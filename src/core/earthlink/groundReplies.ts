// Yer istasyonu cevap şablonları (FAZ_07 §3.4):
// Gerçekçi, jenerik onay/takip yanıtları üretir; tıbbi tanı/ilaç/doz talimatı içermez.
import type { Alert, AlertKind } from '../types/alert'
import type { Message, MessagePriority } from '../types/earthlink'
import type { SimTimeMs } from '../types/frame'
import type { StateId } from '../types/state'
import { minToMs, secToMs } from '../units'

export interface GroundReplyTemplate {
  id: string
  appliesToStates: readonly StateId[]
  appliesToKinds?: readonly AlertKind[]
  titleKey: string
  bodyKey: string
  followUpNoteKey: string
}

export const GROUND_REPLY_TEMPLATES: readonly GroundReplyTemplate[] = [
  {
    id: 'REPLY_SPE_ACK',
    appliesToStates: ['radiation_event'],
    appliesToKinds: ['RADIATION'],
    titleKey: 'ground.reply.REPLY_SPE_ACK.title',
    bodyKey: 'ground.reply.REPLY_SPE_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_SPE_ACK.followUp',
  },
  {
    id: 'REPLY_SPO2_ACK',
    appliesToStates: [],
    appliesToKinds: ['LIMIT'],
    titleKey: 'ground.reply.REPLY_SPO2_ACK.title',
    bodyKey: 'ground.reply.REPLY_SPO2_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_SPO2_ACK.followUp',
  },
  {
    id: 'REPLY_SLEEP_ACK',
    appliesToStates: ['sleep_debt'],
    titleKey: 'ground.reply.REPLY_SLEEP_ACK.title',
    bodyKey: 'ground.reply.REPLY_SLEEP_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_SLEEP_ACK.followUp',
  },
  {
    id: 'REPLY_FATIGUE_ACK',
    appliesToStates: ['fatigue'],
    titleKey: 'ground.reply.REPLY_FATIGUE_ACK.title',
    bodyKey: 'ground.reply.REPLY_FATIGUE_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_FATIGUE_ACK.followUp',
  },
  {
    id: 'REPLY_STRESS_ACK',
    appliesToStates: ['stress'],
    titleKey: 'ground.reply.REPLY_STRESS_ACK.title',
    bodyKey: 'ground.reply.REPLY_STRESS_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_STRESS_ACK.followUp',
  },
  {
    id: 'REPLY_DEHYDRATION_ACK',
    appliesToStates: ['dehydration'],
    titleKey: 'ground.reply.REPLY_DEHYDRATION_ACK.title',
    bodyKey: 'ground.reply.REPLY_DEHYDRATION_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_DEHYDRATION_ACK.followUp',
  },
  {
    id: 'REPLY_CARDIO_ACK',
    appliesToStates: ['cardio_strain'],
    titleKey: 'ground.reply.REPLY_CARDIO_ACK.title',
    bodyKey: 'ground.reply.REPLY_CARDIO_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_CARDIO_ACK.followUp',
  },
  {
    id: 'REPLY_MOOD_ACK',
    appliesToStates: ['mood_decline'],
    titleKey: 'ground.reply.REPLY_MOOD_ACK.title',
    bodyKey: 'ground.reply.REPLY_MOOD_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_MOOD_ACK.followUp',
  },
  {
    id: 'REPLY_GENERIC_ACK',
    appliesToStates: [],
    titleKey: 'ground.reply.REPLY_GENERIC_ACK.title',
    bodyKey: 'ground.reply.REPLY_GENERIC_ACK.body',
    followUpNoteKey: 'ground.reply.REPLY_GENERIC_ACK.followUp',
  },
]

const BY_ID: ReadonlyMap<string, GroundReplyTemplate> = new Map(
  GROUND_REPLY_TEMPLATES.map((t) => [t.id, t]),
)

export function getGroundReplyTemplate(id: string): GroundReplyTemplate | undefined {
  return BY_ID.get(id)
}

export function selectGroundReplyTemplate(
  alert?: Pick<Alert, 'state' | 'kind' | 'metric'>,
): GroundReplyTemplate {
  const generic = BY_ID.get('REPLY_GENERIC_ACK') ?? GROUND_REPLY_TEMPLATES[GROUND_REPLY_TEMPLATES.length - 1]!
  if (!alert) return generic

  if (alert.kind === 'RADIATION' || alert.state === 'radiation_event') {
    return BY_ID.get('REPLY_SPE_ACK') ?? generic
  }
  if (alert.metric === 'spo2') {
    return BY_ID.get('REPLY_SPO2_ACK') ?? generic
  }
  if (alert.state !== undefined) {
    const byState = GROUND_REPLY_TEMPLATES.find((t) => t.appliesToStates.includes(alert.state!))
    if (byState) return byState
  }
  if (alert.kind === 'LIMIT') {
    return BY_ID.get('REPLY_SPO2_ACK') ?? generic
  }
  return generic
}

export interface GroundReplyPayload {
  templateId: string
  titleKey: string
  bodyKey: string
  followUpNoteKey: string
  relatedAlertId?: string
}

export interface BuildGroundReplyParams {
  id: string
  templateId: string
  relatedAlertId?: string
  alertSendArriveT: SimTimeMs
  oneWayDelaySec: number
  groundProcessingMin: number
  priority?: MessagePriority
  nowT?: SimTimeMs
}

/**
 * Yer cevabı mesajı üretir: `arriveT = alertSendArriveT + groundProcessing + oneWay`.
 */
export function buildGroundReplyMessage(params: BuildGroundReplyParams): Message {
  const template =
    getGroundReplyTemplate(params.templateId) ??
    getGroundReplyTemplate('REPLY_GENERIC_ACK') ??
    GROUND_REPLY_TEMPLATES[0]!

  const sendT = params.alertSendArriveT + minToMs(params.groundProcessingMin)
  const arriveT = sendT + secToMs(params.oneWayDelaySec)
  const nowT = params.nowT ?? params.alertSendArriveT

  let status: Message['status'] = 'QUEUED'
  if (nowT >= arriveT) status = 'DELIVERED'
  else if (nowT >= sendT) status = 'IN_FLIGHT'

  const payload: GroundReplyPayload = {
    templateId: template.id,
    titleKey: template.titleKey,
    bodyKey: template.bodyKey,
    followUpNoteKey: template.followUpNoteKey,
    ...(params.relatedAlertId ? { relatedAlertId: params.relatedAlertId } : {}),
  }

  return {
    id: params.id,
    direction: 'DOWN',
    priority: params.priority ?? 2,
    category: 'GROUND_REPLY',
    createdT: params.alertSendArriveT,
    sendT,
    arriveT,
    payload,
    status,
  }
}
