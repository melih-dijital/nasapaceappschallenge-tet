import { MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

// backfillDays=3 + durationDays=3 → güven 7. güne ulaşmadan senaryo biter (confidence < 0.5).
// Uyarılar ADVISORY ile sınırlı kalır; L1 limiti tetikleyecek olay enjekte edilmez.
export const newCrewMemberScenario: Scenario = {
  id: 'new_crew_member',
  titleKey: 'scenario.new_crew_member.title',
  descriptionKey: 'scenario.new_crew_member.description',
  seed: 808,
  durationDays: 3,
  backfillDays: 3,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
  },
  events: [
    {
      id: 'new-crew-mild-sleep',
      kind: 'SLEEP_DEFICIT',
      crewIds: ['sci'],
      fromT: 1 * MS_PER_DAY,
      toT: 3 * MS_PER_DAY,
      deltaH: -1.5,
    },
  ],
  expected: [],
  bookmarks: [
    { labelKey: 'bookmark.new_crew.start', t: 0 },
    { labelKey: 'bookmark.new_crew.day2', t: 2 * MS_PER_DAY },
  ],
}
