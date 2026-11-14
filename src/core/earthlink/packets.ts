// Earth Link paket oluşturucu (FAZ_07 §3.4):
// Yalnızca onaylı kategorileri (consentCategories) taşır; journal metni ve ham check-in notları ASLA pakete girmez.
import type { Alert, WhyKey } from '../types/alert'
import type { CrewId, SimTimeMs } from '../types/frame'
import type { StateId } from '../types/state'

export const EARTH_CONSENT_CATEGORIES = [
  'VITALS_SUMMARY',
  'ALERTS',
  'RADIATION',
  'BEHAVIOR_SUMMARY',
] as const

export type EarthConsentCategory = (typeof EARTH_CONSENT_CATEGORIES)[number]

const PRIVATE_KEY_PATTERN = /journal|rawcheckin|rawnote|privateNote|diary/i

function sanitizeParams(
  params: Record<string, string | number>,
): Record<string, string | number> {
  const clean: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (PRIVATE_KEY_PATTERN.test(key)) continue
    clean[key] = value
  }
  return clean
}

function sanitizeWhyKeys(whyKeys: readonly WhyKey[]): WhyKey[] {
  return whyKeys.map((wk) => ({
    key: wk.key,
    params: sanitizeParams(wk.params),
  }))
}

/** Nesne grafiğinde gizlilik ihlali doğurabilecek anahtar olup olmadığını derinlemesine kontrol eder. */
export function containsForbiddenPrivacyKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenPrivacyKey(item))
  }
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_KEY_PATTERN.test(key)) return true
    if (containsForbiddenPrivacyKey(child)) return true
  }
  return false
}

export interface StatusSnapshotInput {
  t: SimTimeMs
  latest?: Record<string, number>
  activeAlerts?: readonly Alert[]
  radiationSummary?: Record<string, number | string>
  behaviorSummary?: Record<string, number | boolean>
}

export interface StatusPacketPayload {
  kind: 'STATUS'
  t: SimTimeMs
  consentedCategories: EarthConsentCategory[]
  vitalsSummary?: Record<string, number>
  alerts?: {
    id: string
    crewId: CrewId
    severity: Alert['severity']
    state?: StateId
    earthDelayClass: Alert['earthDelayClass']
    status: Alert['status']
  }[]
  radiation?: Record<string, number | string>
  behaviorSummary?: Record<string, number | boolean>
}

export interface AlertPacketPayload {
  kind: 'ALERT'
  alertId: string
  crewId: CrewId
  alertKind: Alert['kind']
  severity: Alert['severity']
  state?: StateId
  metric?: Alert['metric']
  titleKey: string
  whyKeys: WhyKey[]
  evidenceIds: string[]
  earthDelayClass: Alert['earthDelayClass']
  timeToHarmMin?: number
  firstSeenT: SimTimeMs
}

export interface DailySummaryInput {
  vitals?: { hrMean?: number; spo2Min?: number; hrvMean?: number }
  radiation?: { dayDoseMsv?: number; cumulativeMissionMsv?: number }
  behavior?: {
    checkinCompleted?: boolean
    moodScore?: number
    stressScore?: number
    motivationScore?: number
    pvtMedianMs?: number
    pvtLapses?: number
  }
  alertCount?: number
  // Güvensiz/özel alanlar bilerek tip dışındadır; çalışma zamanında da dışlanır.
}

export interface DailySummaryPacketPayload {
  kind: 'DAILY_SUMMARY'
  crewId: CrewId
  day: number
  consentedCategories: EarthConsentCategory[]
  vitals?: { hrMean?: number; spo2Min?: number; hrvMean?: number }
  radiation?: { dayDoseMsv?: number; cumulativeMissionMsv?: number }
  behavior?: {
    checkinCompleted?: boolean
    moodScore?: number
    stressScore?: number
    motivationScore?: number
    pvtMedianMs?: number
    pvtLapses?: number
  }
  alertCount?: number
}

function pickVitalsOnly(latest: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(latest)) {
    if (PRIVATE_KEY_PATTERN.test(key)) continue
    if (key.includes('|rad.')) continue
    if (key.includes('|mood.') || key.includes('|pvt.')) continue
    out[key] = val
  }
  return out
}

function pickSafeFlatRecord<T extends number | string | boolean>(
  input: Record<string, T> | undefined,
): Record<string, T> {
  const out: Record<string, T> = {}
  if (!input) return out
  for (const [key, val] of Object.entries(input)) {
    if (PRIVATE_KEY_PATTERN.test(key)) continue
    if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
      out[key] = val
    }
  }
  return out
}

export function buildStatusPacket(
  snapshot: StatusSnapshotInput,
  consentCategories: readonly EarthConsentCategory[] = EARTH_CONSENT_CATEGORIES,
): StatusPacketPayload | null {
  const consent = new Set(consentCategories)
  if (consent.size === 0) return null

  const payload: StatusPacketPayload = {
    kind: 'STATUS',
    t: snapshot.t,
    consentedCategories: EARTH_CONSENT_CATEGORIES.filter((c) => consent.has(c)),
  }

  if (consent.has('VITALS_SUMMARY') && snapshot.latest) {
    payload.vitalsSummary = pickVitalsOnly(snapshot.latest)
  }

  if (consent.has('ALERTS') && snapshot.activeAlerts) {
    payload.alerts = snapshot.activeAlerts.map((a) => ({
      id: a.id,
      crewId: a.crewId,
      severity: a.severity,
      ...(a.state ? { state: a.state } : {}),
      earthDelayClass: a.earthDelayClass,
      status: a.status,
    }))
  }

  if (consent.has('RADIATION') && snapshot.radiationSummary) {
    payload.radiation = pickSafeFlatRecord(snapshot.radiationSummary)
  }

  if (consent.has('BEHAVIOR_SUMMARY') && snapshot.behaviorSummary) {
    payload.behaviorSummary = pickSafeFlatRecord(snapshot.behaviorSummary)
  }

  return payload
}

export function buildAlertPacket(
  alert: Alert,
  consentCategories: readonly EarthConsentCategory[] = EARTH_CONSENT_CATEGORIES,
): AlertPacketPayload | null {
  if (!consentCategories.includes('ALERTS')) return null
  return {
    kind: 'ALERT',
    alertId: alert.id,
    crewId: alert.crewId,
    alertKind: alert.kind,
    severity: alert.severity,
    ...(alert.state ? { state: alert.state } : {}),
    ...(alert.metric ? { metric: alert.metric } : {}),
    titleKey: alert.titleKey,
    whyKeys: sanitizeWhyKeys(alert.whyKeys),
    evidenceIds: [...alert.evidenceIds],
    earthDelayClass: alert.earthDelayClass,
    ...(alert.timeToHarmMin !== undefined ? { timeToHarmMin: alert.timeToHarmMin } : {}),
    firstSeenT: alert.firstSeenT,
  }
}

export function buildDailySummary(
  crewId: CrewId,
  day: number,
  summary: DailySummaryInput = {},
  consentCategories: readonly EarthConsentCategory[] = EARTH_CONSENT_CATEGORIES,
): DailySummaryPacketPayload | null {
  const consent = new Set(consentCategories)
  if (consent.size === 0) return null

  const payload: DailySummaryPacketPayload = {
    kind: 'DAILY_SUMMARY',
    crewId,
    day,
    consentedCategories: EARTH_CONSENT_CATEGORIES.filter((c) => consent.has(c)),
  }

  if (consent.has('VITALS_SUMMARY') && summary.vitals) {
    payload.vitals = {
      ...(summary.vitals.hrMean !== undefined ? { hrMean: summary.vitals.hrMean } : {}),
      ...(summary.vitals.spo2Min !== undefined ? { spo2Min: summary.vitals.spo2Min } : {}),
      ...(summary.vitals.hrvMean !== undefined ? { hrvMean: summary.vitals.hrvMean } : {}),
    }
  }

  if (consent.has('RADIATION') && summary.radiation) {
    payload.radiation = {
      ...(summary.radiation.dayDoseMsv !== undefined
        ? { dayDoseMsv: summary.radiation.dayDoseMsv }
        : {}),
      ...(summary.radiation.cumulativeMissionMsv !== undefined
        ? { cumulativeMissionMsv: summary.radiation.cumulativeMissionMsv }
        : {}),
    }
  }

  if (consent.has('BEHAVIOR_SUMMARY') && summary.behavior) {
    payload.behavior = {
      ...(summary.behavior.checkinCompleted !== undefined
        ? { checkinCompleted: summary.behavior.checkinCompleted }
        : {}),
      ...(summary.behavior.moodScore !== undefined
        ? { moodScore: summary.behavior.moodScore }
        : {}),
      ...(summary.behavior.stressScore !== undefined
        ? { stressScore: summary.behavior.stressScore }
        : {}),
      ...(summary.behavior.motivationScore !== undefined
        ? { motivationScore: summary.behavior.motivationScore }
        : {}),
      ...(summary.behavior.pvtMedianMs !== undefined
        ? { pvtMedianMs: summary.behavior.pvtMedianMs }
        : {}),
      ...(summary.behavior.pvtLapses !== undefined
        ? { pvtLapses: summary.behavior.pvtLapses }
        : {}),
    }
  }

  if (consent.has('ALERTS') && summary.alertCount !== undefined) {
    payload.alertCount = summary.alertCount
  }

  return payload
}

const utf8Encoder = new TextEncoder()

export function estimatePacketBytes(payload: unknown): number {
  const json = JSON.stringify(payload) ?? ''
  return utf8Encoder.encode(json).byteLength
}
