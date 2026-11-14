import type { CrewId, SimTimeMs } from './frame'
import type { MetricId } from './metric'

export const STATE_IDS = [
  'fatigue',
  'stress',
  'dehydration',
  'sleep_debt',
  'radiation_event',
  'cardio_strain',
  'mood_decline',
] as const

export type StateId = (typeof STATE_IDS)[number]

export interface StateContributor {
  metric: MetricId
  weight: number
  z: number
  contribution: number
}

export interface StateEstimate {
  crewId: CrewId
  t: SimTimeMs
  state: StateId
  /** 0-1 */
  score: number
  confidence: number
  contributors: StateContributor[]
}
