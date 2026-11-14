// Telemetri serileri (<= 600 nokta), son değerler, baseline bantları ve veri kalitesi olayları (FAZ_03 §3.5, FAZ_04 §3.4).
import { create } from 'zustand'
import { registry } from '../core/evidence/registry'
import type { DataQualityEvent } from '../core/ingest'
import type { ZSnapshot } from '../core/pipeline'
import type { StorageWarning } from '../core/storage'
import type { CrewId, MetricId, SimTimeMs } from '../core/types'
import {
  latestKey,
  type ChartFrame,
  type EngineOutputLite,
  type EngineSnapshot,
} from '../workers/protocol'
import { decimate, type Point } from './decimate'

export const MAX_TELEMETRY_POINTS = 600
const MAX_DATA_QUALITY_LOG = 100

export interface BaselineBandPoint {
  t: SimTimeMs
  median: number
  sigma: number
  bandLow: number
  bandHigh: number
  confidence: number
}

function downsampleBands(points: readonly BaselineBandPoint[], maxPoints: number): BaselineBandPoint[] {
  if (points.length <= maxPoints) return [...points]
  if (maxPoints <= 2) return [points[0]!, points[points.length - 1]!]
  const out: BaselineBandPoint[] = [points[0]!]
  const step = (points.length - 1) / (maxPoints - 1)
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)]!)
  }
  out.push(points[points.length - 1]!)
  return out
}

export interface TelemetryState {
  series: Record<string, Point[]>
  latest: Record<string, number>
  latestBaselines: Record<string, ZSnapshot>
  baselineBands: Record<string, BaselineBandPoint[]>
  dataQualityCount: number
  recentDataQuality: DataQualityEvent[]
  storageWarning: StorageWarning | null

  applyFramesBatch: (frames: readonly ChartFrame[]) => void
  applySnapshot: (snapshot: EngineSnapshot) => void
  applyOutput: (output: EngineOutputLite) => void
  setStorageWarning: (warning: StorageWarning | null) => void
  reset: () => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  series: {},
  latest: {},
  latestBaselines: {},
  baselineBands: {},
  dataQualityCount: 0,
  recentDataQuality: [],
  storageWarning: null,

  applyFramesBatch: (frames) => {
    if (frames.length === 0) return
    set((state) => {
      const nextSeries = { ...state.series }
      const nextLatest = { ...state.latest }
      const touchedKeys = new Set<string>()

      for (const frame of frames) {
        const key = latestKey(frame.crewId, frame.metric)
        if (!touchedKeys.has(key)) {
          nextSeries[key] = [...(nextSeries[key] ?? [])]
          touchedKeys.add(key)
        }
        nextSeries[key]!.push({ t: frame.t, value: frame.value })
        nextLatest[key] = frame.value
      }

      for (const key of touchedKeys) {
        const arr = nextSeries[key]
        if (arr && arr.length > MAX_TELEMETRY_POINTS) {
          nextSeries[key] = decimate(arr, MAX_TELEMETRY_POINTS)
        }
      }

      return { series: nextSeries, latest: nextLatest }
    })
  },

  applySnapshot: (snapshot) =>
    set({
      latest: { ...snapshot.latest },
      dataQualityCount: snapshot.dataQualityCount,
    }),

  applyOutput: (output) =>
    set((state) => {
      let nextLatestBaselines = state.latestBaselines
      let nextBands = state.baselineBands

      if (output.baselines && output.baselines.length > 0) {
        const warningZ = registry.getNumber('det.z.warning')
        nextLatestBaselines = { ...state.latestBaselines }
        nextBands = { ...state.baselineBands }
        const touchedBands = new Set<string>()

        for (const snap of output.baselines) {
          const key = latestKey(snap.crewId, snap.metric)
          nextLatestBaselines[key] = snap
          if (snap.baselineMedian !== null && snap.baselineSigma !== null) {
            if (!touchedBands.has(key)) {
              nextBands[key] = [...(nextBands[key] ?? [])]
              touchedBands.add(key)
            }
            const halfWidth = warningZ * snap.baselineSigma
            nextBands[key]!.push({
              t: snap.t,
              median: snap.baselineMedian,
              sigma: snap.baselineSigma,
              bandLow: snap.baselineMedian - halfWidth,
              bandHigh: snap.baselineMedian + halfWidth,
              confidence: snap.confidence,
            })
          }
        }

        for (const key of touchedBands) {
          const arr = nextBands[key]
          if (arr && arr.length > MAX_TELEMETRY_POINTS) {
            nextBands[key] = downsampleBands(arr, MAX_TELEMETRY_POINTS)
          }
        }
      }

      return {
        latestBaselines: nextLatestBaselines,
        baselineBands: nextBands,
        dataQualityCount: output.dataQualityCount,
        recentDataQuality:
          output.dataQuality && output.dataQuality.length > 0
            ? [...state.recentDataQuality, ...output.dataQuality].slice(-MAX_DATA_QUALITY_LOG)
            : state.recentDataQuality,
        storageWarning: output.storageWarning ?? state.storageWarning,
      }
    }),

  setStorageWarning: (storageWarning) => set({ storageWarning }),

  reset: () =>
    set({
      series: {},
      latest: {},
      latestBaselines: {},
      baselineBands: {},
      dataQualityCount: 0,
      recentDataQuality: [],
      storageWarning: null,
    }),
}))

export const selectLatest = (
  state: Pick<TelemetryState, 'latest'>,
  crewId: CrewId,
  metric: MetricId,
): number | undefined => state.latest[latestKey(crewId, metric)]

export const selectSeries = (
  state: Pick<TelemetryState, 'series'>,
  crewId: CrewId,
  metric: MetricId,
): readonly Point[] => state.series[latestKey(crewId, metric)] ?? []

export const selectLatestBaseline = (
  state: Pick<TelemetryState, 'latestBaselines'>,
  crewId: CrewId,
  metric: MetricId,
): ZSnapshot | undefined => state.latestBaselines[latestKey(crewId, metric)]

export const selectBaselineBand = (
  state: Pick<TelemetryState, 'baselineBands'>,
  crewId: CrewId,
  metric: MetricId,
): readonly BaselineBandPoint[] => state.baselineBands[latestKey(crewId, metric)] ?? []
