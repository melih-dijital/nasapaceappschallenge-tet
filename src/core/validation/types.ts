// Faz 8 doğrulama koşucusu sözleşme tipleri ve Zod şemaları. Saf TS, DOM yok.
import { z } from 'zod'
import type { ScenarioEvent } from '../../sim/scenario'
import type {
  AlertEvent,
  AlertKind,
  CrewId,
  EarthDelayClass,
  ExpectedDetection,
  MetricId,
  ScenarioId,
  Severity,
  SimTimeMs,
  StateId,
} from '../types'

export type ValidationTargetStatus = 'PASS' | 'WARN'

export interface ValidationTargetCheck {
  id: string
  metricKey: string
  actual: number | null
  target: number
  comparator: 'LTE' | 'GTE'
  status: ValidationTargetStatus
}

export type ScenarioEventStrength = 'NONE' | 'STRONG' | 'MODERATE'

export interface ExpectedMatchRecord {
  expectedId: string
  crewId: CrewId
  state?: StateId
  alertKind?: AlertKind
  metric?: MetricId
  fromT: SimTimeMs
  toT: SimTimeMs
  minSeverity: Severity
  mustBeEarthClass?: EarthDelayClass
  matched: boolean
  alertId: string | null
  firstSeenT: SimTimeMs | null
  latencyMin: number | null
  matchedSeverity: Severity | null
  earthClass: EarthDelayClass | null
  earthClassOk: boolean | null
}

export interface UnexpectedAlertRecord {
  alertId: string
  crewId: CrewId
  state?: StateId
  kind: AlertKind
  metric?: MetricId
  openedT: SimTimeMs
  resolvedT: SimTimeMs | null
  maxSeverity: Severity
  category: 'FP' | 'ADVISORY'
}

export interface CrewBreakdown {
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  recall: number | null
  precision: number | null
  medianLatencyMin: number | null
}

export interface StateBreakdown {
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  recall: number | null
  precision: number | null
  medianLatencyMin: number | null
}

export interface ScenarioRun {
  scenarioId: ScenarioId
  seed: number
  durationDays: number
  crewCount: number
  crewDays: number
  crewIds: CrewId[]
  events: readonly ScenarioEvent[]
  expected: readonly ExpectedDetection[]
  alertEvents: AlertEvent[]
  evidenceFingerprint: string
  parameterOverrides?: Record<string, number | [number, number]>
}

export interface ScenarioScore {
  scenarioId: ScenarioId
  eventStrength: ScenarioEventStrength
  runsCount: number
  crewDays: number
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  recall: number | null
  precision: number | null
  specificity: number | null
  nominalAlertFreeDayPct: number | null
  fpPerCrewDay: number
  advisoryPerCrewDay: number
  medianLatencyMin: number | null
  p90LatencyMin: number | null
  triageAccuracy: number | null
  triageChecked: number
  triagePassed: number
  byCrew: Record<string, CrewBreakdown>
  byState: Record<string, StateBreakdown>
}

export interface ValidationAggregate {
  totalRuns: number
  totalCrewDays: number
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  recall: number | null
  precision: number | null
  specificity: number | null
  nominalFpPerCrewDay: number | null
  nominalAlertFreeDayPct: number | null
  strongRecall: number | null
  moderateRecall: number | null
  speDetectP90Min: number | null
  medianLatencyMin: number | null
  p90LatencyMin: number | null
  triageAccuracy: number | null
  fpPerCrewDay: number
  advisoryPerCrewDay: number
}

export interface SeedSetReport {
  label: 'tuning' | 'report' | 'custom'
  seeds: number[]
  scenarios: ScenarioScore[]
  aggregate: ValidationAggregate
}

export interface OverfitCheckResult {
  detected: boolean
  tuningRecall: number | null
  reportRecall: number | null
  recallGap: number | null
  threshold: number
}

export interface SensitivityPoint {
  label: 'minus' | 'base' | 'plus'
  value: number
  recall: number | null
  fpPerCrewDay: number
  advisoryPerCrewDay: number
  tp: number
  fn: number
  fp: number
}

export interface SensitivityRow {
  parameter: string
  pct: number
  baseValue: number
  points: SensitivityPoint[]
}

export interface ValidationReport {
  generatedAtSim?: never
  params: {
    evidenceFingerprint: string
    paramsVersion: string
    tuningSeeds: number[]
    reportSeeds: number[]
    quickSeeds: number
    batchHours: number
  }
  quick: boolean
  scenarios: ScenarioScore[]
  aggregate: ValidationAggregate
  tuningSummary: SeedSetReport
  reportSummary: SeedSetReport
  overfitting: OverfitCheckResult
  targetChecks: ValidationTargetCheck[]
  sensitivity: SensitivityRow[]
  limitations: string[]
  assumptions: string[]
}

const BreakdownSchema = z.object({
  tp: z.number().int().nonnegative(),
  fn: z.number().int().nonnegative(),
  fp: z.number().int().nonnegative(),
  advisoryCount: z.number().int().nonnegative(),
  recall: z.number().nullable(),
  precision: z.number().nullable(),
  medianLatencyMin: z.number().nullable(),
})

export const ScenarioScoreSchema = z.object({
  scenarioId: z.string().min(1),
  eventStrength: z.enum(['NONE', 'STRONG', 'MODERATE']),
  runsCount: z.number().int().positive(),
  crewDays: z.number().int().positive(),
  tp: z.number().int().nonnegative(),
  fn: z.number().int().nonnegative(),
  fp: z.number().int().nonnegative(),
  advisoryCount: z.number().int().nonnegative(),
  recall: z.number().nullable(),
  precision: z.number().nullable(),
  specificity: z.number().nullable(),
  nominalAlertFreeDayPct: z.number().nullable(),
  fpPerCrewDay: z.number().nonnegative(),
  advisoryPerCrewDay: z.number().nonnegative(),
  medianLatencyMin: z.number().nullable(),
  p90LatencyMin: z.number().nullable(),
  triageAccuracy: z.number().nullable(),
  triageChecked: z.number().int().nonnegative(),
  triagePassed: z.number().int().nonnegative(),
  byCrew: z.record(z.string(), BreakdownSchema),
  byState: z.record(z.string(), BreakdownSchema),
})

export const ValidationAggregateSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalCrewDays: z.number().int().nonnegative(),
  tp: z.number().int().nonnegative(),
  fn: z.number().int().nonnegative(),
  fp: z.number().int().nonnegative(),
  advisoryCount: z.number().int().nonnegative(),
  recall: z.number().nullable(),
  precision: z.number().nullable(),
  specificity: z.number().nullable(),
  nominalFpPerCrewDay: z.number().nullable(),
  nominalAlertFreeDayPct: z.number().nullable(),
  strongRecall: z.number().nullable(),
  moderateRecall: z.number().nullable(),
  speDetectP90Min: z.number().nullable(),
  medianLatencyMin: z.number().nullable(),
  p90LatencyMin: z.number().nullable(),
  triageAccuracy: z.number().nullable(),
  fpPerCrewDay: z.number().nonnegative(),
  advisoryPerCrewDay: z.number().nonnegative(),
})

const SeedSetReportSchema = z.object({
  label: z.enum(['tuning', 'report', 'custom']),
  seeds: z.array(z.number().int()),
  scenarios: z.array(ScenarioScoreSchema),
  aggregate: ValidationAggregateSchema,
})

const SensitivityPointSchema = z.object({
  label: z.enum(['minus', 'base', 'plus']),
  value: z.number(),
  recall: z.number().nullable(),
  fpPerCrewDay: z.number().nonnegative(),
  advisoryPerCrewDay: z.number().nonnegative(),
  tp: z.number().int().nonnegative(),
  fn: z.number().int().nonnegative(),
  fp: z.number().int().nonnegative(),
})

export const ValidationReportSchema = z.object({
  params: z.object({
    evidenceFingerprint: z.string().min(1),
    paramsVersion: z.string().min(1),
    tuningSeeds: z.array(z.number().int()),
    reportSeeds: z.array(z.number().int()),
    quickSeeds: z.number().int().positive(),
    batchHours: z.number().positive(),
  }),
  quick: z.boolean(),
  scenarios: z.array(ScenarioScoreSchema),
  aggregate: ValidationAggregateSchema,
  tuningSummary: SeedSetReportSchema,
  reportSummary: SeedSetReportSchema,
  overfitting: z.object({
    detected: z.boolean(),
    tuningRecall: z.number().nullable(),
    reportRecall: z.number().nullable(),
    recallGap: z.number().nullable(),
    threshold: z.number(),
  }),
  targetChecks: z.array(
    z.object({
      id: z.string().min(1),
      metricKey: z.string().min(1),
      actual: z.number().nullable(),
      target: z.number(),
      comparator: z.enum(['LTE', 'GTE']),
      status: z.enum(['PASS', 'WARN']),
    }),
  ),
  sensitivity: z.array(
    z.object({
      parameter: z.string().min(1),
      pct: z.number().nonnegative(),
      baseValue: z.number(),
      points: z.array(SensitivityPointSchema),
    }),
  ),
  limitations: z.array(z.string().min(1)).min(1),
  assumptions: z.array(z.string().min(1)),
})
