import { describe, expect, it } from 'vitest'
import { mulberry32, Rng } from '@/sim/rng'

describe('RNG (mulberry32 & Rng)', () => {
  it('aynı seed ile aynı sayı dizisini üretir', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const c = mulberry32(54321)

    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    const seqC = Array.from({ length: 20 }, () => c())

    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('Rng metodları deterministiktir', () => {
    const sample = (seed: number) => {
      const r = new Rng(seed)
      return {
        normals: Array.from({ length: 5 }, () => r.normal(60, 5)),
        uniforms: Array.from({ length: 5 }, () => r.uniform(-2, 4)),
        ints: Array.from({ length: 5 }, () => r.int(10, 20)),
        chances: Array.from({ length: 5 }, () => r.chance(0.4)),
        picked: r.pick(['cdr', 'md', 'eng', 'sci']),
        poissons: Array.from({ length: 5 }, () => r.poisson(1.5)),
        ar1: r.ar1(64, 62, 0.7, 2),
      }
    }

    expect(sample(777)).toEqual(sample(777))
    expect(sample(777)).not.toEqual(sample(778))
  })

  it('fork bağımsızdır ve ebeveyn akışını ilerletmez', () => {
    const parent1 = new Rng(99)
    const childA1 = parent1.fork('vitals')
    const childB = parent1.fork('radiation')
    const parentNext1 = parent1.next()

    const parent2 = new Rng(99)
    const parentNext2 = parent2.next()
    const childA2 = new Rng(99).fork('vitals')

    expect(parentNext1).toBe(parentNext2)
    expect(Array.from({ length: 10 }, () => childA1.next())).toEqual(
      Array.from({ length: 10 }, () => childA2.next()),
    )
    expect(Array.from({ length: 10 }, () => childA1.next())).not.toEqual(
      Array.from({ length: 10 }, () => childB.next()),
    )
  })

  it('normal dağılım ortalama ve standart sapma toleransını sağlar', () => {
    const rng = new Rng(2026)
    const n = 10000
    const targetMean = 62
    const targetSd = 6
    const samples = Array.from({ length: n }, () => rng.normal(targetMean, targetSd))

    const mean = samples.reduce((acc, x) => acc + x, 0) / n
    const variance = samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / n
    const sd = Math.sqrt(variance)

    expect(Math.abs(mean - targetMean)).toBeLessThan(0.25)
    expect(Math.abs(sd - targetSd)).toBeLessThan(0.25)
  })

  it('ar1 sd=0 iken kesin cebirsel adım atar', () => {
    const rng = new Rng(1)
    expect(rng.ar1(70, 60, 0.5, 0)).toBe(65)
    expect(rng.ar1(65, 60, 0.5, 0)).toBe(62.5)
  })
})
