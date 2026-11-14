// FAZ_11 §3.7: sunucu duman testi — yerel ws bağlantısı, çerçeveler geliyor mu, komutlar, Origin kontrolü.
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { isOriginAllowed, startGroundStation, type GroundStation } from '../../server/groundStation'
import { TelemetryFrameSchema } from '../../src/core/schema/frame.schema'
import { WebSocketSource } from '../../src/core/telemetry/webSocketSource'
import { parseServerMessage, type ServerMessage } from '../../src/core/telemetry/wsProtocol'
import type { SourceStatus, TelemetryFrame } from '../../src/core/types'

const nodeTimers = {
  setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimeout: (h: NodeJS.Timeout) => clearTimeout(h),
}

const until = async (cond: () => boolean, timeoutMs = 5000): Promise<void> => {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('zaman aşımı')
    await new Promise((r) => setTimeout(r, 10))
  }
}

let station: GroundStation | null = null
afterEach(async () => {
  await station?.close()
  station = null
})

describe('ground station (ws)', () => {
  it('Origin kontrolü: origin yok ve localhost kabul; bilinmeyen ret; listedeki kabul', () => {
    expect(isOriginAllowed(undefined)).toBe(true)
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:4173')).toBe(true)
    expect(isOriginAllowed('https://evil.example')).toBe(false)
    expect(isOriginAllowed('https://cockpit.example', ['https://cockpit.example'])).toBe(true)
  })

  it('WebSocketSource sunucuya bağlanır: backfill + canlı FRAMES (şemaya uygun), connected, ≤ 10 Hz', async () => {
    station = await startGroundStation({ port: 0, host: '127.0.0.1', scenarioId: 'nominal', speed: 50 })
    const src = new WebSocketSource<NodeJS.Timeout>({
      url: `ws://127.0.0.1:${station.port}`,
      WebSocket,
      timers: nodeTimers,
      speed: 50,
    })
    const batches: { frames: TelemetryFrame[]; simT: number; at: number }[] = []
    const statuses: SourceStatus[] = []
    src.onFrames((frames, simT) => batches.push({ frames, simT, at: Date.now() }))
    src.onStatus((s) => statuses.push(s))
    src.start()

    await until(() => batches.some((b) => b.simT > 0) && batches.filter((b) => b.simT > 0).length >= 5)
    expect(statuses.some((s) => s.connected === true)).toBe(true)
    const backfill = batches.find((b) => b.simT === 0)
    expect(backfill?.frames.length).toBeGreaterThan(0)
    expect(backfill!.frames.every((f) => f.t < 0)).toBe(true)
    for (const b of batches) for (const f of b.frames) expect(TelemetryFrameSchema.safeParse(f).success).toBe(true)

    // ≤ 10 Hz: canlı batch'ler arası ortalama ≥ ~100 ms
    const live = batches.filter((b) => b.simT > 0)
    const span = live.at(-1)!.at - live[0]!.at
    expect(span / (live.length - 1)).toBeGreaterThanOrEqual(80)
    expect(station.getStatus().running).toBe(true)

    src.pause()
    await until(() => station!.getStatus().running === false)
    src.close()
  })

  it('komutlar: SET_SCENARIO / SET_SPEED / RESET; geçersiz komut ERROR; bilinmeyen senaryo ERROR', async () => {
    station = await startGroundStation({ port: 0, host: '127.0.0.1' })
    const ws = new WebSocket(`ws://127.0.0.1:${station.port}`)
    const msgs: ServerMessage[] = []
    ws.on('message', (d: Buffer) => {
      const p = parseServerMessage(d.toString('utf8'))
      if (p.ok) msgs.push(p.data.message)
    })
    await new Promise<void>((r) => ws.once('open', () => r()))
    await until(() => msgs.some((m) => m.type === 'STATUS'))

    ws.send(JSON.stringify({ type: 'SET_SCENARIO', id: 'sleep_debt' }))
    ws.send(JSON.stringify({ type: 'SET_SPEED', speedMultiplier: 20 }))
    await until(() => station!.getStatus().scenarioId === 'sleep_debt' && station!.getStatus().speed === 20)

    ws.send('{"type":"NOPE"}')
    ws.send(JSON.stringify({ type: 'SET_SCENARIO', id: 'no_such' }))
    await until(() => msgs.filter((m) => m.type === 'ERROR').length >= 2)
    expect(station.getStatus().scenarioId).toBe('sleep_debt')

    ws.send(JSON.stringify({ type: 'RESET' }))
    await until(() => msgs.filter((m) => m.type === 'STATUS').length >= 3)
    expect(station.getStatus()).toMatchObject({ simT: 0, running: false })
    ws.close()
  })

  it('izin verilmeyen Origin bağlanamaz', async () => {
    station = await startGroundStation({ port: 0, host: '127.0.0.1' })
    const ws = new WebSocket(`ws://127.0.0.1:${station.port}`, { origin: 'https://evil.example' })
    const result = await new Promise<string>((r) => {
      ws.once('open', () => r('open'))
      ws.once('error', () => r('error'))
    })
    expect(result).toBe('error')
    expect(station.clientCount()).toBe(0)
  })
})
