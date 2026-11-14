// Worker gelen mesajlarının Zod doğrulaması (FAZ_03 §3.4). Saf TS.
import { z } from 'zod'
import { CrewIdSchema, EarthLinkConfigSchema, finite } from '../core/schema'
import { CONSENT_CATEGORIES, type UiToWorkerMessage } from './protocol'

const ScenarioIdSchema = z.string().min(1)
const ConsentCategorySchema = z.enum(CONSENT_CATEGORIES)

export const UiToWorkerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INIT'),
    scenarioId: ScenarioIdSchema,
    seed: finite().optional(),
    speed: finite(),
    source: z.enum(['local', 'ws']).optional(),
    wsUrl: z.string().min(1).optional(),
  }),
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('PAUSE') }),
  z.object({ type: z.literal('RESET') }),
  z.object({ type: z.literal('SET_SPEED'), speedMultiplier: finite() }),
  z.object({
    type: z.literal('SET_SCENARIO'),
    id: ScenarioIdSchema,
    seed: finite().optional(),
  }),
  z.object({ type: z.literal('SEEK_BOOKMARK'), index: z.number().int().nonnegative() }),
  z.object({ type: z.literal('ACK_ALERT'), alertId: z.string().min(1) }),
  z.object({
    type: z.literal('SUBMIT_CHECKIN'),
    crewId: CrewIdSchema,
    mood: z.object({
      stress: finite(),
      mood: finite(),
      motivation: finite(),
    }),
    journalText: z.string().optional(),
  }),
  z.object({
    type: z.literal('SUBMIT_PVT'),
    crewId: CrewIdSchema,
    medianMs: finite(),
    lapses: finite(),
  }),
  z.object({ type: z.literal('ACCEPT_ACTION'), cardId: z.string().min(1) }),
  z.object({ type: z.literal('DISMISS_ACTION'), cardId: z.string().min(1) }),
  z.object({ type: z.literal('COMPLETE_ACTION'), cardId: z.string().min(1) }),
  z.object({
    type: z.literal('SET_EARTH_LINK'),
    config: EarthLinkConfigSchema.partial(),
  }),
  z.object({
    type: z.literal('SET_CONSENT'),
    categories: z.array(ConsentCategorySchema),
  }),
  z.object({
    type: z.literal('GROUND_REPLY'),
    templateId: z.string().min(1),
    relatedAlertId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('REQUEST_VALIDATION'),
    scenarios: z.array(ScenarioIdSchema).optional(),
    seeds: z.array(finite()).optional(),
    quick: z.boolean().optional(),
  }),
  z.object({ type: z.literal('CANCEL_VALIDATION') }),
])

export function parseUiToWorkerMessage(
  raw: unknown,
): { ok: true; data: UiToWorkerMessage } | { ok: false; error: string } {
  const result = UiToWorkerMessageSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; '),
    }
  }
  return { ok: true, data: result.data as UiToWorkerMessage }
}
