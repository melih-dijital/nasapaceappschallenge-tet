// Çalışma zamanı kalibrasyon okuyucusu ve kaynak (provenance) API'si (FAZ_02 §3.3).
import type { Environment, MetricId } from '../core/types'
import rawCalibration from './calibration.generated.json'
import type { CalibrationData } from './calibrationBuilder'
import type { EnvironmentCalibration, MetricCalibration } from './defaults'

export type { CalibrationBuildResult, CalibrationData } from './calibrationBuilder'
export { buildCalibration, defaultCalibrationData, renderCalibrationJson } from './calibrationBuilder'

export interface CalibrationProvenance {
  metric: MetricId
  demo: boolean
  evidenceId: string | null
  sourceFile: string | null
  plausibleMin: number
  plausibleMax: number
}

const CALIBRATION_DATA: CalibrationData = rawCalibration as CalibrationData

export function getCalibrationData(): CalibrationData {
  return CALIBRATION_DATA
}

export function getMetricCalibration(
  metric: MetricId,
  data: CalibrationData = CALIBRATION_DATA,
): MetricCalibration {
  return data.metrics[metric]
}

export function getEnvironmentCalibration(
  environment: Environment,
  data: CalibrationData = CALIBRATION_DATA,
): EnvironmentCalibration {
  return data.environments[environment]
}

/** UI ve denetim için metriğin kalibrasyon kaynağını ve demo bayrağını döndürür. */
export function getCalibrationProvenance(
  metric: MetricId,
  data: CalibrationData = CALIBRATION_DATA,
): CalibrationProvenance {
  const entry = data.metrics[metric]
  return {
    metric: entry.metric,
    demo: entry.demo,
    evidenceId: entry.evidenceId,
    sourceFile: entry.sourceFile,
    plausibleMin: entry.plausibleMin,
    plausibleMax: entry.plausibleMax,
  }
}
