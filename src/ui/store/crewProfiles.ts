// FAZ 9 — Kişi profilleri, senaryo üstverileri ve deterministik backfill yardımcıları (mock modunda).
// Gerçek kişi adı yoktur (FAZ_02 §3.4 kurgusal adları); Math.random kullanılmaz (PROJECT_MEMORY §10).
import { getMid, getNumber } from '@/core/evidence/registry'
import type { CrewId, CrewProfile, MetricId, ScenarioId } from '@/core/types'
import { MIN_PER_DAY, minToMs, msToMin, MS_PER_DAY, VITALS_INTERVAL_MIN } from '@/core/units'
import type { I18nKey } from '@/ui/i18n'
import type { SeriesPoint } from './decimate'

export interface ScenarioMeta {
  id: ScenarioId
  titleKey: I18nKey
  backfillDays: number
  durationDays: number
  defaultOneWayDelaySec: number
}

export interface BookmarkMeta {
  index: number
  labelKey: I18nKey
  day: number
}

export const UI_SCENARIOS: readonly ScenarioMeta[] = [
  {
    id: 'demo_main',
    titleKey: 'scenario.demo_main.title',
    backfillDays: 14,
    durationDays: 3,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_min'),
  },
  {
    id: 'nominal',
    titleKey: 'scenario.nominal.title',
    backfillDays: 14,
    durationDays: 30,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_min'),
  },
  {
    id: 'solar_particle_event',
    titleKey: 'scenario.solar_particle_event.title',
    backfillDays: 14,
    durationDays: 7,
    defaultOneWayDelaySec: 840,
  },
  {
    id: 'sleep_debt',
    titleKey: 'scenario.sleep_debt.title',
    backfillDays: 14,
    durationDays: 12,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_min'),
  },
  {
    id: 'isolation_low_mood',
    titleKey: 'scenario.isolation_low_mood.title',
    backfillDays: 14,
    durationDays: 14,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_max'),
  },
  {
    id: 'dehydration_co2',
    titleKey: 'scenario.dehydration_co2.title',
    backfillDays: 14,
    durationDays: 10,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_min'),
  },
  {
    id: 'comm_blackout',
    titleKey: 'scenario.comm_blackout.title',
    backfillDays: 14,
    durationDays: 7,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.mars_max'),
  },
  {
    id: 'new_crew_member',
    titleKey: 'scenario.new_crew_member.title',
    backfillDays: getNumber('baseline.window.days.min'),
    durationDays: 3,
    defaultOneWayDelaySec: getNumber('earth.oneWayDelaySec.moon'),
  },
] as const

export const DEMO_MAIN_BOOKMARKS: readonly BookmarkMeta[] = [
  { index: 0, labelKey: 'bookmark.demo_main.0', day: 0 },
  { index: 1, labelKey: 'bookmark.demo_main.1', day: 1 },
  { index: 2, labelKey: 'bookmark.demo_main.2', day: 2 },
  { index: 3, labelKey: 'bookmark.demo_main.3', day: 3 },
] as const

export const CREW_PROFILES: readonly (CrewProfile & { phase: number })[] = [
  {
    id: 'cdr',
    displayName: 'Cmdr. A. Rivera',
    role: 'CDR',
    ageBand: '40-49',
    priorCareerDoseMsv: 142,
    phase: 0.3,
    circadianAmplitudeHr: 6,
    sleepWindow: { startMin: 1350, durationMin: 480 }, // 22:30 – 06:30
    baselines: {
      hr: { mean: 58, withinSd: 3.5 },
      spo2: { mean: 97.6, withinSd: 0.5 },
      hrv: { mean: 62, withinSd: 5.5 },
      'sleep.durationH': { mean: 6.8, withinSd: 0.45 },
      'sleep.efficiency': { mean: 0.88, withinSd: 0.04 },
      'sleep.midpointShiftMin': { mean: 8, withinSd: 18 },
      'activity.exerciseMin': { mean: 75, withinSd: 10 },
      'activity.resistiveMin': { mean: 45, withinSd: 8 },
      hydrationL: { mean: 2.6, withinSd: 0.25 },
      'mood.stress': { mean: 3.2, withinSd: 0.8 },
      'mood.mood': { mean: 7.6, withinSd: 0.8 },
      'mood.motivation': { mean: 8.1, withinSd: 0.8 },
      'rad.doseRateMsvDay': { mean: 0.35, withinSd: 0.03 },
    },
  },
  {
    id: 'md',
    displayName: 'Dr. M. Okafor',
    role: 'MD',
    ageBand: '30-39',
    priorCareerDoseMsv: 88,
    phase: 1.1,
    circadianAmplitudeHr: 6,
    sleepWindow: { startMin: 1380, durationMin: 480 }, // 23:00 – 07:00
    baselines: {
      hr: { mean: 62, withinSd: 3.8 },
      spo2: { mean: 97.9, withinSd: 0.5 },
      hrv: { mean: 55, withinSd: 5.2 },
      'sleep.durationH': { mean: 7.1, withinSd: 0.4 },
      'sleep.efficiency': { mean: 0.9, withinSd: 0.04 },
      'sleep.midpointShiftMin': { mean: 6, withinSd: 16 },
      'activity.exerciseMin': { mean: 80, withinSd: 10 },
      'activity.resistiveMin': { mean: 48, withinSd: 8 },
      hydrationL: { mean: 2.8, withinSd: 0.25 },
      'mood.stress': { mean: 2.9, withinSd: 0.8 },
      'mood.mood': { mean: 7.9, withinSd: 0.8 },
      'mood.motivation': { mean: 8.3, withinSd: 0.8 },
      'rad.doseRateMsvDay': { mean: 0.35, withinSd: 0.03 },
    },
  },
  {
    id: 'eng',
    displayName: 'Eng. L. Chen',
    role: 'ENG',
    ageBand: '30-39',
    priorCareerDoseMsv: 64,
    phase: 2.2,
    circadianAmplitudeHr: 6,
    sleepWindow: { startMin: 1320, durationMin: 465 }, // 22:00 – 05:45
    baselines: {
      hr: { mean: 66, withinSd: 4.0 },
      spo2: { mean: 97.3, withinSd: 0.5 },
      hrv: { mean: 48, withinSd: 5.0 },
      'sleep.durationH': { mean: 6.6, withinSd: 0.5 },
      'sleep.efficiency': { mean: 0.86, withinSd: 0.04 },
      'sleep.midpointShiftMin': { mean: 11, withinSd: 20 },
      'activity.exerciseMin': { mean: 70, withinSd: 10 },
      'activity.resistiveMin': { mean: 42, withinSd: 8 },
      hydrationL: { mean: 2.5, withinSd: 0.25 },
      'mood.stress': { mean: 3.6, withinSd: 0.8 },
      'mood.mood': { mean: 7.3, withinSd: 0.8 },
      'mood.motivation': { mean: 7.8, withinSd: 0.8 },
      'rad.doseRateMsvDay': { mean: 0.35, withinSd: 0.03 },
    },
  },
  {
    id: 'sci',
    displayName: 'Sci. T. Yılmaz',
    role: 'SCI',
    ageBand: '40-49',
    priorCareerDoseMsv: 115,
    phase: 3.4,
    circadianAmplitudeHr: 6,
    sleepWindow: { startMin: 1365, durationMin: 480 }, // 22:45 – 06:45
    baselines: {
      hr: { mean: 70, withinSd: 4.2 },
      spo2: { mean: 97.7, withinSd: 0.5 },
      hrv: { mean: 44, withinSd: 5.0 },
      'sleep.durationH': { mean: 6.9, withinSd: 0.45 },
      'sleep.efficiency': { mean: 0.87, withinSd: 0.04 },
      'sleep.midpointShiftMin': { mean: 9, withinSd: 18 },
      'activity.exerciseMin': { mean: 72, withinSd: 10 },
      'activity.resistiveMin': { mean: 44, withinSd: 8 },
      hydrationL: { mean: 2.6, withinSd: 0.25 },
      'mood.stress': { mean: 3.4, withinSd: 0.8 },
      'mood.mood': { mean: 7.4, withinSd: 0.8 },
      'mood.motivation': { mean: 7.9, withinSd: 0.8 },
      'rad.doseRateMsvDay': { mean: 0.35, withinSd: 0.03 },
    },
  },
] as const

export interface DailySleepEntry {
  day: number
  label: string
  durationH: number
  baselineH: number
  debtH: number
  exerciseMin: number
  resistiveMin: number
}

export interface CrewRadiationSummary {
  crewId: CrewId
  priorCareerDoseMsv: number
  cumulativeMissionMsv: number
  careerMsv: number
  careerLimitMsv: number
  careerFraction: number
  currentRateMsvDay: number
  baselineRateMsvDay: number
  speState: 'IDLE' | 'SUSPECTED' | 'CONFIRMED' | 'DECAYING'
  speDoseMsv: number
  speTargetMsv: number
  speFractionOfLimit: number
}

export interface CrewBoneSummary {
  crewId: CrewId
  estimatedMonthlyLossPct: number
  estimatedCumulativeLossPct: number
  resistiveAdherence7d: number
  isEstimate: true
}

export interface CrewMetricBaseline {
  crewId: CrewId
  metric: MetricId
  median: number
  sigma: number
  confidence: number
  learningDay: number
  targetDays: number
}

/** Deterministik sözde-gürültü (mockEngine.ts ile birebir). */
export const deterministicWobble = (t: number, phase: number): number => {
  const m = msToMin(t)
  return (
    0.6 * Math.sin(m / 37 + phase) +
    0.3 * Math.sin(m / 11.3 + 2 * phase) +
    0.1 * Math.sin(m / 3.7)
  )
}

/** Gün içi sirkadiyen ritim (mockEngine.ts ile birebir). */
export const deterministicCircadian = (t: number, phase: number): number => {
  const modMin = ((msToMin(t) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
  return Math.sin((2 * Math.PI * modMin) / MIN_PER_DAY + phase)
}

export function getCrewProfile(crewId: CrewId): (CrewProfile & { phase: number }) {
  return CREW_PROFILES.find((c) => c.id === crewId) ?? CREW_PROFILES[0]!
}

export function getScenarioMeta(scenarioId: ScenarioId): ScenarioMeta {
  return UI_SCENARIOS.find((s) => s.id === scenarioId) ?? UI_SCENARIOS[0]!
}

/**
 * Son 24 simüle saat için başlangıç (t ∈ [-24h, 0]) vitals/radyasyon serisini üretir.
 * Böylece kokpit açılır açılmaz (t=0) grafiklerde 24 saatlik geçmiş hazır görünür.
 */
export function buildInitialVitalsSeries(
  crew: CrewProfile & { phase: number },
): Record<'hr' | 'spo2' | 'hrv' | 'rad.doseRateMsvDay', SeriesPoint[]> {
  const stepMs = minToMs(VITALS_INTERVAL_MIN)
  const startMs = -MS_PER_DAY
  const hrPts: SeriesPoint[] = []
  const spo2Pts: SeriesPoint[] = []
  const hrvPts: SeriesPoint[] = []
  const radPts: SeriesPoint[] = []

  const baseHr = crew.baselines.hr?.mean ?? 62
  const baseSpo2 = crew.baselines.spo2?.mean ?? 97.6
  const baseHrv = crew.baselines.hrv?.mean ?? 54
  const baseRad = crew.baselines['rad.doseRateMsvDay']?.mean ?? 0.35

  for (let t = startMs; t <= 0; t += stepMs) {
    const c = deterministicCircadian(t, crew.phase)
    const w0 = deterministicWobble(t, crew.phase)
    const w1 = deterministicWobble(t, crew.phase + 1)
    const w2 = deterministicWobble(t, crew.phase + 2)
    const w3 = deterministicWobble(t, crew.phase + 3)

    hrPts.push({ t, value: Number((baseHr + 6 * c + 2 * w0).toFixed(1)) })
    spo2Pts.push({ t, value: Number(Math.min(100, baseSpo2 + 0.4 * w1).toFixed(2)) })
    hrvPts.push({ t, value: Number((baseHrv - 5 * c + 3 * w2).toFixed(1)) })
    radPts.push({ t, value: Number(Math.max(0.05, baseRad + 0.02 * w3).toFixed(3)) })
  }

  return {
    hr: hrPts,
    spo2: spo2Pts,
    hrv: hrvPts,
    'rad.doseRateMsvDay': radPts,
  }
}

/**
 * Son 14 gün için uyku + aktivite geçmişini üretir (FAZ 6 §4.2 uyku borcu formülüyle).
 */
export function buildSleepHistory(
  crew: CrewProfile & { phase: number },
  currentSimDay: number,
  scenarioId: ScenarioId,
): DailySleepEntry[] {
  const targetDays = getNumber('baseline.window.days.target')
  const decay = getNumber('sleep.debt.decay')
  const baseSleep = crew.baselines['sleep.durationH']?.mean ?? 6.8
  const baseEx = crew.baselines['activity.exerciseMin']?.mean ?? 75
  const baseRes = crew.baselines['activity.resistiveMin']?.mean ?? 45

  const entries: DailySleepEntry[] = []
  let runningDebt = 0

  const startDay = currentSimDay - (targetDays - 1)
  for (let d = startDay; d <= currentSimDay; d++) {
    const w = Math.sin(d * 1.3 + crew.phase) * 0.35 + Math.cos(d * 0.7 + crew.phase) * 0.2
    const isSleepDeficitEvent =
      crew.id === 'cdr' &&
      (scenarioId === 'demo_main' || scenarioId === 'sleep_debt') &&
      d >= 0
    const durationH = Number(
      Math.max(3.8, baseSleep + w - (isSleepDeficitEvent ? 2.1 : 0)).toFixed(2),
    )
    runningDebt = Math.max(0, runningDebt * decay + (baseSleep - durationH))
    const exerciseMin = Math.round(Math.max(20, baseEx + Math.sin(d + crew.phase) * 12))
    const resistiveMin = Math.round(Math.max(15, baseRes + Math.cos(d + crew.phase) * 8))
    const label = d >= 0 ? `D+${String(d).padStart(2, '0')}` : `D-${String(Math.abs(d)).padStart(2, '0')}`

    entries.push({
      day: d,
      label,
      durationH,
      baselineH: baseSleep,
      debtH: Number(runningDebt.toFixed(2)),
      exerciseMin,
      resistiveMin,
    })
  }
  return entries
}

/**
 * Kemik kaybı TAHMİNİ (FAZ 6 §4.3 formülü: mid(bone.loss.pct_month) * (1 - efficacy * adherence)).
 */
export function computeBoneSummary(
  crew: CrewProfile & { phase: number },
  simDay: number,
): CrewBoneSummary {
  const baseLossMonth = getMid('bone.loss.pct_month')
  const efficacy = getNumber('bone.estimate.efficacy')
  const adherence = Math.min(
    1,
    Math.max(0.55, 0.88 - 0.08 * Math.abs(Math.sin(crew.phase + Math.max(0, simDay) * 0.2))),
  )
  const monthlyLoss = baseLossMonth * (1 - efficacy * adherence)
  const missionDaysElapsed = Math.max(1, simDay + 1)
  const cumulativeLoss = (monthlyLoss * missionDaysElapsed) / 30

  return {
    crewId: crew.id,
    estimatedMonthlyLossPct: Number(monthlyLoss.toFixed(2)),
    estimatedCumulativeLossPct: Number(cumulativeLoss.toFixed(3)),
    resistiveAdherence7d: Number(adherence.toFixed(2)),
    isEstimate: true,
  }
}
