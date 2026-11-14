// Grafik serileri için min-max bucket seyreltme (PROJECT_MEMORY §10, FAZ_03 §3.5).
// İlk/son noktayı ve tepe/çukur uç değerleri korur.
import type { SimTimeMs } from '../core/types'

export interface Point {
  t: SimTimeMs
  value: number
}

export function decimate(points: readonly Point[], maxPoints: number): Point[] {
  if (maxPoints <= 0) return []
  const n = points.length
  if (n <= maxPoints) return [...points]

  const first = points[0]
  const last = points[n - 1]
  if (!first || !last) return []

  if (maxPoints === 1) return [first]
  if (maxPoints === 2) return [first, last]

  const result: Point[] = [first]
  const middleCount = n - 2
  const bucketBudget = Math.floor((maxPoints - 2) / 2)

  if (bucketBudget <= 0) {
    // maxPoints === 3: ortadaki en yüksek mutlak sapmalı noktayı koru
    let bestIdx = 1
    let bestDist = -1
    for (let i = 1; i < n - 1; i++) {
      const pt = points[i]
      if (!pt) continue
      const dist = Math.abs(pt.value - first.value)
      if (dist > bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
    const mid = points[bestIdx]
    if (mid) result.push(mid)
    result.push(last)
    return result
  }

  const buckets = Math.min(bucketBudget, middleCount)
  const bucketSize = middleCount / buckets

  for (let b = 0; b < buckets; b++) {
    const start = 1 + Math.floor(b * bucketSize)
    const end = Math.min(n - 1, 1 + Math.floor((b + 1) * bucketSize))
    if (start >= end) continue

    let minIdx = start
    let maxIdx = start
    let minVal = points[start]?.value ?? Number.POSITIVE_INFINITY
    let maxVal = points[start]?.value ?? Number.NEGATIVE_INFINITY

    for (let i = start + 1; i < end; i++) {
      const v = points[i]?.value
      if (v === undefined) continue
      if (v < minVal) {
        minVal = v
        minIdx = i
      }
      if (v > maxVal) {
        maxVal = v
        maxIdx = i
      }
    }

    if (minIdx === maxIdx) {
      const p = points[minIdx]
      if (p) result.push(p)
    } else if (minIdx < maxIdx) {
      const pMin = points[minIdx]
      const pMax = points[maxIdx]
      if (pMin) result.push(pMin)
      if (pMax) result.push(pMax)
    } else {
      const pMax = points[maxIdx]
      const pMin = points[minIdx]
      if (pMax) result.push(pMax)
      if (pMin) result.push(pMin)
    }
  }

  result.push(last)
  return result
}
