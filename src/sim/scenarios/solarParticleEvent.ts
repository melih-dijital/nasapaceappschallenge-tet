import { minToMs, MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

const SPE_START = 3 * MS_PER_DAY
const SPE_RISE_MIN = 240
const SPE_DECAY_MIN = 1080
const SPE_END = SPE_START + minToMs(SPE_RISE_MIN + SPE_DECAY_MIN)

export const solarParticleEventScenario: Scenario = {
  id: 'solar_particle_event',
  titleKey: 'scenario.solar_particle_event.title',
  descriptionKey: 'scenario.solar_particle_event.description',
  seed: 202,
  durationDays: 7,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'CUSTOM',
    oneWayDelaySec: 840,
  },
  events: [
    {
      id: 'spe-day3',
      kind: 'SPE',
      crewIds: 'ALL',
      fromT: SPE_START,
      toT: SPE_END,
      peakMultiplier: 8,
      peakProtonPfu: 200,
      riseMin: SPE_RISE_MIN,
      decayMin: SPE_DECAY_MIN,
    },
    {
      id: 'spe-earth-delay',
      kind: 'EARTH_DELAY',
      crewIds: 'ALL',
      fromT: SPE_START,
      toT: SPE_END,
      oneWayDelaySec: 840,
    },
  ],
  expected: [
    {
      id: 'exp-spe-radiation',
      crewId: 'ALL',
      state: 'radiation_event',
      alertKind: 'RADIATION',
      metric: 'rad.doseRateMsvDay',
      fromT: SPE_START,
      toT: SPE_START + minToMs(60),
      minSeverity: 'WARNING',
      mustBeEarthClass: 'ACT_NOW',
    },
  ],
  bookmarks: [
    { labelKey: 'bookmark.spe.pre', t: SPE_START - minToMs(60) },
    { labelKey: 'bookmark.spe.onset', t: SPE_START },
    { labelKey: 'bookmark.spe.peak', t: SPE_START + minToMs(SPE_RISE_MIN) },
  ],
}
