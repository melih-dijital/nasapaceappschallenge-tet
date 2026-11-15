// Earth Link konfigürasyonu, giden kutusu, downlink özeti ve Dünya aynası store (Faz 7).
import { create } from 'zustand'
import type { EarthLinkState, PendingReply } from '../core/earthlink/link'
import type { DownlinkState, EarthLinkConfig, GroundMirror, Message } from '../core/types'

export interface EarthLinkStoreState {
  config: EarthLinkConfig
  outbox: Message[]
  inbox: Message[]
  pending: PendingReply[]
  groundMirror: GroundMirror
  downlink: DownlinkState
  setConfig: (patch: Partial<EarthLinkConfig>) => void
  setOutbox: (messages: readonly Message[]) => void
  applyEarthState: (earth: EarthLinkState) => void
  applyMirrorAndDownlink: (groundMirror?: GroundMirror, downlink?: DownlinkState) => void
  reset: () => void
}

const DEFAULT_EARTH_LINK: EarthLinkConfig = {
  preset: 'MARS_MIN',
  oneWayDelaySec: 180,
  blackout: false,
}

const DEFAULT_GROUND_MIRROR: GroundMirror = {
  asOfT: null,
  delaySec: 180,
  linkUp: true,
  latest: {},
  activeAlerts: [],
  states: [],
  cumulativeDoseByCrew: {},
}

const DEFAULT_DOWNLINK: DownlinkState = {
  queued: 0,
  inFlight: 0,
  lastDeliveredT: null,
  recent: [],
}

export const useEarthLinkStore = create<EarthLinkStoreState>((set) => ({
  config: { ...DEFAULT_EARTH_LINK },
  outbox: [],
  inbox: [],
  pending: [],
  groundMirror: { ...DEFAULT_GROUND_MIRROR },
  downlink: { ...DEFAULT_DOWNLINK },
  setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setOutbox: (messages) => set({ outbox: [...messages] }),
  applyEarthState: (earth) =>
    set({
      config: { ...earth.config },
      outbox: [...earth.outbox],
      inbox: [...earth.inbox],
      pending: [...earth.pending],
      groundMirror: earth.groundMirror,
      downlink: earth.downlink,
    }),
  applyMirrorAndDownlink: (groundMirror, downlink) =>
    set((state) => ({
      groundMirror: groundMirror ?? state.groundMirror,
      downlink: downlink ?? state.downlink,
    })),
  reset: () =>
    set({
      config: { ...DEFAULT_EARTH_LINK },
      outbox: [],
      inbox: [],
      pending: [],
      groundMirror: { ...DEFAULT_GROUND_MIRROR },
      downlink: { ...DEFAULT_DOWNLINK },
    }),
}))
