import { MS_PER_DAY, MS_PER_HOUR } from '../../core/units'
import type { Scenario } from '../scenario'

const START_T = 4 * MS_PER_DAY
const END_T = START_T + 36 * MS_PER_HOUR

export const commBlackoutScenario: Scenario = {
  id: 'comm_blackout',
  titleKey: 'scenario.comm_blackout.title',
  descriptionKey: 'scenario.comm_blackout.description',
  seed: 606,
  durationDays: 10,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MAX',
    oneWayDelaySec: 1320,
  },
  events: [
    {
      id: 'blackout-36h',
      kind: 'COMM_BLACKOUT',
      crewIds: 'ALL',
      fromT: START_T,
      toT: END_T,
    },
    {
      id: 'cardio-strain-eng',
      kind: 'HR_ELEVATION',
      crewIds: ['eng'],
      fromT: START_T,
      toT: END_T,
      deltaBpm: 10,
    },
  ],
  expected: [
    {
      id: 'exp-cardio-eng',
      crewId: 'eng',
      state: 'cardio_strain',
      fromT: START_T,
      toT: END_T,
      minSeverity: 'ADVISORY',
    },
  ],
  bookmarks: [
    { labelKey: 'bookmark.blackout.start', t: START_T },
    { labelKey: 'bookmark.blackout.end', t: END_T },
  ],
}
