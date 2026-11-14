import { z } from 'zod'
import { EARTH_LINK_PRESETS } from '../types/earthlink'
import { finite, SimTimeMsSchema } from './common.schema'

export const EarthLinkConfigSchema = z.object({
  oneWayDelaySec: finite(),
  preset: z.enum(EARTH_LINK_PRESETS),
  blackout: z.boolean(),
})

export const MessageSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['UP', 'DOWN']),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  category: z.string().min(1),
  createdT: SimTimeMsSchema,
  sendT: SimTimeMsSchema.optional(),
  arriveT: SimTimeMsSchema.optional(),
  payload: z.unknown(),
  status: z.enum(['QUEUED', 'IN_FLIGHT', 'DELIVERED']),
})
