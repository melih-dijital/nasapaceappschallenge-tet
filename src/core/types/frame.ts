// Telemetri çerçeveleri — PROJECT_MEMORY §6 ile birebir.
// Zaman sabitleri (MS_PER_*, VITALS_INTERVAL_MIN) burada DEĞİL: src/core/units.ts.

/** Değerler role'den sabittir: 'cdr' | 'md' | 'eng' | 'sci' (seed'den TÜRETİLMEZ). */
export type CrewId = string

/** Görev başlangıcından (T0) beri geçen simüle milisaniye; backfill çerçevelerinde t < 0. */
export type SimTimeMs = number

export const FRAME_SOURCES = ['SYNTHETIC', 'REPLAY', 'DEVICE'] as const
export type FrameSource = (typeof FRAME_SOURCES)[number]

export const ENVIRONMENTS = [
  'LEO',
  'MARS_TRANSIT',
  'LUNAR_ORBIT',
  'LUNAR_SURFACE',
  'MARS_SURFACE',
] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export interface VitalsFrame {
  kind: 'vitals'
  t: SimTimeMs
  crewId: CrewId
  hr: number
  spo2: number
  hrv?: number
  source: FrameSource
}

export interface DailyFrame {
  kind: 'daily'
  t: SimTimeMs
  crewId: CrewId
  day: number
  sleep: { durationH: number; efficiency: number /* 0-1 */; midpointShiftMin: number }
  activity: { exerciseMin: number; resistiveMin: number }
  hydrationL: number
  cabinCo2ppm?: number
  mood?: { stress: number; mood: number; motivation: number /* 1-10 */ }
  pvt?: { medianMs: number; lapses: number }
  /** Faz 6: kullanıcı check-in/PVT girişiyle birleştirilmiş çerçeve. */
  userSubmitted?: boolean
  source: FrameSource
}

export interface RadiationFrame {
  kind: 'radiation'
  t: SimTimeMs
  crewId: CrewId
  doseRateMsvDay: number
  protonFluxPfu?: number
  environment: Environment
  source: FrameSource
}

export type TelemetryFrame = VitalsFrame | DailyFrame | RadiationFrame
