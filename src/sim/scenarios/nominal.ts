import { MS_PER_DAY } from '../../core/units'
import type { Scenario } from '../scenario'

export const nominalScenario: Scenario = {
  id: 'nominal',
  titleKey: 'scenario.nominal.title',
  descriptionKey: 'scenario.nominal.description',
  seed: 101,
  durationDays: 30,
  backfillDays: 14,
  crewCount: 4,
  environment: 'MARS_TRANSIT',
  earthLinkPreset: {
    preset: 'MARS_MIN',
    oneWayDelaySec: 180,
  },
  events: [],
  expected: [],
  bookmarks: [
    { labelKey: 'bookmark.nominal.start', t: 0 },
    { labelKey: 'bookmark.nominal.mid', t: 15 * MS_PER_DAY },
  ],
}
