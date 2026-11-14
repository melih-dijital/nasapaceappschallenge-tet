// Saf dayanıklı (robust) istatistik fonksiyonları (FAZ_04 §3.1).
// Boş girdi veya yetersiz veride NaN değil, açık `undefined` / `[]` döner.

export interface Point2D {
  x: number
  y: number
}

export interface TheilSenResult {
  slope: number
  intercept: number
}

/** Normal dağılım için tutarlılık sabiti: 1 / Φ⁻¹(3/4) ≈ 1.4826 (PROJECT_MEMORY §8). */
export const MAD_CONSISTENCY_CONSTANT = 1.4826

/** Yalnızca sonlu (`Number.isFinite`) sayıları süzer. */
export function filterFinite(xs: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i]
    if (v !== undefined && Number.isFinite(v)) {
      out.push(v)
    }
  }
  return out
}

function medianSorted(sorted: readonly number[]): number | undefined {
  const n = sorted.length
  if (n === 0) return undefined
  const mid = n >> 1
  if ((n & 1) === 1) {
    return sorted[mid]
  }
  const lo = sorted[mid - 1]
  const hi = sorted[mid]
  if (lo === undefined || hi === undefined) return undefined
  return (lo + hi) / 2
}

/** Sonlu sayıların medyanı; boşsa `undefined`. */
export function median(xs: readonly number[]): number | undefined {
  const finite = filterFinite(xs)
  if (finite.length === 0) return undefined
  finite.sort((a, b) => a - b)
  return medianSorted(finite)
}

/** Medyandan mutlak sapmaların medyanı (MAD); boşsa `undefined`. */
export function mad(xs: readonly number[], center?: number): number | undefined {
  const finite = filterFinite(xs)
  if (finite.length === 0) return undefined

  let med: number | undefined
  if (center !== undefined && Number.isFinite(center)) {
    med = center
  } else {
    const sorted = [...finite].sort((a, b) => a - b)
    med = medianSorted(sorted)
  }
  if (med === undefined) return undefined

  const devs: number[] = new Array<number>(finite.length)
  for (let i = 0; i < finite.length; i++) {
    devs[i] = Math.abs(finite[i]! - med)
  }
  devs.sort((a, b) => a - b)
  return medianSorted(devs)
}

/** 1.4826 * MAD ölçek tahmini; boşsa `undefined`. */
export function robustSigma(xs: readonly number[]): number | undefined {
  const m = mad(xs)
  if (m === undefined) return undefined
  return MAD_CONSISTENCY_CONSTANT * m
}

/**
 * Sıfıra bölmeyi önleyen alt-sınırlı ölçek: `max(sigma, minScale)`.
 * `sigma` veya `minScale` sonlu değilse güvenli pozitif taban kullanır.
 */
export function effectiveScale(sigma: number | undefined, minScaleValue: number): number {
  const floor = Number.isFinite(minScaleValue) && minScaleValue > 0 ? minScaleValue : 1e-6
  if (sigma === undefined || !Number.isFinite(sigma) || sigma < 0) {
    return floor
  }
  return Math.max(sigma, floor)
}

/** Doğrusal enterpolasyonlu kantil (`q ∈ [0, 1]`). Geçersiz `q` veya boş dizide `undefined`. */
export function quantile(xs: readonly number[], q: number): number | undefined {
  if (!Number.isFinite(q) || q < 0 || q > 1) return undefined
  const finite = filterFinite(xs)
  const n = finite.length
  if (n === 0) return undefined
  finite.sort((a, b) => a - b)
  if (n === 1) return finite[0]

  const pos = (n - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const vLo = finite[lo]!
  const vHi = finite[hi]!
  if (lo === hi) return vLo
  return vLo + (vHi - vLo) * (pos - lo)
}

/**
 * Theil-Sen dayanıklı doğrusal eğim tahmincisi (`O(n²)`, `n ≤ 60` için ideal).
 * En az 2 farklı `x` noktası yoksa `undefined` döner.
 */
export function theilSen(points: readonly Point2D[]): TheilSenResult | undefined {
  const valid: Point2D[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      valid.push(p)
    }
  }
  const n = valid.length
  if (n < 2) return undefined

  const slopes: number[] = []
  for (let i = 0; i < n; i++) {
    const pi = valid[i]!
    for (let j = i + 1; j < n; j++) {
      const pj = valid[j]!
      const dx = pj.x - pi.x
      if (dx !== 0) {
        slopes.push((pj.y - pi.y) / dx)
      }
    }
  }

  if (slopes.length === 0) return undefined
  slopes.sort((a, b) => a - b)
  const slope = medianSorted(slopes)
  if (slope === undefined) return undefined

  const intercepts: number[] = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const p = valid[i]!
    intercepts[i] = p.y - slope * p.x
  }
  intercepts.sort((a, b) => a - b)
  const intercept = medianSorted(intercepts)
  if (intercept === undefined) return undefined

  return { slope, intercept }
}

/**
 * Medyan ± k * robustSigma aralığına kırparak (MAD tabanlı winsorization) uç değer etkisini sınırlar.
 * Yalnızca sonlu değerleri korur; boş dizide `[]` döner.
 */
export function winsorize(xs: readonly number[], k = 3): number[] {
  const finite = filterFinite(xs)
  if (finite.length === 0) return []
  if (!Number.isFinite(k) || k <= 0) return finite

  const sorted = [...finite].sort((a, b) => a - b)
  const med = medianSorted(sorted)
  if (med === undefined) return []
  const m = mad(finite, med)
  const sigma = m === undefined ? 0 : MAD_CONSISTENCY_CONSTANT * m
  const lo = med - k * sigma
  const hi = med + k * sigma

  const out: number[] = new Array<number>(finite.length)
  for (let i = 0; i < finite.length; i++) {
    const v = finite[i]!
    out[i] = v < lo ? lo : v > hi ? hi : v
  }
  return out
}
