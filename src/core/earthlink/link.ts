// Earth Link simülatörü (FAZ_07 §3.4):
// Gecikme, kesinti (blackout), öncelikli giden kuyruğu, bant genişliği modeli ve yer cevabı sayacı.
// Zaman tamamen sim zamanıdır (SimTimeMs); Date.now() veya gerçek zamanlayıcı kullanılmaz.
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { Alert } from '../types/alert'
import type {
  EarthLinkConfig,
  EarthLinkPreset,
  Message,
  MessagePriority,
} from '../types/earthlink'
import type { SimTimeMs } from '../types/frame'
import { MS_PER_MIN, MS_PER_SEC, msToMin, secToMs } from '../units'
import { buildGroundReplyMessage, selectGroundReplyTemplate } from './groundReplies'
import {
  buildAlertPacket,
  containsForbiddenPrivacyKey,
  EARTH_CONSENT_CATEGORIES,
  estimatePacketBytes,
  type EarthConsentCategory,
} from './packets'

export interface PendingReply {
  messageId: string
  etaT: SimTimeMs
  remainingMs: number
  relatedAlertId: string
  localAdviceActionIds: string[]
}

export interface EarthLinkStats {
  sent: number
  delivered: number
  avgLatencyMin: number
}

export interface EarthLinkState {
  config: EarthLinkConfig
  connected: boolean
  outbox: Message[]
  inbox: Message[]
  pending: PendingReply[]
  stats: EarthLinkStats
}

export interface SendMessageInput {
  id?: string
  priority: MessagePriority
  category: string
  payload: unknown
  createdT?: SimTimeMs
  relatedAlertId?: string
  localAdviceActionIds?: readonly string[]
  replyTemplateId?: string
}

export interface EarthLinkOptions {
  preset?: EarthLinkPreset
  config?: Partial<EarthLinkConfig>
  initialSimT?: SimTimeMs
  autoReport?: boolean
  consentCategories?: readonly EarthConsentCategory[]
  evidence?: EvidenceRegistry
}

interface OutboxMeta {
  seq: number
  bytes: number
  relatedAlertId?: string
  localAdviceActionIds: string[]
  replyTemplateId?: string
  replyScheduled: boolean
}

const BITS_PER_BYTE = 8
const BPS_PER_KBPS = 1000

const PRESET_TO_EVIDENCE_ID: Partial<Record<EarthLinkPreset, 'earth.oneWayDelaySec.moon' | 'earth.oneWayDelaySec.mars_min' | 'earth.oneWayDelaySec.mars_max'>> = {
  MOON: 'earth.oneWayDelaySec.moon',
  MARS_MIN: 'earth.oneWayDelaySec.mars_min',
  MARS_MAX: 'earth.oneWayDelaySec.mars_max',
}

export function resolvePresetConfig(
  preset: EarthLinkPreset,
  evidence: EvidenceRegistry = registry,
  blackout = false,
  customOneWayDelaySec?: number,
): EarthLinkConfig {
  const paramId = PRESET_TO_EVIDENCE_ID[preset]
  const oneWayDelaySec =
    paramId !== undefined
      ? evidence.getNumber(paramId)
      : (customOneWayDelaySec ?? evidence.getNumber('earth.oneWayDelaySec.mars_min'))
  return { oneWayDelaySec, preset, blackout }
}

export class EarthLink {
  private readonly evidence: EvidenceRegistry
  private config: EarthLinkConfig
  private simT: SimTimeMs
  private uplinkFreeAtT: SimTimeMs
  private autoReport: boolean
  private consentCategories: EarthConsentCategory[]
  private userDelayOverride = false
  private userBlackoutOverride = false
  private nextSeq = 1
  private readonly outbox: Message[] = []
  private readonly outboxMeta = new Map<string, OutboxMeta>()
  private readonly inbox: Message[] = []
  private readonly inboxReplyMeta = new Map<
    string,
    { relatedAlertId: string; localAdviceActionIds: string[] }
  >()
  private readonly reportedAlertIds = new Set<string>()

  constructor(options: EarthLinkOptions = {}) {
    this.evidence = options.evidence ?? registry
    const initialPreset = options.config?.preset ?? options.preset ?? 'MARS_MIN'
    const baseConfig = resolvePresetConfig(
      initialPreset,
      this.evidence,
      options.config?.blackout ?? false,
      options.config?.oneWayDelaySec,
    )
    this.config = {
      ...baseConfig,
      ...(options.config?.oneWayDelaySec !== undefined
        ? { oneWayDelaySec: options.config.oneWayDelaySec }
        : {}),
    }
    this.simT = options.initialSimT ?? 0
    this.uplinkFreeAtT = this.simT
    this.autoReport = options.autoReport ?? true
    this.consentCategories = [...(options.consentCategories ?? EARTH_CONSENT_CATEGORIES)]
  }

  getConfig(): EarthLinkConfig {
    return { ...this.config }
  }

  getAutoReport(): boolean {
    return this.autoReport
  }

  setAutoReport(enabled: boolean): void {
    this.autoReport = enabled
  }

  getConsentCategories(): EarthConsentCategory[] {
    return [...this.consentCategories]
  }

  setConsentCategories(categories: readonly EarthConsentCategory[]): void {
    const valid = new Set<EarthConsentCategory>(EARTH_CONSENT_CATEGORIES)
    this.consentCategories = categories.filter((c) => valid.has(c))
  }

  /** Kullanıcı gecikme/kesinti değişikliği: senaryo olaylarına karşı önceliklidir (FAZ_07 §3.4). */
  setUserConfig(partial: Partial<EarthLinkConfig>): void {
    if (partial.preset !== undefined || partial.oneWayDelaySec !== undefined) {
      this.userDelayOverride = true
      const nextPreset = partial.preset ?? 'CUSTOM'
      const resolved = resolvePresetConfig(
        nextPreset,
        this.evidence,
        this.config.blackout,
        partial.oneWayDelaySec ?? this.config.oneWayDelaySec,
      )
      this.config = {
        ...this.config,
        preset: nextPreset,
        oneWayDelaySec: partial.oneWayDelaySec ?? resolved.oneWayDelaySec,
      }
    }
    if (partial.blackout !== undefined) {
      this.userBlackoutOverride = true
      this.config = { ...this.config, blackout: partial.blackout }
    }
    if (!this.config.blackout) {
      this.dispatchOutbox(this.simT)
    }
  }

  /** Senaryo olayı kaynaklı güncelleme; kullanıcı seçimi varsa gecikmeyi/kesintiyi geri almaz. */
  applyScenarioConfig(partial: Partial<EarthLinkConfig>): void {
    if (!this.userDelayOverride && (partial.preset !== undefined || partial.oneWayDelaySec !== undefined)) {
      const nextPreset = partial.preset ?? 'CUSTOM'
      const resolved = resolvePresetConfig(
        nextPreset,
        this.evidence,
        this.config.blackout,
        partial.oneWayDelaySec ?? this.config.oneWayDelaySec,
      )
      this.config = {
        ...this.config,
        preset: nextPreset,
        oneWayDelaySec: partial.oneWayDelaySec ?? resolved.oneWayDelaySec,
      }
    }
    if (!this.userBlackoutOverride && partial.blackout !== undefined) {
      this.config = { ...this.config, blackout: partial.blackout }
    }
    if (!this.config.blackout) {
      this.dispatchOutbox(this.simT)
    }
  }

  setBlackout(blackout: boolean, source: 'SCENARIO' | 'USER' = 'SCENARIO'): void {
    if (source === 'USER') {
      this.setUserConfig({ blackout })
      return
    }
    this.applyScenarioConfig({ blackout })
  }

  /**
   * Mesajı giden kutusuna ekler (`status: 'QUEUED'`).
   * Link açıksa hemen gönderim zamanını (`sendT`, `arriveT`) hesaplayıp `IN_FLIGHT`'a geçirir.
   */
  send(input: SendMessageInput): Message | null {
    if (containsForbiddenPrivacyKey(input.payload)) {
      throw new Error('EarthLink privacy policy violation: payload contains forbidden private/journal field')
    }

    const capacity = Math.max(1, Math.floor(this.evidence.getNumber('earth.outbox.capacity')))
    const pendingCount = this.outbox.filter((m) => m.status !== 'DELIVERED').length

    if (pendingCount >= capacity) {
      const evictIdx = this.findLowestPriorityQueuedIndex()
      if (evictIdx === -1) return null
      const candidate = this.outbox[evictIdx]
      if (!candidate || input.priority <= candidate.priority) return null
      this.outbox.splice(evictIdx, 1)
      this.outboxMeta.delete(candidate.id)
    }

    const seq = this.nextSeq
    this.nextSeq += 1
    const id = input.id ?? `up-${seq}`
    const createdT = input.createdT ?? this.simT
    const bytes = estimatePacketBytes(input.payload)

    const msg: Message = {
      id,
      direction: 'UP',
      priority: input.priority,
      category: input.category,
      createdT,
      payload: input.payload,
      status: 'QUEUED',
    }

    this.outbox.push(msg)
    this.outboxMeta.set(id, {
      seq,
      bytes,
      ...(input.relatedAlertId ? { relatedAlertId: input.relatedAlertId } : {}),
      localAdviceActionIds: [...(input.localAdviceActionIds ?? [])],
      ...(input.replyTemplateId ? { replyTemplateId: input.replyTemplateId } : {}),
      replyScheduled: false,
    })

    if (!this.config.blackout) {
      this.dispatchOutbox(this.simT)
    }

    return { ...msg }
  }

  /** WARNING+ uyarılar için otomatik paket oluşturup kuyruğa ekler (politika açıksa). */
  reportAlert(alert: Alert): Message | null {
    if (!this.autoReport) return null
    if (alert.severity !== 'WARNING' && alert.severity !== 'CRITICAL') return null
    if (this.reportedAlertIds.has(alert.id)) return null

    const packet = buildAlertPacket(alert, this.consentCategories)
    if (!packet) return null

    this.reportedAlertIds.add(alert.id)
    const priority: MessagePriority = alert.severity === 'CRITICAL' ? 3 : 2
    const template = selectGroundReplyTemplate(alert)

    return this.send({
      priority,
      category: 'ALERTS',
      payload: packet,
      createdT: this.simT,
      relatedAlertId: alert.id,
      localAdviceActionIds: alert.suggestedActionIds,
      replyTemplateId: template.id,
    })
  }

  /** Manuel veya demo yer cevabı tetikler (`GROUND_REPLY` komutu). */
  triggerGroundReply(
    templateId: string,
    relatedAlertId?: string,
    localAdviceActionIds: readonly string[] = [],
  ): Message {
    const seq = this.nextSeq
    this.nextSeq += 1
    const id = `down-${seq}`
    const groundProcessingMin = this.evidence.getNumber('earth.groundProcessingMin')
    const msg = buildGroundReplyMessage({
      id,
      templateId,
      ...(relatedAlertId ? { relatedAlertId } : {}),
      alertSendArriveT: this.simT,
      oneWayDelaySec: this.config.oneWayDelaySec,
      groundProcessingMin,
      nowT: this.simT,
    })
    this.inbox.push(msg)
    if (relatedAlertId) {
      this.inboxReplyMeta.set(id, {
        relatedAlertId,
        localAdviceActionIds: [...localAdviceActionIds],
      })
    }
    return { ...msg }
  }

  tick(simT: SimTimeMs): void {
    this.simT = simT

    for (const msg of this.outbox) {
      if (msg.status === 'IN_FLIGHT' && msg.arriveT !== undefined && simT >= msg.arriveT) {
        msg.status = 'DELIVERED'
      }
    }

    if (!this.config.blackout) {
      this.dispatchOutbox(simT)
    }

    for (const msg of this.inbox) {
      if (
        msg.status === 'QUEUED' &&
        !this.config.blackout &&
        msg.sendT !== undefined &&
        simT >= msg.sendT
      ) {
        msg.status = 'IN_FLIGHT'
      }
      if (msg.status === 'IN_FLIGHT' && msg.arriveT !== undefined && simT >= msg.arriveT) {
        msg.status = 'DELIVERED'
      }
    }
  }

  getPendingReplies(): PendingReply[] {
    const pending: PendingReply[] = []

    for (const msg of this.outbox) {
      const meta = this.outboxMeta.get(msg.id)
      if (!meta || !meta.relatedAlertId || !meta.replyTemplateId) continue
      if (msg.status === 'QUEUED') {
        pending.push({
          messageId: msg.id,
          etaT: Infinity,
          remainingMs: Infinity,
          relatedAlertId: meta.relatedAlertId,
          localAdviceActionIds: [...meta.localAdviceActionIds],
        })
      }
    }

    for (const reply of this.inbox) {
      if (reply.status === 'DELIVERED' || reply.arriveT === undefined) continue
      const meta = this.inboxReplyMeta.get(reply.id)
      pending.push({
        messageId: reply.id,
        etaT: reply.arriveT,
        remainingMs: Math.max(0, reply.arriveT - this.simT),
        relatedAlertId: meta?.relatedAlertId ?? '',
        localAdviceActionIds: [...(meta?.localAdviceActionIds ?? [])],
      })
    }

    return pending.sort((a, b) => a.etaT - b.etaT)
  }

  getState(): EarthLinkState {
    const sentMessages = this.outbox.filter((m) => m.status !== 'QUEUED')
    const deliveredMessages = this.outbox.filter(
      (m) => m.status === 'DELIVERED' && m.arriveT !== undefined,
    )
    const totalLatencyMs = deliveredMessages.reduce(
      (sum, m) => sum + ((m.arriveT ?? m.createdT) - m.createdT),
      0,
    )
    const avgLatencyMin =
      deliveredMessages.length > 0
        ? msToMin(totalLatencyMs / deliveredMessages.length)
        : 0

    return {
      config: { ...this.config },
      connected: !this.config.blackout,
      outbox: this.outbox.map((m) => ({ ...m })),
      inbox: this.inbox.filter((m) => m.status === 'DELIVERED').map((m) => ({ ...m })),
      pending: this.getPendingReplies(),
      stats: {
        sent: sentMessages.length,
        delivered: deliveredMessages.length,
        avgLatencyMin: Number(avgLatencyMin.toFixed(2)),
      },
    }
  }

  private findLowestPriorityQueuedIndex(): number {
    let bestIdx = -1
    let bestPriority = Infinity
    let bestCreatedT = Infinity
    for (let i = 0; i < this.outbox.length; i += 1) {
      const m = this.outbox[i]
      if (!m || m.status !== 'QUEUED') continue
      if (
        m.priority < bestPriority ||
        (m.priority === bestPriority && m.createdT < bestCreatedT)
      ) {
        bestIdx = i
        bestPriority = m.priority
        bestCreatedT = m.createdT
      }
    }
    return bestIdx
  }

  private dispatchOutbox(simT: SimTimeMs): void {
    const queued = this.outbox.filter((m) => m.status === 'QUEUED')
    if (queued.length === 0) return

    queued.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.createdT !== b.createdT) return a.createdT - b.createdT
      const seqA = this.outboxMeta.get(a.id)?.seq ?? 0
      const seqB = this.outboxMeta.get(b.id)?.seq ?? 0
      return seqA - seqB
    })

    const uplinkKbps = this.evidence.getNumber('earth.uplink.kbps')
    const oneWayMs = secToMs(this.config.oneWayDelaySec)
    const groundProcessingMin = this.evidence.getNumber('earth.groundProcessingMin')

    for (const msg of queued) {
      const meta = this.outboxMeta.get(msg.id)
      const bytes = meta?.bytes ?? estimatePacketBytes(msg.payload)
      const txDurationMs = (bytes * BITS_PER_BYTE * MS_PER_SEC) / (uplinkKbps * BPS_PER_KBPS)
      const txStart = Math.max(simT, this.uplinkFreeAtT)
      const sendT = txStart + txDurationMs
      const arriveT = sendT + oneWayMs

      this.uplinkFreeAtT = sendT
      msg.sendT = sendT
      msg.arriveT = arriveT
      msg.status = simT >= arriveT ? 'DELIVERED' : 'IN_FLIGHT'

      if (meta && meta.relatedAlertId && meta.replyTemplateId && !meta.replyScheduled) {
        meta.replyScheduled = true
        const replySeq = this.nextSeq
        this.nextSeq += 1
        const replyId = `down-${replySeq}`
        const replyMsg = buildGroundReplyMessage({
          id: replyId,
          templateId: meta.replyTemplateId,
          relatedAlertId: meta.relatedAlertId,
          alertSendArriveT: arriveT,
          oneWayDelaySec: this.config.oneWayDelaySec,
          groundProcessingMin,
          priority: msg.priority,
          nowT: simT,
        })
        this.inbox.push(replyMsg)
        this.inboxReplyMeta.set(replyId, {
          relatedAlertId: meta.relatedAlertId,
          localAdviceActionIds: [...meta.localAdviceActionIds],
        })
      }
    }
  }
}

export { MS_PER_MIN }
