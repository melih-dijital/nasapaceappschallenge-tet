// Metrik başına baseline kutu (bin) adresleme kuralları (FAZ_04 §3.2). Saf TS.
import type { Environment, MetricId, SimTimeMs } from '../types'
import { HOURS_PER_DAY, MS_PER_DAY, MS_PER_HOUR } from '../units'

export interface BinKeyOptions {
  hrBlockHours: number
  environment?: Environment
}

/** Negatif backfill zamanları (t < 0) dahil doğru 0..23 günün saatini verir. */
export function hourOfDay(t: SimTimeMs): number {
  const modMs = ((t % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY
  return Math.floor(modMs / MS_PER_HOUR)
}

/** Verilen saat blok genişliğine göre 0..N-1 blok indeksini döner. */
export function hourBlockForTime(t: SimTimeMs, hrBlockHours: number): number {
  const blockH = hrBlockHours > 0 ? hrBlockHours : 6
  const numBlocks = Math.max(1, Math.floor(HOURS_PER_DAY / blockH))
  return Math.floor(hourOfDay(t) / blockH) % numBlocks
}

/** Gece HR istirahat proxy'si için 00:00..hrBlockHours bloğunun kutu anahtarı. */
export function getNightHrBinKey(): string {
  return 'hr|blk0'
}

/** Günlük kadanslı metrikler (vitals ve radyasyon dışındaki tüm metrikler). */
export function isDailyMetric(metric: MetricId): boolean {
  return metric !== 'hr' && metric !== 'spo2' && metric !== 'hrv' && metric !== 'rad.doseRateMsvDay'
}

/**
 * Kutu anahtarları (PROJECT_MEMORY §6 / BaselineStat.bin):
 * - hr, hrv → "hr|blk0".."hr|blk3" / "hrv|blk0".."hrv|blk3"
 * - rad.doseRateMsvDay → "env:LEO", "env:MARS_TRANSIT", ...
 * - spo2 → "all"
 * - diğer tüm metrikler (günlük) → "day"
 */
export function getBinKey(metric: MetricId, t: SimTimeMs, opts: BinKeyOptions): string {
  if (metric === 'hr' || metric === 'hrv') {
    const blk = hourBlockForTime(t, opts.hrBlockHours)
    return `${metric}|blk${blk}`
  }
  if (metric === 'rad.doseRateMsvDay') {
    return `env:${opts.environment ?? 'UNKNOWN'}`
  }
  if (metric === 'spo2') {
    return 'all'
  }
  return 'day'
}
