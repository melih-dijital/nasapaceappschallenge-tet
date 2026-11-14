import type { EarthDelayClass, WhyKey } from './alert'
import type { CrewId } from './frame'
import type { ScheduleEffect } from './schedule'
import type { StateId } from './state'

export type ActionId = string

export const ACTION_KINDS = [
  'REST',
  'HYDRATE',
  'EXERCISE',
  'SHELTER',
  'CHECK',
  'COMMS',
  'ENVIRONMENT',
] as const
export type ActionKind = (typeof ACTION_KINDS)[number]

export interface ActionDef {
  id: ActionId
  titleKey: string
  stepKeys: string[]
  appliesToStates: StateId[]
  kind: ActionKind
  scheduleEffects: ScheduleEffect[]
  evidenceIds: string[]
}

export type ActionCardState = 'SUGGESTED' | 'ACCEPTED' | 'DISMISSED' | 'DONE'

/** Karar kartı (Faz 7 doldurur; Faz 1 asgari şekil — alan EKLENEBİLİR, mevcut alan değiştirilemez). */
export interface ActionCard {
  id: string
  actionId: ActionId
  crewId: CrewId
  priority: number
  earthDelayClass: EarthDelayClass
  titleKey: string
  stepKeys: string[]
  whyKeys: WhyKey[]
  sourceAlertIds: string[]
  evidenceIds: string[]
  state: ActionCardState
}
