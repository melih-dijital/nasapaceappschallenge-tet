// Opsiyonel ws "yer istasyonu" (FAZ_11 §3.4). Yalnızca `ws` + tsx. Simulator'ı (core/sim) aynı `InProcessSimSource` ile
// çalıştırır ve `FRAMES` toplu mesajlarını ≤ 10 Hz yayınlar. Komutlar: START, PAUSE, RESET, SET_SPEED, SET_SCENARIO,
// SEEK_BOOKMARK. Çerçeveler ve komutlar istemciyle AYNI şemalarla doğrulanır (src/core/telemetry/wsProtocol).
// KİMLİK DOĞRULAMA / VERİTABANI YOK — yalnızca yerel demo amaçlı. Yayında (Vercel) sunucu yoktur.
import type { IncomingMessage } from 'node:http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { TelemetryFrameSchema } from '../src/core/schema/frame.schema'
import { InProcessSimSource } from '../src/core/telemetry/inProcessSource'
import { parseClientCommand, type ServerMessage } from '../src/core/telemetry/wsProtocol'
import type { SourceStatus, TelemetryFrame } from '../src/core/types'
import { getScenario } from '../src/sim/scenarios'

export interface GroundStationOptions {
  /** 0 → işletim sistemi boş port seçer (testler). */
  port: number
  host?: string
  scenarioId?: string
  speed?: number
  /** Yayın aralığı; ≤ 10 Hz kuralı gereği en az 100 ms (InProcessSimSource zorlar). */
  tickMs?: number
  /** İzinli tarayıcı Origin'leri (tam eşleşme). Origin'siz (tarayıcı dışı) istemciler ve localhost her zaman kabul. */
  allowedOrigins?: readonly string[]
  log?: (message: string) => void
}

export interface GroundStation {
  readonly port: number
  clientCount(): number
  getStatus(): SourceStatus
  close(): Promise<void>
}

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/

/** Basit Origin kontrolü (CORS benzeri). */
export function isOriginAllowed(origin: string | undefined, allowed: readonly string[] = []): boolean {
  if (origin === undefined || origin === '') return true
  if (LOCAL_ORIGIN.test(origin)) return true
  return allowed.includes(origin)
}

function rawToString(data: RawData): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  return Buffer.from(data).toString('utf8')
}

export function startGroundStation(opts: GroundStationOptions): Promise<GroundStation> {
  const log = opts.log ?? (() => undefined)
  const source = new InProcessSimSource<NodeJS.Timeout>({
    scheduler: {
      setInterval: (cb, ms) => setInterval(cb, ms),
      clearInterval: (h) => clearInterval(h),
    },
    scenarioId: opts.scenarioId ?? 'demo_main',
    speed: opts.speed ?? 1,
    ...(opts.tickMs !== undefined ? { tickMs: opts.tickMs } : {}),
  })

  const wss = new WebSocketServer({
    port: opts.port,
    ...(opts.host ? { host: opts.host } : {}),
    verifyClient: (info: { origin: string; req: IncomingMessage }) => {
      const ok = isOriginAllowed(info.origin, opts.allowedOrigins)
      if (!ok) log(`reddedildi: Origin ${info.origin}`)
      return ok
    },
  })

  let backfillCache: TelemetryFrame[] | null = null
  let lastFramesSimT: number | null = null

  const sendTo = (ws: WebSocket, msg: ServerMessage): void => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }
  const broadcast = (msg: ServerMessage): void => {
    const data = JSON.stringify(msg)
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(data)
  }

  source.onFrames((frames, simT) => {
    // İstemciyle aynı şema: geçersiz çerçeve yayınlanmaz.
    const valid = frames.filter((f) => TelemetryFrameSchema.safeParse(f).success)
    if (valid.length < frames.length) log(`${frames.length - valid.length} geçersiz çerçeve atıldı`)
    if (simT === 0) backfillCache = valid
    lastFramesSimT = simT
    // Tick sırası: simT güncellenir → çerçeveler → durum. Durum mesajı FRAMES içine gömülür (tick başına tek mesaj).
    broadcast({ type: 'FRAMES', frames: valid, simT, status: source.getStatus() })
  })
  source.onStatus((status) => {
    if (status.running && lastFramesSimT === status.simT) return // aynı tick'in FRAMES'inde gitti
    broadcast({ type: 'STATUS', status })
  })

  wss.on('connection', (ws) => {
    log(`istemci bağlandı (toplam ${wss.clients.size})`)
    sendTo(ws, { type: 'STATUS', status: source.getStatus() })
    // Geç katılan istemci: önbellekteki backfill (motor baseline'ı kurabilsin).
    if (backfillCache && backfillCache.length > 0) sendTo(ws, { type: 'FRAMES', frames: backfillCache, simT: 0 })

    ws.on('message', (data) => {
      const parsed = parseClientCommand(rawToString(data))
      if (!parsed.ok) {
        sendTo(ws, { type: 'ERROR', message: `geçersiz komut: ${parsed.error}` })
        return
      }
      const cmd = parsed.data
      switch (cmd.type) {
        case 'START':
          source.start()
          return
        case 'PAUSE':
          source.pause()
          return
        case 'RESET':
          backfillCache = null
          lastFramesSimT = null
          source.reset()
          return
        case 'SET_SPEED':
          source.setSpeed(cmd.speedMultiplier)
          return
        case 'SET_SCENARIO':
          try {
            getScenario(cmd.id)
          } catch (err) {
            sendTo(ws, { type: 'ERROR', message: err instanceof Error ? err.message : String(err) })
            return
          }
          backfillCache = null
          lastFramesSimT = null
          source.setScenario(cmd.id, cmd.seed)
          return
        case 'SEEK_BOOKMARK':
          source.seekToBookmark(cmd.index)
          return
      }
    })
    ws.on('close', () => log(`istemci ayrıldı (toplam ${wss.clients.size})`))
  })

  return new Promise((resolve, reject) => {
    wss.once('error', reject)
    wss.once('listening', () => {
      const address = wss.address()
      const port = typeof address === 'object' && address !== null ? address.port : opts.port
      resolve({
        port,
        clientCount: () => wss.clients.size,
        getStatus: () => source.getStatus(),
        close: () =>
          new Promise<void>((done) => {
            source.pause()
            for (const c of wss.clients) c.terminate()
            wss.close(() => done())
          }),
      })
    })
  })
}
