// Doğrulama metrikleri birim testleri (FAZ_08 §3.6): TP/FP/FN, pencere sınırları, gecikme medyanı,
// ADVISORY vs WARNING ayrımı, özgüllük, triyaj doğruluğu, parmak izi ve overfitting kontrolü.
import { describe, expect, it } from 'vitest'
import { registry } from '@/core/evidence/registry'
import type { Alert, AlertEvent, CrewId, EarthDelayClass, Severity, StateId } from '@/core/types'
import { minToMs, MS_PER_DAY } from '@/core/units'
import {
  checkOverfitting,
  computeEvidenceFingerprint,
  createOverrideRegistry,
  scoreScenarioRunDetailed,
  type ScenarioRun,
} from '@/core/validation'

function makeAlert(opts: {
  id: string
  crewId?: CrewId
  state?: StateId
  severity?: Severity
  earthDelayClass?: EarthDelayClass
  t?: number
}): Alert {
  const t = opts.t ?? 0
  return {
    id: opts.id,
    crewId: opts.crewId ?? 'cdr',
    kind: 'STATE',
    severity: opts.severity ?? 'WARNING',
    ...(opts.state ? { state: opts.state } : {}),
    titleKey: 'alert.test',
    whyKeys: [{ key: 'why.test', params: {} }],
    evidenceIds: ['det.z.warning'],
    suggestedActionIds: ['ACT_REST_BLOCK'],
    earthDelayClass: opts.earthDelayClass ?? 'ACT_THEN_REPORT',
    confidence: 0.9,
    status: 'ACTIVE',
    firstSeenT: t,
    lastSeenT: t,
  }
}

function makeEvent(
  type: AlertEvent['type'],
  t: number,
  alertOpts: Parameters<typeof makeAlert>[0],
): AlertEvent {
  return {
    type,
    t,
    alert: makeAlert({ ...alertOpts, t }),
  }
}

function baseRun(partial: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    scenarioId: 'test_scenario',
    seed: 1,
    durationDays: 5,
    crewCount: 2,
    crewDays: 10,
    crewIds: ['cdr', 'sci'],
    events: [],
    expected: [],
    alertEvents: [],
    evidenceFingerprint: computeEvidenceFingerprint(),
    ...partial,
  }
}

describe('scoreScenarioRunDetailed', () => {
  it('TP/FP/FN, pencere sınırları, kademeli yükseliş ve gecikme medyanını doğru hesaplar', () => {
    const start1 = 1 * MS_PER_DAY
    const end1 = 2 * MS_PER_DAY
    const start2 = 3 * MS_PER_DAY
    const end2 = 4 * MS_PER_DAY

    const run = baseRun({
      expected: [
        {
          id: 'exp-cdr-sleep',
          crewId: 'cdr',
          state: 'sleep_debt',
          fromT: start1,
          toT: end1,
          minSeverity: 'WARNING',
        },
        {
          id: 'exp-sci-rad',
          crewId: 'sci',
          state: 'radiation_event',
          fromT: start2,
          toT: end2,
          minSeverity: 'WARNING',
          mustBeEarthClass: 'ACT_NOW',
        },
        {
          id: 'exp-cdr-missing',
          crewId: 'cdr',
          state: 'fatigue',
          fromT: start2,
          toT: end2,
          minSeverity: 'WARNING',
        },
      ],
      alertEvents: [
        // ADVISORY açılır (1d+15dk), pencere içinde WARNING'e yükselir (1d+45dk) → firstSeenT = 1d+45dk
        makeEvent('OPENED', start1 + minToMs(15), {
          id: 'cdr|state:sleep_debt#1',
          crewId: 'cdr',
          state: 'sleep_debt',
          severity: 'ADVISORY',
        }),
        makeEvent('UPDATED', start1 + minToMs(45), {
          id: 'cdr|state:sleep_debt#1',
          crewId: 'cdr',
          state: 'sleep_debt',
          severity: 'WARNING',
        }),
        // Tam sınırda (t = end2) CRITICAL + ACT_NOW → latency = 1440 dk; sonra çözülmüş bile olsa ilk eşleşme ACT_NOW
        makeEvent('OPENED', end2, {
          id: 'sci|state:radiation_event#2',
          crewId: 'sci',
          state: 'radiation_event',
          severity: 'CRITICAL',
          earthDelayClass: 'ACT_NOW',
        }),
        makeEvent('UPDATED', end2 + minToMs(30), {
          id: 'sci|state:radiation_event#2',
          crewId: 'sci',
          state: 'radiation_event',
          severity: 'ADVISORY',
          earthDelayClass: 'CAN_WAIT_FOR_EARTH',
        }),
        // Eşleşmeyen WARNING → FP
        makeEvent('OPENED', 0.5 * MS_PER_DAY, {
          id: 'sci|state:stress#3',
          crewId: 'sci',
          state: 'stress',
          severity: 'WARNING',
        }),
        makeEvent('RESOLVED', 0.6 * MS_PER_DAY, {
          id: 'sci|state:stress#3',
          crewId: 'sci',
          state: 'stress',
          severity: 'WARNING',
        }),
        // Eşleşmeyen ADVISORY → yalnız advisoryCount, FP'ye KATILMAZ
        makeEvent('OPENED', 2.2 * MS_PER_DAY, {
          id: 'cdr|state:dehydration#4',
          crewId: 'cdr',
          state: 'dehydration',
          severity: 'ADVISORY',
        }),
        makeEvent('OPENED', 2.5 * MS_PER_DAY, {
          id: 'sci|state:fatigue#5',
          crewId: 'sci',
          state: 'fatigue',
          severity: 'ADVISORY',
        }),
      ],
    })

    const detail = scoreScenarioRunDetailed(run)
    expect(detail.score.tp).toBe(2)
    expect(detail.score.fn).toBe(1)
    expect(detail.score.fp).toBe(1)
    expect(detail.score.advisoryCount).toBe(2)
    expect(detail.score.recall).toBeCloseTo(2 / 3)
    expect(detail.score.precision).toBeCloseTo(2 / 3)
    expect(detail.score.triageChecked).toBe(1)
    expect(detail.score.triagePassed).toBe(1)
    expect(detail.score.triageAccuracy).toBe(1)
    // Medyan([45 dk, 1440 dk]) = 742.5 dk
    expect(detail.score.medianLatencyMin).toBeCloseTo(742.5)
  })

  it('pencereden önce açılan uyarı firstSeenT kuralına göre TP sayılmaz (FN), ADVISORY özgüllüğü düşürmez', () => {
    const preOpenRun = baseRun({
      scenarioId: 'sleep_debt',
      durationDays: 2,
      crewCount: 2,
      crewDays: 4,
      crewIds: ['cdr', 'sci'],
      expected: [
        {
          id: 'exp-late',
          crewId: 'cdr',
          state: 'sleep_debt',
          fromT: 1 * MS_PER_DAY,
          toT: 1.5 * MS_PER_DAY,
          minSeverity: 'WARNING',
        },
      ],
      alertEvents: [
        // fromT'den önce WARNING olarak açılmış → firstSeenT < fromT olduğu için TP DEĞİL
        makeEvent('OPENED', 0.9 * MS_PER_DAY, {
          id: 'cdr|state:sleep_debt#1',
          crewId: 'cdr',
          state: 'sleep_debt',
          severity: 'WARNING',
        }),
      ],
    })

    const preOpenDetail = scoreScenarioRunDetailed(preOpenRun)
    expect(preOpenDetail.score.tp).toBe(0)
    expect(preOpenDetail.score.fn).toBe(1)

    // Nominal senaryoda eşleşmeyen ADVISORY tek başına FP sayılmaz ve uyarısız günü bozmaz
    const nominalAdvisoryRun = baseRun({
      scenarioId: 'nominal',
      durationDays: 2,
      crewCount: 2,
      crewDays: 4,
      crewIds: ['cdr', 'sci'],
      expected: [],
      alertEvents: [
        makeEvent('OPENED', 0.2 * MS_PER_DAY, {
          id: 'sci|state:fatigue#2',
          crewId: 'sci',
          state: 'fatigue',
          severity: 'ADVISORY',
        }),
      ],
    })

    const nominalDetail = scoreScenarioRunDetailed(nominalAdvisoryRun)
    expect(nominalDetail.score.fp).toBe(0)
    expect(nominalDetail.score.advisoryCount).toBe(1)
    expect(nominalDetail.score.specificity).toBe(1)
    expect(nominalDetail.score.nominalAlertFreeDayPct).toBe(100)
  })
})

describe('parmak izi ve overfitting yardımcıları', () => {
  it('DEMO parametresi değişince evidenceFingerprint değişir, kalıcı registry bozulmaz', () => {
    const baseFp = computeEvidenceFingerprint(registry)
    const baseZ = registry.getNumber('det.z.warning')
    const overridden = createOverrideRegistry(registry, { 'det.z.warning': baseZ + 0.5 })
    const nextFp = computeEvidenceFingerprint(overridden)

    expect(nextFp).not.toBe(baseFp)
    expect(overridden.getNumber('det.z.warning')).toBe(baseZ + 0.5)
    expect(registry.getNumber('det.z.warning')).toBe(baseZ)
  })

  it('checkOverfitting belirgin recall düşüşünde overfitting uyarısı üretir', () => {
    const gap = registry.getNumber('val.overfit.recallGap')
    expect(checkOverfitting(0.95, 0.7, gap)).toMatchObject({
      detected: true,
      threshold: gap,
    })
    expect(checkOverfitting(0.92, 0.88, gap)).toMatchObject({
      detected: false,
      threshold: gap,
    })
  })
})
