// UI dürüstlük düzeltmeleri: kanıt özeti doğrulama durumuna göre, uyku penceresi simüle mürettebattan,
// SPE çubuğu eşikleri Evidence'tan, radyasyon özeti motor raporundan (sahte doz yok), kemik uyumu gerçek seriden,
// davranış eğilimleri "sample data" etiketli.
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { all as allEvidence, getMid, getNumber } from '@/core/evidence/registry'
import type { ModuleReport, RadiationReport } from '@/core/modules/types'
import { extractChartFrames } from '@/core/pipeline'
import type { DailyFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'
import type { EngineClient } from '@/store/engineClient'
import {
  actions,
  bindEngineClient,
  buildSleepHistoryFromSeries,
  computeBoneSummary,
  getSimulatedSleepWindow,
  isWithinSleepWindow,
  selectSeries,
  useTelemetryStore,
} from '@/ui/store'
import type { WorkerToUiMessage } from '@/workers/protocol'

function spyClient() {
  let listener: ((m: WorkerToUiMessage) => void) | null = null
  const client: EngineClient = {
    send: () => undefined,
    subscribe: (cb) => {
      listener = cb
      return () => {
        listener = null
      }
    },
    dispose: () => undefined,
  }
  return { client, emit: (m: WorkerToUiMessage) => act(() => listener?.(m)) }
}

const navigateTo = (path: string) => window.history.pushState({}, '', path)

beforeEach(() => {
  localStorage.clear()
  actions.setLanguage('en')
})
afterEach(() => navigateTo('/'))

describe('Kanıt sayfası özeti', () => {
  it('sayım registry doğrulama durumlarından; kaynak türü "NASA standard" sayımı yok', async () => {
    navigateTo('/evidence')
    render(<App />)
    const summary = await screen.findByTestId('evidence-summary-counts')
    const by = (s: string) => allEvidence().filter((e) => e.verificationStatus === s).length
    expect(summary).toHaveTextContent(
      `${allEvidence().length} thresholds · ${by('VERIFIED')} verified · ${by('PARTIAL')} partial · ${by('CONFLICTING')} conflicting · ${by('UNVERIFIED')} unverified`,
    )
    expect(summary).not.toHaveTextContent(/NASA standard/i)
  })

  it('kalibrasyon kartı calibration:build çıktısından: docs/calibration boşken her metrik DEMO_PARAMETER', async () => {
    navigateTo('/evidence')
    render(<App />)
    const row = await screen.findByTestId('calibration-row-rad.doseRateMsvDay')
    expect(row).toHaveTextContent('DEMO_PARAMETER')
    expect(row).not.toHaveTextContent('NASA_STD')
  })
})

describe('HR grafiği uyku gölgesi', () => {
  it('pencere simüle mürettebattan (Simulator ile aynı); gece yarısını aşan pencere doğru çalışır', () => {
    const scenario = getScenario('demo_main')
    const simCrew = new Simulator(scenario).getCrew()
    for (const c of simCrew)
      expect(getSimulatedSleepWindow('demo_main', c.id)).toEqual(c.sleepWindow)

    const w = { startMin: 22 * 60 + 30, durationMin: 8 * 60 } // 22:30–06:30
    const at = (h: number, m = 0) => 2 * MS_PER_DAY + h * MS_PER_HOUR + m * MS_PER_MIN
    expect(isWithinSleepWindow(at(22, 29), w)).toBe(false)
    expect(isWithinSleepWindow(at(22, 30), w)).toBe(true)
    expect(isWithinSleepWindow(at(3), w)).toBe(true)
    expect(isWithinSleepWindow(at(6, 29), w)).toBe(true)
    expect(isWithinSleepWindow(at(6, 30), w)).toBe(false)
    expect(isWithinSleepWindow(-MS_PER_HOUR, w)).toBe(true) // backfill (t<0) 23:00
  })
})

describe('Kemik tahmini', () => {
  const series = (baseline: number, recent: number[]) => [
    ...Array.from({ length: 14 }, (_, i) => ({ t: (i - 14) * MS_PER_DAY, value: baseline })),
    ...recent.map((v, i) => ({ t: i * MS_PER_DAY, value: v })),
  ]

  it('günlük veri yokken sayı üretmez (null → "—")', () => {
    expect(computeBoneSummary('cdr', 0, undefined)).toMatchObject({
      estimatedMonthlyLossPct: null,
      estimatedCumulativeLossPct: null,
      resistiveAdherence7d: null,
      isEstimate: true,
    })
  })

  it('uyum = son behavior.windowDays gün / baseline; katsayılar Evidence (bone.loss.pct_month, bone.estimate.efficacy)', () => {
    const w = getNumber('behavior.windowDays')
    const half = computeBoneSummary('cdr', 9, series(40, Array<number>(w).fill(20)))
    expect(half.resistiveAdherence7d).toBeCloseTo(0.5, 6)
    const expected = getMid('bone.loss.pct_month') * (1 - getNumber('bone.estimate.efficacy') * 0.5)
    expect(half.estimatedMonthlyLossPct).toBe(Number(expected.toFixed(2)))
    // Uyum > 1 formülde 1'e kırpılır: kayıp (1 − efficacy) tabanının altına inmez
    const over = computeBoneSummary('cdr', 9, series(40, Array<number>(w).fill(80)))
    expect(over.estimatedMonthlyLossPct).toBe(
      Number(
        (getMid('bone.loss.pct_month') * (1 - getNumber('bone.estimate.efficacy'))).toFixed(2),
      ),
    )
  })
})

describe('Radyasyon özeti motordan', () => {
  it("ENGINE_OUTPUT.moduleReports özeti doldurur; sonraki kareler SPE dozunu UI'da büyütmez", () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    const payload: RadiationReport = {
      cumulativeMissionMsv: 4.2,
      careerMsv: 146.2,
      careerFraction: 146.2 / getNumber('rad.career.limit.msv'),
      currentRateMsvDay: 9.5,
      baselineRate: 1.3,
      rateRatio: 7.3,
      protonFluxPfu: 120,
      projectedMissionEndMsv: 12,
      projectedCareerFractionAtEnd: 0.26,
      projectedIsAssumption: false,
      rateIncreasing: true,
      speState: 'CONFIRMED',
      speDoseMsv: 0.8,
      speFractionOfLimit: 0.8 / getNumber('rad.spe.limit.msv'),
      lastSpe: null,
      environment: 'MARS_TRANSIT',
      adviceKey: 'advice.radiation.shelter',
    }
    const report: ModuleReport = {
      module: 'radiation',
      crewId: 'cdr',
      t: 3 * MS_PER_DAY,
      payload,
      provenance: { evidenceIds: [], anyUnverified: true },
    }
    spy.emit({
      type: 'ENGINE_OUTPUT',
      output: { t: report.t, dataQualityCount: 0, moduleReports: [report] },
    })
    const rad = useTelemetryStore.getState().radiationSummary.cdr!
    expect(rad).toMatchObject({
      speState: 'CONFIRMED',
      speDoseMsv: 0.8,
      careerMsv: 146.2,
      priorCareerDoseMsv: 142,
    })

    // Yüksek doz hızlı kare gelse de UI kendi SPE dozunu hesaplamaz (eski 18.5 taban / ×12 çarpan yok)
    spy.emit({
      type: 'FRAMES_BATCH',
      frames: [
        { t: report.t + 15 * MS_PER_MIN, crewId: 'cdr', metric: 'rad.doseRateMsvDay', value: 20 },
      ],
    })
    expect(useTelemetryStore.getState().radiationSummary.cdr!.speDoseMsv).toBe(0.8)
  })
})

describe('Motor baseline ile kemik uyumu; SNAPSHOT motor değerlerini ezmez', () => {
  it('ENGINE_OUTPUT.baselines (activity.resistiveMin) + günlük kare → kemik tahmini; SNAPSHOT sonrası korunur', () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    const t = 3 * MS_PER_DAY + 23 * MS_PER_HOUR + 59 * MS_PER_MIN
    spy.emit({
      type: 'FRAMES_BATCH',
      frames: [{ t, crewId: 'cdr', metric: 'activity.resistiveMin', value: 20 }],
    })
    spy.emit({
      type: 'ENGINE_OUTPUT',
      output: {
        t,
        dataQualityCount: 0,
        baselines: [
          {
            crewId: 'cdr',
            metric: 'activity.resistiveMin',
            t,
            value: 20,
            z: -2,
            confidence: 1,
            baselineMedian: 40,
            baselineSigma: 8,
          },
        ],
      },
    })
    const bone = useTelemetryStore.getState().boneSummary.cdr!
    expect(bone.resistiveAdherence7d).toBeCloseTo(0.5, 6)
    expect(bone.estimatedMonthlyLossPct).not.toBeNull()

    spy.emit({
      type: 'SNAPSHOT',
      snapshot: { t, latest: {}, activeAlerts: [], states: [], cards: [], dataQualityCount: 0 },
    })
    expect(useTelemetryStore.getState().boneSummary.cdr).toEqual(bone)
  })

  it('motor raporu gelmeden önceki kariyer dozu simüle mürettebattan, görev dozu 0', () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    const simCdr = new Simulator(getScenario('demo_main')).getCrew().find((c) => c.id === 'cdr')!
    const rad = useTelemetryStore.getState().radiationSummary.cdr!
    expect(rad.priorCareerDoseMsv).toBe(simCdr.priorCareerDoseMsv)
    expect(rad.cumulativeMissionMsv).toBe(0)
    expect(rad.speDoseMsv).toBe(0)
  })
})

describe('Uyku geçmişi motorun günlük çerçevelerinden', () => {
  const day = (d: number, value: number) => ({ t: (d + 1) * MS_PER_DAY - MS_PER_MIN, value })

  it('veri yokken boş; borç = max(0, borç·sleep.debt.decay + (baseline − süre)); son baseline.window.days.target gün', () => {
    expect(buildSleepHistoryFromSeries({})).toEqual([])
    const decay = getNumber('sleep.debt.decay')
    const sleep = [
      ...Array.from({ length: 14 }, (_, i) => day(i - 14, 7)),
      day(0, 5),
      day(1, 6),
      day(2, 8),
    ]
    const h = buildSleepHistoryFromSeries({ sleepDurationH: sleep }) // baseline = backfill medyanı = 7
    expect(h).toHaveLength(getNumber('baseline.window.days.target'))
    expect(h.map((e) => e.label).slice(-3)).toEqual(['D+00', 'D+01', 'D+02'])
    const d0 = 2
    const d1 = d0 * decay + 1
    const d2 = Math.max(0, d1 * decay - 1)
    expect(h.slice(-3).map((e) => e.debtH)).toEqual([d0, d1, d2].map((v) => Number(v.toFixed(2))))
    expect(h.every((e) => e.baselineH === 7)).toBe(true)
    // Motor baseline'ı verilirse o kullanılır
    expect(buildSleepHistoryFromSeries({ sleepDurationH: sleep }, 6).at(-1)!.baselineH).toBe(6)
  })

  it("demo_main: grafik simülatörün gerçek günlük uyku değerlerini gösterir (UI'da üretilmiş −2,1 sa yok)", () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    expect(useTelemetryStore.getState().sleepHistory.cdr).toEqual([])

    const sim = new Simulator(getScenario('demo_main'))
    const raw = [...sim.backfill(), ...sim.advanceTo(4 * MS_PER_DAY)]
    spy.emit({ type: 'FRAMES_BATCH', frames: extractChartFrames(raw) })

    const shown = useTelemetryStore.getState().sleepHistory.cdr!
    const truth = raw
      .filter((f): f is DailyFrame => f.kind === 'daily' && f.crewId === 'cdr')
      .map((f) => ({ day: f.day, durationH: Number(f.sleep.durationH.toFixed(2)) }))
      .slice(-getNumber('baseline.window.days.target'))
    expect(shown.map((e) => ({ day: e.day, durationH: e.durationH }))).toEqual(truth)
    expect(shown.at(-1)!.day).toBe(3)
    // CDR'de görev başından uyku açığı (senaryo olayı) → borç birikir
    expect(shown.at(-1)!.debtH).toBeGreaterThan(0)
  })

  it('HR grafiği: uzun geçmişte (14 g backfill + görev) son 24 saat tam çözünürlükte kalır', () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    const sim = new Simulator(getScenario('demo_main'))
    spy.emit({ type: 'FRAMES_BATCH', frames: extractChartFrames(sim.backfill()) })
    // canlı akış gibi birçok küçük batch
    for (let t = 6 * MS_PER_HOUR; t <= 3.5 * MS_PER_DAY; t += 6 * MS_PER_HOUR) {
      spy.emit({ type: 'FRAMES_BATCH', frames: extractChartFrames(sim.advanceTo(t)) })
    }
    const window = selectSeries(useTelemetryStore.getState(), 'cdr', 'hr', MS_PER_DAY)
    expect(window.length).toBeGreaterThanOrEqual(96) // 15 dk kadans × 24 sa
    expect(useTelemetryStore.getState().series['cdr|hr']!.length).toBeLessThanOrEqual(600)
  })

  it('SNAPSHOT: koşu ortası (t > 0, ör. bookmark) geçmişi korur; reset (t = 0) temizler', () => {
    const spy = spyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    const sim = new Simulator(getScenario('demo_main'))
    spy.emit({
      type: 'FRAMES_BATCH',
      frames: extractChartFrames([...sim.backfill(), ...sim.advanceTo(2 * MS_PER_DAY)]),
    })
    const before = useTelemetryStore.getState().sleepHistory.cdr!
    expect(before.length).toBeGreaterThan(0)
    const snap = (t: number) => ({
      t,
      latest: {},
      activeAlerts: [],
      states: [],
      cards: [],
      dataQualityCount: 0,
    })

    spy.emit({ type: 'SNAPSHOT', snapshot: snap(2 * MS_PER_DAY) })
    expect(useTelemetryStore.getState().sleepHistory.cdr).toEqual(before)
    spy.emit({ type: 'SNAPSHOT', snapshot: snap(0) })
    expect(useTelemetryStore.getState().sleepHistory.cdr).toEqual([])
  })
})

describe('Davranış sayfası', () => {
  it('UI\'da üretilen 14 günlük eğilim "Sample data" etiketiyle gösterilir', async () => {
    navigateTo('/behavioral')
    render(<App />)
    expect(await screen.findByTestId('behavioral-sample-data-badge')).toHaveTextContent(
      'Sample data',
    )
  })
})
