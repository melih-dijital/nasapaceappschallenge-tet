import type { ScenarioId } from '../../core/types'
import type { Scenario } from '../scenario'
import { commBlackoutScenario } from './commBlackout'
import { dehydrationCo2Scenario } from './dehydrationCo2'
import { demoMainScenario } from './demoMain'
import { isolationLowMoodScenario } from './isolationLowMood'
import { newCrewMemberScenario } from './newCrewMember'
import { nominalScenario } from './nominal'
import { sleepDebtScenario } from './sleepDebt'
import { solarParticleEventScenario } from './solarParticleEvent'

export const ALL_SCENARIOS: readonly Scenario[] = [
  nominalScenario,
  solarParticleEventScenario,
  sleepDebtScenario,
  isolationLowMoodScenario,
  dehydrationCo2Scenario,
  commBlackoutScenario,
  demoMainScenario,
  newCrewMemberScenario,
]

export const SCENARIO_MAP: ReadonlyMap<ScenarioId, Scenario> = new Map(
  ALL_SCENARIOS.map((scenario) => [scenario.id, scenario]),
)

export const BUILTIN_SCENARIO_IDS = [
  'nominal',
  'solar_particle_event',
  'sleep_debt',
  'isolation_low_mood',
  'dehydration_co2',
  'comm_blackout',
  'demo_main',
  'new_crew_member',
] as const

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIO_MAP.get(id)
  if (!scenario) {
    throw new Error(`Bilinmeyen senaryo id "${id}"`)
  }
  return scenario
}

export function listScenarios(): readonly Scenario[] {
  return ALL_SCENARIOS
}
