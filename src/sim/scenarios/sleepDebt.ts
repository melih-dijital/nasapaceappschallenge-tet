import { MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

const START_T = 5 * MS_PER_DAY
const END_T = 10 * MS_PER_DAY

export const sleepDebtScenario: Scenario = {
  id: 'sleep_debt',
  titleKey: 'scenario.sleep_debt.title',
  descriptionKey: 'scenario.sleep_debt.description',
  seed: 303,
  durationDays: 14,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
  },
  events: [
    {
      id: 'sleep-deficit-cdr-eng',
      kind: 'SLEEP_DEFICIT',
      crewIds: ['cdr', 'eng'],
      fromT: START_T,
      toT: END_T,
      deltaH: -1.8,
    },
  ],
  expected: [
    {
      id: 'exp-sleep-debt-cdr',
      crewId: 'cdr',
      state: 'sleep_debt',
      fromT: START_T,
      toT: 9 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
    {
      id: 'exp-sleep-debt-eng',
      crewId: 'eng',
      state: 'sleep_debt',
      fromT: START_T,
      toT: 9 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
    {
      id: 'exp-fatigue-cdr',
      crewId: 'cdr',
      state: 'fatigue',
      fromT: START_T,
      toT: 10 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
    {
      id: 'exp-fatigue-eng',
      crewId: 'eng',
      state: 'fatigue',
      fromT: START_T,
      toT: 10 * MS_PER_DAY,
      minSeverity: 'ADVISORY',
    },
  ],
  bookmarks: [
    { labelKey: 'bookmark.sleep_debt.start', t: START_T },
    { labelKey: 'bookmark.sleep_debt.day8', t: 8 * MS_PER_DAY },
  ],
}
