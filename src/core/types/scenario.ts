// Yalnızca iki tip. ScenarioEvent, Scenario ve olay tipleri Faz 2'de src/sim/scenario.ts'de tanımlanır.
import type { AlertKind, EarthDelayClass, Severity } from './alert'
import type { CrewId, SimTimeMs } from './frame'
import type { MetricId } from './metric'
import type { StateId } from './state'

export type ScenarioId = string

export interface ExpectedDetection {
  id: string
  crewId: CrewId | 'ALL'
  state?: StateId
  alertKind?: AlertKind
  metric?: MetricId
  fromT: SimTimeMs
  toT: SimTimeMs
  minSeverity: Severity
  mustBeEarthClass?: EarthDelayClass
}
