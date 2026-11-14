// Engine boru hattı tipleri ve aşamaları (FAZ_03 §3.3).
// Nihai sıra: Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist.
// t < 0 backfill çerçeveleri yalnızca Ingest → Buffer → Baseline → Persist aşamalarından geçer.
import { BaselineEngine } from '../baseline'
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import {
  DataQualityTracker,
  IngestNormalizer,
  type DataQualityEvent,
  type PlausibleRanges,
} from '../ingest'
import type { PersistPort } from '../storage'
import type {
  Alert,
  AlertEvent,
  CrewId,
  MetricId,
  SimTimeMs,
  StateEstimate,
  TelemetryFrame,
  ZResult,
} from '../types'
import { extractFrameMetrics, metricSeriesKey, type EngineBuffers } from './buffer'

export interface ZSnapshot {
  crewId: CrewId
  metric: MetricId
  t: SimTimeMs
  value: number
  z: number
  confidence: number
  baselineMedian: number | null
  baselineSigma: number | null
}

/** Faz 6 modül raporları: sözleşme `core/modules/types.ts`'de. */
export type { ModuleReport } from '../modules/types'

/** Faz 7 karar/planlama/Earth Link çıktısı: sözleşme `core/decision/decisionStage.ts`'de. */
import type { DecisionStageSnapshot as DecisionSnapshot } from '../decision/decisionStage'
export type { DecisionSnapshot }

export interface EngineFault {
  stage: string
  message: string
  t: SimTimeMs
}

export interface EngineOutput {
  t: SimTimeMs
  acceptedFrames: TelemetryFrame[]
  dataQuality: DataQualityEvent[]
  faults: EngineFault[]
  baselines?: ZSnapshot[]
  states?: StateEstimate[]
  alertEvents?: AlertEvent[]
  moduleReports?: import('../modules/types').ModuleReport[]
  decisions?: DecisionSnapshot[]
}

export interface EngineContext {
  simT: SimTimeMs
  rawFrames: readonly unknown[]
  acceptedFrames: TelemetryFrame[]
  backfillFrames: TelemetryFrame[]
  liveFrames: TelemetryFrame[]
  dataQuality: DataQualityEvent[]
  faults: EngineFault[]
  buffers: EngineBuffers
  evidence: EvidenceRegistry
  previousOutput: EngineOutput | null
  output: EngineOutput
  scratch: Record<string, unknown>
  /** Yalnızca backfill (t < 0) çerçevelerinden oluşuyorsa true. */
  isBackfillOnly: boolean
}

export interface EngineStage {
  readonly name: string
  /** false ise t < 0 backfill çerçevelerini atlar (Modules/Detection/Decision). */
  readonly runOnBackfill?: boolean
  process(ctx: EngineContext): void
  reset?(): void
  /** Uyarı üreten aşamalar (Detection): açık + son çözülmüş uyarılar (Engine.snapshot için). */
  listAlerts?(t: SimTimeMs): Alert[]
  /** Kullanıcı onayı (ACK_ALERT). Uyarı yoksa/ACTIVE değilse null. */
  ackAlert?(alertId: string, t: SimTimeMs): AlertEvent | null
  /** Modül aşaması: kişi başına son modül raporları (Engine.snapshot().modules). */
  snapshotModules?(): Record<CrewId, import('../modules/types').ModuleReport[]>
  /** Karar aşaması: karar/plan/EarthLink anlık görüntüsü (Engine.snapshot().decision ve cards için). */
  snapshotDecision?(t: SimTimeMs): import('../decision/decisionStage').DecisionStageSnapshot
  /** Karar aşaması: uyarı listesine triyaj sınıfı ve zarar süresini uygular. */
  applyTriageToAlerts?(alerts: readonly Alert[]): Alert[]
}

/** 1. Aşama: Biçim (Zod), SpO2 0–100 normalize, makullük, monoton zaman, kopya bastırma ve stale izleme. */
export class IngestStage implements EngineStage {
  readonly name = 'IngestStage'
  readonly runOnBackfill = true

  private readonly normalizer: IngestNormalizer
  private readonly qualityTracker: DataQualityTracker

  constructor(opts: { plausibleRanges?: PlausibleRanges; evidence: EvidenceRegistry }) {
    this.normalizer = new IngestNormalizer(opts.plausibleRanges)
    this.qualityTracker = new DataQualityTracker(opts.evidence)
  }

  process(ctx: EngineContext): void {
    const { accepted, dataQuality } = this.normalizer.processBatch(ctx.rawFrames, ctx.simT)
    this.qualityTracker.recordFrames(accepted)
    const staleEvents = this.qualityTracker.checkStale(ctx.simT)

    ctx.acceptedFrames = accepted
    ctx.backfillFrames = accepted.filter((f) => f.t < 0)
    ctx.liveFrames = accepted.filter((f) => f.t >= 0)
    ctx.isBackfillOnly = accepted.length > 0 && ctx.liveFrames.length === 0
    ctx.dataQuality.push(...dataQuality, ...staleEvents)
    ctx.output.acceptedFrames = accepted
    ctx.output.dataQuality = ctx.dataQuality
  }

  reset(): void {
    this.normalizer.reset()
    this.qualityTracker.reset()
  }
}

/** 2. Aşama: Kabul edilen çerçeveleri kişi × metrik halka tamponlarına yazar. */
export class BufferStage implements EngineStage {
  readonly name = 'BufferStage'
  readonly runOnBackfill = true

  process(ctx: EngineContext): void {
    if (ctx.acceptedFrames.length === 0) return
    ctx.buffers.pushFrames(ctx.acceptedFrames)
  }
}

/** 3. Aşama: Kayan pencere medyan/MAD baseline + drift koruması (FAZ_04 §3.4). */
export class BaselineStage implements EngineStage {
  readonly name = 'BaselineStage'
  readonly runOnBackfill = true

  private readonly baselineEngine: BaselineEngine

  constructor(opts: { evidence?: EvidenceRegistry; baselineEngine?: BaselineEngine } = {}) {
    this.baselineEngine =
      opts.baselineEngine ?? new BaselineEngine({ registry: opts.evidence ?? defaultRegistry })
  }

  getEngine(): BaselineEngine {
    return this.baselineEngine
  }

  process(ctx: EngineContext): void {
    const snapshots: ZSnapshot[] = []
    const latestZ = new Map<string, ZResult>()

    for (let i = 0; i < ctx.acceptedFrames.length; i++) {
      const frame = ctx.acceptedFrames[i]!
      const env = frame.kind === 'radiation' ? frame.environment : undefined
      const metrics = extractFrameMetrics(frame)

      // Önce mevcut baseline ile zscore hesapla ("kendi kendine kıyas" olmasın), sonra update et.
      for (let m = 0; m < metrics.length; m++) {
        const { metric, value } = metrics[m]!
        const res = this.baselineEngine.zscore(frame.crewId, metric, value, frame.t, env)
        latestZ.set(metricSeriesKey(frame.crewId, metric), res)
        snapshots.push({
          crewId: frame.crewId,
          metric,
          t: frame.t,
          value,
          z: res.z,
          confidence: res.confidence,
          baselineMedian: res.baseline ? res.baseline.median : null,
          baselineSigma: res.baseline ? this.baselineEngine.effectiveSigma(res.baseline) : null,
        })
      }

      this.baselineEngine.update(frame)
    }

    ctx.scratch['baselineEngine'] = this.baselineEngine
    ctx.scratch['latestZResults'] = latestZ
    ctx.output.baselines = snapshots
  }

  reset(): void {
    this.baselineEngine.reset()
  }
}

/** 4. Aşama: alan modülleri (Faz 6; şimdilik radyasyon) — uygulama `core/modules`'da. */
export { ModulesStage } from '../modules/modulesStage'

/** 5. Aşama: L1–L4 algılama + AlertManager (backfill atlanır) — uygulama `core/detection`'da (Faz 5). */
export { DetectionStage } from '../detection/detectionStage'

/** 6. Aşama: Karar destek, planlayıcı ve Earth Link triyajı (backfill atlanır) — uygulama `core/decision`'da (Faz 7). */
export {
  DecisionStage,
  type CrewScheduleOutput,
  type DecisionStageOptions,
  type DecisionStageSnapshot,
  type ScenarioDecisionContext,
} from '../decision/decisionStage'

/** 7. Aşama: PersistPort üzerinden depolamaya yazar (uygulama dışarıdan enjekte edilir). */
export class PersistStage implements EngineStage {
  readonly name = 'PersistStage'
  readonly runOnBackfill = true

  private readonly persist?: PersistPort
  private readonly onPersistError?: (err: unknown, simT: SimTimeMs) => void

  constructor(persist?: PersistPort, onPersistError?: (err: unknown, simT: SimTimeMs) => void) {
    if (persist) this.persist = persist
    if (onPersistError) this.onPersistError = onPersistError
  }

  process(ctx: EngineContext): void {
    if (!this.persist || ctx.acceptedFrames.length === 0) return
    void this.persist.append(ctx.acceptedFrames).catch((err: unknown) => {
      this.onPersistError?.(err, ctx.simT)
    })
  }
}
