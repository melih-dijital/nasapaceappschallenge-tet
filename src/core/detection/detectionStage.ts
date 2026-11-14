// DetectionStage (FAZ_05 §3.6): L1–L4 + AlertManager. Sıra: … Baseline → Modules → Detection → …
// Backfill (t < 0) atlanır. Batch içindeki kareler zamana göre adım adım işlenir: sonuç batch boyutundan
// (ör. 50× hızda 6 sim-saatlik batch) bağımsız olarak 15 dk çözünürlükte kalıcılık/histerezis/soğuma uygular.
import type { BaselineEngine } from '../baseline'
import { median } from '../baseline/robustStats'
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import type { EngineContext, EngineStage, ZSnapshot } from '../pipeline/stages'
import type {
  Alert,
  AlertEvent,
  CrewId,
  MetricId,
  SimTimeMs,
  StateEstimate,
  StateId,
  TelemetryFrame,
} from '../types'
import { MS_PER_DAY } from '../units'
import { AlertManager, type StateHit } from './alertManager'
import { evaluateDoseL1, evaluateL1, type DoseInputs, type L1Hit } from './l1Limits'
import { badDirectionZ, isVitalsCadence, L2Detector, type L2Hit } from './l2Deviation'
import { L3Detector, type L3Hit } from './l3Trend'
import { estimateStates, stateSeverity, type ExtraStateInput, type MetricZInput } from './l4States'
import { isWarningPlus, loadDetectionParams, type DetectionParams } from './params'

/** Faz 6 modüllerinin Detection'a girdi sağladığı kanca (bu fazda no-op). */
export interface DetectionExtras {
  extraStateInputs?(crewId: CrewId, t: SimTimeMs): Partial<Record<StateId, ExtraStateInput>> | undefined
  doseInputs?(crewId: CrewId, t: SimTimeMs): DoseInputs | undefined
}

export const DETECTION_EXTRAS_SCRATCH_KEY = 'detectionExtras'

interface LatestZ {
  t: SimTimeMs
  confidence: number
  /** Vitals için son det.persist.minFrames.vitals karenin kötü yön z'leri (medyanı L4'e girer). */
  recent: number[]
}

export class DetectionStage implements EngineStage {
  readonly name = 'DetectionStage'
  readonly runOnBackfill = false

  private readonly evidence: EvidenceRegistry
  private readonly params: DetectionParams
  private readonly l2: L2Detector
  private readonly l3: L3Detector
  private readonly manager: AlertManager
  private readonly latestZ = new Map<CrewId, Map<MetricId, LatestZ>>()
  private readonly latestStates = new Map<CrewId, StateEstimate[]>()
  private readonly lastWarnT = new Map<CrewId, SimTimeMs>()
  private baselineEngine: BaselineEngine | null = null

  constructor(opts: { evidence?: EvidenceRegistry; baselineEngine?: BaselineEngine } = {}) {
    this.evidence = opts.evidence ?? defaultRegistry
    this.params = loadDetectionParams(this.evidence)
    this.l2 = new L2Detector(this.params)
    this.l3 = new L3Detector(this.params)
    this.manager = new AlertManager(this.params, this.evidence)
    if (opts.baselineEngine) this.baselineEngine = opts.baselineEngine
  }

  process(ctx: EngineContext): void {
    const scratchEngine = ctx.scratch['baselineEngine']
    if (scratchEngine && !this.baselineEngine) this.baselineEngine = scratchEngine as BaselineEngine
    const extras = ctx.scratch[DETECTION_EXTRAS_SCRATCH_KEY] as DetectionExtras | undefined

    const frames = ctx.liveFrames
    const snapshots = (ctx.output.baselines ?? []).filter((s) => s.t >= 0)
    const events: AlertEvent[] = []

    if (frames.length > 0) {
      const framesByT = groupBy(frames, (f) => f.t)
      const snapsByT = groupBy(snapshots, (s) => s.t)
      const times = [...framesByT.keys()].sort((a, b) => a - b)
      for (const t of times) {
        events.push(...this.stepAt(t, framesByT.get(t) ?? [], snapsByT.get(t) ?? [], extras))
      }
    }

    ctx.output.states = this.allStates()
    ctx.output.alertEvents = events
  }

  /** Tek bir sim zamanı için tüm katmanlar + uyarı yöneticisi. */
  private stepAt(
    t: SimTimeMs,
    frames: readonly TelemetryFrame[],
    snaps: readonly ZSnapshot[],
    extras: DetectionExtras | undefined,
  ): AlertEvent[] {
    const l1: L1Hit[] = []
    const l2: L2Hit[] = []
    const l3: L3Hit[] = []
    const crews = new Set<CrewId>()

    for (const frame of frames) {
      crews.add(frame.crewId)
      l1.push(...evaluateL1(frame, { evidence: this.evidence }))
      if (frame.kind === 'daily') l3.push(...this.l3.processDaily(frame))
      else l3.push(...this.l3.processVitalsForTrend(frame))
    }
    for (const snap of snaps) {
      const hit = this.l2.process(snap)
      if (hit) l2.push(hit)
      const cusum = this.l3.processCusum(snap)
      if (cusum) l3.push(cusum)
      this.recordZ(snap)
    }

    const states: StateHit[] = []
    for (const crewId of crews) {
      l1.push(...evaluateDoseL1(crewId, t, extras?.doseInputs?.(crewId, t), { evidence: this.evidence }))
      const extra = extras?.extraStateInputs?.(crewId, t)
      const estimates = estimateStates(
        { crewId, t, metrics: this.metricInputs(crewId, t), ...(extra ? { extra } : {}) },
        this.params,
      )
      this.latestStates.set(crewId, estimates)
      for (const estimate of estimates) {
        const severity = stateSeverity(estimate, this.params)
        if (severity) states.push({ estimate, severity })
      }
    }

    const events = this.manager.step(t, { l1, l2, l3, states })
    this.updateGuards(t, crews)
    return events
  }

  private recordZ(snap: ZSnapshot): void {
    if (snap.baselineMedian === null || !Number.isFinite(snap.z)) return
    let perCrew = this.latestZ.get(snap.crewId)
    if (!perCrew) {
      perCrew = new Map()
      this.latestZ.set(snap.crewId, perCrew)
    }
    const zBad = badDirectionZ(snap.metric, snap.z)
    const prev = perCrew.get(snap.metric)
    const keep = isVitalsCadence(snap.metric) ? Math.max(1, this.params.persistFrames.vitals) : 1
    const recent = prev ? [...prev.recent, zBad].slice(-keep) : [zBad]
    perCrew.set(snap.metric, { t: snap.t, confidence: snap.confidence, recent })
  }

  /** L4 girdileri: son 1 sim-gün içinde güncellenmiş z'ler; daha eski = "o gün veri yok" (eksik metrik). */
  private metricInputs(crewId: CrewId, t: SimTimeMs): Partial<Record<MetricId, MetricZInput>> {
    const out: Partial<Record<MetricId, MetricZInput>> = {}
    const perCrew = this.latestZ.get(crewId)
    if (!perCrew) return out
    for (const [metric, z] of perCrew) {
      if (t - z.t > MS_PER_DAY) continue
      const zBad = median(z.recent)
      if (zBad !== undefined) out[metric] = { zBad, confidence: z.confidence }
    }
    return out
  }

  /** Drift koruması: WARNING+ açık uyarısı olan kişide baseline donar; son WARNING+'tan baseline.guard.hours sonra çözülür. */
  private updateGuards(t: SimTimeMs, crews: ReadonlySet<CrewId>): void {
    if (!this.baselineEngine) return
    for (const crewId of crews) {
      if (this.manager.hasWarningPlus(crewId)) {
        this.lastWarnT.set(crewId, t)
        if (!this.baselineEngine.isGuarded(crewId)) this.baselineEngine.setGuard(crewId, true, t)
        continue
      }
      const last = this.lastWarnT.get(crewId)
      if (last !== undefined && this.baselineEngine.isGuarded(crewId) && t - last >= this.params.guardMs) {
        this.baselineEngine.setGuard(crewId, false, t)
      }
    }
  }

  private allStates(): StateEstimate[] {
    const crews = [...this.latestStates.keys()].sort()
    return crews.flatMap((c) => this.latestStates.get(c) ?? [])
  }

  ackAlert(alertId: string, t: SimTimeMs): AlertEvent | null {
    return this.manager.ack(alertId, t)
  }

  listAlerts(t: SimTimeMs): Alert[] {
    return this.manager.listAlerts(t)
  }

  hasWarningPlus(crewId: CrewId): boolean {
    return this.manager.hasWarningPlus(crewId)
  }

  reset(): void {
    this.l2.reset()
    this.l3.reset()
    this.manager.reset()
    this.latestZ.clear()
    this.latestStates.clear()
    this.lastWarnT.clear()
  }
}

/** WARNING+ seviyesi yardımcı yeniden dışa açımı (testler/Faz 8). */
export { isWarningPlus }

function groupBy<T>(items: readonly T[], keyOf: (item: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const arr = out.get(key)
    if (arr) arr.push(item)
    else out.set(key, [item])
  }
  return out
}
