import type { SimTimeMs } from './frame'

export interface SourceStatus {
  running: boolean
  simT: SimTimeMs
  day: number
  speed: number
  scenarioId: string
  /** WebSocketSource (Faz 11) bağlantı durumu. */
  connected?: boolean
}
