// Karar ve müdahale kartları store iskeleti (Faz 7'de doldurulur).
import { create } from 'zustand'
import type { ActionCard } from '../core/types'

export interface DecisionStoreState {
  cards: ActionCard[]
  setCards: (cards: readonly ActionCard[]) => void
  reset: () => void
}

export const useDecisionStore = create<DecisionStoreState>((set) => ({
  cards: [],
  setCards: (cards) => set({ cards: [...cards] }),
  reset: () => set({ cards: [] }),
}))
