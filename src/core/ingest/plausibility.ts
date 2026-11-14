// Fiziksel makullük kontrolü (FAZ_03 §3.1). Saf TS; aralıklar kalibrasyondan okunur, kodda sabit eşik yok.
import { getCalibrationData } from '../../sim/calibration'
import { METRIC_IDS, type CrewId, type MetricId, type SimTimeMs, type TelemetryFrame } from '../types'

export interface PlausibilityRange {
  plausibleMin: number
  plausibleMax: number
}

export type PlausibleRanges = Partial<Record<MetricId, PlausibilityRange>>

export interface PlausibilityIssue {
  metric: MetricId | 'protonFluxPfu' | 't' | 'day'
  value: number
  min?: number
  max?: number
  reason: 'NON_FINITE' | 'BELOW_MIN' | 'ABOVE_MAX'
}

export type DataQualityKind =
  | 'PLAUSIBILITY_REJECTED'
  | 'SCHEMA_INVALID'
  | 'NON_MONOTONIC_TIME'
  | 'DUPLICATE_FRAME'
  | 'STALE_SENSOR'
  | 'STORAGE_WARNING'
  | 'ENGINE_FAULT'

export interface DataQualityEvent {
  id: string
  kind: DataQualityKind
  t: SimTimeMs
  crewId?: CrewId
  metric?: MetricId
  frameKind?: TelemetryFrame['kind']
  detail: string
  value?: number
}

export function getDefaultPlausibleRanges(): Record<MetricId, PlausibilityRange> {
  const cal = getCalibrationData().metrics
  const ranges = {} as Record<MetricId, PlausibilityRange>
  for (const metric of METRIC_IDS) {
    ranges[metric] = {
      plausibleMin: cal[metric].plausibleMin,
      plausibleMax: cal[metric].plausibleMax,
    }
  }
  return ranges
}

function checkMetricValue(
  metric: MetricId,
  value: number,
  ranges: PlausibleRanges,
  issues: PlausibilityIssue[],
): void {
  if (!Number.isFinite(value)) {
    issues.push({ metric, value, reason: 'NON_FINITE' })
    return
  }
  const range = ranges[metric]
  if (!range) return
  if (value < range.plausibleMin) {
    issues.push({
      metric,
      value,
      min: range.plausibleMin,
      max: range.plausibleMax,
      reason: 'BELOW_MIN',
    })
  } else if (value > range.plausibleMax) {
    issues.push({
      metric,
      value,
      min: range.plausibleMin,
      max: range.plausibleMax,
      reason: 'ABOVE_MAX',
    })
  }
}

/**
 * Fiziksel olarak imkânsız değerleri reddeder; "garip ama mümkün" değerleri kabul eder.
 * Giriş doğrulaması sağlık kurallarından ayrıdır.
 */
export function checkFrame(
  frame: TelemetryFrame,
  ranges: PlausibleRanges = getDefaultPlausibleRanges(),
): { ok: boolean; issues: PlausibilityIssue[] } {
  const issues: PlausibilityIssue[] = []

  if (!Number.isFinite(frame.t)) {
    issues.push({ metric: 't', value: frame.t, reason: 'NON_FINITE' })
  }

  if (frame.kind === 'vitals') {
    checkMetricValue('hr', frame.hr, ranges, issues)
    checkMetricValue('spo2', frame.spo2, ranges, issues)
    if (frame.hrv !== undefined) {
      checkMetricValue('hrv', frame.hrv, ranges, issues)
    }
  } else if (frame.kind === 'radiation') {
    checkMetricValue('rad.doseRateMsvDay', frame.doseRateMsvDay, ranges, issues)
    if (frame.protonFluxPfu !== undefined) {
      if (!Number.isFinite(frame.protonFluxPfu)) {
        issues.push({ metric: 'protonFluxPfu', value: frame.protonFluxPfu, reason: 'NON_FINITE' })
      } else if (frame.protonFluxPfu < 0) {
        issues.push({ metric: 'protonFluxPfu', value: frame.protonFluxPfu, min: 0, reason: 'BELOW_MIN' })
      }
    }
  } else {
    if (!Number.isFinite(frame.day)) {
      issues.push({ metric: 'day', value: frame.day, reason: 'NON_FINITE' })
    }
    checkMetricValue('sleep.durationH', frame.sleep.durationH, ranges, issues)
    checkMetricValue('sleep.efficiency', frame.sleep.efficiency, ranges, issues)
    checkMetricValue('sleep.midpointShiftMin', frame.sleep.midpointShiftMin, ranges, issues)
    checkMetricValue('activity.exerciseMin', frame.activity.exerciseMin, ranges, issues)
    checkMetricValue('activity.resistiveMin', frame.activity.resistiveMin, ranges, issues)
    checkMetricValue('hydrationL', frame.hydrationL, ranges, issues)
    if (frame.cabinCo2ppm !== undefined) {
      checkMetricValue('cabinCo2ppm', frame.cabinCo2ppm, ranges, issues)
    }
    if (frame.mood) {
      checkMetricValue('mood.stress', frame.mood.stress, ranges, issues)
      checkMetricValue('mood.mood', frame.mood.mood, ranges, issues)
      checkMetricValue('mood.motivation', frame.mood.motivation, ranges, issues)
    }
    if (frame.pvt) {
      checkMetricValue('pvt.medianMs', frame.pvt.medianMs, ranges, issues)
      checkMetricValue('pvt.lapses', frame.pvt.lapses, ranges, issues)
    }
  }

  return { ok: issues.length === 0, issues }
}
