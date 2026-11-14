// Earth Link konfigürasyonu ve giden kutusu store iskeleti (Faz 7'de doldurulur).
import { create } from 'zustand'
import type { EarthLinkConfig, Message } from '../core/types'

export interface EarthLinkStoreState {
  config: EarthLinkConfig
  outbox: Message[]
  setConfig: (patch: Partial<EarthLinkConfig>) => void
  setOutbox: (messages: readonly Message[]) => void
  reset: () => void
}

const DEFAULT_EARTH_LINK: EarthLinkConfig = {
  preset: 'MARS_MIN',
  oneWayDelaySec: 180,
  blackout: false,
}

export const useEarthLinkStore = create<EarthLinkStoreState>((set) => ({
  config: { ...DEFAULT_EARTH_LINK },
  outbox: [],
  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setOutbox: (messages) => set({ outbox: [...messages] }),
  reset: () => set({ config: { ...DEFAULT_EARTH_LINK }, outbox: [] }),
}))
