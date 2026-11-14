import { describe, expect, it } from 'vitest'
import { METRIC_IDS } from '@/core/types'
import { buildCalibration, getCalibrationData, getCalibrationProvenance } from '@/sim/calibration'
import calibrationTemplate from '../../templates/CALIBRATION_TEMPLATE.md?raw'

describe('Kalibrasyon okuyucu ve DEMO varsayılanları', () => {
  it('kalibrasyon md dosyası yoksa tüm metrikler ve ortamlar DEMO (demo:true) ile döner', () => {
    const result = buildCalibration([])
    expect(result.issues).toEqual([])
    expect(result.parsedFiles).toEqual([])

    for (const metric of METRIC_IDS) {
      const prov = getCalibrationProvenance(metric, result.data)
      expect(prov.demo, metric).toBe(true)
      expect(prov.sourceFile, metric).toBeNull()
      expect(prov.evidenceId, metric).toBeNull()
      expect(prov.plausibleMin).toBeLessThan(prov.plausibleMax)
    }
    expect(result.data.environments.LEO.demo).toBe(true)
    expect(result.data.environments.MARS_TRANSIT.demo).toBe(true)
  })

  it('kalibrasyon md varsa md değerleri kullanılır, eksik metrikler DEMO kalır', () => {
    const result = buildCalibration([
      { path: 'docs/calibration/calib-vitals-ranges.md', content: calibrationTemplate },
    ])
    expect(result.issues).toEqual([])
    expect(result.parsedFiles).toEqual(['docs/calibration/calib-vitals-ranges.md'])

    // Şablonda tanımlı ve demo=false olan satır:
    const radProv = getCalibrationProvenance('rad.doseRateMsvDay', result.data)
    expect(radProv.demo).toBe(false)
    expect(radProv.evidenceId).toBe('rad.iss.rate.msv_day')
    expect(radProv.sourceFile).toBe('docs/calibration/calib-vitals-ranges.md')
    expect(result.data.metrics.hr.mean).toBe(62)
    expect(result.data.metrics.hr.demo).toBe(true)
    expect(result.data.metrics.hr.sourceFile).toBe('docs/calibration/calib-vitals-ranges.md')

    // Şablonda olmayan metrik DEMO varsayılanından gelir:
    const hrvProv = getCalibrationProvenance('hrv', result.data)
    expect(hrvProv.demo).toBe(true)
    expect(hrvProv.sourceFile).toBeNull()

    // Ortam tablosu:
    expect(result.data.environments.LEO.demo).toBe(false)
    expect(result.data.environments.LEO.evidenceId).toBe('rad.iss.rate.msv_day')
    expect(result.data.environments.MARS_TRANSIT.demo).toBe(true)
  })

  it('bilinmeyen evidenceId ve tutarsız plausibleMin/Max hata verir', () => {
    const broken = calibrationTemplate
      .replace('rad.iss.rate.msv_day | false', 'olmayan.id | false')
      .replace('| 30 | 220 |', '| 250 | 220 |')
    const result = buildCalibration([
      { path: 'docs/calibration/calib-vitals-ranges.md', content: broken },
    ])
    const msgs = result.issues.map((i) => i.message)
    expect(msgs.some((m) => m.includes('bilinmeyen evidenceId "olmayan.id"'))).toBe(true)
    expect(msgs.some((m) => m.includes('plausibleMin <= plausibleMax'))).toBe(true)
  })

  it('çalışma zamanı calibration.generated.json yüklüdür ve provenance döner', () => {
    const data = getCalibrationData()
    expect(Object.keys(data.metrics)).toHaveLength(METRIC_IDS.length)
    const hrProv = getCalibrationProvenance('hr')
    expect(hrProv.metric).toBe('hr')
    expect(typeof hrProv.demo).toBe('boolean')
  })
})
