// Depolama sözleşmesi (FAZ_03 §3.2). Saf TS; Dexie/IndexedDB burada DEĞİL.
import type { CrewId, SimTimeMs, TelemetryFrame } from '../types'

export interface FrameQuery {
  crewId: CrewId
  kind?: TelemetryFrame['kind']
  fromT?: SimTimeMs
  toT?: SimTimeMs
  limit?: number
}

export interface StorageWarning {
  code: 'DEXIE_ERROR'
  message: string
}

export interface FrameStore {
  append(frames: readonly TelemetryFrame[]): Promise<void>
  query(params: FrameQuery): Promise<TelemetryFrame[]>
  clear(): Promise<void>
  count(): Promise<number>
}

/** Pipeline PersistStage için dar port (PROJECT_MEMORY §3.5, §5). */
export interface PersistPort {
  append(frames: readonly TelemetryFrame[]): Promise<void>
  clear?(): Promise<void>
}
