// Earth Link konfigürasyonu ve giden kutusu store (Faz 7).
import { create } from 'zustand'
import type { EarthLinkState, PendingReply } from '../core/earthlink/link'
import type { EarthLinkConfig, Message } from '../core/types'

export interface EarthLinkStoreState {
  config: EarthLinkConfig
  outbox: Message[]
  inbox: Message[]
  pending: PendingReply[]
  setConfig: (patch: Partial<EarthLinkConfig>) => void
  setOutbox: (messages: readonly Message[]) => void
  applyEarthState: (earth: EarthLinkState) => void
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
  inbox: [],
  pending: [],
  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setOutbox: (messages) => set({ outbox: [...messages] }),
  applyEarthState: (earth) =>
    set({
      config: { ...earth.config },
      outbox: [...earth.outbox],
      inbox: [...earth.inbox],
      pending: [...earth.pending],
    }),
  reset: () => set({ config: { ...DEFAULT_EARTH_LINK }, outbox: [], inbox: [], pending: [] }),
}))
