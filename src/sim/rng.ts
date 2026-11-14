// Deterministik tohumlu RNG (PROJECT_MEMORY §3.6, §10). Saf TS, Math.random yasak.

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** FNV-1a 32-bit karma; alt-seed türetmede kullanılır. */
export function hashString(input: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/** 32-bit deterministik sözde-rastgele üreteç, [0, 1) aralığında değer döndürür. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  readonly seed: number
  private readonly rand: () => number
  private cachedNormal: number | null = null

  constructor(seed: number) {
    this.seed = seed >>> 0
    this.rand = mulberry32(this.seed)
  }

  /** [0, 1) aralığında tekdüze sayı. */
  next(): number {
    return this.rand()
  }

  /** Box–Muller normal dağılım; ikinci değeri önbelleğe alır. */
  normal(mean = 0, sd = 1): number {
    if (this.cachedNormal !== null) {
      const z = this.cachedNormal
      this.cachedNormal = null
      return mean + sd * z
    }
    const u1 = Math.max(this.next(), 1e-12)
    const u2 = this.next()
    const mag = Math.sqrt(-2 * Math.log(u1))
    const angle = 2 * Math.PI * u2
    const z0 = mag * Math.cos(angle)
    this.cachedNormal = mag * Math.sin(angle)
    return mean + sd * z0
  }

  /** [a, b) aralığında tekdüze ondalıklı sayı. */
  uniform(a: number, b: number): number {
    return a + (b - a) * this.next()
  }

  /** [a, b] kapalı aralığında tam sayı. */
  int(a: number, b: number): number {
    const min = Math.ceil(Math.min(a, b))
    const max = Math.floor(Math.max(a, b))
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** p olasılığıyla true döndürür. */
  chance(p: number): boolean {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.next() < p
  }

  /** Boş olmayan diziden deterministik seçim. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('Rng.pick: boş diziden seçim yapılamaz')
    }
    const item = arr[this.int(0, arr.length - 1)]
    if (item === undefined) {
      throw new Error('Rng.pick: geçersiz dizin')
    }
    return item
  }

  /** Etiketten türetilmiş bağımsız alt-RNG (ebeveyn akışını ilerletmez). */
  fork(label: string): Rng {
    return new Rng(hashString(`${this.seed}:${label}`))
  }

  /** AR(1) adımı: mean + phi * (prev - mean) + N(0, sd). */
  ar1(prev: number, mean: number, phi: number, sd: number): number {
    return mean + phi * (prev - mean) + this.normal(0, sd)
  }

  /** Küçük lambda değerleri için Knuth Poisson örneklemesi. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0
    if (lambda > 30) {
      return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))))
    }
    const limit = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k += 1
      p *= this.next()
    } while (p > limit)
    return k - 1
  }
}
