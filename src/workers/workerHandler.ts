// Saf worker mesaj işleyicisi (FAZ_03 §3.4, §3.6). Worker olmadan doğrudan test edilebilir.
// Math.random ve Date.now yok.
import { createDefaultEngine, extractChartFrames, type Engine, type EngineOutput } from '../core/pipeline'
import { MemoryFrameStore, type FrameStore, type StorageWarning } from '../core/storage'
import {
  InProcessSimSource,
  WebSocketSource,
  type IntervalScheduler,
  type TelemetrySource,
  type TimeoutScheduler,
  type WebSocketConstructor,
} from '../core/telemetry'
import type { DailyFrame, SourceStatus } from '../core/types'
import { dayOf } from '../sim/clock'
import { getScenario } from '../sim/scenarios'
import { Simulator } from '../sim/simulator'
import type { EngineOutputLite, UiToWorkerMessage, WorkerToUiMessage } from './protocol'
import { parseUiToWorkerMessage } from './protocolSchema'

export interface SessionInitStore extends FrameStore {
  initSession?(opts: {
    scenarioId: string
    seed?: number
    resume?: boolean
    startedAt?: number
  }): Promise<{ degraded: boolean; warning: StorageWarning | null }>
}

export interface WorkerHandlerDeps<THandle = unknown> {
  postMessage: (message: WorkerToUiMessage) => void
  scheduler: IntervalScheduler<THandle>
  frameStore?: SessionInitStore
  tickMs?: number
  /** FAZ_11 §3.3: INIT {source:'ws'} için enjekte edilen WebSocket kurucusu ve zamanlayıcı (yoksa yerel kaynak). */
  webSocket?: WebSocketConstructor
  timers?: TimeoutScheduler
}

type ActiveSource = TelemetrySource & { getStatus(): SourceStatus; close?(): void }

interface SourceChoice {
  source?: 'local' | 'ws' | undefined
  wsUrl?: string | undefined
}

export interface WorkerHandler {
  handleMessage(raw: unknown): void
  dispose(): void
}

const DEFAULT_TICK_MS = 100

function toOutputLite(output: EngineOutput, totalDataQualityCount: number, warning?: StorageWarning): EngineOutputLite {
  const lastDecision = output.decisions?.at(-1)
  return {
    t: output.t,
    ...(output.baselines && output.baselines.length > 0 ? { baselines: output.baselines } : {}),
    ...(output.alertEvents ? { alertEvents: output.alertEvents } : {}),
    ...(output.states ? { states: output.states } : {}),
    ...(output.moduleReports && output.moduleReports.length > 0 ? { moduleReports: output.moduleReports } : {}),
    ...(output.decisions && output.decisions.length > 0 ? { decisions: output.decisions } : {}),
    ...(lastDecision ? { cards: lastDecision.cards } : {}),
    dataQualityCount: totalDataQualityCount,
    ...(output.dataQuality.length > 0 ? { dataQuality: output.dataQuality } : {}),
    ...(output.faults.length > 0 ? { faults: output.faults } : {}),
    ...(warning ? { storageWarning: warning } : {}),
  }
}

export function createWorkerHandler<THandle = unknown>(
  deps: WorkerHandlerDeps<THandle>,
): WorkerHandler {
  const store: SessionInitStore = deps.frameStore ?? new MemoryFrameStore()
  const tickMs = deps.tickMs ?? DEFAULT_TICK_MS

  let source: ActiveSource | null = null
  // ws modunda mürettebat profili/görev süresi yerelde aynı senaryo+seed'den türetilir (radyasyon modülü için).
  let metaRef: { sim: Simulator } | null = null
  let getCrewSim: (() => Simulator) | null = null
  let engine: Engine | null = null
  let unsubFrames: (() => void) | null = null
  let unsubStatus: (() => void) | null = null
  let pendingStorageWarning: StorageWarning | undefined
  const dailyByCrewDay = new Map<string, DailyFrame>()
  const latestDailyByCrew = new Map<string, DailyFrame>()

  const clearDailyCache = (): void => {
    dailyByCrewDay.clear()
    latestDailyByCrew.clear()
  }

  const recordAcceptedDailyFrames = (frames: readonly import('../core/types').TelemetryFrame[]): void => {
    for (const f of frames) {
      if (f.kind === 'daily') {
        dailyByCrewDay.set(`${f.crewId}|${f.day}`, f)
        latestDailyByCrew.set(f.crewId, f)
      }
    }
  }

  const detachSource = (): void => {
    source?.pause()
    source?.close?.()
    unsubFrames?.()
    unsubStatus?.()
    unsubFrames = null
    unsubStatus = null
  }

  const createLocal = (scenarioId: string, seed: number | undefined, speed: number): InProcessSimSource<THandle> =>
    new InProcessSimSource({
      scheduler: deps.scheduler,
      scenarioId,
      ...(seed !== undefined ? { seed } : {}),
      speed,
      tickMs,
    })

  const createSource = (
    scenarioId: string,
    seed: number | undefined,
    speed: number,
    choice: SourceChoice,
  ): { src: ActiveSource; crewSim: () => Simulator } => {
    if (choice.source === 'ws') {
      if (choice.wsUrl && deps.webSocket && deps.timers) {
        const meta = { sim: new Simulator(getScenario(scenarioId), seed !== undefined ? { seed } : {}) }
        metaRef = meta
        const ws = new WebSocketSource({
          url: choice.wsUrl,
          WebSocket: deps.webSocket,
          timers: deps.timers,
          scenarioId,
          ...(seed !== undefined ? { seed } : {}),
          speed,
          fallbackToLocal: true,
          createLocalSource: (req) => createLocal(req.scenarioId, req.seed, req.speed),
          onProtocolError: (message) => deps.postMessage({ type: 'ERROR', code: 'WS_PROTOCOL', message }),
        })
        return { src: ws, crewSim: () => meta.sim }
      }
      deps.postMessage({
        type: 'ERROR',
        code: 'WS_UNAVAILABLE',
        message: choice.wsUrl ? 'WebSocket bu ortamda yok; yerel simülatör kullanılıyor' : 'wsUrl verilmedi; yerel simülatör kullanılıyor',
      })
    }
    metaRef = null
    const local = createLocal(scenarioId, seed, speed)
    return { src: local, crewSim: () => local.getSimulator() }
  }

  const initPipeline = (scenarioId: string, seed: number | undefined, speed: number, choice: SourceChoice = {}): void => {
    detachSource()
    clearDailyCache()
    // Senaryo varlığını doğrula (yoksa açık hata)
    const scenario = getScenario(scenarioId)

    const { src: currentSource, crewSim } = createSource(scenarioId, seed, speed, choice)
    getCrewSim = crewSim
    const currentEngine = createDefaultEngine({
      persist: store,
      onPersistError: (err) => {
        pendingStorageWarning = {
          code: 'DEXIE_ERROR',
          message: err instanceof Error ? err.message : String(err),
        }
      },
      scenario,
      crewProfiles: crewSim().getCrew(),
      // Radyasyon modülü: o anki senaryonun mürettebat kariyer dozu ve görev süresi (SET_SCENARIO sonrası da güncel).
      priorCareerDoseMsv: (crewId) =>
        crewSim()
          .getCrew()
          .find((c) => c.id === crewId)?.priorCareerDoseMsv,
      missionDays: () => crewSim().scenario.durationDays,
    })

    if (store.initSession) {
      void store
        .initSession({
          scenarioId,
          ...(seed !== undefined ? { seed } : {}),
          resume: false,
        })
        .then((res) => {
          if (res.warning) pendingStorageWarning = res.warning
        })
        .catch((err: unknown) => {
          pendingStorageWarning = {
            code: 'DEXIE_ERROR',
            message: err instanceof Error ? err.message : String(err),
          }
        })
    } else {
      void store.clear().catch(() => undefined)
    }

    unsubFrames = currentSource.onFrames((frames, simT) => {
      const output = currentEngine.ingest(frames, simT)
      recordAcceptedDailyFrames(output.acceptedFrames)
      const chartFrames = extractChartFrames(output.acceptedFrames)
      if (chartFrames.length > 0) {
        deps.postMessage({ type: 'FRAMES_BATCH', frames: chartFrames })
      }
      const warning = pendingStorageWarning
      pendingStorageWarning = undefined
      const snap = currentEngine.snapshot()
      deps.postMessage({
        type: 'ENGINE_OUTPUT',
        output: toOutputLite(output, snap.dataQualityCount, warning),
      })
    })

    unsubStatus = currentSource.onStatus((status) => {
      deps.postMessage({ type: 'STATUS', status })
    })

    engine = currentEngine
    source = currentSource
  }

  const dispatch = (msg: UiToWorkerMessage): void => {
    switch (msg.type) {
      case 'INIT': {
        initPipeline(msg.scenarioId, msg.seed, msg.speed, { source: msg.source, wsUrl: msg.wsUrl })
        deps.postMessage({ type: 'READY' })
        if (source && engine) {
          deps.postMessage({ type: 'STATUS', status: source.getStatus() })
          deps.postMessage({ type: 'SNAPSHOT', snapshot: engine.snapshot() })
        }
        return
      }
      case 'START': {
        if (!source) {
          deps.postMessage({
            type: 'ERROR',
            code: 'NOT_INITIALIZED',
            message: 'Worker henüz INIT edilmedi',
          })
          return
        }
        source.start()
        return
      }
      case 'PAUSE': {
        source?.pause()
        return
      }
      case 'RESET': {
        if (!source || !engine) return
        clearDailyCache()
        source.reset()
        engine.reset()
        void store.clear().catch(() => undefined)
        deps.postMessage({ type: 'SNAPSHOT', snapshot: engine.snapshot() })
        return
      }
      case 'SET_SPEED': {
        source?.setSpeed(msg.speedMultiplier)
        return
      }
      case 'SET_SCENARIO': {
        if (!source || !engine) {
          initPipeline(msg.id, msg.seed, 1)
        } else {
          clearDailyCache()
          const scenario = getScenario(msg.id)
          if (metaRef) metaRef.sim = new Simulator(scenario, msg.seed !== undefined ? { seed: msg.seed } : {})
          source.setScenario(msg.id, msg.seed)
          engine.setScenario(scenario, getCrewSim ? getCrewSim().getCrew() : undefined)
          engine.reset()
          void store.clear().catch(() => undefined)
        }
        if (engine) {
          deps.postMessage({ type: 'SNAPSHOT', snapshot: engine.snapshot() })
        }
        return
      }
      case 'SEEK_BOOKMARK': {
        if (!source || !engine) return
        const targetBookmark = getCrewSim?.().scenario.bookmarks?.[msg.index]
        if (targetBookmark && targetBookmark.t < source.getStatus().simT) {
          clearDailyCache()
          engine.reset()
          void store.clear().catch(() => undefined)
        }
        source.seekToBookmark?.(msg.index)
        deps.postMessage({ type: 'SNAPSHOT', snapshot: engine.snapshot() })
        return
      }
      case 'ACK_ALERT': {
        if (!engine) return
        const event = engine.ackAlert(msg.alertId)
        if (event) {
          const snap = engine.snapshot()
          deps.postMessage({
            type: 'ENGINE_OUTPUT',
            output: {
              t: event.t,
              alertEvents: [event],
              cards: snap.cards,
              ...(snap.decision ? { decisions: [snap.decision] } : {}),
              dataQualityCount: snap.dataQualityCount,
            },
          })
        }
        return
      }
      case 'SUBMIT_CHECKIN':
      case 'SUBMIT_PVT': {
        if (!engine) return
        // Gizlilik kuralı: SUBMIT_CHECKIN.journalText cihazda kalır; motora, DailyFrame'e ve Earth Link'e girmez.
        const currentSimT = source?.getStatus().simT ?? engine.getSimT()
        const day = dayOf(currentSimT)
        const key = `${msg.crewId}|${day}`
        const existingDayFrame = dailyByCrewDay.get(key)
        const prevFrame = existingDayFrame ?? latestDailyByCrew.get(msg.crewId)
        const frameT = Math.max(currentSimT, prevFrame?.t ?? currentSimT)

        getCrewSim?.().recordUserSubmission(
          msg.crewId,
          day,
          msg.type === 'SUBMIT_CHECKIN'
            ? { mood: { stress: msg.mood.stress, mood: msg.mood.mood, motivation: msg.mood.motivation } }
            : { pvt: { medianMs: msg.medianMs, lapses: msg.lapses } },
        )

        const mergedDaily: DailyFrame = {
          kind: 'daily',
          t: frameT,
          crewId: msg.crewId,
          day,
          sleep: prevFrame
            ? { ...prevFrame.sleep }
            : { durationH: 7.5, efficiency: 0.88, midpointShiftMin: 0 },
          activity: prevFrame
            ? { ...prevFrame.activity }
            : { exerciseMin: 45, resistiveMin: 30 },
          hydrationL: prevFrame?.hydrationL ?? 2.5,
          ...(prevFrame?.cabinCo2ppm !== undefined ? { cabinCo2ppm: prevFrame.cabinCo2ppm } : {}),
          ...(existingDayFrame?.mood
            ? { mood: { ...existingDayFrame.mood } }
            : prevFrame?.mood
              ? { mood: { ...prevFrame.mood } }
              : {}),
          ...(existingDayFrame?.pvt
            ? { pvt: { ...existingDayFrame.pvt } }
            : prevFrame?.pvt
              ? { pvt: { ...prevFrame.pvt } }
              : {}),
          ...(msg.type === 'SUBMIT_CHECKIN'
            ? {
                mood: {
                  stress: msg.mood.stress,
                  mood: msg.mood.mood,
                  motivation: msg.mood.motivation,
                },
              }
            : {
                pvt: {
                  medianMs: msg.medianMs,
                  lapses: msg.lapses,
                },
              }),
          userSubmitted: true,
          source: existingDayFrame?.source ?? 'SYNTHETIC',
        }

        const output = engine.ingest([mergedDaily], Math.max(engine.getSimT(), frameT))
        recordAcceptedDailyFrames(output.acceptedFrames)
        const chartFrames = extractChartFrames(output.acceptedFrames)
        if (chartFrames.length > 0) {
          deps.postMessage({ type: 'FRAMES_BATCH', frames: chartFrames })
        }
        const warning = pendingStorageWarning
        pendingStorageWarning = undefined
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: toOutputLite(output, snap.dataQualityCount, warning),
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'ACCEPT_ACTION': {
        if (!engine) return
        engine.acceptAction(msg.cardId)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'DISMISS_ACTION': {
        if (!engine) return
        engine.dismissAction(msg.cardId)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'COMPLETE_ACTION': {
        if (!engine) return
        engine.completeAction(msg.cardId)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'SET_EARTH_LINK': {
        if (!engine) return
        engine.setEarthLinkConfig(msg.config)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'SET_CONSENT': {
        if (!engine) return
        engine.setConsentCategories(msg.categories)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'GROUND_REPLY': {
        if (!engine) return
        engine.triggerGroundReply(msg.templateId, msg.relatedAlertId)
        const snap = engine.snapshot()
        deps.postMessage({
          type: 'ENGINE_OUTPUT',
          output: {
            t: snap.t,
            cards: snap.cards,
            ...(snap.decision ? { decisions: [snap.decision] } : {}),
            dataQualityCount: snap.dataQualityCount,
          },
        })
        deps.postMessage({ type: 'SNAPSHOT', snapshot: snap })
        return
      }
      case 'REQUEST_VALIDATION':
      case 'CANCEL_VALIDATION':
        // Faz 8 doğrulama CLI ve sekme yükleyicisi üzerinden çalışır.
        return
    }
  }

  return {
    handleMessage(raw: unknown): void {
      const parsed = parseUiToWorkerMessage(raw)
      if (!parsed.ok) {
        deps.postMessage({ type: 'ERROR', code: 'INVALID_MESSAGE', message: parsed.error })
        return
      }
      try {
        dispatch(parsed.data)
      } catch (err) {
        deps.postMessage({
          type: 'ERROR',
          code: 'WORKER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
    dispose(): void {
      detachSource()
      source = null
      engine = null
    },
  }
}
