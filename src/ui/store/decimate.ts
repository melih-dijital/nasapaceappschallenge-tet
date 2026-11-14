// FAZ 9 §3.4 & PROJECT_MEMORY §10 — Grafik serisi seyreltme (decimation).
// Her grafikte en fazla MAX_CHART_POINTS (600) nokta tutulur; ilk/son nokta ve kova içi min/max korunur.
import type { SimTimeMs } from '@/core/types'

export const MAX_CHART_POINTS = 600

export interface SeriesPoint {
  t: SimTimeMs
  value: number
}

/**
 * Nokta dizisini `maxPoints` sınırına indirger.
 * İlk ve son noktayı daima korur; ara kovalarda min ve max uç değerleri seçerek
 * SPE veya HR sıçramalarının kaybolmasını önler.
 */
export function decimate<T extends SeriesPoint>(
  points: readonly T[],
  maxPoints: number = MAX_CHART_POINTS,
): T[] {
  const len = points.length
  if (maxPoints <= 0) return []
  if (len <= maxPoints) return [...points]
  if (maxPoints === 1) return [points[len - 1]!]
  if (maxPoints === 2) return [points[0]!, points[len - 1]!]

  const first = points[0]!
  const last = points[len - 1]!
  const middleCount = maxPoints - 2
  const buckets = Math.max(1, Math.floor(middleCount / 2))
  const result: T[] = [first]

  const span = len - 2
  for (let b = 0; b < buckets; b++) {
    const startIdx = 1 + Math.floor((b * span) / buckets)
    const endIdx = Math.min(len - 1, 1 + Math.floor(((b + 1) * span) / buckets))
    if (startIdx >= endIdx) continue

    let minPt = points[startIdx]!
    let maxPt = points[startIdx]!
    let minIdx = startIdx
    let maxIdx = startIdx

    for (let i = startIdx + 1; i < endIdx; i++) {
      const pt = points[i]!
      if (pt.value < minPt.value) {
        minPt = pt
        minIdx = i
      }
      if (pt.value > maxPt.value) {
        maxPt = pt
        maxIdx = i
      }
    }

    if (minIdx === maxIdx) {
      result.push(minPt)
    } else if (minIdx < maxIdx) {
      result.push(minPt)
      if (result.length < maxPoints - 1) result.push(maxPt)
    } else {
      result.push(maxPt)
      if (result.length < maxPoints - 1) result.push(minPt)
    }

    if (result.length >= maxPoints - 1) break
  }

  result.push(last)
  return result
}
