// Radyasyon modülü (FAZ_06 §4.1): doz biriktirme, kariyer oranı, projeksiyon ve SPE durum makinesi. Saf TS.
// Tüm eşikler Evidence'tan. 250 mSv "design reference SPE protection target"tır, kişisel olay-başı limit DEĞİL.
import { median, theilSen } from '../baseline/robustStats'
import type { DoseInputs } from '../detection/l1Limits'
import type { ExtraStateInput } from '../detection/l4States'
import type { EvidenceId, EvidenceRegistry } from '../evidence/registry'
import type { CrewId, RadiationFrame, SimTimeMs, StateId } from '../types'
import { MS_PER_DAY, minToMs, msToDays, RADIATION_INTERVAL_MIN } from '../units'
import type { ModuleReport, RadiationReport, SpeState, SpeSummary } from './types'

export interface RadiationModuleOptions {
  evidence: EvidenceRegistry
  /** Kişinin görev öncesi kariyer dozu (CrewProfile.priorCareerDoseMsv); yoksa 0. */
  priorCareerDoseMsv?: (crewId: CrewId) => number | undefined
  /** Senaryonun görev süresi (gün) veya onu veren fonksiyon; yoksa `rad.projection.defaultMissionDays` (varsayım). */
  missionDays?: number | (() => number | undefined)
}

interface CrewRadState {
  cumulativeMissionMsv: number
  spe: SpeState
  /** Ardışık "olay koşulu sağlandı" kare sayısı. */
  conditionRun: number
  speStartT: SimTimeMs
  speDoseMsv: number
  peakRatio: number
  lastSpe: SpeSummary | null
  dayMedians: { day: number; rate: number }[]
  currentDay: number
  currentDayRates: number[]
  last: RadiationReport | null
  lastT: SimTimeMs
}

interface TimedEntry {
  t: SimTimeMs
  report: RadiationReport
}

const FRAME_DT_DAYS = msToDays(minToMs(RADIATION_INTERVAL_MIN))

/** Modülün kullandığı kanıt kayıtları (provenance). */
const RADIATION_EVIDENCE_IDS: EvidenceId[] = [
  'rad.career.limit.msv',
  'rad.spe.limit.msv',
  'rad.spe.detect.ratio',
  'rad.spe.detect.minFrames',
  'rad.spe.decay.ratio',
  'noaa.s1.proton_flux.pfu',
  'rad.projection.windowDays',
]

export class RadiationModule {
  readonly name = 'radiation'
  private readonly evidence: EvidenceRegistry
  private readonly priorCareer: (crewId: CrewId) => number | undefined
  private readonly missionDaysOpt: RadiationModuleOptions['missionDays']
  private readonly crews = new Map<CrewId, CrewRadState>()
  /** Bu batch'teki kare zamanlarına göre durum geçmişi (Detection adım adım okur). */
  private timeline = new Map<CrewId, TimedEntry[]>()
  /** Batch başındaki (önceki batch sonu) raporlar. */
  private batchStart = new Map<CrewId, RadiationReport | null>()

  constructor(opts: RadiationModuleOptions) {
    this.evidence = opts.evidence
    this.priorCareer = opts.priorCareerDoseMsv ?? (() => undefined)
    this.missionDaysOpt = opts.missionDays
  }

  /** Görev süresi: senaryodan; yoksa `rad.projection.defaultMissionDays` ve `isAssumption: true`. */
  private mission(): { days: number; isAssumption: boolean } {
    const v = typeof this.missionDaysOpt === 'function' ? this.missionDaysOpt() : this.missionDaysOpt
    return v !== undefined && Number.isFinite(v)
      ? { days: v, isAssumption: false }
      : { days: this.evidence.getNumber('rad.projection.defaultMissionDays'), isAssumption: true }
  }

  /** Bir batch'in radyasyon karelerini zaman sırasıyla işler; `baselineRateAt` kare öncesi baseline medyanını verir. */
  processBatch(
    frames: readonly RadiationFrame[],
    baselineRateAt: (crewId: CrewId, t: SimTimeMs) => number | null,
  ): ModuleReport[] {
    this.timeline = new Map()
    this.batchStart = new Map([...this.crews].map(([crewId, st]) => [crewId, st.last]))
    const ordered = [...frames].filter((f) => f.t >= 0).sort((a, b) => a.t - b.t)
    for (const frame of ordered) {
      const report = this.processFrame(frame, baselineRateAt(frame.crewId, frame.t))
      let entries = this.timeline.get(frame.crewId)
      if (!entries) {
        entries = []
        this.timeline.set(frame.crewId, entries)
      }
      entries.push({ t: frame.t, report })
    }
    return this.latestReports()
  }

  /** t anında (veya öncesinde) geçerli rapor: önce bu batch'in geçmişi, yoksa önceki batch'in son durumu. */
  reportAt(crewId: CrewId, t: SimTimeMs): RadiationReport | null {
    const entries = this.timeline.get(crewId)
    if (entries) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i]!.t <= t) return entries[i]!.report
      }
    }
    // Bu batch'te kare yoksa son durum; batch'in ilk karesinden önceki an için önceki batch'in son durumu.
    if (!entries) return this.crews.get(crewId)?.last ?? null
    return this.batchStart.get(crewId) ?? null
  }

  /** Faz 5 L1 doz kancası. SPE dozu yalnızca olay sürerken verilir. */
  doseInputs(crewId: CrewId, t: SimTimeMs): DoseInputs | undefined {
    const r = this.reportAt(crewId, t)
    if (!r) return undefined
    return {
      careerMsv: r.careerMsv,
      ...(r.speState !== 'IDLE' ? { speDoseMsv: r.speDoseMsv } : {}),
    }
  }

  /**
   * Faz 5 L4 kancası: `radiation_event` SPE durum makinesince belirlenir (`replace`: tek metrikli doz-hızı
   * L4 tahmininin yerini alır). CONFIRMED → score 1 (CRITICAL); SUSPECTED → WARNING düzeyi;
   * DECAYING → ADVISORY düzeyi; IDLE → 0 (uyarı yok).
   */
  extraStateInputs(crewId: CrewId, t: SimTimeMs): Partial<Record<StateId, ExtraStateInput>> | undefined {
    const r = this.reportAt(crewId, t)
    if (!r) return undefined
    const scoreFor: Record<SpeState, number> = {
      IDLE: 0,
      SUSPECTED: this.evidence.getNumber('det.state.score.warning'),
      CONFIRMED: 1,
      DECAYING: this.evidence.getNumber('det.state.score.advisory'),
    }
    const score = scoreFor[r.speState]
    return {
      radiation_event: {
        score,
        confidence: r.baselineRate === null && r.protonFluxPfu === null ? 0 : 1,
        contributors:
          score > 0
            ? [{ metric: 'rad.doseRateMsvDay', weight: 1, z: r.rateRatio ?? 0, contribution: score }]
            : [],
        replace: true,
      },
    }
  }

  latestReports(): ModuleReport[] {
    const crews = [...this.crews.keys()].sort()
    const out: ModuleReport[] = []
    for (const crewId of crews) {
      const last = this.crews.get(crewId)?.last
      if (last) out.push(this.wrap(crewId, last, this.crews.get(crewId)?.lastT ?? 0))
    }
    return out
  }

  reset(): void {
    this.crews.clear()
    this.timeline = new Map()
    this.batchStart = new Map()
  }

  private stateFor(crewId: CrewId): CrewRadState {
    let st = this.crews.get(crewId)
    if (!st) {
      st = {
        cumulativeMissionMsv: 0,
        spe: 'IDLE',
        conditionRun: 0,
        speStartT: 0,
        speDoseMsv: 0,
        peakRatio: 0,
        lastSpe: null,
        dayMedians: [],
        currentDay: Number.NaN,
        currentDayRates: [],
        last: null,
        lastT: 0,
      }
      this.crews.set(crewId, st)
    }
    return st
  }

  private processFrame(frame: RadiationFrame, baselineRate: number | null): RadiationReport {
    const ev = this.evidence
    const st = this.stateFor(frame.crewId)
    const rate = frame.doseRateMsvDay
    const doseMsv = rate * FRAME_DT_DAYS
    st.cumulativeMissionMsv += doseMsv

    // Gün medyanları (projeksiyon + "artan hız")
    const day = Math.floor(frame.t / MS_PER_DAY)
    if (day !== st.currentDay) {
      const m = median(st.currentDayRates)
      if (m !== undefined && Number.isFinite(st.currentDay)) st.dayMedians.push({ day: st.currentDay, rate: m })
      const windowDays = Math.max(1, Math.round(ev.getNumber('rad.projection.windowDays')))
      while (st.dayMedians.length > windowDays) st.dayMedians.shift()
      st.currentDay = day
      st.currentDayRates = []
    }
    st.currentDayRates.push(rate)

    // SPE durum makinesi
    const ratio = baselineRate !== null && baselineRate > 0 ? rate / baselineRate : null
    const proton = frame.protonFluxPfu ?? null
    const condition =
      (ratio !== null && ratio >= ev.getNumber('rad.spe.detect.ratio')) ||
      (proton !== null && proton >= ev.getNumber('noaa.s1.proton_flux.pfu'))
    const decayRatio = ev.getNumber('rad.spe.decay.ratio')
    const minFrames = Math.max(1, ev.getNumber('rad.spe.detect.minFrames'))
    st.conditionRun = condition ? st.conditionRun + 1 : 0

    const prev = st.spe
    if (prev === 'IDLE' && condition) {
      st.spe = st.conditionRun >= minFrames ? 'CONFIRMED' : 'SUSPECTED'
      st.speStartT = frame.t
      st.speDoseMsv = 0
      st.peakRatio = 0
    } else if (prev === 'SUSPECTED') {
      st.spe = !condition ? 'IDLE' : st.conditionRun >= minFrames ? 'CONFIRMED' : 'SUSPECTED'
    } else if (prev === 'CONFIRMED' && !condition) {
      st.spe = 'DECAYING'
    } else if (prev === 'DECAYING') {
      if (condition && st.conditionRun >= minFrames) st.spe = 'CONFIRMED'
      else if (ratio !== null && ratio < decayRatio) st.spe = 'IDLE'
    }

    const target = ev.getNumber('rad.spe.limit.msv')
    if (st.spe !== 'IDLE') {
      st.speDoseMsv += doseMsv
      if (ratio !== null) st.peakRatio = Math.max(st.peakRatio, ratio)
    } else if (prev === 'DECAYING' || (prev === 'CONFIRMED' && st.spe === 'IDLE')) {
      st.lastSpe = {
        startT: st.speStartT,
        endT: frame.t,
        peakRatio: st.peakRatio,
        doseMsv: st.speDoseMsv,
        fractionOfSpeLimit: st.speDoseMsv / target,
      }
    }
    if (prev === 'SUSPECTED' && st.spe === 'IDLE') st.speDoseMsv = 0

    // Kariyer ve projeksiyon
    const careerLimit = ev.getNumber('rad.career.limit.msv')
    const careerMsv = (this.priorCareer(frame.crewId) ?? 0) + st.cumulativeMissionMsv
    const recentRates = [...st.dayMedians.map((d) => d.rate), ...st.currentDayRates]
    const projectionRate = median(st.dayMedians.length > 0 ? st.dayMedians.map((d) => d.rate) : recentRates) ?? rate
    const mission = this.mission()
    // Kare dozu [t, t + dt) aralığını kapsar → kalan süre aralığın sonundan başlar (çift sayım yok).
    const remainingDays = Math.max(0, mission.days - msToDays(frame.t) - FRAME_DT_DAYS)
    const projectedMissionEndMsv = st.cumulativeMissionMsv + projectionRate * remainingDays
    const fit = st.dayMedians.length >= 2 ? theilSen(st.dayMedians.map((d) => ({ x: d.day, y: d.rate }))) : undefined

    const report: RadiationReport = {
      cumulativeMissionMsv: st.cumulativeMissionMsv,
      careerMsv,
      careerFraction: careerMsv / careerLimit,
      currentRateMsvDay: rate,
      baselineRate,
      rateRatio: ratio,
      protonFluxPfu: proton,
      projectedMissionEndMsv,
      projectedCareerFractionAtEnd:
        ((this.priorCareer(frame.crewId) ?? 0) + projectedMissionEndMsv) / careerLimit,
      projectedIsAssumption: mission.isAssumption,
      rateIncreasing: fit !== undefined && fit.slope > 0,
      speState: st.spe,
      speDoseMsv: st.spe === 'IDLE' ? 0 : st.speDoseMsv,
      speFractionOfLimit: (st.spe === 'IDLE' ? 0 : st.speDoseMsv) / target,
      lastSpe: st.lastSpe,
      environment: frame.environment,
      adviceKey: st.spe === 'CONFIRMED' || st.spe === 'SUSPECTED' ? 'advice.radiation.shelter' : null,
    }
    st.last = report
    st.lastT = frame.t
    return report
  }

  private wrap(crewId: CrewId, report: RadiationReport, t: SimTimeMs): ModuleReport {
    const ids = [...RADIATION_EVIDENCE_IDS]
    return {
      module: 'radiation',
      crewId,
      t,
      payload: report,
      provenance: {
        evidenceIds: ids,
        anyUnverified: ids.some((id) => !this.evidence.getEvidence(id).verified),
      },
    }
  }
}
