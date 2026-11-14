// Karar ve müdahale kartları store (Faz 7).
import { create } from 'zustand'
import type { DecisionSnapshot } from '../core/pipeline'
import type { ActionCard } from '../core/types'

export interface DecisionStoreState {
  cards: ActionCard[]
  decision: DecisionSnapshot | null
  setCards: (cards: readonly ActionCard[]) => void
  setDecision: (decision: DecisionSnapshot | null) => void
  reset: () => void
}

export const useDecisionStore = create<DecisionStoreState>((set) => ({
  cards: [],
  decision: null,
  setCards: (cards) => set({ cards: [...cards] }),
  setDecision: (decision) =>
    set({
      decision,
      ...(decision ? { cards: [...decision.cards] } : {}),
    }),
  reset: () => set({ cards: [], decision: null }),
}))
