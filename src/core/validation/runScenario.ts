// Başsız (headless) senaryo koşucusu (FAZ_08 §3.1). Saf TS; gerçek zamanlayıcı ve DOM yok.
import type { CalibrationData } from '../../sim/calibration'
import { getScenario } from '../../sim/scenarios'
import { Simulator } from '../../sim/simulator'
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import { createDefaultEngine } from '../pipeline'
import type { AlertEvent, ScenarioId, SimTimeMs } from '../types'
import { MS_PER_DAY, MS_PER_HOUR } from '../units'
import {
  computeEvidenceFingerprint,
  createOverrideRegistry,
  type ParameterOverrides,
} from './fingerprint'
import type { ScenarioRun } from './types'

export const DEFAULT_VALIDATION_BATCH_HOURS = 6

export interface RunScenarioOptions {
  /** Geçici Evidence geçersiz kılmaları (duyarlılık analizi için; kalıcı değildir). */
  parameterOverrides?: ParameterOverrides
  /** Sabit batch penceresi (varsayılan 6 sim-saat; PROJECT_MEMORY §13 #246). */
  batchHours?: number
  /** Özel Evidence kayıt defteri (testler veya enjeksiyon için). */
  evidence?: EvidenceRegistry
  /** Opsiyonel kalibrasyon verisi. */
  calibration?: CalibrationData
}

export function runScenario(
  scenarioId: ScenarioId,
  seed?: number,
  opts: RunScenarioOptions = {},
): ScenarioRun {
  const scenario = getScenario(scenarioId)
  const resolvedSeed = seed ?? scenario.seed
  const baseEvidence = opts.evidence ?? defaultRegistry
  const evidence = createOverrideRegistry(baseEvidence, opts.parameterOverrides)
  const batchHours =
    opts.batchHours !== undefined && Number.isFinite(opts.batchHours) && opts.batchHours > 0
      ? opts.batchHours
      : DEFAULT_VALIDATION_BATCH_HOURS

  const sim = new Simulator(scenario, {
    seed: resolvedSeed,
    ...(opts.calibration ? { calibration: opts.calibration } : {}),
  })
  const crew = sim.getCrew()
  const priorDoseByCrew = new Map(crew.map((c) => [c.id, c.priorCareerDoseMsv]))

  const engine = createDefaultEngine({
    evidence,
    scenario,
    crewProfiles: crew,
    priorCareerDoseMsv: (crewId) => priorDoseByCrew.get(crewId),
    missionDays: scenario.durationDays,
  })

  engine.ingest(sim.backfill(), 0)

  const stepMs = Math.max(1, Math.round(batchHours * MS_PER_HOUR))
  const endT: SimTimeMs = scenario.durationDays * MS_PER_DAY
  const alertEvents: AlertEvent[] = []

  for (let t = stepMs; t <= endT; t += stepMs) {
    const out = engine.ingest(sim.advanceTo(t), t)
    if (out.alertEvents && out.alertEvents.length > 0) {
      alertEvents.push(...out.alertEvents)
    }
  }
  if (endT > 0 && endT % stepMs !== 0) {
    const out = engine.ingest(sim.advanceTo(endT), endT)
    if (out.alertEvents && out.alertEvents.length > 0) {
      alertEvents.push(...out.alertEvents)
    }
  }

  const truth = sim.getGroundTruth()
  return {
    scenarioId: scenario.id,
    seed: resolvedSeed,
    durationDays: scenario.durationDays,
    crewCount: scenario.crewCount,
    crewDays: scenario.crewCount * scenario.durationDays,
    crewIds: crew.map((c) => c.id),
    events: truth.events,
    expected: truth.expected,
    alertEvents,
    evidenceFingerprint: computeEvidenceFingerprint(evidence),
    ...(opts.parameterOverrides ? { parameterOverrides: { ...opts.parameterOverrides } } : {}),
  }
}
