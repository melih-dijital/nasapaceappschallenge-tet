import { describe, expect, it } from 'vitest'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { clampSpeed, dayOf, hourOfDay, minuteOfDay, SimClock, speedToSimMsPerRealMs } from '@/sim/clock'

describe('SimClock ve hız dönüşümleri', () => {
  it('advance ve reset doğru çalışır; negatif dtMs reddedilir', () => {
    const clock = new SimClock()
    expect(clock.t).toBe(0)
    expect(clock.advance(15 * MS_PER_MIN)).toBe(15 * MS_PER_MIN)
    expect(clock.dayOf()).toBe(0)
    expect(clock.minuteOfDay()).toBe(15)
    expect(clock.hourOfDay()).toBe(0.25)

    expect(() => clock.advance(-1)).toThrow()
    clock.reset()
    expect(clock.t).toBe(0)
  })

  it('negatif backfill zamanları için dayOf/minuteOfDay/hourOfDay tutarlıdır', () => {
    const t = -15 * MS_PER_MIN
    expect(dayOf(t)).toBe(-1)
    expect(minuteOfDay(t)).toBe(24 * 60 - 15)
    expect(hourOfDay(t)).toBe(23.75)

    const startOfDayMinus14 = -14 * MS_PER_DAY
    expect(dayOf(startOfDayMinus14)).toBe(-14)
    expect(minuteOfDay(startOfDayMinus14)).toBe(0)
    expect(hourOfDay(startOfDayMinus14 + 6 * MS_PER_HOUR)).toBe(6)
  })

  it('speedToSimMsPerRealMs Evidence sim.secondsPerSimDay (20s) ile hesaplanır ve sınırlanır', () => {
    // 1× = 86_400_000 / 20_000 = 4320 sim-ms / gerçek ms
    expect(speedToSimMsPerRealMs(1)).toBe(4320)
    expect(speedToSimMsPerRealMs(0.25)).toBe(1080)
    expect(speedToSimMsPerRealMs(50)).toBe(216000)

    expect(clampSpeed(0.01)).toBe(0.25)
    expect(clampSpeed(100)).toBe(50)
    expect(speedToSimMsPerRealMs(100)).toBe(216000)
  })
})
