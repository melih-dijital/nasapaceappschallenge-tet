// EngineClient sözleşmesi ve Worker/InProcess uygulamaları (FAZ_01, FAZ_03 §3.4–3.5).
// Store'lara YALNIZCA EngineClient yazar; UI bileşenleri yalnızca okur ve actions.ts üzerinden komut yollar.
import { MemoryFrameStore } from '../core/storage'
import type { IntervalScheduler } from '../core/telemetry'
import type { UiToWorkerMessage, WorkerToUiMessage } from '../workers/protocol'
import { createWorkerHandler, type WorkerHandler } from '../workers/workerHandler'
import { useAlertStore } from './alertStore'
import { useDecisionStore } from './decisionStore'
import { useEarthLinkStore } from './earthLinkStore'
import { useSessionStore } from './sessionStore'
import { useStateStore } from './stateStore'
import { useTelemetryStore } from './telemetryStore'

export type EngineListener = (message: WorkerToUiMessage) => void

export interface EngineClient {
  send(message: UiToWorkerMessage): void
  /** Dönen fonksiyon aboneliği kaldırır. */
  subscribe(listener: EngineListener): () => void
  dispose(): void
}

export interface WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: unknown): void
  terminate(): void
}

export interface CreateEngineClientOptions {
  connectStores?: boolean
  forceInProcess?: boolean
  workerFactory?: () => WorkerLike
  scheduler?: IntervalScheduler
}

export function applyWorkerMessageToStores(message: WorkerToUiMessage): void {
  const session = useSessionStore.getState()
  const telemetry = useTelemetryStore.getState()
  const alerts = useAlertStore.getState()
  const states = useStateStore.getState()
  const decisions = useDecisionStore.getState()

  switch (message.type) {
    case 'READY':
      session.setWorkerStatus('ready')
      session.setError(null)
      return
    case 'STATUS':
      session.applyStatus(message.status)
      return
    case 'FRAMES_BATCH':
      telemetry.applyFramesBatch(message.frames)
      return
    case 'ENGINE_OUTPUT': {
      telemetry.applyOutput(message.output)
      if (message.output.alertEvents) alerts.applyAlertEvents(message.output.alertEvents)
      if (message.output.states) states.setStates(message.output.states)
      if (message.output.cards) decisions.setCards(message.output.cards)
      const lastDecision = message.output.decisions?.at(-1)
      if (lastDecision) {
        decisions.setDecision(lastDecision)
        useEarthLinkStore.getState().applyEarthState(lastDecision.earth)
      }
      return
    }
    case 'SNAPSHOT':
      if (message.snapshot.t === 0 && Object.keys(message.snapshot.latest).length === 0) {
        telemetry.reset()
      }
      telemetry.applySnapshot(message.snapshot)
      alerts.setAlerts(message.snapshot.activeAlerts)
      states.setStates(message.snapshot.states)
      decisions.setCards(message.snapshot.cards)
      if (message.snapshot.decision) {
        decisions.setDecision(message.snapshot.decision)
        useEarthLinkStore.getState().applyEarthState(message.snapshot.decision.earth)
      }
      return
    case 'ERROR':
      if (message.code === 'DEXIE_ERROR') {
        telemetry.setStorageWarning({ code: 'DEXIE_ERROR', message: message.message })
      } else {
        session.setError({ code: message.code, message: message.message })
        if (message.code === 'WORKER_CRASHED') {
          session.setWorkerStatus('error')
        }
      }
      return
    case 'VALIDATION_PROGRESS':
    case 'VALIDATION_RESULT':
      return
  }
}

export class WorkerEngineClient implements EngineClient {
  private readonly listeners = new Set<EngineListener>()
  private readonly workerFactory: () => WorkerLike
  private readonly connectStores: boolean
  private worker: WorkerLike | null = null
  private lastInit: UiToWorkerMessage | null = null
  private disposed = false

  constructor(opts: { workerFactory?: () => WorkerLike; connectStores?: boolean } = {}) {
    this.workerFactory =
      opts.workerFactory ??
      (() =>
        new Worker(new URL('../workers/sim.worker.ts', import.meta.url), {
          type: 'module',
        }))
    this.connectStores = opts.connectStores ?? true
    this.spawnWorker()
  }

  send(message: UiToWorkerMessage): void {
    if (this.disposed) return
    if (message.type === 'INIT') {
      this.lastInit = message
      if (this.connectStores) {
        useSessionStore.getState().setWorkerStatus('initializing')
        useSessionStore.getState().setScenarioMeta(message.scenarioId, message.seed)
      }
    }
    if (!this.worker) {
      this.spawnWorker()
    }
    this.worker?.postMessage(message)
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.worker?.terminate()
    this.worker = null
    this.listeners.clear()
  }

  private spawnWorker(): WorkerLike | null {
    if (this.disposed) return null
    const w = this.workerFactory()
    w.onmessage = (event: MessageEvent<unknown>) => {
      const msg = event.data as WorkerToUiMessage
      this.emit(msg)
    }
    w.onerror = (event: ErrorEvent) => {
      const detail = event.message || 'Worker runtime error'
      this.emit({ type: 'ERROR', code: 'WORKER_CRASHED', message: detail })
      w.terminate()
      if (this.disposed) return
      if (this.connectStores) {
        useSessionStore.getState().setWorkerStatus('restarting')
      }
      this.worker = null
      const restarted = this.spawnWorker()
      if (this.lastInit && restarted) {
        restarted.postMessage(this.lastInit)
      }
    }
    this.worker = w
    return w
  }

  private emit(message: WorkerToUiMessage): void {
    if (this.connectStores) {
      applyWorkerMessageToStores(message)
    }
    for (const listener of this.listeners) {
      listener(message)
    }
  }
}

/** Worker desteklenmeyen ortamlarda (ör. çok eski tarayıcı veya Node testi) ana iş parçacığı yedeği. */
export class InProcessEngineClient implements EngineClient {
  private readonly listeners = new Set<EngineListener>()
  private readonly connectStores: boolean
  private readonly handler: WorkerHandler
  private disposed = false

  constructor(opts: { connectStores?: boolean; scheduler?: IntervalScheduler } = {}) {
    this.connectStores = opts.connectStores ?? true
    const scheduler: IntervalScheduler = opts.scheduler ?? {
      setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
      clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
    }

    this.handler = createWorkerHandler({
      scheduler,
      frameStore: new MemoryFrameStore(),
      postMessage: (msg) => {
        if (this.disposed) return
        if (this.connectStores) {
          applyWorkerMessageToStores(msg)
        }
        for (const listener of this.listeners) {
          listener(msg)
        }
      },
    })
  }

  send(message: UiToWorkerMessage): void {
    if (this.disposed) return
    if (message.type === 'INIT' && this.connectStores) {
      useSessionStore.getState().setWorkerStatus('initializing')
      useSessionStore.getState().setScenarioMeta(message.scenarioId, message.seed)
    }
    this.handler.handleMessage(message)
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.handler.dispose()
    this.listeners.clear()
  }
}

export function createEngineClient(options: CreateEngineClientOptions = {}): EngineClient {
  if (options.workerFactory) {
    return new WorkerEngineClient({
      workerFactory: options.workerFactory,
      ...(options.connectStores !== undefined ? { connectStores: options.connectStores } : {}),
    })
  }
  const canUseWorker = !options.forceInProcess && typeof Worker !== 'undefined'
  if (canUseWorker) {
    return new WorkerEngineClient({
      ...(options.connectStores !== undefined ? { connectStores: options.connectStores } : {}),
    })
  }
  return new InProcessEngineClient({
    ...(options.connectStores !== undefined ? { connectStores: options.connectStores } : {}),
    ...(options.scheduler ? { scheduler: options.scheduler } : {}),
  })
}

let sharedClient: EngineClient | null = null

export function getEngineClient(): EngineClient {
  if (!sharedClient) {
    sharedClient = createEngineClient()
  }
  return sharedClient
}

export function setEngineClient(client: EngineClient | null): void {
  sharedClient?.dispose()
  sharedClient = client
}
