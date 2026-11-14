// Simülasyon saati ve hız dönüşümü (FAZ_02 §3.2). Gerçek zaman bağımlılığı YOK.
import { registry, type EvidenceRegistry } from '../core/evidence/registry'
import type { SimTimeMs } from '../core/types'
import { MIN_PER_DAY, MIN_PER_HOUR, MS_PER_DAY, MS_PER_SEC, msToMin } from '../core/units'

export function dayOf(t: SimTimeMs): number {
  return Math.floor(t / MS_PER_DAY)
}

export function minuteOfDay(t: SimTimeMs): number {
  const mins = msToMin(t)
  return ((mins % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
}

export function hourOfDay(t: SimTimeMs): number {
  return minuteOfDay(t) / MIN_PER_HOUR
}

export function clampSpeed(speedMultiplier: number, ev: EvidenceRegistry = registry): number {
  const min = ev.getNumber('sim.speed.min')
  const max = ev.getNumber('sim.speed.max')
  if (!Number.isFinite(speedMultiplier)) return min
  return Math.min(max, Math.max(min, speedMultiplier))
}

/**
 * 1× = `sim.secondsPerSimDay` gerçek saniye / sim-gün (20 sn → 1× = 4320 sim-ms / gerçek ms).
 * Formül: speedMultiplier * MS_PER_DAY / (sim.secondsPerSimDay * 1000).
 */
export function speedToSimMsPerRealMs(
  speedMultiplier: number,
  ev: EvidenceRegistry = registry,
): number {
  const clamped = clampSpeed(speedMultiplier, ev)
  const secondsPerSimDay = ev.getNumber('sim.secondsPerSimDay')
  return (clamped * MS_PER_DAY) / (secondsPerSimDay * MS_PER_SEC)
}

export class SimClock {
  t: SimTimeMs

  constructor(initialT: SimTimeMs = 0) {
    this.t = initialT
  }

  advance(dtMs: number): SimTimeMs {
    if (dtMs < 0 || !Number.isFinite(dtMs)) {
      throw new Error(`SimClock.advance: dtMs >= 0 olmalı, alındı: ${dtMs}`)
    }
    this.t += dtMs
    return this.t
  }

  reset(initialT: SimTimeMs = 0): void {
    this.t = initialT
  }

  dayOf(t: SimTimeMs = this.t): number {
    return dayOf(t)
  }

  minuteOfDay(t: SimTimeMs = this.t): number {
    return minuteOfDay(t)
  }

  hourOfDay(t: SimTimeMs = this.t): number {
    return hourOfDay(t)
  }
}
