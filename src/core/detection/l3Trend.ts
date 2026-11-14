// L3 — Trend (FAZ_05 §3.3): art arda gün kuralları, CUSUM, Theil-Sen. Saf TS.
// Kurallar DEMO; uyku kuralı AstroHealth'in "3 gün <6 sa uyku" fikrinden esinli (demo-parameters.md note).
import { getNightHrBinKey, getBinKey } from '../baseline/bins'
import { median, theilSen } from '../baseline/robustStats'
import type { ZSnapshot } from '../pipeline/stages'
import type { CrewId, DailyFrame, MetricId, Severity, SimTimeMs, TelemetryFrame } from '../types'
import { MS_PER_DAY } from '../units'
import { badDirectionZ, isVitalsCadence } from './l2Deviation'
import type { DetectionParams } from './params'

export type L3Rule = 'CONSECUTIVE' | 'CUSUM' | 'THEIL_SEN'

export interface L3Hit {
  crewId: CrewId
  metric: MetricId
  t: SimTimeMs
  rule: L3Rule
  severity: Severity
  /** Kurala özgü ayrıntı (whyKeys parametreleri). */
  detail: Record<string, number>
  /** z tabanlı kurallarda baseline güveni; mutlak kurallarda 1. */
  confidence: number
}

/** Theil-Sen ile izlenen günlük seriler: doz hızı (gün medyanı) ve istirahat HR (gece bloğu medyanı). */
type TrendSeries = 'rad.doseRateMsvDay' | 'hr'

interface DayAccumulator {
  day: number
  values: number[]
}

const dayOf = (t: SimTimeMs): number => Math.floor(t / MS_PER_DAY)

export class L3Detector {
  private readonly streaks = new Map<string, number>()
  private readonly cusum = new Map<string, { s: number; lastTriggerT: SimTimeMs }>()
  private readonly dayAcc = new Map<string, DayAccumulator>()
  private readonly dailyPoints = new Map<string, { x: number; y: number }[]>()
  private readonly params: DetectionParams

  constructor(params: DetectionParams) {
    this.params = params
  }

  /** Mutlak art arda gün kuralları (günlük çerçeve). */
  processDaily(frame: DailyFrame): L3Hit[] {
    const p = this.params.trend
    return [
      this.consecutive(frame, 'sleep.durationH', frame.sleep.durationH, p.sleepHoursBelow, p.sleepMinDays),
      this.consecutive(
        frame,
        'activity.exerciseMin',
        frame.activity.exerciseMin,
        p.exerciseMinutesBelow,
        p.exerciseMinDays,
      ),
    ].filter((h): h is L3Hit => h !== null)
  }

  private consecutive(
    frame: DailyFrame,
    metric: MetricId,
    value: number,
    below: number,
    minDays: number,
  ): L3Hit | null {
    const key = `${frame.crewId}|${metric}`
    const streak = value < below ? (this.streaks.get(key) ?? 0) + 1 : 0
    this.streaks.set(key, streak)
    if (streak < minDays) return null
    return {
      crewId: frame.crewId,
      metric,
      t: frame.t,
      rule: 'CONSECUTIVE',
      severity: 'ADVISORY',
      detail: { days: streak, value, below },
      confidence: 1,
    }
  }

  /**
   * Tek yönlü CUSUM (kötü yöndeki z üzerinde): S_t = max(0, S_{t−1} + z_t − k); S_t > h → tetik, S = 0 ve soğuma.
   * Yalnızca GÜNLÜK metriklerde: 15 dk'lık vitals'ta (günde 96 örnek) k=0.5/h=4 ile beklenen yanlış alarm aralığı
   * birkaç güne iner; vitals için kalıcılık L2'nin işidir.
   */
  processCusum(snap: ZSnapshot): L3Hit | null {
    if (isVitalsCadence(snap.metric) || snap.baselineMedian === null || !Number.isFinite(snap.z)) {
      return null
    }
    const key = `${snap.crewId}|${snap.metric}`
    const st = this.cusum.get(key) ?? { s: 0, lastTriggerT: Number.NEGATIVE_INFINITY }
    st.s = Math.max(0, st.s + badDirectionZ(snap.metric, snap.z) - this.params.cusum.k)
    let out: L3Hit | null = null
    if (st.s > this.params.cusum.h && snap.t - st.lastTriggerT >= this.params.cooldownMs) {
      out = {
        crewId: snap.crewId,
        metric: snap.metric,
        t: snap.t,
        rule: 'CUSUM',
        severity: 'ADVISORY',
        detail: { s: st.s, h: this.params.cusum.h },
        confidence: snap.confidence,
      }
      st.s = 0
      st.lastTriggerT = snap.t
    }
    this.cusum.set(key, st)
    return out
  }

  /**
   * Theil-Sen (son det.theilSen.windowDays gün): doz hızı (gün medyanı) ve istirahat HR (gece bloğu medyanı).
   * "Anlamlı pozitif eğim": eğim > 0, ardışık gün farklarının işaret tutarlılığı (aynı işaretli farklar + 1 ≥
   * det.theilSen.minSameSign) ve pencere boyu toplam artış ≥ minScale[metrik].
   * Gün kapandığında (bir sonraki günün ilk karesi gelince) değerlendirilir.
   */
  processVitalsForTrend(frame: TelemetryFrame): L3Hit[] {
    if (frame.kind === 'radiation') return this.accumulate(frame.crewId, 'rad.doseRateMsvDay', frame.t, frame.doseRateMsvDay)
    if (frame.kind === 'vitals') {
      const inNightBlock =
        getBinKey('hr', frame.t, { hrBlockHours: this.params.hrBlockHours }) === getNightHrBinKey()
      if (inNightBlock) return this.accumulate(frame.crewId, 'hr', frame.t, frame.hr)
      // Gece bloğu dışındaki kareler de gün kapanışını tetikleyebilsin.
      return this.closeDayIfNeeded(frame.crewId, 'hr', frame.t)
    }
    return []
  }

  private accumulate(crewId: CrewId, series: TrendSeries, t: SimTimeMs, value: number): L3Hit[] {
    const out = this.closeDayIfNeeded(crewId, series, t)
    const key = `${crewId}|${series}`
    const acc = this.dayAcc.get(key)
    if (acc && acc.day === dayOf(t)) acc.values.push(value)
    else this.dayAcc.set(key, { day: dayOf(t), values: [value] })
    return out
  }

  private closeDayIfNeeded(crewId: CrewId, series: TrendSeries, t: SimTimeMs): L3Hit[] {
    const key = `${crewId}|${series}`
    const acc = this.dayAcc.get(key)
    if (!acc || acc.day >= dayOf(t)) return []
    this.dayAcc.delete(key)
    const dayValue = median(acc.values)
    if (dayValue === undefined) return []

    const windowDays = Math.max(2, Math.round(this.params.trend.theilSenWindowDays))
    const points = this.dailyPoints.get(key) ?? []
    points.push({ x: acc.day, y: dayValue })
    while (points.length > windowDays) points.shift()
    this.dailyPoints.set(key, points)
    if (points.length < windowDays) return []

    const fit = theilSen(points)
    if (!fit || fit.slope <= 0) return []
    let sameSign = 1
    for (let i = 1; i < points.length; i++) {
      if (points[i]!.y - points[i - 1]!.y > 0) sameSign++
    }
    const rise = fit.slope * (points[points.length - 1]!.x - points[0]!.x)
    if (sameSign < this.params.trend.theilSenMinSameSign || rise < this.params.minScale[series]) return []

    return [
      {
        crewId,
        metric: series,
        t,
        rule: 'THEIL_SEN',
        severity: 'ADVISORY',
        detail: { slopePerDay: fit.slope, sameSign, windowDays, rise },
        confidence: 1,
      },
    ]
  }

  reset(): void {
    this.streaks.clear()
    this.cusum.clear()
    this.dayAcc.clear()
    this.dailyPoints.clear()
  }
}
