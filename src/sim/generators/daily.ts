// Günlük çerçeve üreticisi: her sim-günde 1 kez gün sonunda (FAZ_02 §3.5). Saf fonksiyon.
import type { CrewProfile, DailyFrame, MetricId, SimTimeMs } from '../../core/types'
import { getCalibrationData, type CalibrationData } from '../calibration'
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

function metricParams(
  crew: CrewProfile,
  metric: MetricId,
  calibration: CalibrationData,
): { mean: number; withinSd: number; min: number; max: number } {
  const cal = calibration.metrics[metric]
  const base = crew.baselines[metric]
  return {
    mean: base?.mean ?? cal.mean,
    withinSd: base?.withinSd ?? cal.withinSd,
    min: cal.plausibleMin,
    max: cal.plausibleMax,
  }
}

export interface DailyFrameOptions {
  day: number
  cabinCo2Deviation: number
}

export function generateDailyFrame(
  state: CrewSimState,
  t: SimTimeMs,
  crew: CrewProfile,
  rng: Rng,
  activeEffects: ActiveEffects,
  options: DailyFrameOptions,
  calibration: CalibrationData = getCalibrationData(),
): GeneratorResult<DailyFrame, CrewSimState> {
  const phi = SIM_DEMO_DEFAULTS.dailyAr1Phi
  const innovScale = Math.sqrt(1 - phi * phi)

  const sleepDurP = metricParams(crew, 'sleep.durationH', calibration)
  const sleepEffP = metricParams(crew, 'sleep.efficiency', calibration)
  const sleepShiftP = metricParams(crew, 'sleep.midpointShiftMin', calibration)
  const exMinP = metricParams(crew, 'activity.exerciseMin', calibration)
  const resMinP = metricParams(crew, 'activity.resistiveMin', calibration)
  const hydP = metricParams(crew, 'hydrationL', calibration)
  const co2P = metricParams(crew, 'cabinCo2ppm', calibration)
  const stressP = metricParams(crew, 'mood.stress', calibration)
  const moodP = metricParams(crew, 'mood.mood', calibration)
  const motivP = metricParams(crew, 'mood.motivation', calibration)
  const pvtMsP = metricParams(crew, 'pvt.medianMs', calibration)
  const pvtLapseP = metricParams(crew, 'pvt.lapses', calibration)

  const nextSleepDurDev = rng.ar1(state.dailyDev.sleepDurationH, 0, phi, sleepDurP.withinSd * innovScale)
  const nextSleepEffDev = rng.ar1(state.dailyDev.sleepEfficiency, 0, phi, sleepEffP.withinSd * innovScale)
  const nextMidShiftDev = rng.ar1(state.dailyDev.midpointShiftMin, 0, phi, sleepShiftP.withinSd * innovScale)
  const nextExDev = rng.ar1(state.dailyDev.exerciseMin, 0, phi, exMinP.withinSd * innovScale)
  const nextResDev = rng.ar1(state.dailyDev.resistiveMin, 0, phi, resMinP.withinSd * innovScale)
  const nextHydDev = rng.ar1(state.dailyDev.hydrationL, 0, phi, hydP.withinSd * innovScale)
  const nextCo2Offset = rng.ar1(state.dailyDev.cabinCo2OffsetPpm, 0, phi * 0.5, co2P.withinSd * 0.2)
  const nextStressDev = rng.ar1(state.dailyDev.stress, 0, phi, stressP.withinSd * innovScale)
  const nextMoodDev = rng.ar1(state.dailyDev.mood, 0, phi, moodP.withinSd * innovScale)
  const nextMotivDev = rng.ar1(state.dailyDev.motivation, 0, phi, motivP.withinSd * innovScale)
  const nextPvtMsDev = rng.ar1(state.dailyDev.pvtMedianMs, 0, phi, pvtMsP.withinSd * innovScale)

  const nextSleepDebtH = Math.max(
    0,
    state.sleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtDecayDaily + Math.max(0, -activeEffects.sleepDeltaH),
  )

  const durationH = roundTo(
    clamp(sleepDurP.mean + nextSleepDurDev + activeEffects.sleepDeltaH, sleepDurP.min, sleepDurP.max),
    2,
  )
  const efficiency = roundTo(
    clamp(
      sleepEffP.mean +
        nextSleepEffDev -
        nextSleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtToEfficiencyPerH -
        Math.max(0, activeEffects.stressDelta) * 0.015,
      sleepEffP.min,
      sleepEffP.max,
    ),
    3,
  )
  const midpointShiftMin = roundTo(
    clamp(sleepShiftP.mean + nextMidShiftDev + activeEffects.sleepShiftMin, sleepShiftP.min, sleepShiftP.max),
    1,
  )

  const moodMotFactor = clamp(1 + activeEffects.motivationDelta * 0.08, 0.4, 1.1)
  const activityScale = Math.max(0, 1 - activeEffects.exerciseSkipFrac) * moodMotFactor
  const exerciseMin = roundTo(
    clamp((exMinP.mean + nextExDev) * activityScale, exMinP.min, exMinP.max),
    1,
  )
  const resistiveMin = roundTo(
    clamp((resMinP.mean + nextResDev) * activityScale, resMinP.min, resMinP.max),
    1,
  )

  const hydrationL = roundTo(
    clamp(hydP.mean + nextHydDev + activeEffects.hydrationDeltaL, hydP.min, hydP.max),
    2,
  )

  const cabinCo2ppm = roundTo(
    clamp(
      co2P.mean + options.cabinCo2Deviation + nextCo2Offset + activeEffects.co2DeltaPpm,
      co2P.min,
      co2P.max,
    ),
    0,
  )

  const stress = roundTo(
    clamp(
      stressP.mean +
        nextStressDev +
        activeEffects.stressDelta +
        nextSleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtToStressPerH,
      stressP.min,
      stressP.max,
    ),
    2,
  )
  const mood = roundTo(
    clamp(moodP.mean + nextMoodDev + activeEffects.moodDelta, moodP.min, moodP.max),
    2,
  )
  const motivation = roundTo(
    clamp(
      motivP.mean +
        nextMotivDev +
        activeEffects.motivationDelta -
        nextSleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtToMotivationPerH,
      motivP.min,
      motivP.max,
    ),
    2,
  )

  const medianMs = roundTo(
    clamp(
      pvtMsP.mean + nextPvtMsDev + nextSleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtToPvtMsPerH,
      pvtMsP.min,
      pvtMsP.max,
    ),
    1,
  )
  const lapseLambda = Math.max(
    0.05,
    pvtLapseP.mean +
      nextSleepDebtH * SIM_DEMO_DEFAULTS.sleepDebtToLapsesPerH +
      Math.max(0, activeEffects.stressDelta) * 0.35,
  )
  const lapses = clamp(rng.poisson(lapseLambda), pvtLapseP.min, pvtLapseP.max)

  return {
    frame: {
      kind: 'daily',
      t,
      crewId: crew.id,
      day: options.day,
      sleep: { durationH, efficiency, midpointShiftMin },
      activity: { exerciseMin, resistiveMin },
      hydrationL,
      cabinCo2ppm,
      mood: { stress, mood, motivation },
      pvt: { medianMs, lapses },
      source: 'SYNTHETIC',
    },
    nextState: {
      ...state,
      sleepDebtH: nextSleepDebtH,
      dailyDev: {
        sleepDurationH: nextSleepDurDev,
        sleepEfficiency: nextSleepEffDev,
        midpointShiftMin: nextMidShiftDev,
        exerciseMin: nextExDev,
        resistiveMin: nextResDev,
        hydrationL: nextHydDev,
        cabinCo2OffsetPpm: nextCo2Offset,
        stress: nextStressDev,
        mood: nextMoodDev,
        motivation: nextMotivDev,
        pvtMedianMs: nextPvtMsDev,
      },
    },
  }
}
