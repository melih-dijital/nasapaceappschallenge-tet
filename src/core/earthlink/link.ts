// Earth Link simülatörü (FAZ_07 §3.4):
// Gecikme, kesinti (blackout), öncelikli giden kuyruğu, bant genişliği modeli, yer cevabı sayacı
// ve Dünya tarafı gecikmeli takip aynası (groundMirror + downlink).
// Zaman tamamen sim zamanıdır (SimTimeMs); Date.now() veya gerçek zamanlayıcı kullanılmaz.
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { Alert } from '../types/alert'
import type {
  DownlinkItemSummary,
  DownlinkPacketKind,
  DownlinkState,
  EarthLinkConfig,
  EarthLinkPreset,
  GroundMirror,
  Message,
  MessagePriority,
} from '../types/earthlink'
import type { CrewId, SimTimeMs } from '../types/frame'
import type { StateEstimate } from '../types/state'
import { MS_PER_MIN, MS_PER_SEC, msToMin, secToMs } from '../units'
import { buildGroundReplyMessage, selectGroundReplyTemplate } from './groundReplies'
import {
  buildAlertPacket,
  buildTelemetryBatchPacket,
  containsForbiddenPrivacyKey,
  EARTH_CONSENT_CATEGORIES,
  estimatePacketBytes,
  type AlertPacketPayload,
  type EarthConsentCategory,
  type StatusPacketPayload,
  type TelemetryBatchInput,
  type TelemetryBatchPacketPayload,
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
  consentCategories?: EarthConsentCategory[]
  groundMirror: GroundMirror
  downlink: DownlinkState
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
const MAX_DELIVERED_TELEMETRY_BATCHES = 32
const MAX_RECENT_DOWNLINK = 24

function resolveDownlinkKind(msg: Message): DownlinkPacketKind {
  if (msg.payload !== null && typeof msg.payload === 'object' && 'kind' in msg.payload) {
    const kind = (msg.payload as { kind?: unknown }).kind
    if (
      kind === 'TELEMETRY_BATCH' ||
      kind === 'ALERT' ||
      kind === 'DAILY_SUMMARY' ||
      kind === 'STATUS'
    ) {
      return kind
    }
  }
  if (msg.category === 'TELEMETRY_BATCH') return 'TELEMETRY_BATCH'
  if (msg.category === 'ALERT' || msg.category === 'ALERTS') return 'ALERT'
  if (msg.category === 'DAILY_SUMMARY') return 'DAILY_SUMMARY'
  return 'STATUS'
}

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
  private readonly reportedAlertSeverities = new Map<string, Alert['severity']>()

  // Dünya tarafı gecikmeli takip aynası (groundMirror) + istatistik sayaçları
  private mirrorAsOfT: SimTimeMs | null = null
  private mirrorLatest: Record<string, number> = {}
  private mirrorActiveAlerts: Alert[] = []
  private mirrorStates: StateEstimate[] = []
  private mirrorCumulativeDoseByCrew: Record<CrewId, number> = {}
  private lastDeliveredT: SimTimeMs | null = null
  private prunedDeliveredCount = 0
  private prunedDeliveredLatencyMs = 0

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
    const prevSeverity = this.reportedAlertSeverities.get(alert.id)
    if (prevSeverity !== undefined) {
      if (prevSeverity === 'CRITICAL' || alert.severity !== 'CRITICAL') {
        return null
      }
      for (let i = this.inbox.length - 1; i >= 0; i -= 1) {
        const reply = this.inbox[i]
        if (!reply || reply.status === 'DELIVERED') continue
        const meta = this.inboxReplyMeta.get(reply.id)
        if (meta?.relatedAlertId === alert.id) {
          this.inbox.splice(i, 1)
          this.inboxReplyMeta.delete(reply.id)
        }
      }
    }

    const packet = buildAlertPacket(alert, this.consentCategories)
    if (!packet) return null

    this.reportedAlertSeverities.set(alert.id, alert.severity)
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

  /**
   * Sürekli telemetri özet paketini (`earth.downlinkBatchMin` periyotlu) oluşturur ve giden kutusuna ekler.
   * Kesinti (blackout) varsa kuyrukta bekler; yer cevabı planlamaz (store-and-forward, cevap beklenmez).
   */
  sendTelemetryBatch(input: TelemetryBatchInput, createdT: SimTimeMs = input.t): Message | null {
    const packet = buildTelemetryBatchPacket(input, this.consentCategories)
    if (!packet) return null
    return this.send({
      priority: 1,
      category: 'TELEMETRY_BATCH',
      payload: packet,
      createdT,
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

    if (!this.config.blackout) {
      this.deliverInFlightUplink(simT)
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
      if (
        !this.config.blackout &&
        msg.status === 'IN_FLIGHT' &&
        msg.arriveT !== undefined &&
        simT >= msg.arriveT
      ) {
        msg.status = 'DELIVERED'
      }
    }
  }

  getGroundMirror(): GroundMirror {
    return {
      asOfT: this.mirrorAsOfT,
      delaySec: this.config.oneWayDelaySec,
      linkUp: !this.config.blackout,
      latest: { ...this.mirrorLatest },
      activeAlerts: this.mirrorActiveAlerts.map((a) => ({ ...a })),
      states: this.mirrorStates.map((s) => ({
        ...s,
        contributors: s.contributors.map((c) => ({ ...c })),
      })),
      cumulativeDoseByCrew: { ...this.mirrorCumulativeDoseByCrew },
    }
  }

  getDownlink(): DownlinkState {
    let queued = 0
    let inFlight = 0
    for (const m of this.outbox) {
      if (m.status === 'QUEUED') queued += 1
      else if (m.status === 'IN_FLIGHT') inFlight += 1
    }
    const recentSlice = this.outbox.slice(-MAX_RECENT_DOWNLINK)
    const recent: DownlinkItemSummary[] = recentSlice.map((m) => ({
      id: m.id,
      kind: resolveDownlinkKind(m),
      createdT: m.createdT,
      ...(m.arriveT !== undefined ? { arriveT: m.arriveT } : {}),
      status: m.status,
    }))
    return {
      queued,
      inFlight,
      lastDeliveredT: this.lastDeliveredT,
      recent,
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
    const activeSentCount = this.outbox.filter((m) => m.status !== 'QUEUED').length
    const activeDeliveredMessages = this.outbox.filter(
      (m) => m.status === 'DELIVERED' && m.arriveT !== undefined,
    )
    const activeLatencyMs = activeDeliveredMessages.reduce(
      (sum, m) => sum + ((m.arriveT ?? m.createdT) - m.createdT),
      0,
    )
    const totalSent = this.prunedDeliveredCount + activeSentCount
    const totalDelivered = this.prunedDeliveredCount + activeDeliveredMessages.length
    const totalLatencyMs = this.prunedDeliveredLatencyMs + activeLatencyMs
    const avgLatencyMin =
      totalDelivered > 0 ? msToMin(totalLatencyMs / totalDelivered) : 0

    return {
      config: { ...this.config },
      connected: !this.config.blackout,
      outbox: this.outbox.map((m) => ({ ...m })),
      inbox: this.inbox.filter((m) => m.status === 'DELIVERED').map((m) => ({ ...m })),
      pending: this.getPendingReplies(),
      stats: {
        sent: totalSent,
        delivered: totalDelivered,
        avgLatencyMin: Number(avgLatencyMin.toFixed(2)),
      },
      consentCategories: this.getConsentCategories(),
      groundMirror: this.getGroundMirror(),
      downlink: this.getDownlink(),
    }
  }

  private deliverInFlightUplink(simT: SimTimeMs): void {
    let deliveredAny = false
    for (const msg of this.outbox) {
      if (msg.status === 'IN_FLIGHT' && msg.arriveT !== undefined && simT >= msg.arriveT) {
        msg.status = 'DELIVERED'
        this.onUplinkDelivered(msg)
        deliveredAny = true
      }
    }
    if (deliveredAny) {
      this.pruneDeliveredTelemetryBatches()
    }
  }

  private onUplinkDelivered(msg: Message): void {
    const arriveT = msg.arriveT ?? this.simT
    this.lastDeliveredT =
      this.lastDeliveredT === null ? arriveT : Math.max(this.lastDeliveredT, arriveT)

    if (msg.payload === null || typeof msg.payload !== 'object') {
      this.mirrorAsOfT =
        this.mirrorAsOfT === null ? msg.createdT : Math.max(this.mirrorAsOfT, msg.createdT)
      return
    }

    const kind = (msg.payload as { kind?: unknown }).kind
    if (kind === 'TELEMETRY_BATCH') {
      const batch = msg.payload as TelemetryBatchPacketPayload
      this.mirrorAsOfT =
        this.mirrorAsOfT === null ? batch.t : Math.max(this.mirrorAsOfT, batch.t)
      for (const [k, v] of Object.entries(batch.latest)) {
        this.mirrorLatest[k] = v
      }
      if (batch.consentedCategories.includes('ALERTS')) {
        this.mirrorActiveAlerts = batch.activeAlerts.map((a) => ({ ...a }))
      }
      if (batch.states.length > 0 || batch.consentedCategories.length > 0) {
        this.mirrorStates = batch.states.map((s) => ({
          ...s,
          contributors: s.contributors.map((c) => ({ ...c })),
        }))
      }
      if (batch.consentedCategories.includes('RADIATION')) {
        for (const [crewId, dose] of Object.entries(batch.cumulativeDoseByCrew)) {
          this.mirrorCumulativeDoseByCrew[crewId] = dose
        }
      }
      return
    }

    if (kind === 'ALERT') {
      const alertPayload = msg.payload as AlertPacketPayload
      this.mirrorAsOfT =
        this.mirrorAsOfT === null ? msg.createdT : Math.max(this.mirrorAsOfT, msg.createdT)
      const mirrorAlert: Alert = {
        id: alertPayload.alertId,
        crewId: alertPayload.crewId,
        kind: alertPayload.alertKind,
        severity: alertPayload.severity,
        ...(alertPayload.state ? { state: alertPayload.state } : {}),
        ...(alertPayload.metric ? { metric: alertPayload.metric } : {}),
        titleKey: alertPayload.titleKey,
        whyKeys: alertPayload.whyKeys.map((w) => ({ key: w.key, params: { ...w.params } })),
        evidenceIds: [...alertPayload.evidenceIds],
        suggestedActionIds: [],
        earthDelayClass: alertPayload.earthDelayClass,
        ...(alertPayload.timeToHarmMin !== undefined
          ? { timeToHarmMin: alertPayload.timeToHarmMin }
          : {}),
        confidence: 1,
        status: 'ACTIVE',
        firstSeenT: alertPayload.firstSeenT,
        lastSeenT: msg.createdT,
      }
      const existingIdx = this.mirrorActiveAlerts.findIndex((a) => a.id === alertPayload.alertId)
      if (existingIdx >= 0) {
        this.mirrorActiveAlerts[existingIdx] = mirrorAlert
      } else {
        this.mirrorActiveAlerts.push(mirrorAlert)
      }
      return
    }

    if (kind === 'STATUS') {
      const statusPayload = msg.payload as StatusPacketPayload
      this.mirrorAsOfT =
        this.mirrorAsOfT === null ? statusPayload.t : Math.max(this.mirrorAsOfT, statusPayload.t)
      if (statusPayload.vitalsSummary) {
        for (const [k, v] of Object.entries(statusPayload.vitalsSummary)) {
          this.mirrorLatest[k] = v
        }
      }
      return
    }

    this.mirrorAsOfT =
      this.mirrorAsOfT === null ? msg.createdT : Math.max(this.mirrorAsOfT, msg.createdT)
  }

  private pruneDeliveredTelemetryBatches(): void {
    const deliveredBatchIndices: number[] = []
    for (let i = 0; i < this.outbox.length; i += 1) {
      const m = this.outbox[i]
      if (!m || m.status !== 'DELIVERED') continue
      if (resolveDownlinkKind(m) === 'TELEMETRY_BATCH') {
        deliveredBatchIndices.push(i)
      }
    }
    const excess = deliveredBatchIndices.length - MAX_DELIVERED_TELEMETRY_BATCHES
    if (excess <= 0) return

    for (let k = excess - 1; k >= 0; k -= 1) {
      const idx = deliveredBatchIndices[k]!
      const removed = this.outbox[idx]
      if (removed) {
        this.prunedDeliveredCount += 1
        this.prunedDeliveredLatencyMs += (removed.arriveT ?? removed.createdT) - removed.createdT
        this.outboxMeta.delete(removed.id)
        this.outbox.splice(idx, 1)
      }
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
    let deliveredImmediately = false

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
      if (msg.status === 'DELIVERED') {
        this.onUplinkDelivered(msg)
        deliveredImmediately = true
      }

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

    if (deliveredImmediately) {
      this.pruneDeliveredTelemetryBatches()
    }
  }
}

export { MS_PER_MIN }
