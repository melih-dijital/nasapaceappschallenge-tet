import { describe, expect, it } from 'vitest'
import { AlertManager, L2Detector, loadDetectionParams, type StateHit } from '@/core/detection'
import type { L2Hit } from '@/core/detection'
import { registry } from '@/core/evidence/registry'
import type { Severity, StateEstimate } from '@/core/types'
import { MS_PER_MIN } from '@/core/units'

const params = loadDetectionParams(registry)
const STEP = 15 * MS_PER_MIN
const empty = { l1: [], l2: [], l3: [], states: [] }

const l2Hit = (severity: Severity, t: number, over: Partial<L2Hit> = {}): L2Hit => ({
  crewId: 'eng',
  metric: 'hr',
  t,
  severity,
  z: 3.5,
  zBad: 3.5,
  persistFrames: params.persistFrames.vitals,
  baselineConfidence: 1,
  lowBaselineConfidence: false,
  ...over,
})

const stateHit = (severity: Severity, t: number): StateHit => {
  const estimate: StateEstimate = {
    crewId: 'eng',
    t,
    state: 'cardio_strain',
    score: 0.8,
    confidence: 0.9,
    contributors: [{ metric: 'hr', weight: 1, z: 3.5, contribution: 0.8 }],
  }
  return { estimate, severity }
}

describe('AlertManager', () => {
  it('birleştirme: aynı kişi+durum için L2 ve L4 tek uyarı; alanlar eksiksiz', () => {
    const m = new AlertManager(params, registry)
    const events = m.step(0, { ...empty, l2: [l2Hit('WARNING', 0)], states: [stateHit('ADVISORY', 0)] })
    expect(events).toHaveLength(1)
    const a = events[0]!.alert
    expect(events[0]!.type).toBe('OPENED')
    expect(a).toMatchObject({ crewId: 'eng', state: 'cardio_strain', severity: 'WARNING', status: 'ACTIVE' })
    expect(a.whyKeys.map((w) => w.key)).toEqual(expect.arrayContaining(['why.l2.deviation', 'why.state.score']))
    expect(a.evidenceIds).toEqual(expect.arrayContaining(['det.z.warning', 'earth.timeToHarmMin.cardio_strain']))
    expect(a.suggestedActionIds).toEqual(['ACT_REST_BLOCK', 'ACT_CARDIO_CHECK'])
    expect(a.timeToHarmMin).toBe(registry.getNumber('earth.timeToHarmMin.cardio_strain'))
    expect(a.earthDelayClass).toBe('CAN_WAIT_FOR_EARTH')
    expect(a.confidence).toBeGreaterThan(0)
  })

  it('CRITICAL yalnızca L1/radiation_event: L2 z-kritik düzeyi WARNING ile sınırlanır', () => {
    const m = new AlertManager(params, registry)
    const [ev] = m.step(0, { ...empty, l2: [l2Hit('CRITICAL', 0)] })
    expect(ev!.alert.severity).toBe('WARNING')
  })

  it('histerezis: artış hemen UPDATED, azalış hold süresi sonra kademeli; ACKED artışta ACTIVE olur', () => {
    const m = new AlertManager(params, registry)
    const id = m.step(0, { ...empty, l2: [l2Hit('ADVISORY', 0)] })[0]!.alert.id
    expect(m.ack(id, STEP)).toMatchObject({ type: 'ACKED', alert: { status: 'ACKED', ackT: STEP } })
    expect(m.ack(id, STEP)).toBeNull()

    const up = m.step(2 * STEP, { ...empty, l2: [l2Hit('WARNING', 2 * STEP)] })
    expect(up[0]).toMatchObject({ type: 'UPDATED', alert: { severity: 'WARNING', status: 'ACTIVE' } })

    // ADVISORY'ye düşüş: hold (det.persist.minFrames.vitals × 15 dk) dolana kadar WARNING kalır
    const hold = params.holdMs.vitals
    let t = 3 * STEP
    const lowered = m.step(t, { ...empty, l2: [l2Hit('ADVISORY', t)] })
    expect(lowered).toEqual([])
    t += hold
    const down = m.step(t, { ...empty, l2: [l2Hit('ADVISORY', t)] })
    expect(down[0]).toMatchObject({ type: 'UPDATED', alert: { severity: 'ADVISORY' } })
  })

  it('çözülme hold süresi sonra; soğuma içinde aynı/küçük severity tekrar OPENED olmaz, sonra olur', () => {
    const m = new AlertManager(params, registry)
    m.step(0, { ...empty, l2: [l2Hit('ADVISORY', 0)] })
    expect(m.step(STEP, empty)).toEqual([])
    const resolved = m.step(STEP + params.holdMs.vitals, empty)
    expect(resolved[0]).toMatchObject({ type: 'RESOLVED', alert: { status: 'RESOLVED' } })
    const resolvedT = resolved[0]!.t

    expect(m.step(resolvedT + STEP, { ...empty, l2: [l2Hit('ADVISORY', resolvedT + STEP)] })).toEqual([])
    const later = resolvedT + params.cooldownMs
    const reopened = m.step(later, { ...empty, l2: [l2Hit('ADVISORY', later)] })
    expect(reopened[0]?.type).toBe('OPENED')
    expect(reopened[0]?.alert.id).not.toBe(resolved[0]?.alert.id)
  })

  it('soğuma içinde daha yüksek severity yeniden açılır (güvenlik)', () => {
    const m = new AlertManager(params, registry)
    m.step(0, { ...empty, l2: [l2Hit('ADVISORY', 0)] })
    m.step(STEP, empty) // yokluk bu adımdan sayılır
    const r = m.step(STEP + params.holdMs.vitals, empty)[0]!
    const opened = m.step(r.t + STEP, { ...empty, l2: [l2Hit('WARNING', r.t + STEP)] })
    expect(opened[0]).toMatchObject({ type: 'OPENED', alert: { severity: 'WARNING' } })
  })

  it('listAlerts: açık + son alert.recentResolvedHours içinde çözülmüşler', () => {
    const m = new AlertManager(params, registry)
    m.step(0, { ...empty, l2: [l2Hit('ADVISORY', 0)] })
    expect(m.listAlerts(0).map((a) => a.status)).toEqual(['ACTIVE'])
    m.step(STEP, empty)
    const r = m.step(STEP + params.holdMs.vitals, empty)[0]!
    expect(m.listAlerts(r.t).map((a) => a.status)).toEqual(['RESOLVED'])
    expect(m.listAlerts(r.t + params.recentResolvedMs + STEP)).toEqual([])
    m.step(r.t + params.recentResolvedMs + STEP, empty)
    expect(m.listAlerts(r.t + params.recentResolvedMs + STEP)).toEqual([])
  })

  it('L2Detector + AlertManager: guard için WARNING+ bilgisi', () => {
    const l2 = new L2Detector(params)
    const m = new AlertManager(params, registry)
    for (let i = 0; i < params.persistFrames.vitals; i++) {
      const hit = l2.process({
        crewId: 'eng',
        metric: 'hr',
        t: i * STEP,
        value: 0,
        z: params.z.warning + 0.5,
        confidence: 1,
        baselineMedian: 60,
        baselineSigma: 3,
      })
      m.step(i * STEP, { ...empty, l2: hit ? [hit] : [] })
    }
    expect(m.hasWarningPlus('eng')).toBe(true)
    expect(m.hasWarningPlus('cdr')).toBe(false)
  })
})
