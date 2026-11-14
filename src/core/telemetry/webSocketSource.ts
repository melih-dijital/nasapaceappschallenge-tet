// WebSocket telemetri kaynağı (FAZ_11 §3.3). Saf TS: `WebSocket` kurucusu ve zamanlayıcı ENJEKTE edilir (core'da
// global yok). Sunucu mesajları Zod ile doğrulanır (wsProtocol). Bağlantı koparsa üstel geri çekilmeyle yeniden dener
// ve `SourceStatus.connected` yayınlar. `fallbackToLocal` ile bağlantı kurulamazsa yerel simülatöre düşer: kokpit asla boş
// kalmaz.
import type { ScenarioId, SimTimeMs, SourceStatus, TelemetryFrame } from '../types'
import type { TelemetrySource } from './source'
import { parseServerMessage, type ClientCommand } from './wsProtocol'

/** Tarayıcı `WebSocket` ve `ws` paketinin ortak alt kümesi. */
export interface WsMessageEventLike {
  readonly data: unknown
}
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'open' | 'close' | 'error', listener: () => void): void
  addEventListener(type: 'message', listener: (ev: WsMessageEventLike) => void): void
}
export type WebSocketConstructor = new (url: string) => WebSocketLike

export interface TimeoutScheduler<THandle = unknown> {
  setTimeout(callback: () => void, delayMs: number): THandle
  clearTimeout(handle: THandle): void
}

export interface BackoffOptions {
  initialMs?: number
  maxMs?: number
  factor?: number
}

export interface LocalSourceRequest {
  scenarioId: ScenarioId
  seed?: number
  speed: number
}

export interface WebSocketSourceOptions<THandle = unknown> {
  url: string
  WebSocket: WebSocketConstructor
  timers: TimeoutScheduler<THandle>
  /** Bağlanınca sunucuya gönderilecek senaryo (yalnızca İLK bağlantıda; yeniden bağlanmada sunucu sıfırlanmaz). */
  scenarioId?: ScenarioId
  seed?: number
  speed?: number
  backoff?: BackoffOptions
  /** Bağlantı kurulamazsa yerel simülatöre düş (varsayılan false). `createLocalSource` zorunlu. */
  fallbackToLocal?: boolean
  /** Fallback'ten önce kaç ardışık başarısız deneme (varsayılan 3). */
  fallbackAfterFailures?: number
  createLocalSource?: (req: LocalSourceRequest) => TelemetrySource
  onProtocolError?: (error: string) => void
}

// Ağ yeniden deneme ayarları (mühendislik varsayılanı, sağlık eşiği değil; seçenekle değiştirilebilir).
const DEFAULT_BACKOFF: Required<BackoffOptions> = { initialMs: 500, maxMs: 10_000, factor: 2 }
const DEFAULT_FALLBACK_AFTER_FAILURES = 3
const WS_OPEN = 1

export type WebSocketSourceMode = 'ws' | 'local'

export class WebSocketSource<THandle = unknown> implements TelemetrySource {
  readonly kind = 'WEBSOCKET' as const

  private readonly opts: WebSocketSourceOptions<THandle>
  private readonly backoff: Required<BackoffOptions>
  private readonly frameListeners = new Set<(frames: TelemetryFrame[], simT: SimTimeMs) => void>()
  private readonly statusListeners = new Set<(s: SourceStatus) => void>()

  private ws: WebSocketLike | null = null
  private connected = false
  private everConnected = false
  private failures = 0
  private retryHandle: { h: THandle } | null = null
  private closed = false

  // İstenen durum (bağlantı yokken biriktirilir, açılınca senkronlanır).
  private running = false
  private speed: number
  private scenarioId: ScenarioId
  private seed: number | undefined
  private scenarioPending: boolean

  private lastStatus: SourceStatus | null = null
  private mode: WebSocketSourceMode = 'ws'
  private local: TelemetrySource | null = null
  private localUnsubs: (() => void)[] = []

  private protocolErrors = 0
  private rejectedFrames = 0

  constructor(opts: WebSocketSourceOptions<THandle>) {
    if (opts.fallbackToLocal && !opts.createLocalSource) {
      throw new Error('WebSocketSource: fallbackToLocal için createLocalSource gerekli')
    }
    this.opts = opts
    this.backoff = { ...DEFAULT_BACKOFF, ...opts.backoff }
    this.speed = opts.speed ?? 1
    this.scenarioId = opts.scenarioId ?? 'demo_main'
    this.seed = opts.seed
    this.scenarioPending = opts.scenarioId !== undefined
  }

  // ---- TelemetrySource ----

  onFrames(cb: (frames: TelemetryFrame[], simT: SimTimeMs) => void): () => void {
    this.frameListeners.add(cb)
    return () => {
      this.frameListeners.delete(cb)
    }
  }

  onStatus(cb: (s: SourceStatus) => void): () => void {
    this.statusListeners.add(cb)
    return () => {
      this.statusListeners.delete(cb)
    }
  }

  start(): void {
    this.running = true
    if (this.local) {
      this.local.start()
      return
    }
    if (!this.ws && !this.retryHandle) this.connect()
    else this.send({ type: 'START' })
    this.emitStatus()
  }

  pause(): void {
    this.running = false
    if (this.local) {
      this.local.pause()
      return
    }
    this.send({ type: 'PAUSE' })
    this.emitStatus()
  }

  reset(): void {
    this.running = false
    if (this.local) {
      this.local.reset()
      return
    }
    this.send({ type: 'RESET' })
    this.emitStatus()
  }

  setSpeed(speedMultiplier: number): void {
    this.speed = speedMultiplier
    if (this.local) {
      this.local.setSpeed(speedMultiplier)
      return
    }
    this.send({ type: 'SET_SPEED', speedMultiplier })
    this.emitStatus()
  }

  setScenario(id: ScenarioId, seed?: number): void {
    this.scenarioId = id
    this.seed = seed
    this.running = false
    if (this.local) {
      this.local.setScenario(id, seed)
      return
    }
    this.scenarioPending = !this.connected
    this.send({ type: 'SET_SCENARIO', id, ...(seed !== undefined ? { seed } : {}) })
    this.emitStatus()
  }

  seekToBookmark(index: number): void {
    if (this.local) {
      this.local.seekToBookmark?.(index)
      return
    }
    this.send({ type: 'SEEK_BOOKMARK', index })
  }

  // ---- Ek API ----

  getStatus(): SourceStatus {
    const base: SourceStatus = this.lastStatus ?? {
      running: this.running,
      simT: 0,
      day: 0,
      speed: this.speed,
      scenarioId: this.scenarioId,
    }
    return { ...base, connected: this.connected }
  }

  getMode(): WebSocketSourceMode {
    return this.mode
  }

  getStats(): { failures: number; protocolErrors: number; rejectedFrames: number } {
    return { failures: this.failures, protocolErrors: this.protocolErrors, rejectedFrames: this.rejectedFrames }
  }

  /** Bağlantıyı ve yeniden denemeyi kalıcı olarak kapatır. */
  close(): void {
    this.closed = true
    this.clearRetry()
    const ws = this.ws
    this.ws = null
    this.connected = false
    ws?.close()
    this.local?.pause()
    for (const u of this.localUnsubs) u()
    this.localUnsubs = []
  }

  // ---- iç ----

  private connect(): void {
    if (this.closed || this.local) return
    let ws: WebSocketLike
    try {
      ws = new this.opts.WebSocket(this.opts.url)
    } catch (err) {
      this.reportProtocolError(err instanceof Error ? err.message : String(err))
      this.handleClose(null)
      return
    }
    this.ws = ws
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return
      this.connected = true
      this.everConnected = true
      this.failures = 0
      this.syncOnOpen()
      this.emitStatus()
    })
    ws.addEventListener('message', (ev) => {
      if (this.ws !== ws) return
      this.handleMessage(ev.data)
    })
    // Tarayıcıda `error` ardından her zaman `close` gelir; yeniden deneme `close`'ta.
    ws.addEventListener('error', () => undefined)
    ws.addEventListener('close', () => this.handleClose(ws))
  }

  private syncOnOpen(): void {
    if (this.scenarioPending) {
      this.scenarioPending = false
      this.send({ type: 'SET_SCENARIO', id: this.scenarioId, ...(this.seed !== undefined ? { seed: this.seed } : {}) })
    }
    this.send({ type: 'SET_SPEED', speedMultiplier: this.speed })
    this.send({ type: this.running ? 'START' : 'PAUSE' })
  }

  private handleClose(ws: WebSocketLike | null): void {
    if (ws !== null && this.ws !== ws) return
    this.ws = null
    const wasConnected = this.connected
    this.connected = false
    if (this.closed) return
    this.failures++
    if (wasConnected || this.failures === 1) this.emitStatus()
    const threshold = this.opts.fallbackAfterFailures ?? DEFAULT_FALLBACK_AFTER_FAILURES
    if (this.opts.fallbackToLocal && this.failures >= threshold) {
      this.activateFallback()
      return
    }
    const delay = Math.min(this.backoff.maxMs, this.backoff.initialMs * this.backoff.factor ** (this.failures - 1))
    this.clearRetry()
    this.retryHandle = {
      h: this.opts.timers.setTimeout(() => {
        this.retryHandle = null
        this.connect()
      }, delay),
    }
  }

  // ASSUMPTION: fallback "yapışkan" — yerel simülatöre geçince oturum boyunca orada kalınır. Yeniden ws'e dönmek sim
  // zamanını geri sardırır (motorda monotonluk ihlali); kullanıcı INIT ile yeniden seçebilir.
  private activateFallback(): void {
    const create = this.opts.createLocalSource
    if (!create || this.local) return
    this.clearRetry()
    this.mode = 'local'
    const local = create({
      scenarioId: this.scenarioId,
      ...(this.seed !== undefined ? { seed: this.seed } : {}),
      speed: this.speed,
    })
    this.local = local
    this.localUnsubs = [
      local.onFrames((frames, simT) => this.emitFrames(frames, simT)),
      local.onStatus((s) => {
        this.lastStatus = { ...s, connected: false }
        this.emitStatus()
      }),
    ]
    if (this.running) local.start()
    this.emitStatus()
  }

  private handleMessage(raw: unknown): void {
    const parsed = parseServerMessage(raw)
    if (!parsed.ok) {
      this.reportProtocolError(parsed.error)
      return
    }
    const { message, rejectedFrames } = parsed.data
    if (rejectedFrames > 0) {
      this.rejectedFrames += rejectedFrames
      this.reportProtocolError(`${rejectedFrames} çerçeve şemaya uymadı`)
    }
    switch (message.type) {
      case 'FRAMES':
        if (message.status) this.lastStatus = message.status
        if (message.frames.length > 0) this.emitFrames(message.frames, message.simT)
        if (message.status) this.emitStatus()
        return
      case 'STATUS':
        this.lastStatus = message.status
        this.emitStatus()
        return
      case 'ERROR':
        this.reportProtocolError(message.message)
        return
    }
  }

  private send(cmd: ClientCommand): void {
    const ws = this.ws
    if (!ws || !this.connected || ws.readyState !== WS_OPEN) return
    ws.send(JSON.stringify(cmd))
  }

  private clearRetry(): void {
    if (this.retryHandle) {
      this.opts.timers.clearTimeout(this.retryHandle.h)
      this.retryHandle = null
    }
  }

  private reportProtocolError(error: string): void {
    this.protocolErrors++
    this.opts.onProtocolError?.(error)
  }

  private emitFrames(frames: TelemetryFrame[], simT: SimTimeMs): void {
    for (const l of this.frameListeners) l(frames, simT)
  }

  private emitStatus(): void {
    const s = this.getStatus()
    for (const l of this.statusListeners) l(s)
  }

  /** Test/teşhis: bağlantı hiç kuruldu mu. */
  hasEverConnected(): boolean {
    return this.everConnected
  }
}
