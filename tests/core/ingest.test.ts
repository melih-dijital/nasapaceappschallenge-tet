import { describe, expect, it } from 'vitest'
import { DataQualityTracker, IngestNormalizer, checkFrame } from '@/core/ingest'
import type { RadiationFrame, VitalsFrame } from '@/core/types'
import { MS_PER_MIN } from '@/core/units'

const validVitals = (overrides: Partial<VitalsFrame> = {}): VitalsFrame => ({
  kind: 'vitals',
  t: 0,
  crewId: 'cdr',
  hr: 65,
  spo2: 98,
  hrv: 55,
  source: 'SYNTHETIC',
  ...overrides,
})

const validRad = (overrides: Partial<RadiationFrame> = {}): RadiationFrame => ({
  kind: 'radiation',
  t: 0,
  crewId: 'cdr',
  doseRateMsvDay: 0.4,
  protonFluxPfu: 0.5,
  environment: 'MARS_TRANSIT',
  source: 'SYNTHETIC',
  ...overrides,
})

describe('Giriş doğrulaması (plausibility, normalize, dataQuality)', () => {
  it('fiziksel olarak imkânsız değerleri reddeder, garip ama mümkün değerleri kabul eder', () => {
    expect(checkFrame(validVitals({ hr: 190 })).ok).toBe(true) // garip ama mümkün
    expect(checkFrame(validVitals({ hr: 30, spo2: 70 })).ok).toBe(true) // sınırlar

    const impossibleHr = checkFrame(validVitals({ hr: 400 }))
    expect(impossibleHr.ok).toBe(false)
    expect(impossibleHr.issues[0]?.metric).toBe('hr')
    expect(impossibleHr.issues[0]?.reason).toBe('ABOVE_MAX')

    const impossibleSpo2 = checkFrame(validVitals({ spo2: 120 }))
    expect(impossibleSpo2.ok).toBe(false)
    expect(impossibleSpo2.issues[0]?.metric).toBe('spo2')

    const negativeDose = checkFrame(validRad({ doseRateMsvDay: -0.5 }))
    expect(negativeDose.ok).toBe(false)
    expect(negativeDose.issues[0]?.metric).toBe('rad.doseRateMsvDay')
  })

  it('normalizer: geçersiz şema, NaN, spo2 0-1 oran normalizasyonu, kopya ve geri zaman', () => {
    const normalizer = new IngestNormalizer()

    // 1. Geçersiz şema & NaN
    const badRes = normalizer.processBatch([{ kind: 'vitals', t: 'bad' }, validVitals({ hr: Number.NaN })], 0)
    expect(badRes.accepted).toHaveLength(0)
    expect(badRes.dataQuality).toHaveLength(2)
    expect(badRes.dataQuality.every((d) => d.kind === 'SCHEMA_INVALID')).toBe(true)

    // 2. SpO2 0-1 oranından 0-100'e normalize edilir ve kabul edilir
    const ratioRes = normalizer.processBatch([validVitals({ t: 1000, spo2: 0.97 })], 1000)
    expect(ratioRes.accepted).toHaveLength(1)
    expect((ratioRes.accepted[0] as VitalsFrame).spo2).toBe(97)

    // 3. Kopya bastırma (aynı crewId + kind + t)
    const dupRes = normalizer.processBatch([validVitals({ t: 1000 })], 1000)
    expect(dupRes.accepted).toHaveLength(0)
    expect(dupRes.dataQuality[0]?.kind).toBe('DUPLICATE_FRAME')

    // 4. Geri giden zaman damgası
    const backRes = normalizer.processBatch([validVitals({ t: 500 })], 1000)
    expect(backRes.accepted).toHaveLength(0)
    expect(backRes.dataQuality[0]?.kind).toBe('NON_MONOTONIC_TIME')

    // 5. İmkânsız değer PLAUSIBILITY_REJECTED üretir
    const plausRes = normalizer.processBatch([validVitals({ t: 2000, hr: 400 })], 2000)
    expect(plausRes.accepted).toHaveLength(0)
    expect(plausRes.dataQuality[0]?.kind).toBe('PLAUSIBILITY_REJECTED')
  })

  it('DataQualityTracker eksik karelerden sonra STALE_SENSOR üretir ve veri gelince temizler', () => {
    const tracker = new DataQualityTracker()
    tracker.recordFrames([validVitals({ t: 0 })])

    // 4 * 15 dk = 60 dk içinde stale değil
    expect(tracker.checkStale(60 * MS_PER_MIN)).toEqual([])
    // 61. dk'da stale olayı üretilir (bir kez)
    const stale1 = tracker.checkStale(61 * MS_PER_MIN)
    expect(stale1.some((e) => e.kind === 'STALE_SENSOR' && e.metric === 'hr')).toBe(true)
    expect(tracker.checkStale(75 * MS_PER_MIN)).toEqual([])

    // Yeni çerçeve gelince stale sıfırlanır
    tracker.recordFrames([validVitals({ t: 75 * MS_PER_MIN })])
    expect(tracker.getStaleKeys()).toEqual([])
  })
})
