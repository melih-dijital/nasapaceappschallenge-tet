import { describe, expect, it } from 'vitest'
import { classify, computeRoundTripMin, reclassifyAlerts } from '@/core/decision/triage'
import { getNumber } from '@/core/evidence/registry'
import type { Alert, EarthDelayClass, Severity } from '@/core/types/alert'
import type { EarthLinkConfig } from '@/core/types/earthlink'
import type { StateId } from '@/core/types/state'

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'AL_TEST',
    crewId: 'CREW_01',
    kind: 'STATE',
    severity: 'WARNING',
    state: 'fatigue',
    titleKey: 'alert.fatigue.title',
    whyKeys: [],
    evidenceIds: [],
    suggestedActionIds: [],
    earthDelayClass: 'ACT_THEN_REPORT',
    confidence: 0.9,
    status: 'ACTIVE',
    firstSeenT: 0,
    lastSeenT: 0,
    ...overrides,
  }
}

describe('Delay-Aware Triage (Faz 7 §3.3)', () => {
  const groundMin = getNumber('earth.groundProcessingMin')
  const moonLink: EarthLinkConfig = {
    preset: 'MOON',
    oneWayDelaySec: getNumber('earth.oneWayDelaySec.moon'),
    blackout: false,
  }
  const marsMinLink: EarthLinkConfig = {
    preset: 'MARS_MIN',
    oneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_min'),
    blackout: false,
  }
  const demoMainLink: EarthLinkConfig = {
    preset: 'CUSTOM',
    oneWayDelaySec: 840, // 14 dk tek yön -> 2*14 + 15 = 43 dk
    blackout: false,
  }
  const marsMaxLink: EarthLinkConfig = {
    preset: 'MARS_MAX',
    oneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_max'),
    blackout: false,
  }
  const blackoutLink: EarthLinkConfig = {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
    blackout: true,
  }

  it('roundTripMin hesabını 2 * tekYönDk + earth.groundProcessingMin ve blackout=Infinity olarak yapar', () => {
    expect(computeRoundTripMin(moonLink)).toBeCloseTo(2 * (1.3 / 60) + groundMin, 5)
    expect(computeRoundTripMin(marsMinLink)).toBe(21)
    expect(computeRoundTripMin(demoMainLink)).toBe(43)
    expect(computeRoundTripMin(marsMaxLink)).toBe(59)
    expect(computeRoundTripMin(blackoutLink)).toBe(Infinity)
  })

  it.each<{
    name: string
    severity: Severity
    state?: StateId
    kind?: Alert['kind']
    timeToHarmMin?: number
    link: EarthLinkConfig
    expected: EarthDelayClass
  }>([
    {
      name: 'INFO + uzun gecikme -> CAN_WAIT_FOR_EARTH',
      severity: 'INFO',
      state: 'fatigue',
      link: marsMaxLink,
      expected: 'CAN_WAIT_FOR_EARTH',
    },
    {
      name: 'INFO + blackout -> CAN_WAIT_FOR_EARTH',
      severity: 'INFO',
      state: 'sleep_debt',
      link: blackoutLink,
      expected: 'CAN_WAIT_FOR_EARTH',
    },
    {
      name: 'WARNING + radiation_event + Moon (RTT ~15 dk, timeToHarm 20 dk) -> ACT_THEN_REPORT',
      severity: 'WARNING',
      state: 'radiation_event',
      kind: 'RADIATION',
      link: moonLink,
      expected: 'ACT_THEN_REPORT',
    },
    {
      name: 'CRITICAL + radiation_event + Moon (gecikmesiz bile) -> ACT_NOW',
      severity: 'CRITICAL',
      state: 'radiation_event',
      kind: 'RADIATION',
      link: moonLink,
      expected: 'ACT_NOW',
    },
    {
      name: 'WARNING + spo2 (timeToHarm 5 dk) + Moon -> ACT_NOW',
      severity: 'WARNING',
      kind: 'LIMIT',
      timeToHarmMin: getNumber('earth.timeToHarmMin.spo2_low'),
      link: moonLink,
      expected: 'ACT_NOW',
    },
    {
      name: 'WARNING + timeToHarm 50 dk + demo_main 14 dk tek yön (43 dk RTT) -> ACT_THEN_REPORT',
      severity: 'WARNING',
      state: 'cardio_strain',
      timeToHarmMin: 50,
      link: demoMainLink,
      expected: 'ACT_THEN_REPORT',
    },
    {
      name: 'WARNING + timeToHarm 50 dk + Mars Max (59 dk RTT) -> ACT_NOW',
      severity: 'WARNING',
      state: 'cardio_strain',
      timeToHarmMin: 50,
      link: marsMaxLink,
      expected: 'ACT_NOW',
    },
    {
      name: 'WARNING + dehydration (480 dk) + Mars Max (59 dk RTT) -> ACT_THEN_REPORT',
      severity: 'WARNING',
      state: 'dehydration',
      link: marsMaxLink,
      expected: 'ACT_THEN_REPORT',
    },
    {
      name: 'WARNING + mood_decline (360 dk) + Mars Max (59 dk RTT) -> ACT_THEN_REPORT',
      severity: 'WARNING',
      state: 'mood_decline',
      link: marsMaxLink,
      expected: 'ACT_THEN_REPORT',
    },
    {
      name: 'WARNING + blackout -> daima ACT_NOW',
      severity: 'WARNING',
      state: 'mood_decline',
      link: blackoutLink,
      expected: 'ACT_NOW',
    },
  ])('$name', ({ severity, state, kind, timeToHarmMin, link, expected }) => {
    const alert = makeAlert({ severity, state, kind: kind ?? 'STATE', timeToHarmMin })
    const result = classify(alert, link)
    expect(result.cls).toBe(expected)
    expect(result.reasonKeys.length).toBeGreaterThanOrEqual(1)
  })

  it('reclassifyAlerts gecikme arttığında ACT_THEN_REPORT uyarısını ACT_NOW yapar ve RESOLVED uyarıya dokunmaz', () => {
    const activeRad = makeAlert({
      id: 'AL_1',
      severity: 'WARNING',
      state: 'radiation_event',
      kind: 'RADIATION',
      earthDelayClass: 'ACT_THEN_REPORT',
    })
    const resolved = makeAlert({
      id: 'AL_2',
      severity: 'WARNING',
      state: 'radiation_event',
      kind: 'RADIATION',
      status: 'RESOLVED',
      earthDelayClass: 'ACT_THEN_REPORT',
    })

    // radiation_event timeToHarmMin = 30 dk <= Mars Max 59 dk RTT -> ACT_NOW
    const next = reclassifyAlerts([activeRad, resolved], marsMaxLink)
    expect(next[0]?.earthDelayClass).toBe('ACT_NOW')
    expect(next[1]?.earthDelayClass).toBe('ACT_THEN_REPORT')
  })
})
