// Oturum ve simülasyon kontrol durumu (FAZ_03 §3.5).
import { create } from 'zustand'
import type { CrewId, ScenarioId, SimTimeMs, SourceStatus } from '../core/types'

export type UiLanguage = 'en' | 'tr'
export type WorkerStatus = 'idle' | 'initializing' | 'ready' | 'restarting' | 'error'

export interface SessionState {
  scenarioId: ScenarioId
  seed: number | undefined
  speed: number
  running: boolean
  simT: SimTimeMs
  day: number
  selectedCrewId: CrewId
  language: UiLanguage
  workerStatus: WorkerStatus
  lastError: { code: string; message: string } | null

  applyStatus: (status: SourceStatus) => void
  setWorkerStatus: (status: WorkerStatus) => void
  setError: (error: { code: string; message: string } | null) => void
  setSelectedCrew: (crewId: CrewId) => void
  setLanguage: (language: UiLanguage) => void
  setScenarioMeta: (scenarioId: ScenarioId, seed?: number) => void
  reset: () => void
}

const INITIAL_SESSION = {
  scenarioId: 'demo_main' as ScenarioId,
  seed: undefined as number | undefined,
  speed: 1,
  running: false,
  simT: 0,
  day: 0,
  selectedCrewId: 'cdr' as CrewId,
  language: 'en' as UiLanguage,
  workerStatus: 'idle' as WorkerStatus,
  lastError: null as { code: string; message: string } | null,
}

export const useSessionStore = create<SessionState>((set) => ({
  ...INITIAL_SESSION,

  applyStatus: (status) =>
    set({
      scenarioId: status.scenarioId,
      speed: status.speed,
      running: status.running,
      simT: status.simT,
      day: status.day,
    }),

  setWorkerStatus: (workerStatus) => set({ workerStatus }),
  setError: (lastError) => set({ lastError }),
  setSelectedCrew: (selectedCrewId) => set({ selectedCrewId }),
  setLanguage: (language) => set({ language }),
  setScenarioMeta: (scenarioId, seed) => set({ scenarioId, seed }),
  reset: () => set({ ...INITIAL_SESSION }),
}))
