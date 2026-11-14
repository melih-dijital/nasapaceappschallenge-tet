import type { CrewId, SimTimeMs } from './frame'
import type { MetricId } from './metric'

export interface BaselineStat {
  crewId: CrewId
  metric: MetricId
  /** Kutu anahtarı: "hr|blk2", "day", "all", "env:LEO" (Faz 4). */
  bin: string
  median: number
  mad: number
  n: number
  updatedT: SimTimeMs
  confidence: number
}

export interface ZResult {
  z: number
  baseline: BaselineStat | null
  confidence: number
}
