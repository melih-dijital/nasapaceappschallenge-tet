// Gecikme-bilinçli triyaj (FAZ_07 §3.3, PROJECT_MEMORY §9):
// "Dünya'yı beklemek güvenli mi?" sınıflaması. Parametreler Evidence'tan okunur (sihirli sayı yok).
import { registry, type EvidenceId, type EvidenceRegistry } from '../evidence/registry'
import type { Alert, EarthDelayClass, Severity, WhyKey } from '../types/alert'
import type { EarthLinkConfig } from '../types/earthlink'
import type { MetricId } from '../types/metric'
import type { StateId } from '../types/state'
import { secToMin } from '../units'

export interface TriageResult {
  cls: EarthDelayClass
  roundTripMin: number
  timeToHarmMin: number
  reasonKeys: WhyKey[]
}

const STATE_TIME_TO_HARM_ID: Record<StateId, EvidenceId> = {
  fatigue: 'earth.timeToHarmMin.fatigue',
  stress: 'earth.timeToHarmMin.stress',
  dehydration: 'earth.timeToHarmMin.dehydration',
  sleep_debt: 'earth.timeToHarmMin.sleep_debt',
  radiation_event: 'earth.timeToHarmMin.radiation_event',
  cardio_strain: 'earth.timeToHarmMin.cardio_strain',
  mood_decline: 'earth.timeToHarmMin.mood_decline',
}

const METRIC_TIME_TO_HARM_ID: Partial<Record<MetricId, EvidenceId>> = {
  spo2: 'earth.timeToHarmMin.spo2_low',
  cabinCo2ppm: 'earth.timeToHarmMin.co2_high',
  'rad.doseRateMsvDay': 'earth.timeToHarmMin.radiation_event',
  hr: 'earth.timeToHarmMin.cardio_strain',
  hrv: 'earth.timeToHarmMin.cardio_strain',
  'sleep.durationH': 'earth.timeToHarmMin.sleep_debt',
  'sleep.efficiency': 'earth.timeToHarmMin.sleep_debt',
  'sleep.midpointShiftMin': 'earth.timeToHarmMin.sleep_debt',
  hydrationL: 'earth.timeToHarmMin.dehydration',
  'mood.stress': 'earth.timeToHarmMin.stress',
  'mood.mood': 'earth.timeToHarmMin.mood_decline',
  'mood.motivation': 'earth.timeToHarmMin.mood_decline',
  'pvt.medianMs': 'earth.timeToHarmMin.fatigue',
  'pvt.lapses': 'earth.timeToHarmMin.fatigue',
  'activity.exerciseMin': 'earth.timeToHarmMin.fatigue',
  'activity.resistiveMin': 'earth.timeToHarmMin.cardio_strain',
}

const CAREER_DOSE_EVIDENCE_IDS = new Set<string>([
  'rad.career.limit.msv',
  'rad.career.warn.fraction',
  'rad.career.critical.fraction',
])

const isWarningOrHigher = (severity: Severity): boolean =>
  severity === 'WARNING' || severity === 'CRITICAL'

export function computeRoundTripMin(
  link: EarthLinkConfig,
  evidence: EvidenceRegistry = registry,
): number {
  if (link.blackout) return Infinity
  const groundProcessingMin = evidence.getNumber('earth.groundProcessingMin')
  return 2 * secToMin(link.oneWayDelaySec) + groundProcessingMin
}

export function resolveTimeToHarmMin(
  alert: Pick<Alert, 'timeToHarmMin' | 'state' | 'metric' | 'kind' | 'evidenceIds'>,
  evidence: EvidenceRegistry = registry,
): number {
  if (alert.timeToHarmMin !== undefined && Number.isFinite(alert.timeToHarmMin)) {
    return alert.timeToHarmMin
  }
  if (alert.state !== undefined) {
    return evidence.getNumber(STATE_TIME_TO_HARM_ID[alert.state])
  }
  if (alert.evidenceIds.some((id) => CAREER_DOSE_EVIDENCE_IDS.has(id))) {
    return evidence.getNumber('earth.timeToHarmMin.career_dose')
  }
  if (alert.metric !== undefined) {
    const metricParamId = METRIC_TIME_TO_HARM_ID[alert.metric]
    if (metricParamId !== undefined) return evidence.getNumber(metricParamId)
  }
  if (alert.kind === 'RADIATION') {
    return evidence.getNumber('earth.timeToHarmMin.radiation_event')
  }
  return evidence.getNumber('earth.timeToHarmMin.fatigue')
}

export function classify(
  alert: Alert,
  link: EarthLinkConfig,
  evidence: EvidenceRegistry = registry,
): TriageResult {
  const roundTripMin = computeRoundTripMin(link, evidence)
  const timeToHarmMin = resolveTimeToHarmMin(alert, evidence)
  const baseParams = {
    severity: alert.severity,
    oneWayDelaySec: link.oneWayDelaySec,
    roundTripMin: Number.isFinite(roundTripMin) ? Number(roundTripMin.toFixed(2)) : 'Infinity',
    timeToHarmMin,
  }

  // Kritik radyasyon olayları gecikmeden bağımsız olarak daima derhal aksiyon gerektirir.
  if (
    alert.severity === 'CRITICAL' &&
    (alert.state === 'radiation_event' || alert.kind === 'RADIATION')
  ) {
    return {
      cls: 'ACT_NOW',
      roundTripMin,
      timeToHarmMin,
      reasonKeys: [{ key: 'triage.reason.criticalRadiation', params: baseParams }],
    }
  }

  if (!isWarningOrHigher(alert.severity)) {
    return {
      cls: 'CAN_WAIT_FOR_EARTH',
      roundTripMin,
      timeToHarmMin,
      reasonKeys: [{ key: 'triage.reason.lowSeverity', params: baseParams }],
    }
  }

  if (link.blackout) {
    return {
      cls: 'ACT_NOW',
      roundTripMin,
      timeToHarmMin,
      reasonKeys: [{ key: 'triage.reason.blackout', params: baseParams }],
    }
  }

  if (timeToHarmMin <= roundTripMin) {
    return {
      cls: 'ACT_NOW',
      roundTripMin,
      timeToHarmMin,
      reasonKeys: [{ key: 'triage.reason.delayExceedsTimeToHarm', params: baseParams }],
    }
  }

  return {
    cls: 'ACT_THEN_REPORT',
    roundTripMin,
    timeToHarmMin,
    reasonKeys: [{ key: 'triage.reason.withinSafeDelayWindow', params: baseParams }],
  }
}

/** Gecikme veya kesinti durumu değiştiğinde aktif uyarıları yeniden sınıflandırır. */
export function reclassifyAlerts(
  alerts: readonly Alert[],
  link: EarthLinkConfig,
  evidence: EvidenceRegistry = registry,
): Alert[] {
  return alerts.map((alert) => {
    if (alert.status === 'RESOLVED') return alert
    const result = classify(alert, link, evidence)
    return {
      ...alert,
      earthDelayClass: result.cls,
      timeToHarmMin: result.timeToHarmMin,
    }
  })
}
