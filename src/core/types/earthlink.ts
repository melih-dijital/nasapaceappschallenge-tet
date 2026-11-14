import type { SimTimeMs } from './frame'

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
