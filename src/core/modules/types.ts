// Alan modülü sözleşmeleri (FAZ_06 §3). Saf TS. (`src/core/types/**` donuk olduğu için modül tipleri burada.)
import type { CrewId, Environment, SimTimeMs } from '../types'

export type ModuleName = 'radiation' | 'sleep' | 'cardio' | 'behavioral'

export interface ModuleProvenance {
  evidenceIds: string[]
  /** Kullanılan kayıtlardan biri `verified: false` ise true (UI "doğrulanmadı" etiketi). */
  anyUnverified: boolean
}

export type SpeState = 'IDLE' | 'SUSPECTED' | 'CONFIRMED' | 'DECAYING'

export interface SpeSummary {
  startT: SimTimeMs
  endT: SimTimeMs
  peakRatio: number
  doseMsv: number
  /** Olay dozu / 250 mSv "design reference SPE protection target" (kişisel limit DEĞİL). */
  fractionOfSpeLimit: number
}

export interface RadiationReport {
  cumulativeMissionMsv: number
  careerMsv: number
  careerFraction: number
  currentRateMsvDay: number
  /** Kişinin ortam bin'indeki baseline doz hızı medyanı (yoksa null). */
  baselineRate: number | null
  rateRatio: number | null
  protonFluxPfu: number | null
  projectedMissionEndMsv: number
  projectedCareerFractionAtEnd: number
  /** Görev süresi senaryodan değil `rad.projection.defaultMissionDays`'ten geldiyse true. */
  projectedIsAssumption: boolean
  /** Son penceredeki gün medyanlarının Theil-Sen eğimi pozitifse true ("artan hız" notu). */
  rateIncreasing: boolean
  speState: SpeState
  speDoseMsv: number
  /** Alan adı korunur; anlamı: speDoseMsv / "design reference SPE protection target". */
  speFractionOfLimit: number
  lastSpe: SpeSummary | null
  environment: Environment
  /** UI öneri metni anahtarı (tıbbi talimat değil; eylem Faz 7). */
  adviceKey: string | null
}

export interface ModuleReport<P = RadiationReport> {
  module: ModuleName
  crewId: CrewId
  t: SimTimeMs
  payload: P
  provenance: ModuleProvenance
}
