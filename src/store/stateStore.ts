// Bileşik sağlık durumları store iskeleti (Faz 5'te L4 çıktılarıyla doldurulur).
import { create } from 'zustand'
import type { StateEstimate } from '../core/types'

export interface StateStoreState {
  states: StateEstimate[]
  setStates: (states: readonly StateEstimate[]) => void
  reset: () => void
}

export const useStateStore = create<StateStoreState>((set) => ({
  states: [],
  setStates: (states) => set({ states: [...states] }),
  reset: () => set({ states: [] }),
}))
