// Engine boru hattı yürütücüsü (FAZ_03 §3.3). Saf TS; aşama hataları yalıtılır.
import type { EngineSnapshot } from '../../workers/protocol'
import type { BaselineEngine } from '../baseline'
import type { EarthConsentCategory } from '../earthlink/packets'
import type { EarthLinkOptions } from '../earthlink/link'
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { PlausibleRanges } from '../ingest'
import type { PersistPort } from '../storage'
import type {
  ActionCard,
  AlertEvent,
  CrewId,
  CrewProfile,
  DownlinkState,
  EarthLinkConfig,
  GroundMirror,
  Message,
  SimTimeMs,
} from '../types'
import { EngineBuffers } from './buffer'
import {
  BaselineStage,
  BufferStage,
  DecisionStage,
  DetectionStage,
  IngestStage,
  ModulesStage,
  PersistStage,
  type DecisionSnapshot,
  type EngineContext,
  type EngineOutput,
  type EngineStage,
  type ScenarioDecisionContext,
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
  /** Faz 7 karar katmanı için senaryo bağlamı (earthLinkPreset, EARTH_DELAY, COMM_BLACKOUT). */
  scenario?: ScenarioDecisionContext
  /** Faz 7 planlayıcı için mürettebat profilleri. */
  crewProfiles?: readonly CrewProfile[]
  /** Faz 7 Earth Link ek yapılandırması. */
  earthLinkOptions?: EarthLinkOptions
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
    let acked: AlertEvent | null = null
    for (const stage of this.stages) {
      const event = stage.ackAlert?.(alertId, this.simT)
      if (event) acked = event
    }
    return acked
  }

  private getDecisionStage(): DecisionStage | undefined {
    return this.stages.find((stage): stage is DecisionStage => stage instanceof DecisionStage)
  }

  acceptAction(cardId: string): ActionCard | null {
    return this.getDecisionStage()?.acceptCard(cardId, this.simT) ?? null
  }

  dismissAction(cardId: string): ActionCard | null {
    return this.getDecisionStage()?.dismissCard(cardId, this.simT) ?? null
  }

  completeAction(cardId: string): ActionCard | null {
    return this.getDecisionStage()?.completeCard(cardId, this.simT) ?? null
  }

  setEarthLinkConfig(config: Partial<EarthLinkConfig>): void {
    this.getDecisionStage()?.setEarthLinkConfig(config)
  }

  setConsentCategories(categories: readonly EarthConsentCategory[]): void {
    this.getDecisionStage()?.setConsentCategories(categories)
  }

  triggerGroundReply(templateId: string, relatedAlertId?: string): Message | null {
    return this.getDecisionStage()?.triggerGroundReply(templateId, relatedAlertId) ?? null
  }

  setScenario(scenario: ScenarioDecisionContext, crewProfiles?: readonly CrewProfile[]): void {
    this.getDecisionStage()?.setScenario(scenario, crewProfiles)
  }

  getSimT(): SimTimeMs {
    return this.simT
  }

  /**
   * `activeAlerts`: açık (ACTIVE/ACKED) + son `alert.recentResolvedHours` sim-saatte çözülmüş uyarılar
   * (FAZ_05 §3.5 `snapshot().alerts`). UI `selectActiveAlerts` RESOLVED'ı zaten süzer.
   */
  snapshot(): EngineSnapshot {
    const modules = Object.assign({}, ...this.stages.map((stage) => stage.snapshotModules?.() ?? {})) as NonNullable<
      EngineSnapshot['modules']
    >
    let activeAlerts = this.stages.flatMap((stage) => stage.listAlerts?.(this.simT) ?? [])
    for (const stage of this.stages) {
      if (stage.applyTriageToAlerts) {
        activeAlerts = stage.applyTriageToAlerts(activeAlerts)
      }
    }
    let decision: DecisionSnapshot | undefined
    for (const stage of this.stages) {
      if (stage.snapshotDecision) {
        decision = stage.snapshotDecision(this.simT)
      }
    }
    const groundMirror: GroundMirror = decision
      ? decision.groundMirror
      : {
          asOfT: null,
          delaySec: this.evidence.getNumber('earth.oneWayDelaySec.mars_min'),
          linkUp: true,
          latest: {},
          activeAlerts: [],
          states: [],
          cumulativeDoseByCrew: {},
        }
    const downlink: DownlinkState = decision
      ? decision.downlink
      : {
          queued: 0,
          inFlight: 0,
          lastDeliveredT: null,
          recent: [],
        }
    return {
      t: this.simT,
      latest: this.buffers.getLatestSnapshot(),
      activeAlerts,
      states: this.previousOutput?.states ?? [],
      cards: decision ? decision.cards : [],
      dataQualityCount: this.dataQualityCount,
      modules,
      ...(decision ? { decision } : {}),
      groundMirror,
      downlink,
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
  const priorCareerDoseMsv =
    opts.priorCareerDoseMsv ??
    (opts.crewProfiles
      ? (crewId: CrewId) => opts.crewProfiles?.find((c) => c.id === crewId)?.priorCareerDoseMsv
      : undefined)
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
        ...(priorCareerDoseMsv ? { priorCareerDoseMsv } : {}),
        ...(opts.missionDays !== undefined ? { missionDays: opts.missionDays } : {}),
      }),
      new DetectionStage({ evidence }),
      new DecisionStage({
        evidence,
        ...(opts.scenario ? { scenario: opts.scenario } : {}),
        ...(opts.crewProfiles ? { crewProfiles: opts.crewProfiles } : {}),
        ...(opts.earthLinkOptions ? { earthLinkOptions: opts.earthLinkOptions } : {}),
      }),
      new PersistStage(opts.persist, opts.onPersistError),
    ],
  })
}
