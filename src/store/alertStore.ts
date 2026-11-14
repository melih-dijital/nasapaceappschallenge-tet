// Uyarı durumu store iskeleti (Faz 5'te algılama olaylarıyla doldurulur).
import { create } from 'zustand'
import type { Alert, AlertEvent } from '../core/types'

export interface AlertStoreState {
  alerts: Alert[]
  recentEvents: AlertEvent[]
  applyAlertEvents: (events: readonly AlertEvent[]) => void
  setAlerts: (alerts: readonly Alert[]) => void
  reset: () => void
}

export const useAlertStore = create<AlertStoreState>((set) => ({
  alerts: [],
  recentEvents: [],

  applyAlertEvents: (events) => {
    if (events.length === 0) return
    set((state) => {
      const byId = new Map(state.alerts.map((a) => [a.id, a]))
      for (const ev of events) {
        byId.set(ev.alert.id, ev.alert)
      }
      return {
        alerts: [...byId.values()],
        recentEvents: [...state.recentEvents, ...events].slice(-100),
      }
    })
  },

  setAlerts: (alerts) => set({ alerts: [...alerts] }),
  reset: () => set({ alerts: [], recentEvents: [] }),
}))

export const selectActiveAlerts = (state: Pick<AlertStoreState, 'alerts'>): Alert[] =>
  state.alerts.filter((a) => a.status !== 'RESOLVED')
