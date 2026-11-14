import { describe, expect, it } from 'vitest'
import {
  estimateState,
  estimateStates,
  evaluateDoseL1,
  evaluateL1,
  explainState,
  L2Detector,
  L3Detector,
  loadDetectionParams,
  stateSeverity,
} from '@/core/detection'
import { registry } from '@/core/evidence/registry'
import type { DailyFrame, RadiationFrame, VitalsFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { snap } from './helpers'

const params = loadDetectionParams(registry)
const vitals = (spo2: number, hr = 62): VitalsFrame => ({
  kind: 'vitals',
  t: 0,
  crewId: 'cdr',
  hr,
  spo2,
  source: 'SYNTHETIC',
})
const daily = (day: number, over: Partial<DailyFrame> = {}): DailyFrame => ({
  kind: 'daily',
  t: (day + 1) * MS_PER_DAY - MS_PER_MIN,
  crewId: 'cdr',
  day,
  sleep: { durationH: 7, efficiency: 0.9, midpointShiftMin: 0 },
  activity: { exerciseMin: 60, resistiveMin: 45 },
  hydrationL: 2.5,
  source: 'SYNTHETIC',
  ...over,
})

describe('L1 mutlak limitler (Evidence eşikleriyle)', () => {
  const threshold = registry.getNumber('spo2.critical')

  it('SpO2 eşiğin altında CRITICAL; tam eşikte değil (kural `<`)', () => {
    const below = evaluateL1(vitals(threshold - 1), { evidence: registry })
    expect(below).toHaveLength(1)
    expect(below[0]).toMatchObject({
      rule: 'SPO2_LOW',
      severity: 'CRITICAL',
      confidence: 1,
      timeToHarmMin: registry.getNumber('earth.timeToHarmMin.spo2_low'),
      evidenceVerified: registry.getEvidence('spo2.critical').verified,
    })
    expect(evaluateL1(vitals(threshold), { evidence: registry })).toEqual([])
  })

  it('kabin CO2 DEMO eşiğinde WARNING; evidenceVerified=false (NASA limiti değil)', () => {
    const co2 = registry.getNumber('limit.cabinCo2ppm.warning')
    const hits = evaluateL1(daily(0, { cabinCo2ppm: co2 }), { evidence: registry })
    expect(hits.map((h) => [h.rule, h.severity, h.evidenceVerified])).toEqual([['CO2_HIGH', 'WARNING', false]])
    expect(evaluateL1(daily(0, { cabinCo2ppm: co2 - 1 }), { evidence: registry })).toEqual([])
  })

  it('doz kancası: kariyer ve SPE oranları (Faz 6 girdi sağlayana kadar no-op)', () => {
    expect(evaluateDoseL1('cdr', 0, undefined, { evidence: registry })).toEqual([])
    const career = registry.getNumber('rad.career.limit.msv')
    const spe = registry.getNumber('rad.spe.limit.msv')
    const warn = evaluateDoseL1(
      'cdr',
      0,
      { careerMsv: career * registry.getNumber('rad.career.warn.fraction') },
      { evidence: registry },
    )
    expect(warn.map((h) => [h.rule, h.severity])).toEqual([['CAREER_DOSE', 'WARNING']])
    const crit = evaluateDoseL1(
      'cdr',
      0,
      { speDoseMsv: spe * registry.getNumber('rad.spe.critical.fraction') },
      { evidence: registry },
    )
    expect(crit.map((h) => [h.rule, h.severity, h.state])).toEqual([['SPE_DOSE', 'CRITICAL', 'radiation_event']])
  })
})

describe('L2 kişisel sapma', () => {
  const step = 15 * MS_PER_MIN
  const zWarn = params.z.warning + 0.1
  const need = params.persistFrames.vitals

  it('kalıcılık: tek karelik sıçrama alarm üretmez; ardışık kareler üretir', () => {
    const l2 = new L2Detector(params)
    expect(l2.process(snap('hr', zWarn, 0))).toBeNull()
    expect(l2.process(snap('hr', 0, step))).toBeNull()
    const hits = Array.from({ length: need }, (_, i) => l2.process(snap('hr', zWarn, (i + 2) * step)))
    expect(hits.slice(0, need - 1).every((h) => h === null)).toBe(true)
    expect(hits[need - 1]).toMatchObject({ severity: 'WARNING', persistFrames: need })
  })

  it('günlük metrikte det.persist.minFrames.daily kare yeter', () => {
    const l2 = new L2Detector(params)
    const hits = Array.from({ length: params.persistFrames.daily }, (_, d) =>
      l2.process(snap('sleep.durationH', -zWarn, d * MS_PER_DAY)),
    )
    expect(hits.at(-1)?.severity).toBe('WARNING')
  })

  it('düşük baseline güveninde severity ≤ ADVISORY ve işaretli', () => {
    const l2 = new L2Detector(params)
    const lowConf = params.confidenceCap / 2
    let hit = null
    for (let i = 0; i < need; i++) hit = l2.process(snap('hr', params.z.critical + 1, i * step, { confidence: lowConf }))
    expect(hit).toMatchObject({ severity: 'ADVISORY', lowBaselineConfidence: true })
  })

  it('yön duyarlılığı: HR düşük ve SpO2 yüksek sapma alarm üretmez; baseline yoksa z kullanılmaz', () => {
    const l2 = new L2Detector(params)
    for (let i = 0; i < need + 2; i++) {
      expect(l2.process(snap('hr', -zWarn, i * step))).toBeNull()
      expect(l2.process(snap('spo2', zWarn, i * step))).toBeNull()
      expect(l2.process(snap('hrv', -zWarn, i * step, { baseline: false }))).toBeNull()
    }
  })
})

describe('L3 trend', () => {
  it('art arda det.trend.sleep.minDays gün eşik altı uyku → CONSECUTIVE', () => {
    const l3 = new L3Detector(params)
    const below = params.trend.sleepHoursBelow - 0.5
    const results = Array.from({ length: params.trend.sleepMinDays }, (_, d) =>
      l3.processDaily(daily(d, { sleep: { durationH: below, efficiency: 0.9, midpointShiftMin: 0 } })),
    )
    expect(results.slice(0, -1).every((r) => r.length === 0)).toBe(true)
    expect(results.at(-1)?.[0]).toMatchObject({ rule: 'CONSECUTIVE', metric: 'sleep.durationH' })
    // Bir normal gece seriyi sıfırlar
    expect(l3.processDaily(daily(9))).toEqual([])
  })

  it('CUSUM küçük kalıcı kaymayı yakalar, tek sıçramayı yakalamaz', () => {
    const shift = params.cusum.k + 1
    const small = new L3Detector(params)
    let fired = -1
    for (let d = 0; d < 20 && fired < 0; d++) {
      if (small.processCusum(snap('mood.stress', shift, d * MS_PER_DAY))) fired = d
    }
    expect(fired).toBeGreaterThan(0)

    const spike = new L3Detector(params)
    expect(spike.processCusum(snap('mood.stress', params.cusum.h, 0))).toBeNull()
    for (let d = 1; d < 10; d++) expect(spike.processCusum(snap('mood.stress', 0, d * MS_PER_DAY))).toBeNull()
  })

  it('Theil-Sen: tutarlı artan doz hızı TREND üretir, düz seri üretmez', () => {
    const run = (slopePerDay: number): number => {
      const l3 = new L3Detector(params)
      let hits = 0
      for (let d = 0; d <= params.trend.theilSenWindowDays + 1; d++) {
        for (let h = 0; h < 24; h += 6) {
          const frame: RadiationFrame = {
            kind: 'radiation',
            t: d * MS_PER_DAY + h * MS_PER_HOUR,
            crewId: 'cdr',
            doseRateMsvDay: 1.3 + slopePerDay * d,
            environment: 'MARS_TRANSIT',
            source: 'SYNTHETIC',
          }
          hits += l3.processVitalsForTrend(frame).filter((x) => x.rule === 'THEIL_SEN').length
        }
      }
      return hits
    }
    expect(run(params.minScale['rad.doseRateMsvDay'])).toBeGreaterThan(0)
    expect(run(0)).toBe(0)
  })
})

describe('L4 durum çıkarımı', () => {
  const full = (zBad: number) => ({ zBad, confidence: 1 })

  it('eksik metrik: ağırlıklar yeniden normalize edilir ve güven kapsamayla düşer', () => {
    const all = estimateState(
      'dehydration',
      { crewId: 'md', t: 0, metrics: { hydrationL: full(4), hr: full(0), hrv: full(0) } },
      params,
    )
    const partial = estimateState('dehydration', { crewId: 'md', t: 0, metrics: { hydrationL: full(4) } }, params)
    expect(all && partial).toBeTruthy()
    const sumW = partial!.contributors.reduce((a, c) => a + c.weight, 0)
    expect(sumW).toBeCloseTo(1, 10)
    expect(partial!.confidence).toBeLessThan(all!.confidence)
    expect(partial!.score).toBeGreaterThan(all!.score)
    expect(estimateState('dehydration', { crewId: 'md', t: 0, metrics: {} }, params)).toBeNull()
  })

  it('durum çıkarımı tek başına CRITICAL üretmez; radiation_event üretebilir; düşük güven ≤ ADVISORY', () => {
    const maxed = estimateStates(
      {
        crewId: 'cdr',
        t: 0,
        metrics: { 'sleep.durationH': full(9), 'sleep.midpointShiftMin': full(9), 'rad.doseRateMsvDay': full(9) },
      },
      params,
    )
    const sleep = maxed.find((e) => e.state === 'sleep_debt')!
    const rad = maxed.find((e) => e.state === 'radiation_event')!
    expect(sleep.score).toBeGreaterThanOrEqual(params.state.scoreCritical)
    expect(stateSeverity(sleep, params)).toBe('WARNING')
    expect(stateSeverity(rad, params)).toBe('CRITICAL')
    expect(stateSeverity({ ...sleep, confidence: params.confidenceCap / 2 }, params)).toBe('ADVISORY')
  })

  it('katkılar sıralı; contribution = w·f; explainState i18n anahtarları üretir', () => {
    const est = estimateState(
      'fatigue',
      { crewId: 'cdr', t: 0, metrics: { 'sleep.durationH': full(4), 'pvt.lapses': full(2), hr: full(-3) } },
      params,
    )!
    const contribs = est.contributors.map((c) => c.contribution)
    expect(contribs).toEqual([...contribs].sort((a, b) => b - a))
    const top = est.contributors[0]!
    expect(top.contribution).toBeCloseTo(top.weight * Math.min(1, top.z / params.z.critical), 10)
    expect(est.contributors.find((c) => c.metric === 'hr')?.contribution).toBe(0)
    const keys = explainState(est, params).map((i) => i.key)
    expect(keys[0]).toBe('why.state.score')
    expect(keys.filter((k) => k === 'why.state.contributor')).toHaveLength(2)
  })
})
