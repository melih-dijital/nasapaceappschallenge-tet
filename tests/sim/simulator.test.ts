import { describe, expect, it } from 'vitest'
import type { DailyFrame, RadiationFrame, TelemetryFrame, VitalsFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, minToMs } from '@/core/units'
import { getCalibrationData } from '@/sim/calibration'
import { hashString, speCurveMultiplier, type SpeScenarioEvent } from '@/sim'
import { BUILTIN_SCENARIO_IDS, getScenario, listScenarios } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'

function hashFrames(frames: readonly TelemetryFrame[]): string {
  const json = JSON.stringify(frames)
  const h1 = hashString(json).toString(16).padStart(8, '0')
  const h2 = hashString(`salt:${json.length}:${json}`).toString(16).padStart(8, '0')
  return `${h1}${h2}`
}

function assertAllFiniteAndPlausible(frames: readonly TelemetryFrame[]): void {
  const cal = getCalibrationData().metrics
  const inRange = (val: number, min: number, max: number, label: string) => {
    expect(Number.isFinite(val), `${label} sonlu değil: ${val}`).toBe(true)
    expect(val, `${label} < ${min}`).toBeGreaterThanOrEqual(min)
    expect(val, `${label} > ${max}`).toBeLessThanOrEqual(max)
  }

  for (const f of frames) {
    expect(Number.isFinite(f.t)).toBe(true)
    if (f.kind === 'vitals') {
      inRange(f.hr, cal.hr.plausibleMin, cal.hr.plausibleMax, 'hr')
      inRange(f.spo2, cal.spo2.plausibleMin, cal.spo2.plausibleMax, 'spo2')
      if (f.hrv !== undefined) inRange(f.hrv, cal.hrv.plausibleMin, cal.hrv.plausibleMax, 'hrv')
    } else if (f.kind === 'radiation') {
      inRange(
        f.doseRateMsvDay,
        cal['rad.doseRateMsvDay'].plausibleMin,
        cal['rad.doseRateMsvDay'].plausibleMax,
        'rad.doseRateMsvDay',
      )
      if (f.protonFluxPfu !== undefined) {
        expect(Number.isFinite(f.protonFluxPfu)).toBe(true)
        expect(f.protonFluxPfu).toBeGreaterThanOrEqual(0)
      }
    } else {
      inRange(f.sleep.durationH, cal['sleep.durationH'].plausibleMin, cal['sleep.durationH'].plausibleMax, 'sleep.durationH')
      inRange(f.sleep.efficiency, cal['sleep.efficiency'].plausibleMin, cal['sleep.efficiency'].plausibleMax, 'sleep.efficiency')
      inRange(
        f.sleep.midpointShiftMin,
        cal['sleep.midpointShiftMin'].plausibleMin,
        cal['sleep.midpointShiftMin'].plausibleMax,
        'sleep.midpointShiftMin',
      )
      inRange(
        f.activity.exerciseMin,
        cal['activity.exerciseMin'].plausibleMin,
        cal['activity.exerciseMin'].plausibleMax,
        'activity.exerciseMin',
      )
      inRange(
        f.activity.resistiveMin,
        cal['activity.resistiveMin'].plausibleMin,
        cal['activity.resistiveMin'].plausibleMax,
        'activity.resistiveMin',
      )
      inRange(f.hydrationL, cal.hydrationL.plausibleMin, cal.hydrationL.plausibleMax, 'hydrationL')
      if (f.cabinCo2ppm !== undefined) {
        inRange(f.cabinCo2ppm, cal.cabinCo2ppm.plausibleMin, cal.cabinCo2ppm.plausibleMax, 'cabinCo2ppm')
      }
      if (f.mood) {
        inRange(f.mood.stress, cal['mood.stress'].plausibleMin, cal['mood.stress'].plausibleMax, 'mood.stress')
        inRange(f.mood.mood, cal['mood.mood'].plausibleMin, cal['mood.mood'].plausibleMax, 'mood.mood')
        inRange(
          f.mood.motivation,
          cal['mood.motivation'].plausibleMin,
          cal['mood.motivation'].plausibleMax,
          'mood.motivation',
        )
      }
      if (f.pvt) {
        inRange(f.pvt.medianMs, cal['pvt.medianMs'].plausibleMin, cal['pvt.medianMs'].plausibleMax, 'pvt.medianMs')
        inRange(f.pvt.lapses, cal['pvt.lapses'].plausibleMin, cal['pvt.lapses'].plausibleMax, 'pvt.lapses')
      }
    }
  }
}

describe('Simulator ve 8 senaryo', () => {
  it('8 yerleşik senaryo yüklenir ve ground-truth erişilebilir', () => {
    const scenarios = listScenarios()
    expect(scenarios.map((s) => s.id)).toEqual([...BUILTIN_SCENARIO_IDS])
    expect(scenarios).toHaveLength(8)

    for (const s of scenarios) {
      const sim = new Simulator(s)
      expect(sim.getGroundTruth()).toEqual({ events: s.events, expected: s.expected })
    }
  })

  it('aynı seed → aynı çerçeve SHA-256 özeti; farklı seed → farklı özet', () => {
    const scenario = getScenario('demo_main')
    const run = (seed: number) => {
      const sim = new Simulator(scenario, { seed })
      return [...sim.backfill(scenario.backfillDays), ...sim.advanceTo(scenario.durationDays * MS_PER_DAY)]
    }

    const h1 = hashFrames(run(42))
    const h2 = hashFrames(run(42))
    const h3 = hashFrames(run(43))

    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3)
  })

  it('nominal 30 gün: beklenen çerçeve sayısı birebir, NaN yok, tüm değerler makul aralıkta', () => {
    const scenario = getScenario('nominal')
    const sim = new Simulator(scenario)
    const back = sim.backfill(scenario.backfillDays)
    const active = sim.advanceTo(scenario.durationDays * MS_PER_DAY)

    // Backfill: 14 gün, t < 0, day = -14..-1
    expect(back.every((f) => f.t < 0 && f.t >= -14 * MS_PER_DAY)).toBe(true)
    const backDaily = back.filter((f): f is DailyFrame => f.kind === 'daily')
    expect(backDaily).toHaveLength(14 * 4)
    expect(Math.min(...backDaily.map((d) => d.day))).toBe(-14)
    expect(Math.max(...backDaily.map((d) => d.day))).toBe(-1)

    // Aktif 30 gün: 96 vitals + 96 rad + 1 daily per crew per day
    const vitals = active.filter((f): f is VitalsFrame => f.kind === 'vitals')
    const rads = active.filter((f): f is RadiationFrame => f.kind === 'radiation')
    const dailies = active.filter((f): f is DailyFrame => f.kind === 'daily')

    expect(vitals).toHaveLength(30 * 96 * 4)
    expect(rads).toHaveLength(30 * 96 * 4)
    expect(dailies).toHaveLength(30 * 4)

    // Zaman sıralı
    for (let i = 1; i < active.length; i++) {
      expect(active[i]!.t).toBeGreaterThanOrEqual(active[i - 1]!.t)
    }

    assertAllFiniteAndPlausible([...back, ...active])
  })

  it('advanceTo(a) + advanceTo(b) ≡ advanceTo(b)', () => {
    const scenario = getScenario('sleep_debt')
    const simWhole = new Simulator(scenario)
    simWhole.backfill(scenario.backfillDays)
    const whole = simWhole.advanceTo(10 * MS_PER_DAY)

    const simSplit = new Simulator(scenario)
    simSplit.backfill(scenario.backfillDays)
    const partA = simSplit.advanceTo(3.5 * MS_PER_DAY + minToMs(15))
    const partB = simSplit.advanceTo(7 * MS_PER_DAY)
    const partC = simSplit.advanceTo(10 * MS_PER_DAY)

    expect([...partA, ...partB, ...partC]).toEqual(whole)
  })

  it('SPE eğrisi süreklidir (sıçrama yok) ve ~20-30 dk civarında >=3× eşiği aşar', () => {
    const spe: SpeScenarioEvent = {
      id: 'spe-test',
      kind: 'SPE',
      crewIds: 'ALL',
      fromT: 3 * MS_PER_DAY,
      toT: 3 * MS_PER_DAY + minToMs(240 + 1080),
      peakMultiplier: 8,
      peakProtonPfu: 200,
      riseMin: 240,
      decayMin: 1080,
    }

    const mStart = speCurveMultiplier(spe.fromT, spe)
    const m25 = speCurveMultiplier(spe.fromT + minToMs(25), spe)
    const mEndBefore = speCurveMultiplier(spe.fromT + minToMs(240), spe)
    const mEndAfter = speCurveMultiplier(spe.fromT + minToMs(240) + 1, spe)

    expect(mStart).toBe(1)
    expect(m25).toBeGreaterThan(3)
    expect(Math.abs(mEndBefore - mEndAfter)).toBeLessThan(0.001)
    expect(mEndBefore).toBeGreaterThan(7.5)
  })

  it('her senaryoda enjekte edilen olayın etkisi gözlemlenebilir', () => {
    // 1. solar_particle_event: pik civarı doz hızı >= 5× arka plan
    const speScenario = getScenario('solar_particle_event')
    const speSim = new Simulator(speScenario)
    speSim.backfill(speScenario.backfillDays)
    const speFrames = speSim.advanceTo(speScenario.durationDays * MS_PER_DAY)
    const speRads = speFrames.filter((f): f is RadiationFrame => f.kind === 'radiation')
    const baselineRad = speRads.filter((f) => f.t < 2 * MS_PER_DAY).map((f) => f.doseRateMsvDay)
    const avgBaselineRad = baselineRad.reduce((a, b) => a + b, 0) / baselineRad.length
    const peakDose = Math.max(...speRads.map((f) => f.doseRateMsvDay))
    const peakProton = Math.max(...speRads.map((f) => f.protonFluxPfu ?? 0))
    expect(peakDose / avgBaselineRad).toBeGreaterThanOrEqual(5)
    expect(peakProton).toBeGreaterThan(150)

    // 2. sleep_debt: cdr/eng uyku süresi olay penceresinde belirgin düşer
    const sleepScenario = getScenario('sleep_debt')
    const sleepSim = new Simulator(sleepScenario)
    sleepSim.backfill(sleepScenario.backfillDays)
    const sleepDailies = sleepSim
      .advanceTo(sleepScenario.durationDays * MS_PER_DAY)
      .filter((f): f is DailyFrame => f.kind === 'daily')
    const cdrNormalSleep = sleepDailies
      .filter((d) => d.crewId === 'cdr' && d.day < 5)
      .map((d) => d.sleep.durationH)
    const cdrEventSleep = sleepDailies
      .filter((d) => d.crewId === 'cdr' && d.day >= 5 && d.day < 10)
      .map((d) => d.sleep.durationH)
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(avg(cdrNormalSleep) - avg(cdrEventSleep)).toBeGreaterThan(1.2)

    // 3. isolation_low_mood: sci morali düşer
    const moodScenario = getScenario('isolation_low_mood')
    const moodSim = new Simulator(moodScenario)
    moodSim.backfill(moodScenario.backfillDays)
    const moodDailies = moodSim
      .advanceTo(moodScenario.durationDays * MS_PER_DAY)
      .filter((f): f is DailyFrame => f.kind === 'daily' && f.crewId === 'sci')
    const earlyMood = avg(moodDailies.filter((d) => d.day < 8).map((d) => d.mood?.mood ?? 0))
    const lateMood = avg(moodDailies.filter((d) => d.day >= 18).map((d) => d.mood?.mood ?? 0))
    expect(earlyMood - lateMood).toBeGreaterThan(1.5)

    // 4. dehydration_co2: md su düşer ve co2 tüm kabinden yüksek artar
    const hydScenario = getScenario('dehydration_co2')
    const hydSim = new Simulator(hydScenario)
    hydSim.backfill(hydScenario.backfillDays)
    const hydDailies = hydSim
      .advanceTo(hydScenario.durationDays * MS_PER_DAY)
      .filter((f): f is DailyFrame => f.kind === 'daily')
    const mdNormalHyd = avg(hydDailies.filter((d) => d.crewId === 'md' && d.day < 6).map((d) => d.hydrationL))
    const mdEventHyd = avg(
      hydDailies.filter((d) => d.crewId === 'md' && d.day >= 6 && d.day <= 8).map((d) => d.hydrationL),
    )
    const mdEventCo2 = avg(
      hydDailies.filter((d) => d.crewId === 'md' && d.day >= 6 && d.day <= 8).map((d) => d.cabinCo2ppm ?? 0),
    )
    const cdrEventCo2 = avg(
      hydDailies.filter((d) => d.crewId === 'cdr' && d.day >= 6 && d.day <= 8).map((d) => d.cabinCo2ppm ?? 0),
    )
    expect(mdNormalHyd - mdEventHyd).toBeGreaterThan(0.5)
    expect(mdEventCo2 - cdrEventCo2).toBeGreaterThan(250)

    // 5. comm_blackout: eng HR gün 4'te yükselir
    const blkScenario = getScenario('comm_blackout')
    const blkSim = new Simulator(blkScenario)
    blkSim.backfill(blkScenario.backfillDays)
    const engVitals = blkSim
      .advanceTo(blkScenario.durationDays * MS_PER_DAY)
      .filter((f): f is VitalsFrame => f.kind === 'vitals' && f.crewId === 'eng')
    const hrBefore = avg(engVitals.filter((v) => v.t < 4 * MS_PER_DAY).map((v) => v.hr))
    const hrDuring = avg(
      engVitals.filter((v) => v.t >= 4 * MS_PER_DAY && v.t < 4 * MS_PER_DAY + 36 * MS_PER_HOUR).map((v) => v.hr),
    )
    expect(hrDuring - hrBefore).toBeGreaterThan(7)
  })

  it("demo_main baştan sona NaN'sız üretilir; new_crew_member backfill=3, duration=3", () => {
    const demo = getScenario('demo_main')
    expect(demo.bookmarks).toHaveLength(4)
    expect(demo.expected.length).toBeGreaterThanOrEqual(3)

    const demoSim = new Simulator(demo)
    const demoFrames = [...demoSim.backfill(demo.backfillDays), ...demoSim.advanceTo(demo.durationDays * MS_PER_DAY)]
    assertAllFiniteAndPlausible(demoFrames)

    const newbie = getScenario('new_crew_member')
    expect(newbie.backfillDays).toBe(3)
    expect(newbie.durationDays).toBe(3)
    expect(newbie.expected).toEqual([])
    const newbieSim = new Simulator(newbie)
    const newbieBack = newbieSim.backfill(newbie.backfillDays)
    expect(newbieBack.filter((f) => f.kind === 'daily')).toHaveLength(3 * 4)
    assertAllFiniteAndPlausible([
      ...newbieBack,
      ...newbieSim.advanceTo(newbie.durationDays * MS_PER_DAY),
    ])
  })

  it('performans: 30 gün × 4 kişi üretimi 2 saniyenin altında tamamlanır', () => {
    const scenario = getScenario('nominal')
    const start = performance.now()
    const sim = new Simulator(scenario)
    const back = sim.backfill(scenario.backfillDays)
    const active = sim.advanceTo(scenario.durationDays * MS_PER_DAY)
    const elapsedMs = performance.now() - start

    expect(back.length + active.length).toBeGreaterThan(20000)
    expect(elapsedMs).toBeLessThan(2000)
  })
})
