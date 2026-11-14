// Telemetri kaynağı arayüzü (FAZ_02 §3.9). Saf TS, DOM yok.
import type { ScenarioId, SimTimeMs, SourceStatus, TelemetryFrame } from '../types'

export interface TelemetrySource {
  start(): void
  pause(): void
  reset(): void
  setSpeed(speedMultiplier: number): void
  setScenario(id: ScenarioId, seed?: number): void
  seekToBookmark?(index: number): void
  onFrames(cb: (frames: TelemetryFrame[], simT: SimTimeMs) => void): () => void
  onStatus(cb: (s: SourceStatus) => void): () => void
  readonly kind: 'IN_PROCESS' | 'WEBSOCKET'
}
