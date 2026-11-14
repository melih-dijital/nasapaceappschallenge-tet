// Çoklu seed doğrulama paketi, eğitim/rapor ayrımı, overfitting ve hedef denetimi (FAZ_08 §3.3).
import { BUILTIN_SCENARIO_IDS } from '../../sim/scenarios'
import { median, quantile } from '../baseline/robustStats'
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import type { ScenarioId } from '../types'
import { computeEvidenceFingerprint, createOverrideRegistry, type ParameterOverrides } from './fingerprint'
import { DEFAULT_VALIDATION_BATCH_HOURS, runScenario } from './runScenario'
import { classifyScenarioStrength, scoreScenarioRunDetailed, scoreScenarioRuns } from './score'
import { runSensitivityAnalysis } from './sensitivity'
import type {
  OverfitCheckResult,
  ScenarioRun,
  ScenarioScore,
  SeedSetReport,
  ValidationAggregate,
  ValidationReport,
  ValidationTargetCheck,
} from './types'

export const TUNING_SEEDS: readonly number[] = [1, 2, 3, 4, 5]

export const REPORT_SEEDS: readonly number[] = Array.from({ length: 20 }, (_, i) => 100 + i)

export const PARAMS_VERSION = 'demo-parameters-v1'

export const MANDATORY_LIMITATIONS: readonly string[] = [
  'Veriler sentetik; olaylar simülatörün enjekte ettiği örüntülerdir; algılayıcı ve simülatör aynı takım tarafından yazılmıştır (döngüsellik riski); gerçek astronot verisiyle doğrulanmamıştır; tıbbi performans iddiası yoktur.',
  'Synthetic telemetry only: injected anomalies reflect scripted scenario patterns written by the same team as the detector (circularity risk); not validated on real astronaut flight data and makes no claim of medical diagnostic performance.',
  'Nearly all detection, baseline, and triage thresholds carry DEMO_PARAMETER (UNVERIFIED) provenance; targets and scores measure internal software consistency rather than clinical sensitivity/specificity.',
]

export const DEFAULT_ASSUMPTIONS: readonly string[] = [
  'Backfill defaults to 14 sim-days (3 days for new_crew_member) and live runs use fixed 6 sim-hour Engine ingestion batches for batch-size determinism.',
  'True Positive rule (FAZ_08 §3.2): alert must reach >= minSeverity within [exp.fromT, exp.toT] (firstSeenT inside window); Earth Delay class is captured at that first qualifying event.',
  'False Positives count unmatched WARNING/CRITICAL alert episodes per scenario; unmatched ADVISORY alerts are isolated into advisoryCount and never mixed into FP or specificity.',
  'Specificity measures the fraction of event-free crew-days without an active WARNING/CRITICAL alert across nominal and non-event crew-days of other scenarios.',
  'Strong event scenarios: solar_particle_event, sleep_debt, dehydration_co2, comm_blackout, demo_main; moderate event scenario: isolation_low_mood; baseline-only: nominal, new_crew_member.',
]

const runMemo = new Map<string, ScenarioRun>()

export function clearValidationCache(): void {
  runMemo.clear()
}

export function getValidationCacheSize(): number {
  return runMemo.size
}

function cacheKey(
  evidenceFingerprint: string,
  scenarioId: ScenarioId,
  seed: number,
  batchHours: number,
): string {
  return `${evidenceFingerprint}|${scenarioId}|${seed}|${batchHours}`
}

export function runScenarioCached(
  scenarioId: ScenarioId,
  seed: number,
  evidence: EvidenceRegistry,
  batchHours: number,
  parameterOverrides?: ParameterOverrides,
): ScenarioRun {
  const effectiveEvidence = createOverrideRegistry(evidence, parameterOverrides)
  const fp = computeEvidenceFingerprint(effectiveEvidence)
  const key = cacheKey(fp, scenarioId, seed, batchHours)
  const hit = runMemo.get(key)
  if (hit) return hit

  const run = runScenario(scenarioId, seed, {
    evidence,
    batchHours,
    ...(parameterOverrides ? { parameterOverrides } : {}),
  })
  runMemo.set(key, run)
  return run
}

export function checkOverfitting(
  tuningRecall: number | null,
  reportRecall: number | null,
  threshold: number,
): OverfitCheckResult {
  if (tuningRecall === null || reportRecall === null) {
    return {
      detected: false,
      tuningRecall,
      reportRecall,
      recallGap: null,
      threshold,
    }
  }
  const recallGap = tuningRecall - reportRecall
  return {
    detected: recallGap > threshold,
    tuningRecall,
    reportRecall,
    recallGap,
    threshold,
  }
}

export function aggregateRuns(runs: readonly ScenarioRun[]): {
  scenarios: ScenarioScore[]
  aggregate: ValidationAggregate
} {
  const scenarios = scoreScenarioRuns(runs)
  const details = runs.map((r) => scoreScenarioRunDetailed(r))

  let tp = 0
  let fn = 0
  let fp = 0
  let advisoryCount = 0
  let totalCrewDays = 0
  let triageChecked = 0
  let triagePassed = 0
  let eventFreeCrewDays = 0
  let cleanEventFreeCrewDays = 0

  let strongTp = 0
  let strongFn = 0
  let moderateTp = 0
  let moderateFn = 0

  const allLatenciesMin: number[] = []
  const speLatenciesMin: number[] = []

  for (const d of details) {
    tp += d.score.tp
    fn += d.score.fn
    fp += d.score.fp
    advisoryCount += d.score.advisoryCount
    totalCrewDays += d.score.crewDays
    triageChecked += d.score.triageChecked
    triagePassed += d.score.triagePassed
    eventFreeCrewDays += d.eventFreeCrewDays
    cleanEventFreeCrewDays += d.cleanEventFreeCrewDays
    allLatenciesMin.push(...d.latenciesMin)

    const strength = classifyScenarioStrength(d.score.scenarioId)
    if (strength === 'STRONG') {
      strongTp += d.score.tp
      strongFn += d.score.fn
    } else if (strength === 'MODERATE') {
      moderateTp += d.score.tp
      moderateFn += d.score.fn
    }

    for (const m of d.matches) {
      if (m.matched && m.latencyMin !== null && m.state === 'radiation_event') {
        speLatenciesMin.push(m.latencyMin)
      }
    }
  }

  const nominalScore = scenarios.find((s) => s.scenarioId === 'nominal')

  return {
    scenarios,
    aggregate: {
      totalRuns: runs.length,
      totalCrewDays,
      tp,
      fn,
      fp,
      advisoryCount,
      recall: tp + fn > 0 ? tp / (tp + fn) : null,
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
      specificity: eventFreeCrewDays > 0 ? cleanEventFreeCrewDays / eventFreeCrewDays : null,
      nominalFpPerCrewDay: nominalScore ? nominalScore.fpPerCrewDay : null,
      nominalAlertFreeDayPct: nominalScore ? nominalScore.nominalAlertFreeDayPct : null,
      strongRecall: strongTp + strongFn > 0 ? strongTp / (strongTp + strongFn) : null,
      moderateRecall: moderateTp + moderateFn > 0 ? moderateTp / (moderateTp + moderateFn) : null,
      speDetectP90Min: quantile(speLatenciesMin, 0.9) ?? null,
      medianLatencyMin: median(allLatenciesMin) ?? null,
      p90LatencyMin: quantile(allLatenciesMin, 0.9) ?? null,
      triageAccuracy: triageChecked > 0 ? triagePassed / triageChecked : null,
      fpPerCrewDay: totalCrewDays > 0 ? fp / totalCrewDays : 0,
      advisoryPerCrewDay: totalCrewDays > 0 ? advisoryCount / totalCrewDays : 0,
    },
  }
}

export function evaluateTargetChecks(
  aggregate: ValidationAggregate,
  evidence: EvidenceRegistry = defaultRegistry,
): ValidationTargetCheck[] {
  const nominalTarget = evidence.getNumber('val.target.nominalFpPerCrewDay')
  const strongRecallTarget = evidence.getNumber('val.target.strongRecall')
  const speP90Target = evidence.getNumber('val.target.speDetectP90Min')

  const checks: ValidationTargetCheck[] = [
    {
      id: 'target.nominal_fp_per_crew_day',
      metricKey: 'nominalFpPerCrewDay',
      actual: aggregate.nominalFpPerCrewDay,
      target: nominalTarget,
      comparator: 'LTE',
      status:
        aggregate.nominalFpPerCrewDay !== null && aggregate.nominalFpPerCrewDay <= nominalTarget
          ? 'PASS'
          : 'WARN',
    },
    {
      id: 'target.strong_recall',
      metricKey: 'strongRecall',
      actual: aggregate.strongRecall,
      target: strongRecallTarget,
      comparator: 'GTE',
      status:
        aggregate.strongRecall !== null && aggregate.strongRecall >= strongRecallTarget
          ? 'PASS'
          : 'WARN',
    },
    {
      id: 'target.spe_detect_p90_min',
      metricKey: 'speDetectP90Min',
      actual: aggregate.speDetectP90Min,
      target: speP90Target,
      comparator: 'LTE',
      status:
        aggregate.speDetectP90Min !== null && aggregate.speDetectP90Min <= speP90Target
          ? 'PASS'
          : 'WARN',
    },
  ]

  return checks
}

export interface RunSuiteOptions {
  scenarios?: readonly ScenarioId[]
  /** Özel seed listesi verilirse hem scenarios/aggregate hem reportSummary bu seed'lerle koşulur. */
  seeds?: readonly number[]
  tuningSeeds?: readonly number[]
  reportSeeds?: readonly number[]
  quick?: boolean
  includeSensitivity?: boolean
  batchHours?: number
  evidence?: EvidenceRegistry
  parameterOverrides?: ParameterOverrides
  onProgress?: (done: number, total: number) => void
  isCancelled?: () => boolean
}

export interface RunSuiteAsyncOptions extends RunSuiteOptions {
  yieldTurn?: () => Promise<void>
}

function resolveSuitePlan(opts: RunSuiteOptions) {
  const baseEvidence = opts.evidence ?? defaultRegistry
  const evidence = createOverrideRegistry(baseEvidence, opts.parameterOverrides)
  const quickSeedsCount = Math.max(1, Math.round(evidence.getNumber('val.quickSeeds')))
  const quick = opts.quick ?? false

  const scenarios: readonly ScenarioId[] =
    opts.scenarios && opts.scenarios.length > 0 ? opts.scenarios : [...BUILTIN_SCENARIO_IDS]

  const quickTuningCount = quick ? Math.max(1, Math.floor(quickSeedsCount / 3)) : TUNING_SEEDS.length
  const quickReportCount = quick
    ? Math.max(1, quickSeedsCount - quickTuningCount)
    : REPORT_SEEDS.length

  const tuningSeeds =
    opts.tuningSeeds && opts.tuningSeeds.length > 0
      ? [...opts.tuningSeeds]
      : quick
        ? TUNING_SEEDS.slice(0, quickTuningCount)
        : [...TUNING_SEEDS]

  const reportSeeds =
    opts.seeds && opts.seeds.length > 0
      ? [...opts.seeds]
      : opts.reportSeeds && opts.reportSeeds.length > 0
        ? [...opts.reportSeeds]
        : quick
          ? REPORT_SEEDS.slice(0, quickReportCount)
          : [...REPORT_SEEDS]

  const batchHours = opts.batchHours ?? DEFAULT_VALIDATION_BATCH_HOURS
  const includeSensitivity = opts.includeSensitivity ?? !quick
  const sensitivitySeeds = quick ? tuningSeeds.slice(0, 1) : tuningSeeds.slice(0, 2)

  return {
    evidence,
    quickSeedsCount,
    quick,
    scenarios,
    tuningSeeds,
    reportSeeds,
    batchHours,
    includeSensitivity,
    sensitivitySeeds,
  }
}

export function buildValidationReportFromRuns(
  plan: ReturnType<typeof resolveSuitePlan>,
  tuningRuns: readonly ScenarioRun[],
  reportRuns: readonly ScenarioRun[],
  sensitivity: ReturnType<typeof runSensitivityAnalysis>,
  customSeedsUsed: boolean,
): ValidationReport {
  const tuningAgg = aggregateRuns(tuningRuns)
  const reportAgg = aggregateRuns(reportRuns)

  const tuningSummary: SeedSetReport = {
    label: 'tuning',
    seeds: [...plan.tuningSeeds],
    scenarios: tuningAgg.scenarios,
    aggregate: tuningAgg.aggregate,
  }

  const reportSummary: SeedSetReport = {
    label: customSeedsUsed ? 'custom' : 'report',
    seeds: [...plan.reportSeeds],
    scenarios: reportAgg.scenarios,
    aggregate: reportAgg.aggregate,
  }

  const gapThreshold = plan.evidence.getNumber('val.overfit.recallGap')
  const overfitting = checkOverfitting(
    tuningSummary.aggregate.recall,
    reportSummary.aggregate.recall,
    gapThreshold,
  )

  return {
    params: {
      evidenceFingerprint: computeEvidenceFingerprint(plan.evidence),
      paramsVersion: PARAMS_VERSION,
      tuningSeeds: [...plan.tuningSeeds],
      reportSeeds: [...plan.reportSeeds],
      quickSeeds: plan.quickSeedsCount,
      batchHours: plan.batchHours,
    },
    quick: plan.quick,
    scenarios: reportSummary.scenarios,
    aggregate: reportSummary.aggregate,
    tuningSummary,
    reportSummary,
    overfitting,
    targetChecks: evaluateTargetChecks(reportSummary.aggregate, plan.evidence),
    sensitivity,
    limitations: [...MANDATORY_LIMITATIONS],
    assumptions: [...DEFAULT_ASSUMPTIONS],
  }
}

export function runSuite(opts: RunSuiteOptions = {}): ValidationReport {
  const plan = resolveSuitePlan(opts)
  const customSeedsUsed = Boolean(opts.seeds && opts.seeds.length > 0)
  // Hızlı modda duyarlılık analizini atla; rapor + ayar seed'leri üzerinden çalıştır
  const sensitivityRunsCount = plan.includeSensitivity
    ? 2 * 3 * plan.scenarios.length * plan.sensitivitySeeds.length
    : 0
  const total =
    plan.scenarios.length * (plan.tuningSeeds.length + plan.reportSeeds.length) +
    sensitivityRunsCount

  let done = 0
  const stepProgress = (): void => {
    done += 1
    opts.onProgress?.(done, total)
  }

  const tuningRuns: ScenarioRun[] = []
  for (const scenarioId of plan.scenarios) {
    for (const seed of plan.tuningSeeds) {
      if (opts.isCancelled?.()) break
      tuningRuns.push(
        runScenarioCached(scenarioId, seed, plan.evidence, plan.batchHours, opts.parameterOverrides),
      )
      stepProgress()
    }
  }

  const reportRuns: ScenarioRun[] = []
  for (const scenarioId of plan.scenarios) {
    for (const seed of plan.reportSeeds) {
      if (opts.isCancelled?.()) break
      reportRuns.push(
        runScenarioCached(scenarioId, seed, plan.evidence, plan.batchHours, opts.parameterOverrides),
      )
      stepProgress()
    }
  }

  const sensitivity = plan.includeSensitivity
    ? runSensitivityAnalysis({
        scenarios: plan.scenarios,
        seeds: plan.sensitivitySeeds,
        batchHours: plan.batchHours,
        evidence: plan.evidence,
        ...(opts.parameterOverrides ? { baseOverrides: opts.parameterOverrides } : {}),
        onProgressStep: stepProgress,
        ...(opts.isCancelled ? { isCancelled: opts.isCancelled } : {}),
      })
    : []

  return buildValidationReportFromRuns(plan, tuningRuns, reportRuns, sensitivity, customSeedsUsed)
}

export async function runSuiteAsync(
  opts: RunSuiteAsyncOptions = {},
): Promise<ValidationReport | null> {
  const plan = resolveSuitePlan(opts)
  const customSeedsUsed = Boolean(opts.seeds && opts.seeds.length > 0)
  const sensitivityRunsCount = plan.includeSensitivity
    ? 2 * 3 * plan.scenarios.length * plan.sensitivitySeeds.length
    : 0
  const total =
    plan.scenarios.length * (plan.tuningSeeds.length + plan.reportSeeds.length) +
    sensitivityRunsCount

  let done = 0
  const stepProgress = (): void => {
    done += 1
    opts.onProgress?.(done, total)
  }

  const tuningRuns: ScenarioRun[] = []
  for (const scenarioId of plan.scenarios) {
    for (const seed of plan.tuningSeeds) {
      if (opts.isCancelled?.()) return null
      tuningRuns.push(
        runScenarioCached(scenarioId, seed, plan.evidence, plan.batchHours, opts.parameterOverrides),
      )
      stepProgress()
      await opts.yieldTurn?.()
    }
  }

  const reportRuns: ScenarioRun[] = []
  for (const scenarioId of plan.scenarios) {
    for (const seed of plan.reportSeeds) {
      if (opts.isCancelled?.()) return null
      reportRuns.push(
        runScenarioCached(scenarioId, seed, plan.evidence, plan.batchHours, opts.parameterOverrides),
      )
      stepProgress()
      await opts.yieldTurn?.()
    }
  }

  if (opts.isCancelled?.()) return null

  const sensitivity = plan.includeSensitivity
    ? runSensitivityAnalysis({
        scenarios: plan.scenarios,
        seeds: plan.sensitivitySeeds,
        batchHours: plan.batchHours,
        evidence: plan.evidence,
        ...(opts.parameterOverrides ? { baseOverrides: opts.parameterOverrides } : {}),
        onProgressStep: stepProgress,
        ...(opts.isCancelled ? { isCancelled: opts.isCancelled } : {}),
      })
    : []

  if (opts.isCancelled?.()) return null

  return buildValidationReportFromRuns(plan, tuningRuns, reportRuns, sensitivity, customSeedsUsed)
}
