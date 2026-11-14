import { describe, expect, it } from 'vitest'
import { registry } from '@/core/evidence/registry'
import { RadiationModule } from '@/core/modules'
import type { RadiationFrame } from '@/core/types'
import { MS_PER_MIN } from '@/core/units'

const STEP = 15 * MS_PER_MIN
const BASE = 1.3
const frame = (i: number, rate: number, proton = 0.5, crewId = 'cdr'): RadiationFrame => ({
  kind: 'radiation',
  t: i * STEP,
  crewId,
  doseRateMsvDay: rate,
  protonFluxPfu: proton,
  environment: 'MARS_TRANSIT',
  source: 'SYNTHETIC',
})
const constBaseline = () => BASE

describe('RadiationModule', () => {
  it('doz birikimi sabit hızda analitik toplamla eşleşir; kariyer = önceki + görev', () => {
    const mod = new RadiationModule({ evidence: registry, priorCareerDoseMsv: () => 100, missionDays: 30 })
    const n = 96 * 3
    mod.processBatch(
      Array.from({ length: n }, (_, i) => frame(i, BASE)),
      constBaseline,
    )
    const r = mod.reportAt('cdr', n * STEP)!
    expect(r.cumulativeMissionMsv).toBeCloseTo(BASE * 3, 10)
    expect(r.careerMsv).toBeCloseTo(100 + BASE * 3, 10)
    expect(r.careerFraction).toBeCloseTo((100 + BASE * 3) / registry.getNumber('rad.career.limit.msv'), 10)
    expect(r.projectedMissionEndMsv).toBeCloseTo(BASE * 30, 6)
    expect(r.projectedIsAssumption).toBe(false)
    expect(r.speState).toBe('IDLE')
  })

  it('görev süresi yoksa projeksiyon Evidence varsayımıyla ve işaretli', () => {
    const mod = new RadiationModule({ evidence: registry })
    mod.processBatch([frame(0, BASE)], constBaseline)
    const r = mod.reportAt('cdr', 0)!
    expect(r.projectedIsAssumption).toBe(true)
    expect(r.projectedMissionEndMsv).toBeCloseTo(
      BASE * registry.getNumber('rad.projection.defaultMissionDays'),
      6,
    )
  })

  it('durum makinesi: IDLE → SUSPECTED → CONFIRMED → DECAYING → IDLE ve olay özeti', () => {
    const mod = new RadiationModule({ evidence: registry })
    const detect = registry.getNumber('rad.spe.detect.ratio')
    const decay = registry.getNumber('rad.spe.decay.ratio')
    const minFrames = registry.getNumber('rad.spe.detect.minFrames')
    const high = BASE * (detect + 1)
    const between = BASE * ((detect + decay) / 2)
    const rates = [BASE, ...Array<number>(minFrames + 2).fill(high), between, BASE * (decay / 2)]
    mod.processBatch(
      rates.map((r, i) => frame(i, r)),
      constBaseline,
    )
    const states = rates.map((_, i) => mod.reportAt('cdr', i * STEP)!.speState)
    expect(states[0]).toBe('IDLE')
    expect(states[1]).toBe(minFrames > 1 ? 'SUSPECTED' : 'CONFIRMED')
    expect(states[minFrames]).toBe('CONFIRMED')
    expect(states.at(-2)).toBe('DECAYING')
    expect(states.at(-1)).toBe('IDLE')

    const last = mod.reportAt('cdr', rates.length * STEP)!
    expect(last.lastSpe).not.toBeNull()
    expect(last.lastSpe!.startT).toBe(STEP)
    expect(last.lastSpe!.peakRatio).toBeCloseTo(detect + 1, 10)
    expect(last.lastSpe!.fractionOfSpeLimit).toBeCloseTo(
      last.lastSpe!.doseMsv / registry.getNumber('rad.spe.limit.msv'),
      12,
    )
  })

  it('proton akısı NOAA S1 eşiğinde tek başına SUSPECTED; kısa sıçrama IDLE\'a döner (yanlış alarm yok)', () => {
    const mod = new RadiationModule({ evidence: registry })
    const s1 = registry.getNumber('noaa.s1.proton_flux.pfu')
    mod.processBatch([frame(0, BASE, s1), frame(1, BASE, 0.5)], constBaseline)
    if (registry.getNumber('rad.spe.detect.minFrames') > 1) {
      expect(mod.reportAt('cdr', 0)!.speState).toBe('SUSPECTED')
    }
    expect(mod.reportAt('cdr', STEP)!.speState).toBe('IDLE')
    expect(mod.reportAt('cdr', STEP)!.lastSpe).toBeNull()
  })

  it('L4/L1 kancaları: CONFIRMED → radiation_event score 1 (replace); SPE dozu yalnız olay sırasında', () => {
    const mod = new RadiationModule({ evidence: registry, priorCareerDoseMsv: () => 50 })
    const high = BASE * (registry.getNumber('rad.spe.detect.ratio') + 1)
    const n = registry.getNumber('rad.spe.detect.minFrames') + 1
    mod.processBatch(
      [frame(0, BASE), ...Array.from({ length: n }, (_, i) => frame(i + 1, high))],
      constBaseline,
    )
    const tIdle = 0
    const tConfirmed = n * STEP
    expect(mod.extraStateInputs('cdr', tIdle)?.radiation_event).toMatchObject({ score: 0, replace: true })
    expect(mod.extraStateInputs('cdr', tConfirmed)?.radiation_event).toMatchObject({ score: 1, replace: true })
    expect(mod.doseInputs('cdr', tIdle)).toEqual({ careerMsv: expect.any(Number) as number })
    expect(mod.doseInputs('cdr', tConfirmed)?.speDoseMsv).toBeGreaterThan(0)
    expect(mod.reportAt('cdr', tConfirmed)!.adviceKey).toBe('advice.radiation.shelter')
  })

  it('zaman damgalı geçmiş: batch içindeki her an için o anki durum; sonraki batch başında önceki son durum', () => {
    const mod = new RadiationModule({ evidence: registry })
    const high = BASE * (registry.getNumber('rad.spe.detect.ratio') + 1)
    mod.processBatch([frame(0, BASE), frame(1, high)], constBaseline)
    expect(mod.reportAt('cdr', 0)!.speState).toBe('IDLE')
    mod.processBatch([frame(2, high), frame(3, high)], constBaseline)
    // t = 2*STEP öncesi (1.5*STEP): bir önceki batch'in son durumu
    expect(mod.reportAt('cdr', 1.5 * STEP)!.currentRateMsvDay).toBe(high)
    expect(mod.reportAt('cdr', 3 * STEP)!.speState).toBe('CONFIRMED')
  })

  it('provenance: doğrulanmamış kayıt (NOAA S1 DEMO) kullanıldığı için anyUnverified', () => {
    const mod = new RadiationModule({ evidence: registry })
    const [report] = mod.processBatch([frame(0, BASE)], constBaseline)
    expect(report?.module).toBe('radiation')
    expect(report?.provenance.evidenceIds).toContain('noaa.s1.proton_flux.pfu')
    expect(report?.provenance.anyUnverified).toBe(true)
  })

  it('backfill (t < 0) kareleri doz birikimine girmez', () => {
    const mod = new RadiationModule({ evidence: registry })
    mod.processBatch([{ ...frame(0, BASE), t: -STEP }], constBaseline)
    expect(mod.reportAt('cdr', 0)).toBeNull()
  })
})
