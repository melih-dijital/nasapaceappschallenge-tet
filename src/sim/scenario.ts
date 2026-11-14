// Senaryo olay tipleri, senaryo şeması ve SPE eğri hesabı (FAZ_02 §3.6).
import type {
  CrewId,
  EarthLinkPreset,
  Environment,
  ExpectedDetection,
  ScenarioId,
  SimTimeMs,
} from '../core/types'
import { minToMs, msToMin } from '../core/units'

export interface ScenarioEventBase {
  id: string
  crewIds: CrewId[] | 'ALL'
  fromT: SimTimeMs
  toT: SimTimeMs
}

export type ScenarioEvent =
  | (ScenarioEventBase & { kind: 'SLEEP_DEFICIT'; deltaH: number })
  | (ScenarioEventBase & { kind: 'SLEEP_SHIFT'; shiftMin: number })
  | (ScenarioEventBase & {
      kind: 'SPE'
      peakMultiplier: number
      peakProtonPfu: number
      riseMin: number
      decayMin: number
    })
  | (ScenarioEventBase & { kind: 'EARTH_DELAY'; oneWayDelaySec: number })
  | (ScenarioEventBase & { kind: 'HR_ELEVATION'; deltaBpm: number })
  | (ScenarioEventBase & { kind: 'SPO2_DIP'; delta: number })
  | (ScenarioEventBase & { kind: 'HYDRATION_DROP'; deltaL: number })
  | (ScenarioEventBase & { kind: 'CO2_RISE'; deltaPpm: number })
  | (ScenarioEventBase & {
      kind: 'MOOD_DECLINE'
      stressDelta: number
      moodDelta: number
      motivationDelta: number
      ramp?: boolean
    })
  | (ScenarioEventBase & { kind: 'EXERCISE_SKIP'; pct: number })
  | (ScenarioEventBase & { kind: 'COMM_BLACKOUT' })

export type SpeScenarioEvent = Extract<ScenarioEvent, { kind: 'SPE' }>

export interface ScenarioBookmark {
  labelKey: string
  t: SimTimeMs
}

export interface Scenario {
  id: ScenarioId
  titleKey: string
  descriptionKey: string
  seed: number
  durationDays: number
  /** Varsayılan 14 gün; new_crew_member 3 gün (PROJECT_MEMORY §6). */
  backfillDays: number
  crewCount: number
  environment: Environment
  earthLinkPreset?: {
    preset: EarthLinkPreset
    oneWayDelaySec: number
    blackout?: boolean
  }
  events: ScenarioEvent[]
  expected: ExpectedDetection[]
  bookmarks?: ScenarioBookmark[]
}

export interface ActiveEffects {
  sleepDeltaH: number
  sleepShiftMin: number
  hrDeltaBpm: number
  spo2Delta: number
  hydrationDeltaL: number
  co2DeltaPpm: number
  stressDelta: number
  moodDelta: number
  motivationDelta: number
  exerciseSkipFrac: number
  speDoseMultiplier: number
  speProtonFraction: number
  spePeakProtonPfu: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const EMPTY_ACTIVE_EFFECTS: ActiveEffects = {
  sleepDeltaH: 0,
  sleepShiftMin: 0,
  hrDeltaBpm: 0,
  spo2Delta: 0,
  hydrationDeltaL: 0,
  co2DeltaPpm: 0,
  stressDelta: 0,
  moodDelta: 0,
  motivationDelta: 0,
  exerciseSkipFrac: 0,
  speDoseMultiplier: 1,
  speProtonFraction: 0,
  spePeakProtonPfu: 0,
}

/**
 * FAZ_02 §3.6 SPE eğrisi (kodla birebir):
 * Yükseliş: m(t) = 1 + (peak - 1) * (1 - e^(-(t - fromT) / tauRise)), tauRise = riseMin / 4
 * Sönüm:    m(t) = 1 + (m(tEnd) - 1) * e^(-(t - tEnd) / tauDecay), tauDecay = decayMin / 4
 * tEnd = fromT + riseMin; sönüm yükselişin O ANKİ değerinden başlar → sıçrama yok.
 */
export function speCurveMultiplier(t: SimTimeMs, event: SpeScenarioEvent): number {
  if (t < event.fromT || t >= event.toT || event.peakMultiplier <= 1) return 1
  const tauRise = Math.max(1e-6, event.riseMin / 4)
  const tauDecay = Math.max(1e-6, event.decayMin / 4)
  const tEnd = event.fromT + minToMs(event.riseMin)

  if (t <= tEnd) {
    const elapsedMin = msToMin(t - event.fromT)
    return 1 + (event.peakMultiplier - 1) * (1 - Math.exp(-elapsedMin / tauRise))
  }
  const mAtEnd = 1 + (event.peakMultiplier - 1) * (1 - Math.exp(-event.riseMin / tauRise))
  const sinceEndMin = msToMin(t - tEnd)
  return 1 + (mAtEnd - 1) * Math.exp(-sinceEndMin / tauDecay)
}

export function eventAppliesToCrew(event: ScenarioEvent, crewId: CrewId, t: SimTimeMs): boolean {
  if (t < event.fromT || t >= event.toT) return false
  return event.crewIds === 'ALL' || event.crewIds.includes(crewId)
}

/** Bir mürettebat üyesi ve t anı için aktif olaylardan efekt özetini türetir. */
export function resolveActiveEffects(
  events: readonly ScenarioEvent[],
  crewId: CrewId,
  t: SimTimeMs,
): ActiveEffects {
  if (t < 0 || events.length === 0) return EMPTY_ACTIVE_EFFECTS

  const effects: ActiveEffects = { ...EMPTY_ACTIVE_EFFECTS }

  for (const event of events) {
    if (!eventAppliesToCrew(event, crewId, t)) continue

    switch (event.kind) {
      case 'SLEEP_DEFICIT':
        effects.sleepDeltaH += event.deltaH
        break
      case 'SLEEP_SHIFT':
        effects.sleepShiftMin += event.shiftMin
        break
      case 'HR_ELEVATION':
        effects.hrDeltaBpm += event.deltaBpm
        break
      case 'SPO2_DIP':
        effects.spo2Delta += event.delta
        break
      case 'HYDRATION_DROP':
        effects.hydrationDeltaL += event.deltaL
        break
      case 'CO2_RISE':
        effects.co2DeltaPpm += event.deltaPpm
        break
      case 'MOOD_DECLINE': {
        const span = Math.max(1, event.toT - event.fromT)
        const factor = event.ramp ? clamp((t - event.fromT) / span, 0, 1) : 1
        effects.stressDelta += event.stressDelta * factor
        effects.moodDelta += event.moodDelta * factor
        effects.motivationDelta += event.motivationDelta * factor
        break
      }
      case 'EXERCISE_SKIP': {
        const frac = clamp(event.pct > 1 ? event.pct / 100 : event.pct, 0, 1)
        effects.exerciseSkipFrac = Math.max(effects.exerciseSkipFrac, frac)
        break
      }
      case 'SPE': {
        const mult = speCurveMultiplier(t, event)
        if (mult > effects.speDoseMultiplier) {
          effects.speDoseMultiplier = mult
          const denom = Math.max(1e-9, event.peakMultiplier - 1)
          effects.speProtonFraction = clamp((mult - 1) / denom, 0, 1)
          effects.spePeakProtonPfu = Math.max(effects.spePeakProtonPfu, event.peakProtonPfu)
        }
        break
      }
      case 'EARTH_DELAY':
      case 'COMM_BLACKOUT':
        // Üretimi etkilemez; Faz 7 Earth Link tarafından okunur.
        break
    }
  }

  return effects
}
