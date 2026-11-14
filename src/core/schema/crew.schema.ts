import { z } from 'zod'
import { AGE_BANDS, CREW_ROLES } from '../types/crew'
import { CrewIdSchema, finite, MetricIdSchema } from './common.schema'

export const MetricBaselineParamsSchema = z.object({
  mean: finite(),
  withinSd: finite(),
})

export const CrewProfileSchema = z.object({
  id: CrewIdSchema,
  displayName: z.string().min(1),
  role: z.enum(CREW_ROLES),
  ageBand: z.enum(AGE_BANDS),
  priorCareerDoseMsv: finite(),
  baselines: z.partialRecord(MetricIdSchema, MetricBaselineParamsSchema),
  circadianAmplitudeHr: finite(),
  sleepWindow: z.object({
    startMin: finite(),
    durationMin: finite(),
  }),
})
