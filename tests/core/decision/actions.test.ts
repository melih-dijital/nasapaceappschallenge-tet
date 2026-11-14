import { describe, expect, it } from 'vitest'
import {
  ACTION_CATALOG,
  ACTION_NOTES,
  CATALOG_ACTION_IDS,
  getActionDef,
  getActionsForState,
} from '@/core/decision/actions'
import { has } from '@/core/evidence/registry'
import { STATE_IDS } from '@/core/types/state'

describe('ACTION_CATALOG (Faz 7 §3.1)', () => {
  it('ActionId listesindeki 13 eylemin tamamını içerir', () => {
    expect(CATALOG_ACTION_IDS).toHaveLength(13)
    for (const id of CATALOG_ACTION_IDS) {
      const def = ACTION_CATALOG[id]
      expect(def, id).toBeDefined()
      if (!def) continue
      expect(def.id).toBe(id)
      expect(getActionDef(id)).toBe(def)
      expect(ACTION_NOTES[id].length).toBeGreaterThan(10)
    }
  })

  it('her eylem 2-5 arası adım anahtarına ve geçerli titleKey + kind alanına sahiptir', () => {
    for (const id of CATALOG_ACTION_IDS) {
      const def = ACTION_CATALOG[id]
      expect(def, id).toBeDefined()
      if (!def) continue
      expect(def.titleKey).toBe(`action.${id}.title`)
      expect(def.stepKeys.length).toBeGreaterThanOrEqual(2)
      expect(def.stepKeys.length).toBeLessThanOrEqual(5)
      for (const [idx, stepKey] of def.stepKeys.entries()) {
        expect(stepKey).toBe(`action.${id}.step${idx + 1}`)
      }
      expect(def.appliesToStates.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('eylem evidenceIds kayıtlarının tamamı EvidenceRegistry içinde mevcuttur', () => {
    for (const id of CATALOG_ACTION_IDS) {
      const def = ACTION_CATALOG[id]
      if (!def) continue
      for (const evId of def.evidenceIds) {
        expect(has(evId), `${id} -> ${evId}`).toBe(true)
      }
    }
  })

  it('eylem metinleri/notları tıbbi tanı, ilaç adı veya dozaj talimatı içermez', () => {
    const forbidden = /\b(diagnos|prescrib|dosage|mg|tablet|medication|ibuprofen|modafinil|melatonin)\b/i
    for (const id of CATALOG_ACTION_IDS) {
      expect(ACTION_NOTES[id]).not.toMatch(forbidden)
    }
  })

  it('getActionsForState her StateId için ilgili eylemleri döndürür', () => {
    for (const state of STATE_IDS) {
      const actions = getActionsForState(state)
      expect(actions.length, state).toBeGreaterThanOrEqual(1)
      for (const action of actions) {
        expect(action.appliesToStates).toContain(state)
      }
    }
  })
})
