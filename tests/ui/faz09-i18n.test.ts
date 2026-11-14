// FAZ 9 §3.2 & §3.6 — i18n sözlük eşitliği, t() parametre/yedek davranışı, Mission Clock ve decimate testleri.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EARTH_DELAY_CLASSES, METRIC_META, SEVERITIES, STATE_IDS } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import {
  en,
  formatMissionClock,
  formatNumber,
  setLanguage,
  t,
  tr,
  type I18nKey,
} from '@/ui/i18n'
import { decimate, MAX_CHART_POINTS, type SeriesPoint } from '@/ui/store/decimate'

afterEach(() => {
  setLanguage('en')
  vi.restoreAllMocks()
})

describe('i18n sözlükleri ve biçimlendiriciler (FAZ 9 §3.2)', () => {
  it('en ve tr sözlüklerinin anahtar kümeleri birebir eşittir ve boş değer yoktur', () => {
    const enKeys = Object.keys(en).sort()
    const trKeys = Object.keys(tr).sort()
    expect(trKeys).toEqual(enKeys)

    for (const key of enKeys as I18nKey[]) {
      expect(en[key].trim().length, `en["${key}"] boş olmamalı`).toBeGreaterThan(0)
      expect(tr[key].trim().length, `tr["${key}"] boş olmamalı`).toBeGreaterThan(0)
    }
  })

  it('METRIC_META, STATE_IDS, SEVERITIES ve EARTH_DELAY_CLASSES anahtarlarının tamamı sözlükte tanımlıdır', () => {
    for (const meta of Object.values(METRIC_META)) {
      expect(en).toHaveProperty(meta.labelKey)
      expect(tr).toHaveProperty(meta.labelKey)
    }
    for (const stateId of STATE_IDS) {
      expect(en).toHaveProperty(`state.${stateId}`)
      expect(tr).toHaveProperty(`state.${stateId}`)
    }
    for (const sev of SEVERITIES) {
      expect(en).toHaveProperty(`severity.${sev}`)
      expect(tr).toHaveProperty(`severity.${sev}`)
    }
    for (const cls of EARTH_DELAY_CLASSES) {
      expect(en).toHaveProperty(`earthDelay.${cls}`)
      expect(tr).toHaveProperty(`earthDelay.${cls}`)
    }
  })

  it('t() parametreleri yerleştirir; eksik anahtarda İngilizce yedek döner ve console.warn basar', () => {
    expect(
      t('why.sleep.belowBaseline', { valueH: 4.6, baselineH: 6.8, z: -3.4 }, 'en'),
    ).toContain('4.6')
    expect(
      t('why.sleep.belowBaseline', { valueH: 4.6, baselineH: 6.8, z: -3.4 }, 'tr'),
    ).toContain('4.6')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const missingResult = t('nonexistent.test.key', { foo: 42 }, 'tr')
    expect(missingResult).toBe('nonexistent.test.key')
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('formatMissionClock sim zamanını MET D+012 14:32 biçiminde döndürür', () => {
    const tMs = 12 * MS_PER_DAY + 14 * MS_PER_HOUR + 32 * MS_PER_MIN
    expect(formatMissionClock(tMs)).toBe('MET D+012 14:32')
    expect(formatMissionClock(0)).toBe('MET D+000 00:00')
    expect(formatMissionClock(-MS_PER_DAY)).toBe('MET D-001 00:00')
  })

  it('formatNumber Intl.NumberFormat ile dile göre biçimlendirir', () => {
    expect(formatNumber(97.64, 1, 'en')).toBe('97.6')
    expect(formatNumber(97.64, 1, 'tr')).toBe('97,6')
    expect(formatNumber(Number.NaN, 1, 'en')).toBe('—')
  })
})

describe('decimate (FAZ 9 §3.4 — ≤ 600 nokta sınırı)', () => {
  it('MAX_CHART_POINTS üstündeki seriyi ≤ 600 noktaya indirger, ilk/son ve min/max tepeyi korur', () => {
    const raw: SeriesPoint[] = []
    for (let i = 0; i < 1500; i++) {
      const value = i === 750 ? 999 : i === 300 ? -50 : Math.sin(i * 0.1) * 10
      raw.push({ t: i * 1000, value })
    }

    const out = decimate(raw, MAX_CHART_POINTS)
    expect(out.length).toBeLessThanOrEqual(MAX_CHART_POINTS)
    expect(out[0]).toEqual(raw[0])
    expect(out[out.length - 1]).toEqual(raw[raw.length - 1])
    expect(out.some((p) => p.value === 999)).toBe(true)
    expect(out.some((p) => p.value === -50)).toBe(true)
  })
})
