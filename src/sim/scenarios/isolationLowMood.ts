import { MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

const START_T = 8 * MS_PER_DAY
const END_T = 22 * MS_PER_DAY

export const isolationLowMoodScenario: Scenario = {
  id: 'isolation_low_mood',
  titleKey: 'scenario.isolation_low_mood.title',
  descriptionKey: 'scenario.isolation_low_mood.description',
  seed: 404,
  durationDays: 22,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MAX',
    oneWayDelaySec: 1320,
  },
  events: [
    {
      id: 'isolation-mood-sci',
      kind: 'MOOD_DECLINE',
      crewIds: ['sci'],
      fromT: START_T,
      toT: END_T,
      stressDelta: 2.8,
      moodDelta: -2.8,
      motivationDelta: -2.6,
      ramp: true,
    },
    {
      id: 'isolation-exercise-sci',
      kind: 'EXERCISE_SKIP',
      crewIds: ['sci'],
      fromT: 13 * MS_PER_DAY,
      toT: END_T,
      pct: 40,
    },
  ],
  expected: [
    {
      id: 'exp-mood-decline-sci',
      crewId: 'sci',
      state: 'mood_decline',
      fromT: START_T,
      toT: END_T,
      minSeverity: 'ADVISORY',
    },
  ],
  bookmarks: [
    { labelKey: 'bookmark.isolation.start', t: START_T },
    { labelKey: 'bookmark.isolation.week2', t: 16 * MS_PER_DAY },
  ],
}
