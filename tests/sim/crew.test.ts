import { describe, expect, it } from 'vitest'
import { METRIC_IDS } from '@/core/types'
import { generateCrew } from '@/sim/crew'

describe('Mürettebat profilleri (generateCrew)', () => {
  it('aynı seed ile birebir aynı profilleri üretir', () => {
    expect(generateCrew(42)).toEqual(generateCrew(42))
    expect(generateCrew(42)).not.toEqual(generateCrew(43))
  })

  it("CrewId değerleri role'den sabittir (cdr, md, eng, sci)", () => {
    const crewA = generateCrew(1)
    const crewB = generateCrew(999)
    expect(crewA.map((c) => c.id)).toEqual(['cdr', 'md', 'eng', 'sci'])
    expect(crewB.map((c) => c.id)).toEqual(['cdr', 'md', 'eng', 'sci'])
    expect(crewA.map((c) => c.role)).toEqual(['CDR', 'MD', 'ENG', 'SCI'])
  })

  it('kişiler arası istirahat HR standart sapması > 0 ve tüm metrik baseline’ları tanımlıdır', () => {
    const crew = generateCrew(42)
    const hrs = crew.map((c) => c.baselines.hr?.mean ?? 0)
    const mean = hrs.reduce((a, b) => a + b, 0) / hrs.length
    const sd = Math.sqrt(hrs.reduce((a, x) => a + (x - mean) ** 2, 0) / hrs.length)
    expect(sd).toBeGreaterThan(0)

    for (const member of crew) {
      expect(member.priorCareerDoseMsv).toBeGreaterThanOrEqual(0)
      expect(member.priorCareerDoseMsv).toBeLessThanOrEqual(150)
      expect(member.circadianAmplitudeHr).toBeGreaterThanOrEqual(8)
      expect(member.circadianAmplitudeHr).toBeLessThanOrEqual(12)
      for (const metric of METRIC_IDS) {
        expect(member.baselines[metric]).toBeDefined()
      }
    }
  })
})
