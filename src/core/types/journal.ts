import type { CrewId, SimTimeMs } from './frame'

/**
 * Serbest metin günlük kaydı. TelemetryFrame, Engine çıktısı ve Earth Link tiplerinden
 * BAĞIMSIZDIR; yalnızca cihazda kalır, hiçbir pakete girmez (PROJECT_MEMORY §13 gizlilik ilkesi).
 */
export interface JournalEntry {
  id: string
  crewId: CrewId
  t: SimTimeMs
  text: string
}
