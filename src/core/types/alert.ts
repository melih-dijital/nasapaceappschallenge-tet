import type { CrewId, SimTimeMs } from './frame'
import type { MetricId } from './metric'
import type { StateId } from './state'

/** Artan önem sırasıyla. */
export const SEVERITIES = ['INFO', 'ADVISORY', 'WARNING', 'CRITICAL'] as const
export type Severity = (typeof SEVERITIES)[number]

export const ALERT_KINDS = ['LIMIT', 'DEVIATION', 'TREND', 'STATE', 'RADIATION'] as const
export type AlertKind = (typeof ALERT_KINDS)[number]

export const EARTH_DELAY_CLASSES = ['ACT_NOW', 'ACT_THEN_REPORT', 'CAN_WAIT_FOR_EARTH'] as const
export type EarthDelayClass = (typeof EARTH_DELAY_CLASSES)[number]

export const ALERT_STATUSES = ['ACTIVE', 'ACKED', 'RESOLVED'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

/** i18n anahtarı + parametreleri ("Why?" maddeleri). */
export interface WhyKey {
  key: string
  params: Record<string, string | number>
}

export interface Alert {
  id: string
  crewId: CrewId
  kind: AlertKind
  severity: Severity
  state?: StateId
  metric?: MetricId
  titleKey: string
  whyKeys: WhyKey[]
  evidenceIds: string[]
  suggestedActionIds: string[]
  earthDelayClass: EarthDelayClass
  timeToHarmMin?: number
  confidence: number
  status: AlertStatus
  firstSeenT: SimTimeMs
  lastSeenT: SimTimeMs
  ackT?: SimTimeMs
  resolvedT?: SimTimeMs
}

export interface AlertEvent {
  type: 'OPENED' | 'UPDATED' | 'ACKED' | 'RESOLVED'
  alert: Alert
  t: SimTimeMs
}
