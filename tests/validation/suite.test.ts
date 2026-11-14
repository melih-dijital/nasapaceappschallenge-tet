// Doğrulama paketi, determinizm, duyarlılık, Zod şeması ve işçi mesajlaşması testleri (FAZ_08 §3.6).
import { describe, expect, it } from 'vitest'
import {
  clearValidationCache,
  formatValidationReportMarkdown,
  getValidationCacheSize,
  MANDATORY_LIMITATIONS,
  runScenario,
  runSensitivityAnalysis,
  runSuite,
  ValidationReportSchema,
} from '@/core/validation'
import type { WorkerToUiMessage } from '@/workers/protocol'
import { createValidationWorkerHandler } from '@/workers/validationHandler'

describe('doğrulama koşucusu ve paketi (FAZ 8)', () => {
  it('runScenario deterministiktir: aynı seed → aynı uyarı dizisi ve parmak izi', () => {
    const a = runScenario('solar_particle_event', 2)
    const b = runScenario('solar_particle_event', 2)

    expect(a.evidenceFingerprint).toBe(b.evidenceFingerprint)
    expect(
      a.alertEvents.map((e) => `${e.t}|${e.type}|${e.alert.id}|${e.alert.severity}|${e.alert.earthDelayClass}`),
    ).toEqual(
      b.alertEvents.map((e) => `${e.t}|${e.type}|${e.alert.id}|${e.alert.severity}|${e.alert.earthDelayClass}`),
    )
  })

  it('küçük paket (2 senaryo × 2 seed): Zod şeması geçer, limitations boş değildir, memo önbelleği çalışır', () => {
    clearValidationCache()
    const report = runSuite({
      scenarios: ['solar_particle_event', 'new_crew_member'],
      tuningSeeds: [1],
      reportSeeds: [100],
      includeSensitivity: false,
    })

    const parsed = ValidationReportSchema.parse(report)
    expect(parsed.scenarios).toHaveLength(2)
    expect(parsed.limitations).toEqual(MANDATORY_LIMITATIONS)
    expect(parsed.limitations.length).toBeGreaterThanOrEqual(1)
    expect((report as { generatedAtSim?: unknown }).generatedAtSim).toBeUndefined()

    const cacheAfterFirst = getValidationCacheSize()
    expect(cacheAfterFirst).toBe(4)

    const md = formatValidationReportMarkdown(parsed)
    expect(md).toContain('## Limitations (Mandatory)')
    expect(md).toContain('WARNING+ FP')
    expect(md).toContain('ADVISORY Noise')

    // İkinci aynı çağrı önbellekten gelir (yeni girdi eklenmez)
    const report2 = runSuite({
      scenarios: ['solar_particle_event', 'new_crew_member'],
      tuningSeeds: [1],
      reportSeeds: [100],
      includeSensitivity: false,
    })
    expect(getValidationCacheSize()).toBe(cacheAfterFirst)
    expect(formatValidationReportMarkdown(report2)).toBe(md)
  }, 15_000)

  it('duyarlılık analizi det.z.warning ve det.persist.minFrames.vitals için -20%/base/+20% üretir', () => {
    const rows = runSensitivityAnalysis({
      scenarios: ['new_crew_member'],
      seeds: [1],
    })
    expect(rows.map((r) => r.parameter)).toEqual(['det.z.warning', 'det.persist.minFrames.vitals'])
    for (const row of rows) {
      expect(row.points.map((p) => p.label)).toEqual(['minus', 'base', 'plus'])
    }
  }, 15_000)

  it('validation worker handler: REQUEST_VALIDATION ilerleme+sonuç yollar, CANCEL_VALIDATION iptal eder', async () => {
    clearValidationCache()
    const messages: WorkerToUiMessage[] = []
    const handler = createValidationWorkerHandler({
      postMessage: (msg) => messages.push(msg),
      yieldTurn: () => new Promise((r) => setTimeout(r, 0)),
    })

    handler.handleMessage({
      type: 'REQUEST_VALIDATION',
      scenarios: ['new_crew_member'],
      seeds: [100],
      quick: true,
    })

    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 10_000
      const poll = (): void => {
        if (messages.some((m) => m.type === 'VALIDATION_RESULT')) {
          resolve()
          return
        }
        if (Date.now() > deadline) {
          reject(new Error('VALIDATION_RESULT zaman aşımı'))
          return
        }
        setTimeout(poll, 10)
      }
      poll()
    })

    const progressMsgs = messages.filter((m) => m.type === 'VALIDATION_PROGRESS')
    const resultMsg = messages.find((m) => m.type === 'VALIDATION_RESULT')
    expect(progressMsgs.length).toBeGreaterThan(0)
    expect(resultMsg).toBeDefined()
    if (resultMsg?.type === 'VALIDATION_RESULT') {
      expect(() => ValidationReportSchema.parse(resultMsg.report)).not.toThrow()
    }

    // İptal testi
    const beforeCancelCount = messages.length
    handler.handleMessage({
      type: 'REQUEST_VALIDATION',
      scenarios: ['new_crew_member', 'solar_particle_event'],
      seeds: [100, 101],
      quick: true,
    })
    handler.handleMessage({ type: 'CANCEL_VALIDATION' })
    await new Promise((r) => setTimeout(r, 50))
    expect(handler.isRunning()).toBe(false)
    expect(messages.slice(beforeCancelCount).some((m) => m.type === 'VALIDATION_RESULT')).toBe(false)

    handler.dispose()
  }, 15_000)
})
