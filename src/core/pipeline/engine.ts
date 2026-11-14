// Engine boru hattı yürütücüsü (FAZ_03 §3.3). Saf TS; aşama hataları yalıtılır.
import type { EngineSnapshot } from '../../workers/protocol'
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { PlausibleRanges } from '../ingest'
import type { PersistPort } from '../storage'
import type { SimTimeMs } from '../types'
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
  persist?: PersistPort
  plausibleRanges?: PlausibleRanges
  onPersistError?: (err: unknown, simT: SimTimeMs) => void
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

  snapshot(): EngineSnapshot {
    return {
      t: this.simT,
      latest: this.buffers.getLatestSnapshot(),
      activeAlerts: [],
      states: this.previousOutput?.states ?? [],
      cards: [],
      dataQualityCount: this.dataQualityCount,
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
      new BaselineStage(),
      new ModulesStage(),
      new DetectionStage(),
      new DecisionStage(),
      new PersistStage(opts.persist, opts.onPersistError),
    ],
  })
}
