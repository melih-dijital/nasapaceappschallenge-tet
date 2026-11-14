import { describe, expect, it } from 'vitest'
import { getNumber } from '@/core/evidence/registry'
import type { WorkerToUiMessage } from '@/workers/protocol'
import { MockEngine, type MockScheduler } from '@/ui/mock/mockEngine'

/** Sahte zamanlayıcı: gerçek zaman yok, `tick()` ile ilerletilir. */
function fakeScheduler() {
  let callback: (() => void) | null = null
  const scheduler: MockScheduler = {
    every(_intervalMs, cb) {
      callback = cb
      return () => {
        callback = null
      }
    },
  }
  return {
    scheduler,
    tick(times = 1) {
      for (let i = 0; i < times; i++) callback?.()
    },
    get active() {
      return callback !== null
    },
  }
}

function setup() {
  const clock = fakeScheduler()
  const engine = new MockEngine({ scheduler: clock.scheduler })
  const received: WorkerToUiMessage[] = []
  engine.subscribe((message) => received.push(message))
  const ofType = <T extends WorkerToUiMessage['type']>(type: T) =>
    received.filter((m): m is Extract<WorkerToUiMessage, { type: T }> => m.type === type)
  return { clock, engine, received, ofType }
}

describe('MockEngine (EngineClient + protokol, tipli akış)', () => {
  it('INIT → READY + STATUS + SNAPSHOT', () => {
    const { engine, received } = setup()
    engine.send({ type: 'INIT', scenarioId: 'demo_main', speed: 1 })
    expect(received.map((m) => m.type)).toEqual(['READY', 'STATUS', 'SNAPSHOT'])
  })

  it('START → FRAMES_BATCH, ENGINE_OUTPUT (sahte uyarı + kart), ACK ve kart kabulü', () => {
    const { clock, engine, ofType } = setup()
    engine.send({ type: 'INIT', scenarioId: 'demo_main', speed: 1 })
    engine.send({ type: 'SET_SPEED', speedMultiplier: 50 })
    engine.send({ type: 'START' })
    expect(clock.active).toBe(true)
    clock.tick(12) // 50×: tick başına 6 sim-saat → 3 sim-gün

    const frames = ofType('FRAMES_BATCH').flatMap((m) => m.frames)
    expect(frames.length).toBeGreaterThan(0)
    expect(new Set(frames.map((f) => f.metric))).toEqual(
      new Set(['hr', 'spo2', 'hrv', 'rad.doseRateMsvDay']),
    )
    expect(new Set(frames.map((f) => f.crewId))).toEqual(new Set(['cdr', 'md', 'eng', 'sci']))
    expect(frames.every((f) => Number.isFinite(f.value))).toBe(true)

    const opened = ofType('ENGINE_OUTPUT').flatMap((m) => m.output.alertEvents ?? [])
    expect(opened.map((e) => [e.type, e.alert.state, e.alert.severity])).toEqual([
      ['OPENED', 'sleep_debt', 'ADVISORY'],
      ['OPENED', 'radiation_event', 'CRITICAL'],
    ])
    expect(opened[1]?.alert.earthDelayClass).toBe('ACT_NOW')

    engine.send({ type: 'ACK_ALERT', alertId: 'mock-sleep-cdr' })
    const lastOutput = ofType('ENGINE_OUTPUT').at(-1)?.output
    expect(lastOutput?.alertEvents?.[0]).toMatchObject({ type: 'ACKED', alert: { status: 'ACKED' } })

    engine.send({ type: 'ACCEPT_ACTION', cardId: 'card-shelter-sci' })
    const cards = ofType('ENGINE_OUTPUT').at(-1)?.output.cards ?? []
    expect(cards.find((c) => c.id === 'card-shelter-sci')?.state).toBe('ACCEPTED')
  })

  it('hız Evidence sınırlarına kırpılır; PAUSE zamanlayıcıyı durdurur', () => {
    const { clock, engine, ofType } = setup()
    engine.send({ type: 'INIT', scenarioId: 'demo_main', speed: 999 })
    expect(ofType('STATUS').at(-1)?.status.speed).toBe(getNumber('sim.speed.max'))
    engine.send({ type: 'SET_SPEED', speedMultiplier: 0 })
    expect(ofType('STATUS').at(-1)?.status.speed).toBe(getNumber('sim.speed.min'))

    engine.send({ type: 'START' })
    engine.send({ type: 'PAUSE' })
    expect(clock.active).toBe(false)
    expect(ofType('STATUS').at(-1)?.status.running).toBe(false)
  })

  it('deterministik: iki mock aynı akışı üretir', () => {
    const run = () => {
      const { clock, engine, ofType } = setup()
      engine.send({ type: 'INIT', scenarioId: 'demo_main', speed: 20 })
      engine.send({ type: 'START' })
      clock.tick(5)
      return ofType('FRAMES_BATCH').flatMap((m) => m.frames)
    }
    expect(run()).toEqual(run())
  })

  it('REQUEST_VALIDATION → PROGRESS + RESULT; dispose sonrası mesaj yok', () => {
    const { engine, received, ofType } = setup()
    engine.send({ type: 'REQUEST_VALIDATION', quick: true })
    expect(ofType('VALIDATION_PROGRESS')).toEqual([{ type: 'VALIDATION_PROGRESS', done: 1, total: 1 }])
    expect(ofType('VALIDATION_RESULT')).toHaveLength(1)

    engine.dispose()
    const count = received.length
    engine.send({ type: 'INIT', scenarioId: 'nominal', speed: 1 })
    expect(received).toHaveLength(count)
  })
})
