import type { CrewId } from './frame'
import type { MetricId } from './metric'

export const CREW_ROLES = ['CDR', 'MD', 'ENG', 'SCI'] as const
export type CrewRole = (typeof CREW_ROLES)[number]

export const AGE_BANDS = ['30-39', '40-49', '50+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

export interface MetricBaselineParams {
  mean: number
  withinSd: number
}

export interface CrewProfile {
  id: CrewId
  displayName: string
  role: CrewRole
  ageBand: AgeBand
  priorCareerDoseMsv: number
  baselines: Partial<Record<MetricId, MetricBaselineParams>>
  circadianAmplitudeHr: number
  sleepWindow: { startMin: number /* günün dakikası 0-1439 */; durationMin: number }
}
