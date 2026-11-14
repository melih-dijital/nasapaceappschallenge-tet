import { describe, expect, it } from 'vitest'
import {
  effectiveScale,
  filterFinite,
  mad,
  median,
  quantile,
  robustSigma,
  theilSen,
  winsorize,
} from '@/core/baseline'

function sampleMean(xs: readonly number[]): number {
  return xs.reduce((acc, v) => acc + v, 0) / xs.length
}

function sampleSd(xs: readonly number[]): number {
  const m = sampleMean(xs)
  const variance = xs.reduce((acc, v) => acc + (v - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

describe('robustStats', () => {
  it('bilinen veri kümelerinde medyan, MAD, robustSigma, quantile ve winsorize hesaplar', () => {
    // Tek sayılı ve çift sayılı diziler
    expect(median([5, 1, 9, 3, 7])).toBe(5)
    expect(median([10, 20, 30, 40])).toBe(25)

    // [1, 1, 2, 2, 4, 6, 9] -> medyan=2, sapmalar=[1,1,0,0,2,4,7] -> sıralı=[0,0,1,1,2,4,7] -> MAD=1
    const data = [1, 1, 2, 2, 4, 6, 9]
    expect(median(data)).toBe(2)
    expect(mad(data)).toBe(1)
    expect(robustSigma(data)).toBeCloseTo(1.4826, 6)

    expect(quantile([10, 20, 30, 40], 0)).toBe(10)
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(quantile([10, 20, 30, 40], 1)).toBe(40)
    expect(quantile([10, 20, 30, 40], 0.25)).toBe(17.5)

    // Winsorize uç değeri kırpar, iç değerlere dokunmaz
    const w = winsorize([1, 2, 3, 4, 5, 1000], 3)
    expect(w.slice(0, 5)).toEqual([1, 2, 3, 4, 5])
    expect(w[5]).toBeLessThan(15)
  })

  it('Theil-Sen bilinen doğrusunu ve aykırı değere direncini doğrular', () => {
    // y = 2x + 5 (tam doğru)
    const exact = [
      { x: 0, y: 5 },
      { x: 1, y: 7 },
      { x: 2, y: 9 },
      { x: 3, y: 11 },
      { x: 4, y: 13 },
    ]
    const fitExact = theilSen(exact)
    expect(fitExact).toEqual({ slope: 2, intercept: 5 })

    // Tek büyük uç değer Theil-Sen eğimini neredeyse oynatmaz
    const withOutlier = [...exact, { x: 5, y: 1000 }]
    const fitOutlier = theilSen(withOutlier)
    expect(fitOutlier).toBeDefined()
    expect(fitOutlier!.slope).toBeCloseTo(2, 6)
    expect(fitOutlier!.intercept).toBeCloseTo(5, 6)
  })

  it('tek aykırı değer medyanı/MAD ı oynatmazken aritmetik ortalama ve SD sıçrar (kıyas testi)', () => {
    const clean = [60, 61, 62, 62, 63, 64, 65]
    const poisoned = [...clean, 10000]

    expect(Math.abs(median(poisoned)! - median(clean)!)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(mad(poisoned)! - mad(clean)!)).toBeLessThanOrEqual(0.5)

    // Kıyas: ortalama ve standart sapma uç değerle bozulur
    expect(sampleMean(poisoned)).toBeGreaterThan(1000)
    expect(sampleSd(poisoned)).toBeGreaterThan(3000)
  })

  it('kenar durumları: boş, n=1, MAD=0, NaN/Infinity ve sıfıra bölme koruması', () => {
    expect(median([])).toBeUndefined()
    expect(mad([])).toBeUndefined()
    expect(robustSigma([])).toBeUndefined()
    expect(quantile([], 0.5)).toBeUndefined()
    expect(theilSen([])).toBeUndefined()
    expect(winsorize([])).toEqual([])

    expect(median([42])).toBe(42)
    expect(mad([42])).toBe(0)
    expect(robustSigma([42])).toBe(0)
    expect(quantile([42], 0.5)).toBe(42)
    expect(theilSen([{ x: 1, y: 42 }])).toBeUndefined()

    // NaN/Infinity filtrelenir
    expect(filterFinite([1, Number.NaN, 3, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 5])).toEqual([
      1, 3, 5,
    ])
    expect(median([Number.NaN, 10, Number.POSITIVE_INFINITY, 20])).toBe(15)
    expect(quantile([1, 2, 3], -0.1)).toBeUndefined()
    expect(quantile([1, 2, 3], 1.1)).toBeUndefined()
    expect(theilSen([{ x: 2, y: 1 }, { x: 2, y: 5 }])).toBeUndefined()

    // MAD=0 iken minScale sıfıra bölmeyi önler
    expect(effectiveScale(robustSigma([65, 65, 65, 65]), 3)).toBe(3)
  })
})
