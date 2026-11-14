// Basit duyarlılık analizi (FAZ_08 §3.3): det.z.warning ve det.persist.minFrames.vitals için ±val.sensitivity.pct%.
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import type { ScenarioId } from '../types'
import type { ParameterOverrides } from './fingerprint'
import { DEFAULT_VALIDATION_BATCH_HOURS, runScenario } from './runScenario'
import { scoreScenarioRunDetailed } from './score'
import type { SensitivityPoint, SensitivityRow } from './types'

export interface SensitivityOptions {
  scenarios: readonly ScenarioId[]
  seeds: readonly number[]
  batchHours?: number
  evidence?: EvidenceRegistry
  baseOverrides?: ParameterOverrides
  onProgressStep?: () => void
  isCancelled?: () => boolean
}

interface ParamSpec {
  id: 'det.z.warning' | 'det.persist.minFrames.vitals'
  integer: boolean
  minValue: number
}

const SENSITIVITY_PARAMS: readonly ParamSpec[] = [
  { id: 'det.z.warning', integer: false, minValue: 0.1 },
  { id: 'det.persist.minFrames.vitals', integer: true, minValue: 1 },
]

function roundValue(v: number, integer: boolean, minValue: number): number {
  const scaled = integer ? Math.round(v) : Math.round(v * 1000) / 1000
  return Math.max(minValue, scaled)
}

function summarizePoint(
  label: SensitivityPoint['label'],
  value: number,
  scenarios: readonly ScenarioId[],
  seeds: readonly number[],
  batchHours: number,
  evidence: EvidenceRegistry,
  overrides: ParameterOverrides,
  onProgressStep?: () => void,
  isCancelled?: () => boolean,
): SensitivityPoint | null {
  let tp = 0
  let fn = 0
  let fp = 0
  let advisoryCount = 0
  let crewDays = 0

  for (const scenarioId of scenarios) {
    for (const seed of seeds) {
      if (isCancelled?.()) return null
      const run = runScenario(scenarioId, seed, {
        evidence,
        batchHours,
        parameterOverrides: overrides,
      })
      const detail = scoreScenarioRunDetailed(run)
      tp += detail.score.tp
      fn += detail.score.fn
      fp += detail.score.fp
      advisoryCount += detail.score.advisoryCount
      crewDays += detail.score.crewDays
      onProgressStep?.()
    }
  }

  return {
    label,
    value,
    recall: tp + fn > 0 ? tp / (tp + fn) : null,
    fpPerCrewDay: crewDays > 0 ? fp / crewDays : 0,
    advisoryPerCrewDay: crewDays > 0 ? advisoryCount / crewDays : 0,
    tp,
    fn,
    fp,
  }
}

export function runSensitivityAnalysis(opts: SensitivityOptions): SensitivityRow[] {
  const evidence = opts.evidence ?? defaultRegistry
  const pct = evidence.getNumber('val.sensitivity.pct')
  const batchHours = opts.batchHours ?? DEFAULT_VALIDATION_BATCH_HOURS
  const baseOverrides = opts.baseOverrides ?? {}
  const rows: SensitivityRow[] = []

  for (const spec of SENSITIVITY_PARAMS) {
    if (opts.isCancelled?.()) break
    const overrideVal = baseOverrides[spec.id]
    const baseValue =
      typeof overrideVal === 'number' ? overrideVal : evidence.getNumber(spec.id)
    const minusVal = roundValue(baseValue * (1 - pct / 100), spec.integer, spec.minValue)
    const plusVal = roundValue(baseValue * (1 + pct / 100), spec.integer, spec.minValue)

    const variants: Array<{ label: SensitivityPoint['label']; value: number }> = [
      { label: 'minus', value: minusVal },
      { label: 'base', value: baseValue },
      { label: 'plus', value: plusVal },
    ]

    const points: SensitivityPoint[] = []
    for (const v of variants) {
      const point = summarizePoint(
        v.label,
        v.value,
        opts.scenarios,
        opts.seeds,
        batchHours,
        evidence,
        { ...baseOverrides, [spec.id]: v.value },
        opts.onProgressStep,
        opts.isCancelled,
      )
      if (!point) return rows
      points.push(point)
    }

    rows.push({
      parameter: spec.id,
      pct,
      baseValue,
      points,
    })
  }

  return rows
}
