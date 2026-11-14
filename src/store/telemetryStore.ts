// Telemetri serileri (<= 600 nokta), son değerler ve veri kalitesi olayları (FAZ_03 §3.5).
import { create } from 'zustand'
import type { DataQualityEvent } from '../core/ingest'
import type { StorageWarning } from '../core/storage'
import type { CrewId, MetricId } from '../core/types'
import {
  latestKey,
  type ChartFrame,
  type EngineOutputLite,
  type EngineSnapshot,
} from '../workers/protocol'
import { decimate, type Point } from './decimate'

export const MAX_TELEMETRY_POINTS = 600
const MAX_DATA_QUALITY_LOG = 100

export interface TelemetryState {
  series: Record<string, Point[]>
  latest: Record<string, number>
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
    set((state) => ({
      dataQualityCount: output.dataQualityCount,
      recentDataQuality:
        output.dataQuality && output.dataQuality.length > 0
          ? [...state.recentDataQuality, ...output.dataQuality].slice(-MAX_DATA_QUALITY_LOG)
          : state.recentDataQuality,
      storageWarning: output.storageWarning ?? state.storageWarning,
    })),

  setStorageWarning: (storageWarning) => set({ storageWarning }),

  reset: () =>
    set({
      series: {},
      latest: {},
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
