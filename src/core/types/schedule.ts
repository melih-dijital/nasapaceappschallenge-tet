import type { CrewId } from './frame'

export const SCHEDULE_BLOCK_TYPES = [
  'SLEEP',
  'WORK',
  'EVA',
  'EXERCISE_AERO',
  'EXERCISE_RESISTIVE',
  'MEAL',
  'HYDRATION',
  'REST',
  'PSYCH_CHECKIN',
  'COMMS',
  'SHELTER',
] as const
export type ScheduleBlockType = (typeof SCHEDULE_BLOCK_TYPES)[number]

export type Intensity = 'LOW' | 'MED' | 'HIGH'

export interface ScheduleBlock {
  id: string
  type: ScheduleBlockType
  /** Günün dakikası 0-1439. */
  startMin: number
  durationMin: number
  intensity?: Intensity
  locked?: boolean
  reasonKey?: string
}

export interface DaySchedule {
  day: number
  crewId: CrewId
  blocks: ScheduleBlock[]
}

/**
 * Planlayıcı efektleri (Faz 7). Süre/sayı değerleri sihirli sayı olmasın diye
 * doğrudan sayı değil Evidence id'si taşır (`...ParamId`, ör. 'plan.rest.durationMin').
 */
export type ScheduleEffect =
  | {
      op: 'SHIFT'
      target: ScheduleBlockType
      direction: 'EARLIER' | 'LATER'
      deltaMinParamId: string
    }
  | { op: 'EXTEND'; target: ScheduleBlockType; durationMinParamId: string }
  | { op: 'SHORTEN'; target: ScheduleBlockType; durationMinParamId: string }
  | {
      op: 'ADD'
      blockType: ScheduleBlockType
      durationMinParamId: string
      countParamId?: string
    }
  | { op: 'REMOVE'; targets: ScheduleBlockType[] }
  | { op: 'SET_INTENSITY'; target: ScheduleBlockType; intensity: Intensity }

export type ScheduleChange =
  | 'ADDED'
  | 'MOVED'
  | 'SHORTENED'
  | 'EXTENDED'
  | 'INTENSITY'
  | 'REMOVED'
  | 'CONFLICT'

export interface ScheduleDiffItem {
  blockId: string
  change: ScheduleChange
  reasonKey: string
  byAlertId?: string
}
