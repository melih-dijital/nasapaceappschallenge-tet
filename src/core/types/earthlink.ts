import type { Alert } from './alert'
import type { CrewId, SimTimeMs } from './frame'
import type { StateEstimate } from './state'

export const EARTH_LINK_PRESETS = ['MOON', 'MARS_MIN', 'MARS_MAX', 'CUSTOM'] as const
export type EarthLinkPreset = (typeof EARTH_LINK_PRESETS)[number]

export interface EarthLinkConfig {
  oneWayDelaySec: number
  preset: EarthLinkPreset
  blackout: boolean
}

export type MessageDirection = 'UP' | 'DOWN'
export type MessagePriority = 0 | 1 | 2 | 3
export type MessageStatus = 'QUEUED' | 'IN_FLIGHT' | 'DELIVERED'

export interface Message {
  id: string
  direction: MessageDirection
  priority: MessagePriority
  category: string
  createdT: SimTimeMs
  /** QUEUED (ör. kesintide) iken henüz yok. */
  sendT?: SimTimeMs
  /** QUEUED iken henüz yok. */
  arriveT?: SimTimeMs
  payload: unknown
  status: MessageStatus
}

export type DownlinkPacketKind = 'TELEMETRY_BATCH' | 'ALERT' | 'DAILY_SUMMARY' | 'STATUS'

export interface DownlinkItemSummary {
  id: string
  kind: DownlinkPacketKind
  createdT: SimTimeMs
  arriveT?: SimTimeMs
  status: MessageStatus
}

export interface DownlinkState {
  queued: number
  inFlight: number
  lastDeliveredT: SimTimeMs | null
  recent: DownlinkItemSummary[]
}

export interface GroundMirror {
  /** Dünya'ya ulaşmış son paketin araç içi zamanı (henüz paket ulaşmadıysa null). */
  asOfT: SimTimeMs | null
  /** O anki tek yön gecikme (sn). */
  delaySec: number
  /** İletişim hattı açık mı (!blackout). */
  linkUp: boolean
  /** Dünya'ya ulaşmış son metrik değerleri ("crewId|metric" -> değer). */
  latest: Record<string, number>
  /** Dünya'ya ulaşmış açık uyarılar. */
  activeAlerts: Alert[]
  /** Dünya'ya ulaşmış durum tahminleri. */
  states: StateEstimate[]
  /** Kişi başına Dünya'ya ulaşmış kümülatif görev radyasyon dozu (mSv). */
  cumulativeDoseByCrew?: Record<CrewId, number>
}
