// Yer istasyonu (ws) tel protokolü (FAZ_11 §3.3–3.4). İstemci (WebSocketSource) ve sunucu (server/) AYNI şemaları
// kullanır. Çerçeveler `TelemetryFrameSchema` ile doğrulanır. Saf TS, DOM yok.
import { z } from 'zod'
import { finite, SimTimeMsSchema } from '../schema/common.schema'
import { TelemetryFrameSchema } from '../schema/frame.schema'
import type { SourceStatus, TelemetryFrame } from '../types'

export const SourceStatusSchema = z.object({
  running: z.boolean(),
  simT: SimTimeMsSchema,
  day: finite(),
  speed: finite(),
  scenarioId: z.string().min(1),
  connected: z.boolean().optional(),
})

/** Sunucu → istemci. `FRAMES` zarfı önce doğrulanır, çerçeveler ayrı ayrı (geçersiz olan atılır, sayılır). */
export const ServerEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FRAMES'),
    frames: z.array(z.unknown()),
    simT: SimTimeMsSchema,
    status: SourceStatusSchema.optional(),
  }),
  z.object({ type: z.literal('STATUS'), status: SourceStatusSchema }),
  z.object({ type: z.literal('ERROR'), message: z.string() }),
])
export type ServerEnvelope = z.infer<typeof ServerEnvelopeSchema>

export type ServerMessage =
  | { type: 'FRAMES'; frames: TelemetryFrame[]; simT: number; status?: SourceStatus }
  | { type: 'STATUS'; status: SourceStatus }
  | { type: 'ERROR'; message: string }

/** İstemci → sunucu komutları. */
export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('PAUSE') }),
  z.object({ type: z.literal('RESET') }),
  z.object({ type: z.literal('SET_SPEED'), speedMultiplier: finite() }),
  z.object({ type: z.literal('SET_SCENARIO'), id: z.string().min(1), seed: finite().optional() }),
  z.object({ type: z.literal('SEEK_BOOKMARK'), index: z.number().int().nonnegative() }),
])
export type ClientCommand = z.infer<typeof ClientCommandSchema>

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

function parseJson(raw: unknown): ParseResult<unknown> {
  if (typeof raw !== 'string') return { ok: false, error: 'mesaj metin değil' }
  try {
    return { ok: true, data: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false, error: 'geçersiz JSON' }
  }
}

export interface ParsedServerMessage {
  message: ServerMessage
  /** FRAMES içinde şemaya uymadığı için atılan çerçeve sayısı. */
  rejectedFrames: number
}

export function parseServerMessage(raw: unknown): ParseResult<ParsedServerMessage> {
  const json = parseJson(raw)
  if (!json.ok) return json
  const env = ServerEnvelopeSchema.safeParse(json.data)
  if (!env.success) return { ok: false, error: env.error.issues[0]?.message ?? 'geçersiz zarf' }
  const e = env.data
  if (e.type !== 'FRAMES') return { ok: true, data: { message: e, rejectedFrames: 0 } }
  const frames: TelemetryFrame[] = []
  let rejectedFrames = 0
  for (const f of e.frames) {
    const p = TelemetryFrameSchema.safeParse(f)
    if (p.success) frames.push(p.data)
    else rejectedFrames++
  }
  return {
    ok: true,
    data: {
      message: { type: 'FRAMES', frames, simT: e.simT, ...(e.status ? { status: e.status } : {}) },
      rejectedFrames,
    },
  }
}

export function parseClientCommand(raw: unknown): ParseResult<ClientCommand> {
  const json = parseJson(raw)
  if (!json.ok) return json
  const p = ClientCommandSchema.safeParse(json.data)
  return p.success ? { ok: true, data: p.data } : { ok: false, error: p.error.issues[0]?.message ?? 'geçersiz komut' }
}
