// Deterministik mürettebat profil üretimi (FAZ_02 §3.4).
// CrewId'ler role'den sabittir ('cdr' | 'md' | 'eng' | 'sci'), seed'den TÜRETİLMEZ (PROJECT_MEMORY §6).
import {
  AGE_BANDS,
  CREW_ROLES,
  METRIC_IDS,
  type CrewProfile,
  type CrewRole,
  type MetricBaselineParams,
  type MetricId,
} from '../core/types'
import { MIN_PER_DAY } from '../core/units'
import { getCalibrationData, type CalibrationData } from './calibration'
import { SIM_DEMO_DEFAULTS } from './defaults'
import { Rng } from './rng'

interface RosterSlot {
  id: string
  role: CrewRole
  displayName: string
}

const FIXED_ROSTER: readonly RosterSlot[] = [
  { id: 'cdr', role: 'CDR', displayName: 'Cmdr. A. Rivera' },
  { id: 'md', role: 'MD', displayName: 'Dr. M. Okafor' },
  { id: 'eng', role: 'ENG', displayName: 'Eng. L. Chen' },
  { id: 'sci', role: 'SCI', displayName: 'Sci. T. Yılmaz' },
]

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function generateCrew(
  seed: number,
  n = 4,
  calibration: CalibrationData = getCalibrationData(),
): CrewProfile[] {
  const crewRootRng = new Rng(seed).fork('crew')
  const profiles: CrewProfile[] = []

  for (let i = 0; i < n; i++) {
    const slot: RosterSlot = FIXED_ROSTER[i] ?? {
      id: `crew-${i + 1}`,
      role: CREW_ROLES[i % CREW_ROLES.length] ?? 'SCI',
      displayName: `Specialist ${i + 1}`,
    }
    const rng = crewRootRng.fork(slot.id)
    const baselines: Partial<Record<MetricId, MetricBaselineParams>> = {}

    for (const metric of METRIC_IDS) {
      const cal = calibration.metrics[metric]
      const rawMean = cal.mean + rng.normal(0, cal.betweenSd)
      const mean = clamp(rawMean, cal.plausibleMin, cal.plausibleMax)
      baselines[metric] = {
        mean: Number(mean.toFixed(4)),
        withinSd: cal.withinSd,
      }
    }

    const startMin =
      (((SIM_DEMO_DEFAULTS.defaultSleepStartMin +
        rng.int(-SIM_DEMO_DEFAULTS.sleepStartJitterMin, SIM_DEMO_DEFAULTS.sleepStartJitterMin)) %
        MIN_PER_DAY) +
        MIN_PER_DAY) %
      MIN_PER_DAY

    const durationMin = SIM_DEMO_DEFAULTS.defaultSleepWindowDurationMin + rng.int(-15, 15)

    profiles.push({
      id: slot.id,
      displayName: slot.displayName,
      role: slot.role,
      ageBand: rng.pick(AGE_BANDS),
      priorCareerDoseMsv: Number(
        rng
          .uniform(SIM_DEMO_DEFAULTS.priorCareerDoseMsvMin, SIM_DEMO_DEFAULTS.priorCareerDoseMsvMax)
          .toFixed(1),
      ),
      baselines,
      circadianAmplitudeHr: Number(
        rng
          .uniform(
            SIM_DEMO_DEFAULTS.circadianAmplitudeHrMin,
            SIM_DEMO_DEFAULTS.circadianAmplitudeHrMax,
          )
          .toFixed(2),
      ),
      sleepWindow: {
        startMin,
        durationMin,
      },
    })
  }

  return profiles
}
