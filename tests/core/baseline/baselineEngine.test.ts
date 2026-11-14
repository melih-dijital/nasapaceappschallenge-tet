import { describe, expect, it } from 'vitest'
import { BaselineEngine, getBinKey, hourBlockForTime, hourOfDay } from '@/core/baseline'
import { registry } from '@/core/evidence/registry'
import type { DailyFrame, RadiationFrame, TelemetryFrame, VitalsFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'

function makeVitals(
  crewId: string,
  t: number,
  hr: number,
  opts: { spo2?: number; hrv?: number } = {},
): VitalsFrame {
  return {
    kind: 'vitals',
    crewId,
    t,
    hr,
    spo2: opts.spo2 ?? 98,
    ...(opts.hrv !== undefined ? { hrv: opts.hrv } : {}),
    source: 'SYNTHETIC',
  }
}

function makeDaily(crewId: string, day: number, durationH = 7.5): DailyFrame {
  return {
    kind: 'daily',
    crewId,
    day,
    t: (day + 1) * MS_PER_DAY - MS_PER_MIN,
    sleep: { durationH, efficiency: 0.9, midpointShiftMin: 0 },
    activity: { exerciseMin: 35, resistiveMin: 20 },
    hydrationL: 2.5,
    cabinCo2ppm: 1200,
    mood: { stress: 3, mood: 7.5, motivation: 7.5 },
    pvt: { medianMs: 250, lapses: 0 },
    source: 'SYNTHETIC',
  }
}

function makeRad(
  crewId: string,
  t: number,
  doseRateMsvDay: number,
  environment: RadiationFrame['environment'] = 'LEO',
): RadiationFrame {
  return {
    kind: 'radiation',
    crewId,
    t,
    doseRateMsvDay,
    protonFluxPfu: 0.4,
    environment,
    source: 'SYNTHETIC',
  }
}

describe('BaselineEngine ve kutular', () => {
  it('saat blokları ve negatif backfill zamanları doğru kutuya gider', () => {
    expect(hourOfDay(-MS_PER_DAY + 2 * MS_PER_HOUR)).toBe(2)
    expect(hourOfDay(-15 * MS_PER_MIN)).toBe(23)
    expect(hourBlockForTime(-MS_PER_DAY + 2 * MS_PER_HOUR, 6)).toBe(0)
    expect(hourBlockForTime(14 * MS_PER_HOUR, 6)).toBe(2)

    expect(getBinKey('hr', 14 * MS_PER_HOUR, { hrBlockHours: 6 })).toBe('hr|blk2')
    expect(getBinKey('hrv', 2 * MS_PER_HOUR, { hrBlockHours: 6 })).toBe('hrv|blk0')
    expect(getBinKey('spo2', 14 * MS_PER_HOUR, { hrBlockHours: 6 })).toBe('all')
    expect(getBinKey('sleep.durationH', 14 * MS_PER_HOUR, { hrBlockHours: 6 })).toBe('day')
    expect(
      getBinKey('rad.doseRateMsvDay', 14 * MS_PER_HOUR, {
        hrBlockHours: 6,
        environment: 'MARS_TRANSIT',
      }),
    ).toBe('env:MARS_TRANSIT')
  })

  it('öğrenme penceresi: <3 gün null, 3–6 gün confidence < 0.5, 7. günde 0.5, 14 günde 1.0', () => {
    const engine = new BaselineEngine({ registry })
    const tHour = 13 * MS_PER_HOUR

    // 2 gün × günde 8 örnek (sparseBin sınırını geçsin, yalnız gün sayısı <3 test edilsin)
    for (let day = 0; day < 2; day++) {
      for (let i = 0; i < 8; i++) {
        engine.update(makeVitals('cdr', day * MS_PER_DAY + tHour + i * MS_PER_MIN, 64))
      }
    }
    expect(engine.getBaseline('cdr', 'hr', 2 * MS_PER_DAY + tHour)).toBeNull()
    const cold = engine.zscore('cdr', 'hr', 95, 2 * MS_PER_DAY + tHour)
    expect(cold.baseline).toBeNull()
    expect(cold.z).toBe(0)
    expect(Number.isNaN(cold.z)).toBe(false)
    expect(cold.confidence).toBeLessThan(0.5)

    // Gün 3..6: baseline artık var ama güven < 0.5
    for (let day = 2; day < 6; day++) {
      for (let i = 0; i < 4; i++) {
        engine.update(makeVitals('cdr', day * MS_PER_DAY + tHour + i * MS_PER_MIN, 64))
      }
      const stat = engine.getBaseline('cdr', 'hr', day * MS_PER_DAY + tHour)
      expect(stat).not.toBeNull()
      expect(stat!.confidence).toBeLessThan(0.5)
    }

    // Gün 7: 7 / 14 = 0.5
    for (let i = 0; i < 4; i++) {
      engine.update(makeVitals('cdr', 6 * MS_PER_DAY + tHour + i * MS_PER_MIN, 64))
    }
    const day7 = engine.getBaseline('cdr', 'hr', 6 * MS_PER_DAY + tHour)
    expect(day7).not.toBeNull()
    expect(day7!.confidence).toBeCloseTo(0.5, 6)

    // Gün 8..14: 14 / 14 = 1.0
    for (let day = 7; day < 14; day++) {
      for (let i = 0; i < 4; i++) {
        engine.update(makeVitals('cdr', day * MS_PER_DAY + tHour + i * MS_PER_MIN, 64))
      }
    }
    const day14 = engine.getBaseline('cdr', 'hr', 13 * MS_PER_DAY + tHour)
    expect(day14!.confidence).toBeCloseTo(1, 6)

    // Günlük metrikte sparseBin cezası (< 8 örnekken çarpan 0.5) ve 14 günde 1.0
    for (let day = 0; day < 7; day++) {
      engine.update(makeDaily('cdr', day, 7.5))
    }
    expect(engine.confidence('cdr', 'sleep.durationH', 6 * MS_PER_DAY)).toBeCloseTo(0.25, 6)
    for (let day = 7; day < 14; day++) {
      engine.update(makeDaily('cdr', day, 7.5))
    }
    expect(engine.confidence('cdr', 'sleep.durationH', 13 * MS_PER_DAY)).toBeCloseTo(1, 6)
  })

  it('MAD=0 durumunda minScale devreye girer ve z sonlu kalır', () => {
    const engine = new BaselineEngine({ registry })
    for (let day = 0; day < 5; day++) {
      for (let i = 0; i < 4; i++) {
        engine.update(makeVitals('md', day * MS_PER_DAY + 13 * MS_PER_HOUR + i * MS_PER_MIN, 60))
      }
    }
    const stat = engine.getBaseline('md', 'hr', 5 * MS_PER_DAY + 13 * MS_PER_HOUR)
    expect(stat).not.toBeNull()
    expect(stat!.mad).toBe(0)

    // minScale.hr = 3 -> (69 - 60) / 3 = 3
    const zRes = engine.zscore('md', 'hr', 69, 5 * MS_PER_DAY + 13 * MS_PER_HOUR)
    expect(Number.isFinite(zRes.z)).toBe(true)
    expect(zRes.z).toBeCloseTo(registry.getNumber('minScale.hr') > 0 ? 9 / registry.getNumber('minScale.hr') : 0, 6)
  })

  it('drift koruması: guard açıkken 10 günde artan HR baseline ı kaydırmaz; kapalıyken kayar', () => {
    const guarded = new BaselineEngine({ registry })
    const unguarded = new BaselineEngine({ registry })
    const noon = 13 * MS_PER_HOUR

    // İlk 14 gün stabil 62 bpm (gün -14..-1)
    for (let day = -14; day < 0; day++) {
      for (let k = 0; k < 2; k++) {
        const frame = makeVitals('cdr', day * MS_PER_DAY + noon + k * 15 * MS_PER_MIN, 62)
        guarded.update(frame)
        unguarded.update(frame)
      }
    }
    const initialMedian = guarded.getBaseline('cdr', 'hr', 0 + noon)!.median
    expect(initialMedian).toBe(62)

    // 10 gün boyunca HR yavaş yavaş +2 bpm/gün artıyor (64 .. 82)
    guarded.setGuard('cdr', true, 0)
    for (let day = 0; day < 10; day++) {
      const hr = 64 + day * 2
      for (let k = 0; k < 2; k++) {
        const frame = makeVitals('cdr', day * MS_PER_DAY + noon + k * 15 * MS_PER_MIN, hr)
        guarded.update(frame)
        unguarded.update(frame)
      }
    }

    // Guard açıkken baseline donuk kalır ve z yüksektir
    const guardedStat = guarded.getBaseline('cdr', 'hr', 10 * MS_PER_DAY + noon)!
    expect(guardedStat.median).toBe(62)
    expect(guarded.zscore('cdr', 'hr', 82, 10 * MS_PER_DAY + noon).z).toBeGreaterThan(5)

    // Guard hiç açılmadığında pencere zamanla yukarı kayar
    const unguardedStat = unguarded.getBaseline('cdr', 'hr', 10 * MS_PER_DAY + noon)!
    expect(unguardedStat.median).toBeGreaterThan(initialMedian + 5)
  })

  it('saat bloğu izolasyonu, restingHr ve radyasyon ortam kutuları', () => {
    const engine = new BaselineEngine({ registry })
    for (let day = -14; day < 0; day++) {
      // Gece bloğu (02:00): HR 52
      engine.update(makeVitals('eng', day * MS_PER_DAY + 2 * MS_PER_HOUR, 52))
      // Gündüz bloğu (14:00): HR 78
      engine.update(makeVitals('eng', day * MS_PER_DAY + 14 * MS_PER_HOUR, 78))
      // LEO radyasyon: 0.35
      engine.update(makeRad('eng', day * MS_PER_DAY + 12 * MS_PER_HOUR, 0.35, 'LEO'))
    }

    expect(engine.restingHr('eng', 0)).toBe(52)
    expect(engine.getBaseline('eng', 'hr', 2 * MS_PER_HOUR)!.median).toBe(52)
    expect(engine.getBaseline('eng', 'hr', 14 * MS_PER_HOUR)!.median).toBe(78)

    // Gece değerinin (52) gündüz bloğunda düşük çıkması gerekir (sızma yok)
    expect(engine.zscore('eng', 'hr', 52, 14 * MS_PER_HOUR).z).toBeLessThan(-5)

    // Ortam değişince MARS_TRANSIT kendi binini öğrenir, LEO binini bozmaz
    for (let day = 0; day < 4; day++) {
      engine.update(makeRad('eng', day * MS_PER_DAY + 12 * MS_PER_HOUR, 1.0, 'MARS_TRANSIT'))
    }
    expect(engine.getBaseline('eng', 'rad.doseRateMsvDay', 4 * MS_PER_DAY, 'LEO')!.median).toBe(0.35)
    expect(engine.getBaseline('eng', 'rad.doseRateMsvDay', 4 * MS_PER_DAY, 'MARS_TRANSIT')!.median).toBe(1.0)
  })

  it('kişiler arası bağımsızlık, determinizm ve backfill ≡ update eşdeğerliği', () => {
    const e1 = new BaselineEngine({ registry })
    const e2 = new BaselineEngine({ registry })
    const noon = 13 * MS_PER_HOUR
    const frames: TelemetryFrame[] = []

    for (let day = -14; day < 0; day++) {
      // Kişi A normali 78 bpm, Kişi B normali 58 bpm
      frames.push(makeVitals('a', day * MS_PER_DAY + noon, 78 + (day % 2)))
      frames.push(makeVitals('b', day * MS_PER_DAY + noon, 58 + (day % 2)))
    }

    e1.backfill(frames)
    for (const f of frames) e2.update(f)

    // Same raw HR=80: A için normal, B için yüksek z
    const zA = e1.zscore('a', 'hr', 80, noon)
    const zB = e1.zscore('b', 'hr', 80, noon)
    expect(Math.abs(zA.z)).toBeLessThan(1)
    expect(zB.z).toBeGreaterThan(5)

    // Determinizm ve backfill === tek tek update
    expect(e1.snapshot()).toEqual(e2.snapshot())
    expect(zA.z).toBe(e2.zscore('a', 'hr', 80, noon).z)
    expect(zB.z).toBe(e2.zscore('b', 'hr', 80, noon).z)
  })

  it('30 sim-gün boyunca kişi×metrik×bin örnek sayısı sınırlı kalır', () => {
    const scenario = getScenario('nominal')
    const sim = new Simulator(scenario, { seed: 1 })
    const engine = new BaselineEngine({ registry })

    engine.backfill(sim.backfill())
    const snapAt14 = engine.snapshot()

    // Gün 0..30 adım adım ilerle
    for (let day = 1; day <= 30; day++) {
      for (const frame of sim.advanceTo(day * MS_PER_DAY)) {
        engine.update(frame)
      }
    }
    const snapAt30 = engine.snapshot()

    // Backfill 14 gündü, hedef pencere de 14 gün olduğu için 30. günde örnek sayısı patlamaz
    expect(snapAt30.binCount).toBe(snapAt14.binCount)
    expect(snapAt30.totalSamples).toBeLessThanOrEqual(snapAt14.totalSamples + 20)
    for (const stat of snapAt30.stats) {
      if (stat.metric === 'hr' || stat.metric === 'hrv') {
        expect(stat.n).toBeLessThanOrEqual(352)
      } else if (stat.metric === 'spo2' || stat.metric === 'rad.doseRateMsvDay') {
        expect(stat.n).toBeLessThanOrEqual(1376)
      } else {
        expect(stat.n).toBeLessThanOrEqual(21)
      }
    }
  })
})
