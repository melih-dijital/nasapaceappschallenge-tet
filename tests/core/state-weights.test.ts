import { describe, expect, it } from 'vitest'
import { all, has } from '@/core/evidence/registry'
import { METRIC_IDS, STATE_IDS } from '@/core/types'

const EXTRA_WEIGHT_SUFFIX = '.trendSlope'

describe('L4 durum ağırlıkları (state.<state>.w.<metric>)', () => {
  it.each(STATE_IDS)("%s: metrik ağırlıkları toplamı 1.0 (trendSlope hariç)", (state) => {
    const prefix = `state.${state}.w.`
    const weights = all().filter(
      (e) => e.id.startsWith(prefix) && !e.id.endsWith(EXTRA_WEIGHT_SUFFIX),
    )
    expect(weights.length, state).toBeGreaterThan(0)
    for (const entry of weights) {
      const metric = entry.id.slice(prefix.length)
      expect(METRIC_IDS as readonly string[], entry.id).toContain(metric)
      expect(entry.sourceType).toBe('DEMO_PARAMETER')
    }
    const sum = weights.reduce((acc, e) => acc + (Array.isArray(e.value) ? Number.NaN : e.value), 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('trendSlope ek ağırlıkları var ve toplama dahil edilmiyor', () => {
    expect(has('state.stress.w.trendSlope')).toBe(true)
    expect(has('state.mood_decline.w.trendSlope')).toBe(true)
  })
})
