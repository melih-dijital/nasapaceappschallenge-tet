import { describe, expect, it } from 'vitest'
import { formatIssue } from '@/core/evidence/markdown'
import { checkCalibrationMd } from '@/sim/calibrationMd'
import calibrationTemplate from '../../templates/CALIBRATION_TEMPLATE.md?raw'

const asFile = (content: string, name = 'calib-vitals-ranges.md') => ({
  path: `docs/calibration/${name}`,
  content,
})

describe('calibration:check (başlık/sütun doğrulaması)', () => {
  it('CALIBRATION_TEMPLATE.md şablonun kendisi geçerli', () => {
    expect(checkCalibrationMd(asFile(calibrationTemplate))).toEqual([])
  })

  it("front matter'da verified alanı reddedilir", () => {
    const withVerified = calibrationTemplate.replace('owner: Kişi B', 'verified: false\nowner: Kişi B')
    const issues = checkCalibrationMd(asFile(withVerified)).map(formatIssue)
    expect(issues.some((i) => i.includes("'verified' alanı YOK"))).toBe(true)
  })

  it('eski `sourceId` sütun adı reddedilir (doğrusu evidenceId)', () => {
    const oldHeader = calibrationTemplate.replace(
      '| plausibleMax | evidenceId | demo |',
      '| plausibleMax | sourceId | demo |',
    )
    const issues = checkCalibrationMd(asFile(oldHeader)).map(formatIssue)
    expect(issues[0]).toMatch(/^docs\/calibration\/calib-vitals-ranges\.md:\d+: tablo sütunları şablonla aynı olmalı/)
  })

  it('bilinmeyen metrik, sayı olmayan hücre ve demo dışı değer satır numarasıyla raporlanır', () => {
    const broken = calibrationTemplate
      .replace('| hr | bpm | 62 |', '| heartRate | bpm | 62 |')
      .replace('| spo2 | % | 97.5 |', '| spo2 | % | yüksek |')
      .replace('| 0 | 8 | — | true |', '| 0 | 8 | — | evet |')
    const messages = checkCalibrationMd(asFile(broken)).map((i) => i.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        'bilinmeyen metric "heartRate"',
        `'mean' sayı olmalı, bulundu: "yüksek"`,
        `'demo' true/false olmalı, bulundu: "evet"`,
      ]),
    )
  })
})
