// FAZ_11 §3.7: WebSocketSource — sahte WebSocket ile geçerli/geçersiz mesaj, yeniden bağlanma, fallback.
import { describe, expect, it } from 'vitest'
import { InProcessSimSource, WebSocketSource, type TelemetrySource, type WsMessageEventLike } from '@/core/telemetry'
import type { SourceStatus, TelemetryFrame, VitalsFrame } from '@/core/types'

type Listener = (ev: WsMessageEventLike) => void

class FakeWs {
  static instances: FakeWs[] = []
  readyState = 0
  sent: unknown[] = []
  closed = false
  private listeners = new Map<string, Listener[]>()
  readonly url: string
  constructor(url: string) {
    this.url = url
    FakeWs.instances.push(this)
  }
  addEventListener(type: string, l: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l])
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as unknown)
  }
  close(): void {
    this.closed = true
  }
  emit(type: string, data?: unknown): void {
    for (const l of this.listeners.get(type) ?? []) l({ data })
  }
  open(): void {
    this.readyState = 1
    this.emit('open')
  }
  drop(): void {
    this.readyState = 3
    this.emit('error')
    this.emit('close')
  }
}

class FakeTimers {
  private seq = 0
  pending = new Map<number, { cb: () => void; ms: number }>()
  delays: number[] = []
  setTimeout = (cb: () => void, ms: number): number => {
    this.pending.set(++this.seq, { cb, ms })
    this.delays.push(ms)
    return this.seq
  }
  clearTimeout = (h: number): void => {
    this.pending.delete(h)
  }
  runAll(): void {
    const all = [...this.pending.entries()]
    this.pending.clear()
    for (const [, t] of all) t.cb()
  }
}

const vitals = (t: number): VitalsFrame => ({
  kind: 'vitals',
  t,
  crewId: 'cdr',
  hr: 62,
  spo2: 0.98,
  hrv: 55,
  source: 'SYNTHETIC',
})
const status = (simT: number): SourceStatus => ({ running: true, simT, day: 0, speed: 1, scenarioId: 'demo_main' })

function setup(extra: Partial<ConstructorParameters<typeof WebSocketSource<number>>[0]> = {}) {
  FakeWs.instances = []
  const timers = new FakeTimers()
  const errors: string[] = []
  const src = new WebSocketSource<number>({
    url: 'ws://localhost:8787',
    WebSocket: FakeWs,
    timers,
    onProtocolError: (e) => errors.push(e),
    ...extra,
  })
  const frames: TelemetryFrame[][] = []
  const statuses: SourceStatus[] = []
  src.onFrames((f) => frames.push(f))
  src.onStatus((s) => statuses.push(s))
  return { src, timers, errors, frames, statuses }
}

describe('WebSocketSource', () => {
  it('start → bağlanır; açılınca hız + START senkronlanır; FRAMES onFrames\'e iletilir; connected yayınlanır', () => {
    const { src, frames, statuses } = setup({ scenarioId: 'sleep_debt', speed: 5 })
    src.start()
    const ws = FakeWs.instances[0]!
    expect(ws.url).toBe('ws://localhost:8787')
    ws.open()
    expect(ws.sent).toEqual([
      { type: 'SET_SCENARIO', id: 'sleep_debt' },
      { type: 'SET_SPEED', speedMultiplier: 5 },
      { type: 'START' },
    ])
    expect(statuses.at(-1)?.connected).toBe(true)

    ws.emit('message', JSON.stringify({ type: 'FRAMES', frames: [vitals(0), vitals(900_000)], simT: 900_000, status: status(900_000) }))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toHaveLength(2)
    expect(src.getStatus()).toMatchObject({ simT: 900_000, connected: true })

    src.setSpeed(20)
    expect(ws.sent.at(-1)).toEqual({ type: 'SET_SPEED', speedMultiplier: 20 })
    src.reset()
    expect(ws.sent.at(-1)).toEqual({ type: 'RESET' })
  })

  it('geçersiz mesajlar atılır: JSON değil, bilinmeyen tür, şemaya uymayan çerçeve (geçerliler iletilir)', () => {
    const { src, errors, frames } = setup()
    src.start()
    const ws = FakeWs.instances[0]!
    ws.open()
    ws.emit('message', 'not json')
    ws.emit('message', JSON.stringify({ type: 'HELLO' }))
    ws.emit('message', new Uint8Array([1, 2]))
    ws.emit(
      'message',
      JSON.stringify({ type: 'FRAMES', simT: 1, frames: [vitals(0), { ...vitals(1), hr: 'fast' }, { kind: 'x' }] }),
    )
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual([vitals(0)])
    expect(src.getStats()).toMatchObject({ protocolErrors: 4, rejectedFrames: 2 })
    expect(errors).toHaveLength(4)
  })

  it('bağlantı koparsa üstel geri çekilmeyle yeniden dener (maks sınırlı); yeniden bağlanınca senaryo sıfırlanmaz', () => {
    const { src, timers, statuses } = setup({ scenarioId: 'nominal', backoff: { initialMs: 100, maxMs: 350, factor: 2 } })
    src.start()
    FakeWs.instances[0]!.open()
    FakeWs.instances[0]!.drop()
    expect(statuses.at(-1)?.connected).toBe(false)
    for (let i = 1; i <= 3; i++) {
      timers.runAll()
      FakeWs.instances[i]!.drop()
    }
    expect(timers.delays).toEqual([100, 200, 350, 350])
    timers.runAll()
    const ws = FakeWs.instances[4]!
    ws.open()
    expect(ws.sent).toEqual([{ type: 'SET_SPEED', speedMultiplier: 1 }, { type: 'START' }])
    expect(src.getStatus().connected).toBe(true)
    expect(src.getMode()).toBe('ws')
  })

  it('fallbackToLocal: N başarısız denemeden sonra yerel simülatöre düşer, akış devam eder (kokpit boş kalmaz)', () => {
    let interval: (() => void) | null = null
    const created: TelemetrySource[] = []
    const { src, timers, frames, statuses } = setup({
      scenarioId: 'nominal',
      fallbackToLocal: true,
      fallbackAfterFailures: 2,
      createLocalSource: (req) => {
        const local = new InProcessSimSource<number>({
          scheduler: {
            setInterval: (cb) => {
              interval = cb
              return 1
            },
            clearInterval: () => {
              interval = null
            },
          },
          scenarioId: req.scenarioId,
          speed: req.speed,
        })
        created.push(local)
        return local
      },
    })
    src.start()
    FakeWs.instances[0]!.drop()
    timers.runAll()
    FakeWs.instances[1]!.drop()
    expect(src.getMode()).toBe('local')
    expect(created).toHaveLength(1)
    expect(timers.pending.size).toBe(0) // yapışkan: yeniden deneme durdu
    // Backfill + canlı tick yerelden gelir
    expect(frames.length).toBeGreaterThan(0)
    const before = frames.length
    ;(interval as (() => void) | null)?.()
    expect(frames.length).toBeGreaterThan(before)
    expect(statuses.at(-1)).toMatchObject({ connected: false, scenarioId: 'nominal' })

    src.setSpeed(20)
    expect(src.getStatus().speed).toBe(20)
    src.close()
    expect(interval).toBeNull()
  })

  it('fallback için createLocalSource zorunlu; close() yeniden denemeyi durdurur', () => {
    expect(() => setup({ fallbackToLocal: true })).toThrow(/createLocalSource/)
    const { src, timers } = setup()
    src.start()
    FakeWs.instances[0]!.drop()
    expect(timers.pending.size).toBe(1)
    src.close()
    expect(timers.pending.size).toBe(0)
  })
})
