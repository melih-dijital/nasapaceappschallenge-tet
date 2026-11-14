// Saf worker mesaj işleyicisi (FAZ_03 §3.4, §3.6). Worker olmadan doğrudan test edilebilir.
// Math.random ve Date.now yok.
import { createDefaultEngine, extractChartFrames, type Engine, type EngineOutput } from '../core/pipeline'
import { MemoryFrameStore, type FrameStore, type StorageWarning } from '../core/storage'
import { InProcessSimSource, type IntervalScheduler } from '../core/telemetry'
import { getScenario } from '../sim/scenarios'
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
}

export interface WorkerHandler {
  handleMessage(raw: unknown): void
  dispose(): void
}

const DEFAULT_TICK_MS = 100

function toOutputLite(output: EngineOutput, totalDataQualityCount: number, warning?: StorageWarning): EngineOutputLite {
  return {
    t: output.t,
    ...(output.baselines && output.baselines.length > 0 ? { baselines: output.baselines } : {}),
    ...(output.alertEvents ? { alertEvents: output.alertEvents } : {}),
    ...(output.states ? { states: output.states } : {}),
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

  let source: InProcessSimSource<THandle> | null = null
  let engine: Engine | null = null
  let unsubFrames: (() => void) | null = null
  let unsubStatus: (() => void) | null = null
  let pendingStorageWarning: StorageWarning | undefined

  const detachSource = (): void => {
    source?.pause()
    unsubFrames?.()
    unsubStatus?.()
    unsubFrames = null
    unsubStatus = null
  }

  const initPipeline = (scenarioId: string, seed: number | undefined, speed: number): void => {
    detachSource()
    // Senaryo varlığını doğrula (yoksa açık hata)
    getScenario(scenarioId)

    const currentEngine = createDefaultEngine({
      persist: store,
      onPersistError: (err) => {
        pendingStorageWarning = {
          code: 'DEXIE_ERROR',
          message: err instanceof Error ? err.message : String(err),
        }
      },
    })
    const currentSource = new InProcessSimSource({
      scheduler: deps.scheduler,
      scenarioId,
      ...(seed !== undefined ? { seed } : {}),
      speed,
      tickMs,
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
        initPipeline(msg.scenarioId, msg.seed, msg.speed)
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
          getScenario(msg.id)
          source.setScenario(msg.id, msg.seed)
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
        source.seekToBookmark?.(msg.index)
        deps.postMessage({ type: 'SNAPSHOT', snapshot: engine.snapshot() })
        return
      }
      case 'ACK_ALERT':
      case 'SUBMIT_CHECKIN':
      case 'SUBMIT_PVT':
      case 'ACCEPT_ACTION':
      case 'DISMISS_ACTION':
      case 'COMPLETE_ACTION':
      case 'SET_EARTH_LINK':
      case 'SET_CONSENT':
      case 'GROUND_REPLY':
      case 'REQUEST_VALIDATION':
      case 'CANCEL_VALIDATION':
        // Faz 5–8 aşamaları eklendikçe ilgili motor bileşenlerine yönlendirilecek.
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
