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

/** Faz 6 modül raporları için genişletilebilir yer tutucu. */
export interface ModuleReport {
  kind: string
  crewId: string
  t: SimTimeMs
  payload: unknown
}

/** Faz 7 karar/planlama çıktısı için genişletilebilir yer tutucu. */
export interface DecisionSnapshot {
  t: SimTimeMs
  cardsCount: number
}

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
  moduleReports?: ModuleReport[]
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

/** 4. Aşama (Faz 6 yer tutucusu): Radyasyon, uyku, kardiyo/kemik ve davranış modülleri (backfill atlanır). */
export class ModulesStage implements EngineStage {
  readonly name = 'ModulesStage'
  readonly runOnBackfill = false

  process(ctx: EngineContext): void {
    if (ctx.liveFrames.length === 0) return
    ctx.output.moduleReports ??= []
  }
}

/** 5. Aşama: L1–L4 algılama + AlertManager (backfill atlanır) — uygulama `core/detection`'da (Faz 5). */
export { DetectionStage } from '../detection/detectionStage'

/** 6. Aşama (Faz 7 yer tutucusu): Karar destek, planlayıcı ve Earth Link triyajı (backfill atlanır). */
export class DecisionStage implements EngineStage {
  readonly name = 'DecisionStage'
  readonly runOnBackfill = false

  process(ctx: EngineContext): void {
    if (ctx.liveFrames.length === 0) return
    ctx.output.decisions ??= []
  }
}

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
