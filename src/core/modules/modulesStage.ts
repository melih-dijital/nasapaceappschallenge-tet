// ModulesStage (FAZ_06 §3, §4.5). Sıra kesin: Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist.
// Modüller yalnızca ham çerçeve + Baseline z/medyanını okur; Detection modül çıktısını `ctx.scratch.detectionExtras`
// kancasıyla AYNI karede okur (döngü yok). Backfill (t < 0) atlanır.
import { DETECTION_EXTRAS_SCRATCH_KEY, type DetectionExtras } from '../detection/detectionStage'
import type { ExtraStateInput } from '../detection/l4States'
import type { EvidenceRegistry } from '../evidence/registry'
import type { EngineContext, EngineStage } from '../pipeline/stages'
import type { CrewId, RadiationFrame, SimTimeMs, StateId } from '../types'
import { RadiationModule } from './radiation'
import type { ModuleReport } from './types'

export interface ModulesStageOptions {
  evidence: EvidenceRegistry
  priorCareerDoseMsv?: (crewId: CrewId) => number | undefined
  missionDays?: number | (() => number | undefined)
}

export class ModulesStage implements EngineStage {
  readonly name = 'ModulesStage'
  readonly runOnBackfill = false

  private readonly radiation: RadiationModule
  private latest = new Map<CrewId, ModuleReport[]>()

  constructor(opts: ModulesStageOptions) {
    this.radiation = new RadiationModule({
      evidence: opts.evidence,
      ...(opts.priorCareerDoseMsv ? { priorCareerDoseMsv: opts.priorCareerDoseMsv } : {}),
      ...(opts.missionDays !== undefined ? { missionDays: opts.missionDays } : {}),
    })
  }

  process(ctx: EngineContext): void {
    const radFrames = ctx.liveFrames.filter((f): f is RadiationFrame => f.kind === 'radiation')

    // Kare başına "güncellemeden önceki" baseline medyanı (BaselineStage ZSnapshot) → batch boyutundan bağımsız.
    const baselineByKey = new Map<string, number | null>()
    for (const s of ctx.output.baselines ?? []) {
      if (s.metric === 'rad.doseRateMsvDay') baselineByKey.set(`${s.crewId}|${s.t}`, s.baselineMedian)
    }
    const reports = this.radiation.processBatch(
      radFrames,
      (crewId, t) => baselineByKey.get(`${crewId}|${t}`) ?? null,
    )
    for (const r of reports) this.latest.set(r.crewId, [r])
    if (reports.length > 0) ctx.output.moduleReports = reports

    const radiation = this.radiation
    const extras: DetectionExtras = {
      doseInputs: (crewId: CrewId, t: SimTimeMs) => radiation.doseInputs(crewId, t),
      extraStateInputs: (crewId: CrewId, t: SimTimeMs): Partial<Record<StateId, ExtraStateInput>> | undefined =>
        radiation.extraStateInputs(crewId, t),
    }
    ctx.scratch[DETECTION_EXTRAS_SCRATCH_KEY] = extras
  }

  /** Kişi başına son modül raporları (Engine.snapshot().modules). */
  snapshotModules(): Record<CrewId, ModuleReport[]> {
    const out: Record<CrewId, ModuleReport[]> = {}
    for (const crewId of [...this.latest.keys()].sort()) out[crewId] = this.latest.get(crewId) ?? []
    return out
  }

  getRadiationModule(): RadiationModule {
    return this.radiation
  }

  reset(): void {
    this.radiation.reset()
    this.latest = new Map()
  }
}
