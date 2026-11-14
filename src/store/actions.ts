// UI bileşenlerinin EngineClient'a komut göndermek için kullandığı eylemler (FAZ_03 §3.5).
// UI bileşenleri store'lara doğrudan yazmaz; worker komutları buradan geçer.
import type { CrewId, ScenarioId } from '../core/types'
import { getEngineClient } from './engineClient'
import { useSessionStore, type UiLanguage } from './sessionStore'

export function initSimulation(opts: {
  scenarioId?: ScenarioId
  seed?: number
  speed?: number
} = {}): void {
  getEngineClient().send({
    type: 'INIT',
    scenarioId: opts.scenarioId ?? 'demo_main',
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    speed: opts.speed ?? 1,
  })
}

export function startSimulation(): void {
  getEngineClient().send({ type: 'START' })
}

export function pauseSimulation(): void {
  getEngineClient().send({ type: 'PAUSE' })
}

export function resetSimulation(): void {
  getEngineClient().send({ type: 'RESET' })
}

export function setSimulationSpeed(speedMultiplier: number): void {
  getEngineClient().send({ type: 'SET_SPEED', speedMultiplier })
}

export function selectScenario(id: ScenarioId, seed?: number): void {
  useSessionStore.getState().setScenarioMeta(id, seed)
  getEngineClient().send({
    type: 'SET_SCENARIO',
    id,
    ...(seed !== undefined ? { seed } : {}),
  })
}

export function seekBookmark(index: number): void {
  getEngineClient().send({ type: 'SEEK_BOOKMARK', index })
}

export function ackAlert(alertId: string): void {
  getEngineClient().send({ type: 'ACK_ALERT', alertId })
}

export function submitCheckin(
  crewId: CrewId,
  mood: { stress: number; mood: number; motivation: number },
  journalText?: string,
): void {
  getEngineClient().send({
    type: 'SUBMIT_CHECKIN',
    crewId,
    mood,
    ...(journalText !== undefined ? { journalText } : {}),
  })
}

export function submitPvt(crewId: CrewId, medianMs: number, lapses: number): void {
  getEngineClient().send({ type: 'SUBMIT_PVT', crewId, medianMs, lapses })
}

export function acceptAction(cardId: string): void {
  getEngineClient().send({ type: 'ACCEPT_ACTION', cardId })
}

export function dismissAction(cardId: string): void {
  getEngineClient().send({ type: 'DISMISS_ACTION', cardId })
}

export function completeAction(cardId: string): void {
  getEngineClient().send({ type: 'COMPLETE_ACTION', cardId })
}

export function setSelectedCrew(crewId: CrewId): void {
  useSessionStore.getState().setSelectedCrew(crewId)
}

export function setLanguage(language: UiLanguage): void {
  useSessionStore.getState().setLanguage(language)
}
