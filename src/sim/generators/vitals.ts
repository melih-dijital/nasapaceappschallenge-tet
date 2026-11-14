// Vitals üreticisi: her 15 sim-dakikada bir VitalsFrame (FAZ_02 §3.5). Saf fonksiyon.
import type { CrewProfile, SimTimeMs, VitalsFrame } from '../../core/types'
import { MIN_PER_DAY } from '../../core/units'
import { getCalibrationData, type CalibrationData } from '../calibration'
import { minuteOfDay } from '../clock'
import { SIM_DEMO_DEFAULTS } from '../defaults'
import type { Rng } from '../rng'
import type { ActiveEffects } from '../scenario'
import type { CrewSimState, GeneratorResult } from './state'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function circadianHrOffset(t: SimTimeMs, crew: CrewProfile): number {
  const sleepMidMin =
    (crew.sleepWindow.startMin + crew.sleepWindow.durationMin / 2) % MIN_PER_DAY
  const phase = (2 * Math.PI * (minuteOfDay(t) - sleepMidMin)) / MIN_PER_DAY
  // Uyku orta noktasında -circadianAmplitudeHr (−8..−12 bpm)
  return -crew.circadianAmplitudeHr * Math.cos(phase)
}

function dailyActivityHrEffect(t: SimTimeMs, crew: CrewProfile, exerciseSkipFrac: number): number {
  // Her mürettebat üyesi için tutarlı günlük 30 dk egzersiz penceresi (10:00 sonrası role göre kaydırılmış)
  const roleSlot: Record<string, number> = { cdr: 600, md: 630, eng: 660, sci: 690 }
  const startMin = roleSlot[crew.id] ?? 600
  const modMin = minuteOfDay(t)
  const inWindow =
    modMin >= startMin && modMin < startMin + SIM_DEMO_DEFAULTS.exerciseWindowDurationMin
  if (!inWindow) return 0
  return SIM_DEMO_DEFAULTS.exerciseHrBoostBpm * Math.max(0, 1 - exerciseSkipFrac)
}

export function generateVitalsFrame(
  state: CrewSimState,
  t: SimTimeMs,
  crew: CrewProfile,
  rng: Rng,
  activeEffects: ActiveEffects,
  calibration: CalibrationData = getCalibrationData(),
): GeneratorResult<VitalsFrame, CrewSimState> {
  const phi = SIM_DEMO_DEFAULTS.vitalsAr1Phi
  const innovScale = Math.sqrt(1 - phi * phi)

  const hrBase = crew.baselines.hr ?? {
    mean: calibration.metrics.hr.mean,
    withinSd: calibration.metrics.hr.withinSd,
  }
  const spo2Base = crew.baselines.spo2 ?? {
    mean: calibration.metrics.spo2.mean,
    withinSd: calibration.metrics.spo2.withinSd,
  }
  const hrvBase = crew.baselines.hrv ?? {
    mean: calibration.metrics.hrv.mean,
    withinSd: calibration.metrics.hrv.withinSd,
  }

  const nextHrNoise = rng.ar1(state.hrNoise, 0, phi, hrBase.withinSd * innovScale)
  const nextSpo2Noise = rng.ar1(state.spo2Noise, 0, phi * 0.5, spo2Base.withinSd * Math.sqrt(1 - (phi * 0.5) ** 2))
  const nextHrvNoise = rng.ar1(state.hrvNoise, 0, phi, hrvBase.withinSd * innovScale)

  const circadian = circadianHrOffset(t, crew)
  const activityEffect = dailyActivityHrEffect(t, crew, activeEffects.exerciseSkipFrac)
  const dehydrationDeficit = Math.max(0, -activeEffects.hydrationDeltaL)
  const dehydrationHr = dehydrationDeficit * SIM_DEMO_DEFAULTS.dehydrationHrPerLiter

  const rawHr =
    hrBase.mean + circadian + activityEffect + dehydrationHr + nextHrNoise + activeEffects.hrDeltaBpm
  const hr = roundTo(
    clamp(rawHr, calibration.metrics.hr.plausibleMin, calibration.metrics.hr.plausibleMax),
    1,
  )

  const rawSpo2 = spo2Base.mean + nextSpo2Noise + activeEffects.spo2Delta
  const spo2 = roundTo(
    clamp(rawSpo2, calibration.metrics.spo2.plausibleMin, Math.min(100, calibration.metrics.spo2.plausibleMax)),
    2,
  )

  const hrDeviationFromBase = hr - hrBase.mean
  const rawHrv = hrvBase.mean - SIM_DEMO_DEFAULTS.hrvInverseHrSlope * hrDeviationFromBase + nextHrvNoise
  const hrv = roundTo(
    clamp(rawHrv, calibration.metrics.hrv.plausibleMin, calibration.metrics.hrv.plausibleMax),
    1,
  )

  return {
    frame: {
      kind: 'vitals',
      t,
      crewId: crew.id,
      hr,
      spo2,
      hrv,
      source: 'SYNTHETIC',
    },
    nextState: {
      ...state,
      hrNoise: nextHrNoise,
      spo2Noise: nextSpo2Noise,
      hrvNoise: nextHrvNoise,
    },
  }
}
