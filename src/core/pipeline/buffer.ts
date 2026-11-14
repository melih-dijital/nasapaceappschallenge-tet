// Kişi × metrik zaman serisi halka tamponları (FAZ_03 §3.3). Saf TS.
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { ChartFrame } from '../../workers/protocol'
import type { CrewId, MetricId, SimTimeMs, TelemetryFrame } from '../types'
import { MIN_PER_HOUR, VITALS_INTERVAL_MIN } from '../units'

export interface MetricSample {
  t: SimTimeMs
  value: number
}

export const metricSeriesKey = (crewId: CrewId, metric: MetricId): string => `${crewId}|${metric}`

export function extractFrameMetrics(frame: TelemetryFrame): { metric: MetricId; value: number }[] {
  if (frame.kind === 'vitals') {
    const out: { metric: MetricId; value: number }[] = [
      { metric: 'hr', value: frame.hr },
      { metric: 'spo2', value: frame.spo2 },
    ]
    if (frame.hrv !== undefined) out.push({ metric: 'hrv', value: frame.hrv })
    return out
  }
  if (frame.kind === 'radiation') {
    return [{ metric: 'rad.doseRateMsvDay', value: frame.doseRateMsvDay }]
  }
  const out: { metric: MetricId; value: number }[] = [
    { metric: 'sleep.durationH', value: frame.sleep.durationH },
    { metric: 'sleep.efficiency', value: frame.sleep.efficiency },
    { metric: 'sleep.midpointShiftMin', value: frame.sleep.midpointShiftMin },
    { metric: 'activity.exerciseMin', value: frame.activity.exerciseMin },
    { metric: 'activity.resistiveMin', value: frame.activity.resistiveMin },
    { metric: 'hydrationL', value: frame.hydrationL },
  ]
  if (frame.cabinCo2ppm !== undefined) out.push({ metric: 'cabinCo2ppm', value: frame.cabinCo2ppm })
  if (frame.mood) {
    out.push(
      { metric: 'mood.stress', value: frame.mood.stress },
      { metric: 'mood.mood', value: frame.mood.mood },
      { metric: 'mood.motivation', value: frame.mood.motivation },
    )
  }
  if (frame.pvt) {
    out.push(
      { metric: 'pvt.medianMs', value: frame.pvt.medianMs },
      { metric: 'pvt.lapses', value: frame.pvt.lapses },
    )
  }
  return out
}

export function extractChartFrames(frames: readonly TelemetryFrame[]): ChartFrame[] {
  const out: ChartFrame[] = []
  for (const frame of frames) {
    for (const { metric, value } of extractFrameMetrics(frame)) {
      out.push({ t: frame.t, crewId: frame.crewId, metric, value })
    }
  }
  return out
}

function isDailyMetric(metric: MetricId): boolean {
  return metric !== 'hr' && metric !== 'spo2' && metric !== 'hrv' && metric !== 'rad.doseRateMsvDay'
}

export class EngineBuffers {
  private readonly vitalsCapacity: number
  private readonly dailyCapacity: number
  private readonly series = new Map<string, MetricSample[]>()
  private readonly latest: Record<string, number> = {}

  constructor(evidence: EvidenceRegistry = registry) {
    const vitalsHours = evidence.getNumber('buffer.vitals.hours')
    const dailyDays = evidence.getNumber('buffer.daily.days')
    this.vitalsCapacity = Math.max(1, Math.round((vitalsHours * MIN_PER_HOUR) / VITALS_INTERVAL_MIN))
    this.dailyCapacity = Math.max(1, Math.round(dailyDays))
  }

  pushFrames(frames: readonly TelemetryFrame[]): void {
    for (const frame of frames) {
      for (const { metric, value } of extractFrameMetrics(frame)) {
        const key = metricSeriesKey(frame.crewId, metric)
        let arr = this.series.get(key)
        if (!arr) {
          arr = []
          this.series.set(key, arr)
        }
        arr.push({ t: frame.t, value })
        const cap = isDailyMetric(metric) ? this.dailyCapacity : this.vitalsCapacity
        if (arr.length > cap) {
          arr.splice(0, arr.length - cap)
        }
        this.latest[key] = value
      }
    }
  }

  getSeries(crewId: CrewId, metric: MetricId): readonly MetricSample[] {
    return this.series.get(metricSeriesKey(crewId, metric)) ?? []
  }

  getLatestSnapshot(): Record<string, number> {
    return { ...this.latest }
  }

  clear(): void {
    this.series.clear()
    for (const key of Object.keys(this.latest)) {
      delete this.latest[key]
    }
  }
}
