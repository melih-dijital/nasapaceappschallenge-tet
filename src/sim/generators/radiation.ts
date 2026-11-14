// Radyasyon çerçeve üreticisi: her 15 sim-dakikada bir RadiationFrame (FAZ_02 §3.5). Saf fonksiyon.
import type { CrewProfile, Environment, RadiationFrame, SimTimeMs } from '../../core/types'
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

export function generateRadiationFrame(
  state: CrewSimState,
  t: SimTimeMs,
  crew: CrewProfile,
  rng: Rng,
  activeEffects: ActiveEffects,
  environment: Environment,
  calibration: CalibrationData = getCalibrationData(),
): GeneratorResult<RadiationFrame, CrewSimState> {
  const envCal = calibration.environments[environment]
  const radCal = calibration.metrics['rad.doseRateMsvDay']

  // Kişisel dozimetre farkı (küçük oran farkı)
  const personalRatio = (crew.baselines['rad.doseRateMsvDay']?.mean ?? radCal.mean) / Math.max(1e-6, radCal.mean)
  const relWithinSd = radCal.withinSd / Math.max(1e-6, radCal.mean)

  const phi = 0.4
  const nextRadNoise = rng.ar1(state.radNoise, 0, phi, relWithinSd * Math.sqrt(1 - phi * phi))

  const baselineDoseRate = envCal.doseRateMsvDayMean * personalRatio * Math.max(0.2, 1 + nextRadNoise)
  const rawDoseRate = baselineDoseRate * activeEffects.speDoseMultiplier
  const doseRateMsvDay = roundTo(clamp(rawDoseRate, radCal.plausibleMin, radCal.plausibleMax), 4)

  const bgProton = Math.max(
    SIM_DEMO_DEFAULTS.minProtonFluxPfu,
    SIM_DEMO_DEFAULTS.backgroundProtonFluxPfu +
      rng.normal(0, SIM_DEMO_DEFAULTS.backgroundProtonFluxSd),
  )
  const rawProton =
    activeEffects.speProtonFraction > 0 && activeEffects.spePeakProtonPfu > bgProton
      ? bgProton + (activeEffects.spePeakProtonPfu - bgProton) * activeEffects.speProtonFraction
      : bgProton
  const protonFluxPfu = roundTo(Math.max(SIM_DEMO_DEFAULTS.minProtonFluxPfu, rawProton), 3)

  return {
    frame: {
      kind: 'radiation',
      t,
      crewId: crew.id,
      doseRateMsvDay,
      protonFluxPfu,
      environment,
      source: 'SYNTHETIC',
    },
    nextState: {
      ...state,
      radNoise: nextRadNoise,
    },
  }
}
