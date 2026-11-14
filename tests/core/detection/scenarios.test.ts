// Senaryo entegrasyonu (FAZ_05 §3.7 hızlı sürüm; tam ölçüm Faz 8 tests/validation/).
import { describe, expect, it } from 'vitest'
import { BaselineEngine } from '@/core/baseline'
import { DetectionStage } from '@/core/detection'
import { registry } from '@/core/evidence/registry'
import { createDefaultEngine } from '@/core/pipeline'
import type { AlertEvent } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR } from '@/core/units'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'
import { createWorkerHandler } from '@/workers/workerHandler'
import type { WorkerToUiMessage } from '@/workers/protocol'
import { detectedInWindow, runScenario, warningPlusCount } from './helpers'

const allWellFormed = (events: readonly AlertEvent[]): boolean =>
  events.every(
    (e) =>
      Array.isArray(e.alert.whyKeys) &&
      e.alert.whyKeys.length > 0 &&
      e.alert.evidenceIds.length > 0 &&
      Array.isArray(e.alert.suggestedActionIds) &&
      Number.isFinite(e.alert.confidence) &&
      e.alert.evidenceIds.every((id) => registry.has(id)),
  )

const criticalOnlyViaL1OrRadiation = (events: readonly AlertEvent[]): boolean =>
  events
    .filter((e) => e.alert.severity === 'CRITICAL')
    .every((e) => e.alert.kind === 'LIMIT' || e.alert.kind === 'RADIATION' || e.alert.state === 'radiation_event')

describe('senaryo entegrasyonu', () => {
  it('nominal 30 gün × 4 kişi: WARNING+ ≤ val.target.nominalFpPerCrewDay × kişi-gün', () => {
    const { events, crewDays } = runScenario('nominal')
    const target = registry.getNumber('val.target.nominalFpPerCrewDay') * crewDays
    expect(warningPlusCount(events)).toBeLessThanOrEqual(target)
    expect(allWellFormed(events)).toBe(true)
    expect(criticalOnlyViaL1OrRadiation(events)).toBe(true)
  })

  it.each(['sleep_debt', 'isolation_low_mood', 'dehydration_co2', 'comm_blackout'])(
    '%s: her beklenen tespit penceresinde uygun uyarı var',
    (id) => {
      const { events } = runScenario(id)
      for (const exp of getScenario(id).expected) {
        expect(detectedInWindow(events, exp), exp.id).toBe(true)
      }
      expect(allWellFormed(events)).toBe(true)
      expect(criticalOnlyViaL1OrRadiation(events)).toBe(true)
    },
  )

  // Beklenti `radiation_event ≥ WARNING` + `mustBeEarthClass: ACT_NOW`: SPE durum makinesi Faz 6, nihai
  // gecikme-bilinçli triyaj (ACT_NOW) Faz 7'de. Faz 5'te L4 radiation_event CRITICAL üretse de
  // earthDelayClass bilerek varsayılan CAN_WAIT_FOR_EARTH kalır → Faz 6'da etkinleştirilecek (FAZ_05 §3.7).
  it.skip('solar_particle_event: radiation_event ≥ WARNING ve ACT_NOW, +60 sim-dk içinde (Faz 6/7)', () => {
    const { events } = runScenario('solar_particle_event')
    for (const exp of getScenario('solar_particle_event').expected) {
      expect(detectedInWindow(events, exp)).toBe(true)
    }
  })

  it('new_crew_member (düşük baseline güveni): WARNING+ uyarı yok, düşük güven işaretli', () => {
    const { events } = runScenario('new_crew_member')
    expect(warningPlusCount(events)).toBe(0)
    const lowConf = events.filter((e) => e.alert.whyKeys.some((w) => w.key === 'why.baseline.lowConfidence'))
    expect(lowConf.every((e) => e.alert.severity === 'ADVISORY')).toBe(true)
  })

  it('deterministik: aynı seed → aynı uyarı dizisi; batch boyu (15 dk vs 6 sa) sonucu değiştirmez', () => {
    const a = runScenario('sleep_debt', { batchHours: 6 }).events
    const b = runScenario('sleep_debt', { batchHours: 6 }).events
    const c = runScenario('sleep_debt', { batchHours: 0.25 }).events
    const sig = (evs: AlertEvent[]) => evs.map((e) => `${e.t}|${e.type}|${e.alert.id}|${e.alert.severity}`)
    expect(sig(a)).toEqual(sig(b))
    expect(sig(c)).toEqual(sig(a))
  })
})

describe('DetectionStage motor entegrasyonu', () => {
  it('backfill atlanır; canlı akışta states üretilir; snapshot uyarıları ve ACK; WARNING+ → baseline guard', () => {
    const scenario = getScenario('demo_main')
    const sim = new Simulator(scenario)
    const engine = createDefaultEngine()
    const backfillOut = engine.ingest(sim.backfill(), 0)
    expect(backfillOut.alertEvents).toBeUndefined()
    expect(backfillOut.states).toBeUndefined()

    const events: AlertEvent[] = []
    let states = 0
    for (let t = 6 * MS_PER_HOUR; t <= 1.5 * MS_PER_DAY; t += 6 * MS_PER_HOUR) {
      const out = engine.ingest(sim.advanceTo(t), t)
      events.push(...(out.alertEvents ?? []))
      states = out.states?.length ?? 0
    }
    expect(states).toBe(4 * 7)

    // demo_main: CDR gün 0'dan uyku açığı → gün 0 sonunda sleep_debt WARNING
    const sleep = events.find((e) => e.alert.crewId === 'cdr' && e.alert.state === 'sleep_debt')
    expect(sleep?.alert.severity).toBe('WARNING')
    expect(sleep!.t).toBeLessThan(MS_PER_DAY + MS_PER_HOUR)

    const snapAlerts = engine.snapshot().activeAlerts
    expect(snapAlerts.some((a) => a.id === sleep!.alert.id)).toBe(true)
    expect(engine.ackAlert(sleep!.alert.id)).toMatchObject({ type: 'ACKED' })
    expect(engine.snapshot().activeAlerts.find((a) => a.id === sleep!.alert.id)?.status).toBe('ACKED')
  })

  it('WARNING+ açık uyarısı olan kişide baseline guard açılır', () => {
    const stage = new DetectionStage({ evidence: registry })
    expect(stage.runOnBackfill).toBe(false)
    const scenario = getScenario('demo_main')
    const sim = new Simulator(scenario)
    const baselineEngine = new BaselineEngine({ registry })
    const engine = createDefaultEngine({ baselineEngine })
    engine.ingest(sim.backfill(), 0)
    expect(baselineEngine.isGuarded('cdr')).toBe(false)
    engine.ingest(sim.advanceTo(1.25 * MS_PER_DAY), 1.25 * MS_PER_DAY)
    const warnCrews = engine
      .snapshot()
      .activeAlerts.filter((a) => a.severity === 'WARNING' || a.severity === 'CRITICAL')
      .map((a) => a.crewId)
    expect(warnCrews).toContain('cdr')
    // BaselineStage'in motoru scratch üzerinden DetectionStage'e geçer ve guard açılır (baseline donar).
    expect(baselineEngine.isGuarded('cdr')).toBe(true)
  })

  it('worker ACK_ALERT → ENGINE_OUTPUT ACKED olayı', () => {
    const posted: WorkerToUiMessage[] = []
    let tick: (() => void) | null = null
    const handler = createWorkerHandler<number>({
      postMessage: (m) => posted.push(m),
      scheduler: {
        setInterval: (cb) => {
          tick = cb
          return 1
        },
        clearInterval: () => {
          tick = null
        },
      },
    })
    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', speed: 50 })
    handler.handleMessage({ type: 'START' })
    for (let i = 0; i < 6; i++) (tick as (() => void) | null)?.()
    const alertEvents = posted.flatMap((m) => (m.type === 'ENGINE_OUTPUT' ? (m.output.alertEvents ?? []) : []))
    const resolvedIds = new Set(alertEvents.filter((e) => e.type === 'RESOLVED').map((e) => e.alert.id))
    const opened = alertEvents.find((e) => e.type === 'OPENED' && !resolvedIds.has(e.alert.id))
    expect(opened).toBeDefined()
    handler.handleMessage({ type: 'ACK_ALERT', alertId: opened!.alert.id })
    const last = posted.at(-1)
    expect(last?.type).toBe('ENGINE_OUTPUT')
    if (last?.type === 'ENGINE_OUTPUT') expect(last.output.alertEvents?.[0]?.type).toBe('ACKED')
    handler.dispose()
  })

  it('performans: 4 kişi × 15 dk kare başına < 2 ms (esnek)', () => {
    const scenario = getScenario('nominal')
    const sim = new Simulator(scenario)
    const engine = createDefaultEngine()
    engine.ingest(sim.backfill(), 0)
    const steps = 4 * 96
    const start = performance.now()
    for (let i = 1; i <= steps; i++) {
      const t = i * 15 * 60 * 1000
      engine.ingest(sim.advanceTo(t), t)
    }
    const perStep = (performance.now() - start) / steps
    expect(perStep).toBeLessThan(2)
  })
})
