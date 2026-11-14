// Veri kalitesi ve sensör kayıp (stale) izleyici (FAZ_03 §3.1). Saf TS.
import { registry, type EvidenceRegistry } from '../evidence/registry'
import type { CrewId, MetricId, SimTimeMs, TelemetryFrame } from '../types'
import { MS_PER_DAY, RADIATION_INTERVAL_MIN, VITALS_INTERVAL_MIN, minToMs } from '../units'
import type { DataQualityEvent } from './plausibility'

export interface MetricLastSeen {
  crewId: CrewId
  metric: MetricId
  lastSeenT: SimTimeMs
}

const VITALS_STEP_MS = minToMs(VITALS_INTERVAL_MIN)
const RAD_STEP_MS = minToMs(RADIATION_INTERVAL_MIN)

function metricsInFrame(frame: TelemetryFrame): MetricId[] {
  if (frame.kind === 'vitals') {
    return frame.hrv !== undefined ? ['hr', 'spo2', 'hrv'] : ['hr', 'spo2']
  }
  if (frame.kind === 'radiation') {
    return ['rad.doseRateMsvDay']
  }
  const metrics: MetricId[] = [
    'sleep.durationH',
    'sleep.efficiency',
    'sleep.midpointShiftMin',
    'activity.exerciseMin',
    'activity.resistiveMin',
    'hydrationL',
  ]
  if (frame.cabinCo2ppm !== undefined) metrics.push('cabinCo2ppm')
  if (frame.mood) metrics.push('mood.stress', 'mood.mood', 'mood.motivation')
  if (frame.pvt) metrics.push('pvt.medianMs', 'pvt.lapses')
  return metrics
}

function expectedIntervalForMetric(metric: MetricId): number {
  if (metric === 'hr' || metric === 'spo2' || metric === 'hrv') return VITALS_STEP_MS
  if (metric === 'rad.doseRateMsvDay') return RAD_STEP_MS
  return MS_PER_DAY
}

export class DataQualityTracker {
  private readonly lastSeen = new Map<string, MetricLastSeen>()
  private readonly activeStale = new Set<string>()
  private readonly vitalsMissThreshold: number
  private readonly dailyMissThreshold: number
  private eventSeq = 0

  constructor(evidence: EvidenceRegistry = registry) {
    this.vitalsMissThreshold = evidence.getNumber('det.persist.minFrames.vitals')
    this.dailyMissThreshold = evidence.getNumber('det.persist.minFrames.daily') + 1
  }

  reset(): void {
    this.lastSeen.clear()
    this.activeStale.clear()
    this.eventSeq = 0
  }

  recordFrames(frames: readonly TelemetryFrame[]): void {
    for (const frame of frames) {
      for (const metric of metricsInFrame(frame)) {
        const key = `${frame.crewId}|${metric}`
        const prev = this.lastSeen.get(key)
        if (!prev || frame.t >= prev.lastSeenT) {
          this.lastSeen.set(key, { crewId: frame.crewId, metric, lastSeenT: frame.t })
          this.activeStale.delete(key)
        }
      }
    }
  }

  checkStale(simT: SimTimeMs): DataQualityEvent[] {
    if (simT < 0) return []
    const events: DataQualityEvent[] = []
    for (const [key, entry] of this.lastSeen) {
      const interval = expectedIntervalForMetric(entry.metric)
      const thresholdFrames = interval === MS_PER_DAY ? this.dailyMissThreshold : this.vitalsMissThreshold
      const maxGapMs = thresholdFrames * interval
      if (simT - entry.lastSeenT > maxGapMs) {
        if (!this.activeStale.has(key)) {
          this.activeStale.add(key)
          this.eventSeq += 1
          events.push({
            id: `dq-stale-${this.eventSeq}`,
            kind: 'STALE_SENSOR',
            t: simT,
            crewId: entry.crewId,
            metric: entry.metric,
            detail: `Sensor stale for ${key}: last seen at ${entry.lastSeenT}`,
          })
        }
      }
    }
    return events
  }

  getLastSeen(crewId: CrewId, metric: MetricId): SimTimeMs | undefined {
    return this.lastSeen.get(`${crewId}|${metric}`)?.lastSeenT
  }

  getStaleKeys(): string[] {
    return [...this.activeStale]
  }
}
