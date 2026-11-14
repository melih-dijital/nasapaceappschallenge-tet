// Engine boru hattı yürütücüsü (FAZ_03 §3.3). Saf TS; aşama hataları yalıtılır.
import type { EngineSnapshot } from '../../workers/protocol'
import type { BaselineEngine } from '../baseline'
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { PlausibleRanges } from '../ingest'
import type { PersistPort } from '../storage'
import type { AlertEvent, CrewId, SimTimeMs } from '../types'
import { EngineBuffers } from './buffer'
import {
  BaselineStage,
  BufferStage,
  DecisionStage,
  DetectionStage,
  IngestStage,
  ModulesStage,
  PersistStage,
  type EngineContext,
  type EngineOutput,
  type EngineStage,
} from './stages'

export interface EngineOptions {
  stages: EngineStage[]
  evidence?: EvidenceRegistry
}

export interface DefaultEngineOptions {
  evidence?: EvidenceRegistry
  baselineEngine?: BaselineEngine
  persist?: PersistPort
  plausibleRanges?: PlausibleRanges
  onPersistError?: (err: unknown, simT: SimTimeMs) => void
  /** Radyasyon modülü: CrewProfile.priorCareerDoseMsv (yoksa 0). */
  priorCareerDoseMsv?: (crewId: CrewId) => number | undefined
  /** Radyasyon projeksiyonu için senaryo görev süresi (gün) veya onu veren fonksiyon; yoksa Evidence varsayımı. */
  missionDays?: number | (() => number | undefined)
}

export class Engine {
  private readonly stages: readonly EngineStage[]
  private readonly evidence: EvidenceRegistry
  private readonly buffers: EngineBuffers

  private simT: SimTimeMs = 0
  private previousOutput: EngineOutput | null = null
  private dataQualityCount = 0

  constructor(opts: EngineOptions) {
    this.stages = opts.stages
    this.evidence = opts.evidence ?? registry
    this.buffers = new EngineBuffers(this.evidence)
  }

  ingest(frames: readonly unknown[], simT: SimTimeMs): EngineOutput {
    const output: EngineOutput = {
      t: simT,
      acceptedFrames: [],
      dataQuality: [],
      faults: [],
    }

    const ctx: EngineContext = {
      simT,
      rawFrames: frames,
      acceptedFrames: [],
      backfillFrames: [],
      liveFrames: [],
      dataQuality: [],
      faults: [],
      buffers: this.buffers,
      evidence: this.evidence,
      previousOutput: this.previousOutput,
      output,
      scratch: {},
      isBackfillOnly: false,
    }

    for (const stage of this.stages) {
      if (ctx.isBackfillOnly && stage.runOnBackfill === false) {
        continue
      }
      try {
        stage.process(ctx)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.faults.push({ stage: stage.name, message, t: simT })
        ctx.dataQuality.push({
          id: `dq-fault-${stage.name}-${simT}`,
          kind: 'ENGINE_FAULT',
          t: simT,
          detail: `${stage.name} failed: ${message}`,
        })
      }
    }

    output.acceptedFrames = ctx.acceptedFrames
    output.dataQuality = ctx.dataQuality
    output.faults = ctx.faults

    this.simT = simT
    this.previousOutput = output
    this.dataQualityCount += output.dataQuality.length

    return output
  }

  /** ACK_ALERT: uyarıyı ACTIVE → ACKED yapar; olay yoksa null. */
  ackAlert(alertId: string): AlertEvent | null {
    for (const stage of this.stages) {
      const event = stage.ackAlert?.(alertId, this.simT)
      if (event) return event
    }
    return null
  }

  /**
   * `activeAlerts`: açık (ACTIVE/ACKED) + son `alert.recentResolvedHours` sim-saatte çözülmüş uyarılar
   * (FAZ_05 §3.5 `snapshot().alerts`). UI `selectActiveAlerts` RESOLVED'ı zaten süzer.
   */
  snapshot(): EngineSnapshot {
    const modules = Object.assign({}, ...this.stages.map((stage) => stage.snapshotModules?.() ?? {})) as NonNullable<
      EngineSnapshot['modules']
    >
    return {
      t: this.simT,
      latest: this.buffers.getLatestSnapshot(),
      activeAlerts: this.stages.flatMap((stage) => stage.listAlerts?.(this.simT) ?? []),
      states: this.previousOutput?.states ?? [],
      cards: [],
      dataQualityCount: this.dataQualityCount,
      modules,
    }
  }

  getBuffers(): EngineBuffers {
    return this.buffers
  }

  reset(): void {
    this.simT = 0
    this.previousOutput = null
    this.dataQualityCount = 0
    this.buffers.clear()
    for (const stage of this.stages) {
      stage.reset?.()
    }
  }
}

/** Nihai sıra: Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist */
export function createDefaultEngine(opts: DefaultEngineOptions = {}): Engine {
  const evidence = opts.evidence ?? registry
  return new Engine({
    evidence,
    stages: [
      new IngestStage({
        evidence,
        ...(opts.plausibleRanges ? { plausibleRanges: opts.plausibleRanges } : {}),
      }),
      new BufferStage(),
      new BaselineStage({
        evidence,
        ...(opts.baselineEngine ? { baselineEngine: opts.baselineEngine } : {}),
      }),
      new ModulesStage({
        evidence,
        ...(opts.priorCareerDoseMsv ? { priorCareerDoseMsv: opts.priorCareerDoseMsv } : {}),
        ...(opts.missionDays !== undefined ? { missionDays: opts.missionDays } : {}),
      }),
      new DetectionStage(),
      new DecisionStage(),
      new PersistStage(opts.persist, opts.onPersistError),
    ],
  })
}
