// Eylem kataloğu (FAZ_07 §3.1): tüm eylem tanımları öneri/prosedür dilindedir; tıbbi tanı/ilaç/doz içermez.
import type { ActionDef, ActionId } from '../types/action'
import type { StateId } from '../types/state'

export const CATALOG_ACTION_IDS = [
  'ACT_REST_BLOCK',
  'ACT_REDUCE_WORKLOAD',
  'ACT_BREATHING',
  'ACT_COMMS_FAMILY',
  'ACT_HYDRATE',
  'ACT_SLEEP_SHIFT',
  'ACT_LIGHT_CONTROL',
  'ACT_SHELTER',
  'ACT_DOSE_CHECK',
  'ACT_CARDIO_CHECK',
  'ACT_JOURNAL',
  'ACT_PSYCH_CHECKIN',
  'ACT_PRELANDING_FLUIDS',
] as const

export type CatalogActionId = (typeof CATALOG_ACTION_IDS)[number]

/**
 * Doğrulanmış kaynak md'lerde sayısal eşiği bulunmayan eylemler için niteliksel dayanak notları.
 * Tıbbi talimat değildir; Faz 10 Kanıt / Eylem kartlarında bağlam göstermek için kullanılır.
 */
export const ACTION_NOTES: Record<CatalogActionId, string> = {
  ACT_REST_BLOCK:
    'DEMO rest block parameter; aligns qualitatively with NASA HRP fatigue/cardiovascular management.',
  ACT_REDUCE_WORKLOAD:
    'Reduces work load and drops resistive exercise to LOW (not removed) due to spaceflight bone loss risk.',
  ACT_BREATHING:
    'Paced breathing advisory for acute stress support; no verified numerical NASA threshold.',
  ACT_COMMS_FAMILY:
    'Extends crew personal communications window; qualitatively linked to NASA HRP isolation risk.',
  ACT_HYDRATE:
    'DEMO hydration reminder blocks and capped target increase (hydration.max.L); no NASA numerical threshold.',
  ACT_SLEEP_SHIFT:
    'Shifts and extends sleep window using DEMO parameters; qualitatively linked to NASA HRP sleep risk.',
  ACT_LIGHT_CONTROL:
    'Procedural cabin lighting hygiene guidance; qualitatively linked to NASA HRP circadian research (ARCHeR).',
  ACT_SHELTER:
    'Mission-protocol shielding response referencing the 250 mSv design reference SPE protection target (PARTIAL).',
  ACT_DOSE_CHECK:
    'Dosimetry verification referencing NASA-STD-3001 career effective dose limit and design reference SPE target.',
  ACT_CARDIO_CHECK:
    'Procedural vital/sensor check following mission protocol; no medical diagnosis.',
  ACT_JOURNAL:
    'Local device-only personal reflection prompt; never leaves device or enters Earth Link packets.',
  ACT_PSYCH_CHECKIN:
    'Prompts crew behavioral check-in; qualitatively aligned with NASA HRP Standard Measures.',
  ACT_PRELANDING_FLUIDS:
    'Pre-landing fluid loading protocol hook; inactive unless scenario defines a landing window.',
}

const CATALOG_ENTRIES: Record<CatalogActionId, ActionDef> = {
  ACT_REST_BLOCK: {
    id: 'ACT_REST_BLOCK',
    titleKey: 'action.ACT_REST_BLOCK.title',
    stepKeys: [
      'action.ACT_REST_BLOCK.step1',
      'action.ACT_REST_BLOCK.step2',
      'action.ACT_REST_BLOCK.step3',
    ],
    appliesToStates: ['fatigue', 'cardio_strain'],
    kind: 'REST',
    scheduleEffects: [{ op: 'ADD', blockType: 'REST', durationMinParamId: 'plan.rest.durationMin' }],
    evidenceIds: [],
  },
  ACT_REDUCE_WORKLOAD: {
    id: 'ACT_REDUCE_WORKLOAD',
    titleKey: 'action.ACT_REDUCE_WORKLOAD.title',
    stepKeys: [
      'action.ACT_REDUCE_WORKLOAD.step1',
      'action.ACT_REDUCE_WORKLOAD.step2',
      'action.ACT_REDUCE_WORKLOAD.step3',
    ],
    appliesToStates: ['fatigue'],
    kind: 'REST',
    scheduleEffects: [
      { op: 'SET_INTENSITY', target: 'WORK', intensity: 'LOW' },
      { op: 'SHORTEN', target: 'WORK', durationMinParamId: 'plan.rest.durationMin' },
      { op: 'SET_INTENSITY', target: 'EXERCISE_RESISTIVE', intensity: 'LOW' },
    ],
    evidenceIds: ['bone.loss.pct_month'],
  },
  ACT_BREATHING: {
    id: 'ACT_BREATHING',
    titleKey: 'action.ACT_BREATHING.title',
    stepKeys: [
      'action.ACT_BREATHING.step1',
      'action.ACT_BREATHING.step2',
      'action.ACT_BREATHING.step3',
    ],
    appliesToStates: ['stress'],
    kind: 'REST',
    scheduleEffects: [],
    evidenceIds: [],
  },
  ACT_COMMS_FAMILY: {
    id: 'ACT_COMMS_FAMILY',
    titleKey: 'action.ACT_COMMS_FAMILY.title',
    stepKeys: ['action.ACT_COMMS_FAMILY.step1', 'action.ACT_COMMS_FAMILY.step2'],
    appliesToStates: ['stress', 'mood_decline'],
    kind: 'COMMS',
    scheduleEffects: [{ op: 'EXTEND', target: 'COMMS', durationMinParamId: 'plan.sleepShiftMin' }],
    evidenceIds: [],
  },
  ACT_HYDRATE: {
    id: 'ACT_HYDRATE',
    titleKey: 'action.ACT_HYDRATE.title',
    stepKeys: [
      'action.ACT_HYDRATE.step1',
      'action.ACT_HYDRATE.step2',
      'action.ACT_HYDRATE.step3',
    ],
    appliesToStates: ['dehydration'],
    kind: 'HYDRATE',
    scheduleEffects: [
      {
        op: 'ADD',
        blockType: 'HYDRATION',
        durationMinParamId: 'plan.sleepShiftMin',
        countParamId: 'plan.hydrate.extraBlocks',
      },
    ],
    evidenceIds: [],
  },
  ACT_SLEEP_SHIFT: {
    id: 'ACT_SLEEP_SHIFT',
    titleKey: 'action.ACT_SLEEP_SHIFT.title',
    stepKeys: [
      'action.ACT_SLEEP_SHIFT.step1',
      'action.ACT_SLEEP_SHIFT.step2',
      'action.ACT_SLEEP_SHIFT.step3',
    ],
    appliesToStates: ['sleep_debt'],
    kind: 'REST',
    scheduleEffects: [
      {
        op: 'SHIFT',
        target: 'SLEEP',
        direction: 'EARLIER',
        deltaMinParamId: 'plan.sleepShiftMin',
      },
      { op: 'EXTEND', target: 'SLEEP', durationMinParamId: 'plan.sleepShiftMin' },
    ],
    evidenceIds: [],
  },
  ACT_LIGHT_CONTROL: {
    id: 'ACT_LIGHT_CONTROL',
    titleKey: 'action.ACT_LIGHT_CONTROL.title',
    stepKeys: [
      'action.ACT_LIGHT_CONTROL.step1',
      'action.ACT_LIGHT_CONTROL.step2',
      'action.ACT_LIGHT_CONTROL.step3',
    ],
    appliesToStates: ['sleep_debt'],
    kind: 'ENVIRONMENT',
    scheduleEffects: [],
    evidenceIds: [],
  },
  ACT_SHELTER: {
    id: 'ACT_SHELTER',
    titleKey: 'action.ACT_SHELTER.title',
    stepKeys: [
      'action.ACT_SHELTER.step1',
      'action.ACT_SHELTER.step2',
      'action.ACT_SHELTER.step3',
    ],
    appliesToStates: ['radiation_event'],
    kind: 'SHELTER',
    scheduleEffects: [
      { op: 'REMOVE', targets: ['EXERCISE_AERO', 'EXERCISE_RESISTIVE', 'EVA', 'WORK'] },
      { op: 'ADD', blockType: 'SHELTER', durationMinParamId: 'plan.rest.durationMin' },
    ],
    evidenceIds: ['rad.spe.limit.msv'],
  },
  ACT_DOSE_CHECK: {
    id: 'ACT_DOSE_CHECK',
    titleKey: 'action.ACT_DOSE_CHECK.title',
    stepKeys: ['action.ACT_DOSE_CHECK.step1', 'action.ACT_DOSE_CHECK.step2'],
    appliesToStates: ['radiation_event'],
    kind: 'CHECK',
    scheduleEffects: [],
    evidenceIds: ['rad.career.limit.msv', 'rad.spe.limit.msv'],
  },
  ACT_CARDIO_CHECK: {
    id: 'ACT_CARDIO_CHECK',
    titleKey: 'action.ACT_CARDIO_CHECK.title',
    stepKeys: [
      'action.ACT_CARDIO_CHECK.step1',
      'action.ACT_CARDIO_CHECK.step2',
      'action.ACT_CARDIO_CHECK.step3',
    ],
    appliesToStates: ['cardio_strain'],
    kind: 'CHECK',
    scheduleEffects: [],
    evidenceIds: [],
  },
  ACT_JOURNAL: {
    id: 'ACT_JOURNAL',
    titleKey: 'action.ACT_JOURNAL.title',
    stepKeys: ['action.ACT_JOURNAL.step1', 'action.ACT_JOURNAL.step2'],
    appliesToStates: ['mood_decline'],
    kind: 'REST',
    scheduleEffects: [],
    evidenceIds: [],
  },
  ACT_PSYCH_CHECKIN: {
    id: 'ACT_PSYCH_CHECKIN',
    titleKey: 'action.ACT_PSYCH_CHECKIN.title',
    stepKeys: ['action.ACT_PSYCH_CHECKIN.step1', 'action.ACT_PSYCH_CHECKIN.step2'],
    appliesToStates: ['mood_decline'],
    kind: 'CHECK',
    scheduleEffects: [],
    evidenceIds: [],
  },
  ACT_PRELANDING_FLUIDS: {
    id: 'ACT_PRELANDING_FLUIDS',
    titleKey: 'action.ACT_PRELANDING_FLUIDS.title',
    stepKeys: ['action.ACT_PRELANDING_FLUIDS.step1', 'action.ACT_PRELANDING_FLUIDS.step2'],
    appliesToStates: ['dehydration', 'cardio_strain'],
    kind: 'HYDRATE',
    scheduleEffects: [],
    evidenceIds: [],
  },
}

export const ACTION_CATALOG: Record<ActionId, ActionDef> = CATALOG_ENTRIES

export function getActionDef(id: ActionId): ActionDef | undefined {
  return ACTION_CATALOG[id]
}

export function getActionsForState(state: StateId): ActionDef[] {
  return CATALOG_ACTION_IDS.map((id) => CATALOG_ENTRIES[id]).filter((def) =>
    def.appliesToStates.includes(state),
  )
}
