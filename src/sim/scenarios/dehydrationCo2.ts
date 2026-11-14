import { MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

const START_T = 6 * MS_PER_DAY
const END_T = 9 * MS_PER_DAY

export const dehydrationCo2Scenario: Scenario = {
  id: 'dehydration_co2',
  titleKey: 'scenario.dehydration_co2.title',
  descriptionKey: 'scenario.dehydration_co2.description',
  seed: 505,
  durationDays: 12,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
  },
  events: [
    {
      id: 'dehydration-md',
      kind: 'HYDRATION_DROP',
      crewIds: ['md'],
      fromT: START_T,
      toT: END_T,
      deltaL: -0.9,
    },
    {
      id: 'co2-cabin-wide',
      kind: 'CO2_RISE',
      crewIds: 'ALL',
      fromT: START_T,
      toT: END_T,
      deltaPpm: 500,
    },
    {
      id: 'co2-md-local',
      kind: 'CO2_RISE',
      crewIds: ['md'],
      fromT: START_T,
      toT: END_T,
      deltaPpm: 400,
    },
  ],
  expected: [
    {
      id: 'exp-dehydration-md',
      crewId: 'md',
      state: 'dehydration',
      fromT: START_T,
      toT: END_T,
      minSeverity: 'ADVISORY',
    },
  ],
  bookmarks: [
    { labelKey: 'bookmark.dehydration.start', t: START_T },
    { labelKey: 'bookmark.dehydration.day8', t: 8 * MS_PER_DAY },
  ],
}
