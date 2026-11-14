// UI ↔ Worker mesaj protokolü (FAZ_03 §3.4 listesiyle birebir). Faz 1: yalnızca tipler; çalışan worker Faz 3.
// Asgari tip şekilleri: Faz 3/7 alan EKLEYEBİLİR, mevcut alanı değiştiremez.
// Faz 3 worker girişinde bu birleşimleri Zod ile doğrular.
import type {
  ActionCard,
  Alert,
  AlertEvent,
  CrewId,
  EarthLinkConfig,
  MetricId,
  ScenarioId,
  SimTimeMs,
  SourceStatus,
  StateEstimate,
} from '../core/types'

/** Grafik için indirgenmiş tek nokta (tüm çerçeve UI'ya gönderilmez). */
export interface ChartFrame {
  t: SimTimeMs
  crewId: CrewId
  metric: MetricId
  value: number
}

export interface EngineOutputLite {
  t: SimTimeMs
  alertEvents?: AlertEvent[]
  states?: StateEstimate[]
  cards?: ActionCard[]
  dataQualityCount: number
}

export interface EngineSnapshot {
  t: SimTimeMs
  /** Anahtar: latestKey(crewId, metric) → "crewId|metric". */
  latest: Record<string, number>
  activeAlerts: Alert[]
  states: StateEstimate[]
  cards: ActionCard[]
  dataQualityCount: number
}

export const latestKey = (crewId: CrewId, metric: MetricId): string => `${crewId}|${metric}`

/** Earth Link paketlerine girebilecek onaylı kategoriler (Faz 7). Journal hiçbir kategoride YOK. */
export const CONSENT_CATEGORIES = ['VITALS_SUMMARY', 'ALERTS', 'RADIATION', 'BEHAVIOR_SUMMARY'] as const
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number]

export type TelemetrySourceChoice = 'local' | 'ws'

export type UiToWorkerMessage =
  | {
      type: 'INIT'
      scenarioId: ScenarioId
      seed?: number
      speed: number
      source?: TelemetrySourceChoice
      wsUrl?: string
    }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; speedMultiplier: number }
  | { type: 'SET_SCENARIO'; id: ScenarioId; seed?: number }
  | { type: 'SEEK_BOOKMARK'; index: number }
  | { type: 'ACK_ALERT'; alertId: string }
  | {
      type: 'SUBMIT_CHECKIN'
      crewId: CrewId
      mood: { stress: number; mood: number; motivation: number }
      /** Yalnızca cihazda kalır; hiçbir Earth Link paketine girmez. */
      journalText?: string
    }
  | { type: 'SUBMIT_PVT'; crewId: CrewId; medianMs: number; lapses: number }
  | { type: 'ACCEPT_ACTION'; cardId: string }
  | { type: 'DISMISS_ACTION'; cardId: string }
  | { type: 'COMPLETE_ACTION'; cardId: string }
  /** Faz 7 */
  | { type: 'SET_EARTH_LINK'; config: Partial<EarthLinkConfig> }
  /** Faz 7 */
  | { type: 'SET_CONSENT'; categories: ConsentCategory[] }
  /** Faz 7/10: yer istasyonu şablon cevabı (demo). */
  | { type: 'GROUND_REPLY'; templateId: string; relatedAlertId?: string }
  /** Faz 8 */
  | { type: 'REQUEST_VALIDATION'; scenarios?: ScenarioId[]; seeds?: number[]; quick?: boolean }
  /** Faz 8 */
  | { type: 'CANCEL_VALIDATION' }

export type WorkerToUiMessage =
  | { type: 'READY' }
  | { type: 'STATUS'; status: SourceStatus }
  | { type: 'FRAMES_BATCH'; frames: ChartFrame[] }
  | { type: 'ENGINE_OUTPUT'; output: EngineOutputLite }
  | { type: 'SNAPSHOT'; snapshot: EngineSnapshot }
  | { type: 'ERROR'; code: string; message: string }
  /** Faz 8 */
  | { type: 'VALIDATION_PROGRESS'; done: number; total: number }
  /** Faz 8: ValidationReport şeması Faz 8'de tanımlanır. */
  | { type: 'VALIDATION_RESULT'; report: unknown }

export type UiToWorkerType = UiToWorkerMessage['type']
export type WorkerToUiType = WorkerToUiMessage['type']
