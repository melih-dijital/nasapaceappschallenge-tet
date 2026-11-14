// Kişisel kayan pencere (medyan/MAD) baseline motoru + drift koruması (FAZ_04 §3.3). Saf TS.
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import { extractFrameMetrics } from '../pipeline/buffer'
import {
  METRIC_IDS,
  type BaselineStat,
  type CrewId,
  type Environment,
  type MetricId,
  type SimTimeMs,
  type TelemetryFrame,
  type ZResult,
} from '../types'
import { MIN_PER_DAY, MIN_PER_HOUR, MS_PER_DAY, VITALS_INTERVAL_MIN } from '../units'
import { getBinKey, getNightHrBinKey, isDailyMetric } from './bins'
import { effectiveScale, MAD_CONSISTENCY_CONSTANT } from './robustStats'

export interface BaselineEngineOptions {
  registry?: EvidenceRegistry
  /** Dış zaman zorunludur; içeride global Date.now() kullanılmaz. */
  nowGetter?: never
}

export interface GuardState {
  active: boolean
  updatedT: SimTimeMs
}

export interface BaselineSnapshot {
  stats: BaselineStat[]
  guards: Record<CrewId, GuardState>
  binCount: number
  totalSamples: number
}

interface Sample {
  t: SimTimeMs
  value: number
}

interface BinEntry {
  crewId: CrewId
  metric: MetricId
  binKey: string
  capacity: number
  samples: Sample[]
  head: number
  /** Artan sırada değerler (sıfır ayırmalı O(1) medyan / O(N) MAD için). */
  sortedValues: number[]
  /** Penceredeki benzersiz gün sayısını O(1) izlemek için gün->sayım tablosu. */
  dayCounts: Map<number, number>
  newestT: SimTimeMs
  dirty: boolean
  cachedStat: BaselineStat | null
  cachedConfidence: number
}

function makeStorageKey(crewId: CrewId, metric: MetricId, binKey: string): string {
  return `${crewId}|${metric}|${binKey}`
}

function dayIndex(t: SimTimeMs): number {
  return Math.floor(t / MS_PER_DAY)
}

function lowerBound(arr: readonly number[], target: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid]! < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

function medianFromSorted(sorted: readonly number[]): number {
  const n = sorted.length
  const mid = n >>> 1
  if ((n & 1) === 1) {
    return sorted[mid]!
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Sıralı diziden ayırma (allocation) olmadan iki işaretçiyle MAD hesaplar.
 * Ortadaki değerlerden dışa doğru |x - med| azalmadan arttığı için merge doğrusal ve tamdır.
 */
function madFromSorted(sorted: readonly number[], med: number): number {
  const n = sorted.length
  if (n <= 1) return 0

  const mid = n >>> 1
  let l = (n & 1) === 1 ? mid : mid - 1
  let r = (n & 1) === 1 ? mid + 1 : mid
  const targetLo = (n - 1) >>> 1
  const targetHi = n >>> 1
  let valLo = 0
  let valHi = 0

  for (let k = 0; k <= targetHi; k++) {
    const devL = l >= 0 ? med - sorted[l]! : Number.POSITIVE_INFINITY
    const devR = r < n ? sorted[r]! - med : Number.POSITIVE_INFINITY
    let cur: number
    if (devL <= devR) {
      cur = devL
      l--
    } else {
      cur = devR
      r++
    }
    if (k === targetLo) valLo = cur
    if (k === targetHi) valHi = cur
  }

  return (n & 1) === 1 ? valHi : (valLo + valHi) / 2
}

export class BaselineEngine {
  private readonly evidence: EvidenceRegistry
  private readonly targetDays: number
  private readonly minDays: number
  private readonly windowMs: SimTimeMs
  private readonly sparseMinSamples: number
  private readonly sparseConfidenceFactor: number
  private readonly hrBlockHours: number
  private readonly minScales: Record<MetricId, number>

  private readonly bins = new Map<string, BinEntry>()
  private readonly guards = new Map<CrewId, GuardState>()
  private readonly lastEnvByCrew = new Map<CrewId, Environment>()

  constructor(opts: BaselineEngineOptions = {}) {
    this.evidence = opts.registry ?? defaultRegistry
    this.targetDays = this.evidence.getNumber('baseline.window.days.target')
    this.minDays = this.evidence.getNumber('baseline.window.days.min')
    this.windowMs = this.targetDays * MS_PER_DAY
    this.sparseMinSamples = this.evidence.getNumber('baseline.sparseBin.minSamples')
    this.sparseConfidenceFactor = this.evidence.getNumber('baseline.sparseBin.confidenceFactor')
    this.hrBlockHours = this.evidence.getNumber('baseline.hrBlockHours')

    const scales = {} as Record<MetricId, number>
    for (const metric of METRIC_IDS) {
      scales[metric] = this.evidence.getNumber(`minScale.${metric}`)
    }
    this.minScales = scales
  }

  /** Tek bir çerçeveyi ilgili kutulara işler (guard aktifse pencereye eklemez). */
  update(frame: TelemetryFrame): void {
    if (frame.kind === 'radiation') {
      this.lastEnvByCrew.set(frame.crewId, frame.environment)
    }

    const guard = this.guards.get(frame.crewId)
    if (guard?.active) {
      return
    }

    const env = frame.kind === 'radiation' ? frame.environment : undefined
    const metrics = extractFrameMetrics(frame)

    for (let i = 0; i < metrics.length; i++) {
      const item = metrics[i]!
      if (!Number.isFinite(item.value) || !Number.isFinite(frame.t)) {
        continue
      }
      const binKey = getBinKey(item.metric, frame.t, {
        hrBlockHours: this.hrBlockHours,
        ...(env ? { environment: env } : {}),
      })
      const entry = this.getOrCreateBin(frame.crewId, item.metric, binKey)
      this.pushSample(entry, { t: frame.t, value: item.value })
    }
  }

  /** Backfill çerçevelerini tek geçişte (kronolojik sırada) öğrenir. */
  backfill(frames: readonly TelemetryFrame[]): void {
    if (frames.length === 0) return
    let needsSort = false
    for (let i = 1; i < frames.length; i++) {
      if (frames[i]!.t < frames[i - 1]!.t) {
        needsSort = true
        break
      }
    }
    const ordered = needsSort ? [...frames].sort((a, b) => a.t - b.t) : frames
    for (let i = 0; i < ordered.length; i++) {
      this.update(ordered[i]!)
    }
  }

  /**
   * Verilen değer için sağlam z-skoru ve güven döndürür.
   * Soğuk başlangıçta (`nEffDays < baseline.window.days.min`): `{ z: 0, baseline: null, confidence: < 0.5 }` döner;
   * tüketiciler `baseline === null` iken `z`'yi uyarı üretmek için kullanmamalıdır.
   */
  zscore(
    crewId: CrewId,
    metric: MetricId,
    value: number,
    t: SimTimeMs,
    env?: Environment,
  ): ZResult {
    const effEnv = env ?? this.lastEnvByCrew.get(crewId)
    const binKey = getBinKey(metric, t, {
      hrBlockHours: this.hrBlockHours,
      ...(effEnv ? { environment: effEnv } : {}),
    })
    const entry = this.bins.get(makeStorageKey(crewId, metric, binKey))
    if (!entry) {
      return { z: 0, baseline: null, confidence: 0 }
    }

    this.evaluateBin(entry)
    const stat = entry.cachedStat
    const conf = entry.cachedConfidence

    if (!stat || !Number.isFinite(value)) {
      return {
        z: 0,
        baseline: stat ? { ...stat } : null,
        confidence: conf,
      }
    }

    const scale = effectiveScale(MAD_CONSISTENCY_CONSTANT * stat.mad, this.minScales[metric])
    const z = (value - stat.median) / scale
    return {
      z,
      baseline: { ...stat },
      confidence: stat.confidence,
    }
  }

  getBaseline(
    crewId: CrewId,
    metric: MetricId,
    t: SimTimeMs,
    env?: Environment,
  ): BaselineStat | null {
    const effEnv = env ?? this.lastEnvByCrew.get(crewId)
    const binKey = getBinKey(metric, t, {
      hrBlockHours: this.hrBlockHours,
      ...(effEnv ? { environment: effEnv } : {}),
    })
    const entry = this.bins.get(makeStorageKey(crewId, metric, binKey))
    if (!entry) return null
    this.evaluateBin(entry)
    return entry.cachedStat ? { ...entry.cachedStat } : null
  }

  confidence(crewId: CrewId, metric: MetricId, t: SimTimeMs, env?: Environment): number {
    const effEnv = env ?? this.lastEnvByCrew.get(crewId)
    const binKey = getBinKey(metric, t, {
      hrBlockHours: this.hrBlockHours,
      ...(effEnv ? { environment: effEnv } : {}),
    })
    const entry = this.bins.get(makeStorageKey(crewId, metric, binKey))
    if (!entry) return 0
    this.evaluateBin(entry)
    return entry.cachedConfidence
  }

  /** Gece bloğu (00:00–hrBlockHours) HR medyanını istirahat HR proxy'si olarak döner. */
  restingHr(crewId: CrewId, t: SimTimeMs): number | null {
    if (!Number.isFinite(t)) return null
    const nightKey = getNightHrBinKey()
    const entry = this.bins.get(makeStorageKey(crewId, 'hr', nightKey))
    if (!entry) return null
    this.evaluateBin(entry)
    return entry.cachedStat ? entry.cachedStat.median : null
  }

  /** Drift koruması: `active === true` iken bu mürettebat üyesinin baseline kutuları donar. */
  setGuard(crewId: CrewId, active: boolean, t: SimTimeMs): void {
    this.guards.set(crewId, { active, updatedT: t })
  }

  isGuarded(crewId: CrewId): boolean {
    return this.guards.get(crewId)?.active ?? false
  }

  getMinScale(metric: MetricId): number {
    return this.minScales[metric]
  }

  /** Verilen baseline istatistiği için etkili sigma (`max(1.4826 * mad, minScale[metric])`). */
  effectiveSigma(stat: BaselineStat): number {
    return effectiveScale(MAD_CONSISTENCY_CONSTANT * stat.mad, this.minScales[stat.metric])
  }

  snapshot(): BaselineSnapshot {
    const stats: BaselineStat[] = []
    let totalSamples = 0

    for (const entry of this.bins.values()) {
      this.evaluateBin(entry)
      totalSamples += entry.samples.length - entry.head
      if (entry.cachedStat) {
        stats.push({ ...entry.cachedStat })
      }
    }

    stats.sort((a, b) => {
      if (a.crewId !== b.crewId) return a.crewId.localeCompare(b.crewId)
      if (a.metric !== b.metric) return a.metric.localeCompare(b.metric)
      return a.bin.localeCompare(b.bin)
    })

    const guards: Record<CrewId, GuardState> = {}
    for (const [crewId, g] of this.guards.entries()) {
      guards[crewId] = { ...g }
    }

    return {
      stats,
      guards,
      binCount: this.bins.size,
      totalSamples,
    }
  }

  reset(): void {
    this.bins.clear()
    this.guards.clear()
    this.lastEnvByCrew.clear()
  }

  private capacityForMetric(metric: MetricId): number {
    if (isDailyMetric(metric)) {
      return Math.max(21, Math.ceil(this.targetDays) + 7)
    }
    if (metric === 'hr' || metric === 'hrv') {
      const framesPerBlock = Math.max(
        1,
        Math.round((this.hrBlockHours * MIN_PER_HOUR) / VITALS_INTERVAL_MIN),
      )
      return Math.ceil(this.targetDays) * framesPerBlock + 16
    }
    const framesPerDay = Math.max(1, Math.round(MIN_PER_DAY / VITALS_INTERVAL_MIN))
    return Math.ceil(this.targetDays) * framesPerDay + 32
  }

  private getOrCreateBin(crewId: CrewId, metric: MetricId, binKey: string): BinEntry {
    const key = makeStorageKey(crewId, metric, binKey)
    let entry = this.bins.get(key)
    if (!entry) {
      entry = {
        crewId,
        metric,
        binKey,
        capacity: this.capacityForMetric(metric),
        samples: [],
        head: 0,
        sortedValues: [],
        dayCounts: new Map(),
        newestT: Number.NEGATIVE_INFINITY,
        dirty: true,
        cachedStat: null,
        cachedConfidence: 0,
      }
      this.bins.set(key, entry)
    }
    return entry
  }

  private addEntryAccounting(entry: BinEntry, sample: Sample): void {
    const insPos = lowerBound(entry.sortedValues, sample.value)
    entry.sortedValues.splice(insPos, 0, sample.value)

    const d = dayIndex(sample.t)
    entry.dayCounts.set(d, (entry.dayCounts.get(d) ?? 0) + 1)
  }

  private removeEntryAccounting(entry: BinEntry, sample: Sample): void {
    const pos = lowerBound(entry.sortedValues, sample.value)
    if (pos < entry.sortedValues.length && entry.sortedValues[pos] === sample.value) {
      entry.sortedValues.splice(pos, 1)
    }

    const d = dayIndex(sample.t)
    const count = entry.dayCounts.get(d) ?? 0
    if (count <= 1) {
      entry.dayCounts.delete(d)
    } else {
      entry.dayCounts.set(d, count - 1)
    }
  }

  private pushSample(entry: BinEntry, sample: Sample): void {
    const activeCount = entry.samples.length - entry.head
    if (activeCount > 0) {
      if (sample.t <= entry.newestT - this.windowMs) {
        return
      }
      if (sample.t >= entry.newestT) {
        entry.samples.push(sample)
        entry.newestT = sample.t
      } else {
        let pos = entry.samples.length
        while (pos > entry.head && entry.samples[pos - 1]!.t > sample.t) {
          pos--
        }
        entry.samples.splice(pos, 0, sample)
      }
    } else {
      entry.samples.push(sample)
      entry.newestT = sample.t
    }

    this.addEntryAccounting(entry, sample)

    const cutoffT = entry.newestT - this.windowMs
    while (entry.head < entry.samples.length && entry.samples[entry.head]!.t <= cutoffT) {
      const evicted = entry.samples[entry.head++]!
      this.removeEntryAccounting(entry, evicted)
    }

    while (entry.samples.length - entry.head > entry.capacity) {
      const evicted = entry.samples[entry.head++]!
      this.removeEntryAccounting(entry, evicted)
    }

    if (entry.head >= 64 || entry.samples.length > entry.capacity + 64) {
      entry.samples = entry.samples.slice(entry.head)
      entry.head = 0
    }

    entry.dirty = true
  }

  private evaluateBin(entry: BinEntry): void {
    if (!entry.dirty) return

    const activeCount = entry.sortedValues.length
    if (activeCount <= 0) {
      entry.cachedStat = null
      entry.cachedConfidence = 0
      entry.dirty = false
      return
    }

    const nEffDays = entry.dayCounts.size
    const baseConf = Math.min(1, nEffDays / this.targetDays)
    const sparseFactor = activeCount < this.sparseMinSamples ? this.sparseConfidenceFactor : 1
    const conf = baseConf * sparseFactor

    if (nEffDays < this.minDays) {
      entry.cachedStat = null
      entry.cachedConfidence = conf
      entry.dirty = false
      return
    }

    const med = medianFromSorted(entry.sortedValues)
    const m = madFromSorted(entry.sortedValues, med)

    entry.cachedStat = {
      crewId: entry.crewId,
      metric: entry.metric,
      bin: entry.binKey,
      median: med,
      mad: m,
      n: activeCount,
      updatedT: entry.newestT,
      confidence: conf,
    }
    entry.cachedConfidence = conf
    entry.dirty = false
  }
}
