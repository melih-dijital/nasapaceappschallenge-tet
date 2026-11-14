import { z } from 'zod'
import { ENVIRONMENTS, FRAME_SOURCES } from '../types/frame'
import { CrewIdSchema, finite, SimTimeMsSchema } from './common.schema'

export const FrameSourceSchema = z.enum(FRAME_SOURCES)
export const EnvironmentSchema = z.enum(ENVIRONMENTS)

export const VitalsFrameSchema = z.object({
  kind: z.literal('vitals'),
  t: SimTimeMsSchema,
  crewId: CrewIdSchema,
  hr: finite(),
  spo2: finite(),
  hrv: finite().optional(),
  source: FrameSourceSchema,
})

export const DailyFrameSchema = z.object({
  kind: z.literal('daily'),
  t: SimTimeMsSchema,
  crewId: CrewIdSchema,
  day: finite(),
  sleep: z.object({
    durationH: finite(),
    efficiency: finite(),
    midpointShiftMin: finite(),
  }),
  activity: z.object({
    exerciseMin: finite(),
    resistiveMin: finite(),
  }),
  hydrationL: finite(),
  cabinCo2ppm: finite().optional(),
  mood: z
    .object({
      stress: finite(),
      mood: finite(),
      motivation: finite(),
    })
    .optional(),
  pvt: z
    .object({
      medianMs: finite(),
      lapses: finite(),
    })
    .optional(),
  userSubmitted: z.boolean().optional(),
  source: FrameSourceSchema,
})

export const RadiationFrameSchema = z.object({
  kind: z.literal('radiation'),
  t: SimTimeMsSchema,
  crewId: CrewIdSchema,
  doseRateMsvDay: finite(),
  protonFluxPfu: finite().optional(),
  environment: EnvironmentSchema,
  source: FrameSourceSchema,
})

export const TelemetryFrameSchema = z.discriminatedUnion('kind', [
  VitalsFrameSchema,
  DailyFrameSchema,
  RadiationFrameSchema,
])
