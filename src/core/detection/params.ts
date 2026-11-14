// Algılama parametreleri — hepsi Evidence'tan (PROJECT_MEMORY §7; sihirli sayı yok). Saf TS.
import type { EvidenceRegistry } from '../evidence/registry'
import { METRIC_IDS, STATE_IDS, type MetricId, type Severity, type StateId } from '../types'
import { MS_PER_DAY, minToMs, VITALS_INTERVAL_MIN, MS_PER_HOUR } from '../units'

/** L4 "toplam 1" testine dahil olmayan ek katkı anahtarı (Faz 6). */
export const EXTRA_WEIGHT_KEY = 'trendSlope'

export interface DetectionParams {
  z: { advisory: number; warning: number; critical: number }
  persistFrames: { vitals: number; daily: number }
  cusum: { k: number; h: number }
  trend: {
    sleepMinDays: number
    sleepHoursBelow: number
    exerciseMinDays: number
    exerciseMinutesBelow: number
    theilSenWindowDays: number
    theilSenMinSameSign: number
  }
  state: {
    sigmoidK: number
    sigmoidBias: number
    scoreAdvisory: number
    scoreWarning: number
    scoreCritical: number
  }
  confidenceCap: number
  cooldownMs: number
  recentResolvedMs: number
  guardMs: number
  hrBlockHours: number
  /** state → metrik → ağırlık (yalnızca MetricId anahtarları; trendSlope hariç). */
  weights: Record<StateId, Partial<Record<MetricId, number>>>
  /** Metrik → baskın durum (en yüksek L4 ağırlığı); hiçbir durumda ağırlığı yoksa yok (ör. cabinCo2ppm). */
  metricState: Partial<Record<MetricId, StateId>>
  minScale: Record<MetricId, number>
  /** Kalıcılık / çözülme bekleme süresi (ms): vitals = minFrames × 15 dk, günlük = minFrames × 1 gün. */
  holdMs: { vitals: number; daily: number }
}

export function loadDetectionParams(evidence: EvidenceRegistry): DetectionParams {
  const n = (id: Parameters<EvidenceRegistry['getNumber']>[0]): number => evidence.getNumber(id)

  const weights = {} as Record<StateId, Partial<Record<MetricId, number>>>
  for (const state of STATE_IDS) {
    const prefix = `state.${state}.w.`
    const perMetric: Partial<Record<MetricId, number>> = {}
    for (const entry of evidence.all()) {
      if (!entry.id.startsWith(prefix)) continue
      const key = entry.id.slice(prefix.length)
      if (key === EXTRA_WEIGHT_KEY) continue
      const metric = METRIC_IDS.find((m) => m === key)
      if (metric && !Array.isArray(entry.value)) perMetric[metric] = entry.value
    }
    weights[state] = perMetric
  }

  // Metrik → baskın durum: en yüksek ağırlık; eşitlikte STATE_IDS sırası (deterministik).
  const metricState: Partial<Record<MetricId, StateId>> = {}
  for (const metric of METRIC_IDS) {
    let best: StateId | undefined
    let bestW = 0
    for (const state of STATE_IDS) {
      const w = weights[state][metric] ?? 0
      if (w > bestW) {
        best = state
        bestW = w
      }
    }
    if (best) metricState[metric] = best
  }

  const minScale = {} as Record<MetricId, number>
  for (const metric of METRIC_IDS) minScale[metric] = evidence.getNumber(`minScale.${metric}`)

  const persistVitals = n('det.persist.minFrames.vitals')
  const persistDaily = n('det.persist.minFrames.daily')

  return {
    z: { advisory: n('det.z.advisory'), warning: n('det.z.warning'), critical: n('det.z.critical') },
    persistFrames: { vitals: persistVitals, daily: persistDaily },
    cusum: { k: n('det.cusum.k'), h: n('det.cusum.h') },
    trend: {
      sleepMinDays: n('det.trend.sleep.minDays'),
      sleepHoursBelow: n('det.trend.sleep.hoursBelow'),
      exerciseMinDays: n('det.trend.exercise.minDays'),
      exerciseMinutesBelow: n('det.trend.exercise.minutesBelow'),
      theilSenWindowDays: n('det.theilSen.windowDays'),
      theilSenMinSameSign: n('det.theilSen.minSameSign'),
    },
    state: {
      sigmoidK: n('det.state.sigmoid.k'),
      sigmoidBias: n('det.state.sigmoid.bias'),
      scoreAdvisory: n('det.state.score.advisory'),
      scoreWarning: n('det.state.score.warning'),
      scoreCritical: n('det.state.score.critical'),
    },
    confidenceCap: n('det.confidence.cap.threshold'),
    cooldownMs: minToMs(n('det.cooldownMin')),
    recentResolvedMs: n('alert.recentResolvedHours') * MS_PER_HOUR,
    guardMs: n('baseline.guard.hours') * MS_PER_HOUR,
    hrBlockHours: n('baseline.hrBlockHours'),
    weights,
    metricState,
    minScale,
    holdMs: {
      vitals: persistVitals * minToMs(VITALS_INTERVAL_MIN),
      daily: persistDaily * MS_PER_DAY,
    },
  }
}

const SEVERITY_RANK: Record<Severity, number> = { INFO: 0, ADVISORY: 1, WARNING: 2, CRITICAL: 3 }

export const severityRank = (s: Severity): number => SEVERITY_RANK[s]
export const maxSeverity = (a: Severity, b: Severity): Severity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b
export const minSeverity = (a: Severity, b: Severity): Severity =>
  SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b
export const isWarningPlus = (s: Severity): boolean => SEVERITY_RANK[s] >= SEVERITY_RANK.WARNING
