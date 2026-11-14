import { describe, expect, it } from 'vitest'
import { EVIDENCE_IDS } from '@/core/evidence/evidenceIds.generated'
import {
  all,
  byType,
  EvidenceError,
  getEvidence,
  getMid,
  getNumber,
  getRange,
  has,
  registry,
  unverified,
} from '@/core/evidence/registry'

/** PROJECT_MEMORY §7 tablosundaki id'ler ve status'ları. */
const SEED_STATUS = {
  'rad.career.limit.msv': 'VERIFIED',
  'rad.spe.limit.msv': 'PARTIAL',
  'rad.iss.rate.msv_day': 'VERIFIED',
  'bone.loss.pct_month': 'VERIFIED',
  'rad.gcr.design.free_space': 'PARTIAL',
  'rad.gcr.design.surface': 'CONFLICTING',
  'spo2.critical': 'PARTIAL',
  'noaa.s1.proton_flux.pfu': 'UNVERIFIED',
  'hct.flight.rise.pct': 'UNVERIFIED',
} as const

describe('EvidenceRegistry', () => {
  it('seed id\'leri §7 status\'larıyla var', () => {
    for (const [id, status] of Object.entries(SEED_STATUS)) {
      expect(has(id), id).toBe(true)
      if (has(id)) expect(getEvidence(id).verificationStatus, id).toBe(status)
    }
  })

  it('getNumber tek sayı döner, aralıkta EvidenceError fırlatır', () => {
    expect(getNumber('rad.career.limit.msv')).toBe(600)
    expect(getNumber('det.z.warning')).toBe(3)
    expect(() => getNumber('rad.iss.rate.msv_day')).toThrow(EvidenceError)
    expect(() => getNumber('rad.iss.rate.msv_day')).toThrow(/getRange veya getMid/)
  })

  it('getRange aralık döner, tek sayıda hata; getMid ikisinde de çalışır', () => {
    expect(getRange('rad.iss.rate.msv_day')).toEqual([0.2, 0.5])
    expect(getRange('hct.flight.rise.pct')).toEqual([10, 12])
    expect(() => getRange('spo2.critical')).toThrow(EvidenceError)
    expect(getMid('bone.loss.pct_month')).toBe(1.25)
    expect(getMid('spo2.critical')).toBe(90)
  })

  it('bilinmeyen id açık EvidenceError verir', () => {
    expect(has('does.not.exist')).toBe(false)
    // Çalışma zamanı koruması: tip sistemi dışından gelen (ör. md'den silinmiş) id.
    expect(() => getEvidence('does.not.exist' as never)).toThrow(/Bilinmeyen evidence id "does.not.exist"/)
  })

  it('byType ve unverified', () => {
    const nasaStd = byType('NASA_STD').map((e) => e.id)
    expect(nasaStd).toEqual(
      expect.arrayContaining(['rad.career.limit.msv', 'rad.spe.limit.msv', 'rad.gcr.design.surface']),
    )
    expect(byType('NASA_STD').every((e) => e.sourceType === 'NASA_STD')).toBe(true)

    const unverifiedIds = new Set(unverified().map((e) => e.id))
    expect(unverifiedIds.has('rad.career.limit.msv')).toBe(false)
    expect(unverifiedIds.has('spo2.critical')).toBe(true)
    expect(byType('DEMO_PARAMETER').every((e) => unverifiedIds.has(e.id))).toBe(true)
    expect(byType('DEMO_PARAMETER').every((e) => e.verificationStatus === 'UNVERIFIED')).toBe(true)
  })

  it('all() id sırasıyla, üretilen id listesiyle aynı; VERIFIED kayıtların URL\'si var', () => {
    const ids = all().map((e) => e.id)
    expect(ids).toEqual([...EVIDENCE_IDS])
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    for (const entry of all().filter((e) => e.verified)) {
      expect(entry.sourceUrl, entry.id).toMatch(/^https?:\/\/\S+$/)
    }
  })

  it('registry nesnesi aynı fonksiyonları taşır (Faz 3/4 enjeksiyonu)', () => {
    expect(registry.getNumber('sim.secondsPerSimDay')).toBe(getNumber('sim.secondsPerSimDay'))
    expect(Object.keys(registry).sort()).toEqual(
      ['all', 'byType', 'getEvidence', 'getMid', 'getNumber', 'getRange', 'has', 'unverified'].sort(),
    )
  })
})
