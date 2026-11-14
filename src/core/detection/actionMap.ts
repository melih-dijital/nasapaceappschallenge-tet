// Durum → önerilen eylem ID'leri (FAZ_05 §3.5). Yalnızca ID sözleşmesi; eylem kataloğu Faz 7.
import type { ActionId, StateId } from '../types'

export const STATE_ACTION_MAP: Record<StateId, readonly ActionId[]> = {
  fatigue: ['ACT_REST_BLOCK', 'ACT_REDUCE_WORKLOAD'],
  stress: ['ACT_BREATHING', 'ACT_COMMS_FAMILY'],
  dehydration: ['ACT_HYDRATE'],
  sleep_debt: ['ACT_SLEEP_SHIFT', 'ACT_LIGHT_CONTROL'],
  radiation_event: ['ACT_SHELTER', 'ACT_DOSE_CHECK'],
  cardio_strain: ['ACT_REST_BLOCK', 'ACT_CARDIO_CHECK'],
  mood_decline: ['ACT_JOURNAL', 'ACT_COMMS_FAMILY', 'ACT_PSYCH_CHECKIN'],
}

export function suggestedActionsFor(state: StateId | undefined): ActionId[] {
  return state ? [...STATE_ACTION_MAP[state]] : []
}
