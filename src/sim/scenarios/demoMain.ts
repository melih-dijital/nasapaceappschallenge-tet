import { minToMs, MS_PER_DAY, MS_PER_HOUR } from '../../core/units'
import type { Scenario } from '../scenario'

const SPE_START = 3 * MS_PER_DAY + 12 * MS_PER_HOUR // Gün 3 öğleden sonra (~70 sn @ 1×)
const SPE_RISE_MIN = 240
const SPE_DECAY_MIN = 1080
const SPE_END = SPE_START + minToMs(SPE_RISE_MIN + SPE_DECAY_MIN)

export const demoMainScenario: Scenario = {
  id: 'demo_main',
  titleKey: 'scenario.demo_main.title',
  descriptionKey: 'scenario.demo_main.description',
  seed: 42,
  durationDays: 6,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
  },
  events: [
    {
      id: 'demo-sleep-cdr',
      kind: 'SLEEP_DEFICIT',
      crewIds: ['cdr'],
      fromT: 0,
      toT: 4 * MS_PER_DAY,
      deltaH: -2.0,
    },
    {
      id: 'demo-mood-sci',
      kind: 'MOOD_DECLINE',
      crewIds: ['sci'],
      fromT: 0,
      toT: 3 * MS_PER_DAY,
      stressDelta: 2.5,
      moodDelta: -2.5,
      motivationDelta: -2.5,
      ramp: true,
    },
    {
      id: 'demo-spe',
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
      id: 'demo-spe-earth-delay',
      kind: 'EARTH_DELAY',
      crewIds: 'ALL',
      fromT: SPE_START,
      toT: SPE_END,
      oneWayDelaySec: 840,
    },
  ],
  expected: [
    {
      id: 'exp-demo-sleep-cdr',
      crewId: 'cdr',
      state: 'sleep_debt',
      fromT: 0,
      toT: 3 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
    {
      id: 'exp-demo-mood-sci',
      crewId: 'sci',
      state: 'mood_decline',
      fromT: 1 * MS_PER_DAY,
      toT: 3 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
    {
      id: 'exp-demo-spe',
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
    { labelKey: 'bookmark.demo.sleepDeficit', t: 0 },
    { labelKey: 'bookmark.demo.moodDecline', t: 1 * MS_PER_DAY },
    { labelKey: 'bookmark.demo.preSpe', t: 3 * MS_PER_DAY + 6 * MS_PER_HOUR },
    { labelKey: 'bookmark.demo.spe', t: SPE_START },
  ],
}
