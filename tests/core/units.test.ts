import { describe, expect, it } from 'vitest'
import {
  daysToMs,
  hoursToMs,
  minToMs,
  minToSec,
  MIN_PER_DAY,
  msToDays,
  msToHours,
  msToMin,
  msToSec,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MIN,
  secToMin,
  secToMs,
  VITALS_INTERVAL_MIN,
} from '@/core/units'

describe('units', () => {
  it('MS_PER_* sabitleri', () => {
    expect(MS_PER_MIN).toBe(60_000)
    expect(MS_PER_HOUR).toBe(3_600_000)
    expect(MS_PER_DAY).toBe(86_400_000)
    expect(MIN_PER_DAY).toBe(1440)
  })

  it('vitals kadansı günde 96 çerçeve verir', () => {
    expect(MIN_PER_DAY / VITALS_INTERVAL_MIN).toBe(96)
  })

  it('dönüşümler karşılıklı tersidir', () => {
    expect(msToSec(secToMs(1.3))).toBeCloseTo(1.3)
    expect(msToMin(minToMs(15))).toBe(15)
    expect(msToHours(hoursToMs(48))).toBe(48)
    expect(msToDays(daysToMs(-14))).toBe(-14)
    expect(secToMin(1320)).toBe(22)
    expect(minToSec(3)).toBe(180)
  })
})
