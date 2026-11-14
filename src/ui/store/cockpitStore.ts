// FAZ 9 — Zustand store'ları (sessionStore, telemetryStore, alertStore, stateStore, decisionStore, earthLinkStore)
// ve EngineClient (MockEngine) bağlantısı.
// Kural (FAZ 9 §0): UI yalnızca store'lardan okur ve actions ile komut yollar.
import { create } from 'zustand'
import { getNumber } from '@/core/evidence/registry'
import {
  METRIC_META,
  SEVERITIES,
  STATE_IDS,
  type ActionCard,
  type Alert,
  type AlertEvent,
  type CrewId,
  type EarthDelayClass,
  type EarthLinkConfig,
  type EarthLinkPreset,
  type MetricId,
  type ScenarioId,
  type Severity,
  type SimTimeMs,
  type StateEstimate,
  type StateId,
} from '@/core/types'
import { MIN_PER_DAY, msToDays, VITALS_INTERVAL_MIN } from '@/core/units'
import { createEngineClient, type EngineClient } from '@/store/engineClient'
import {
  getLanguage,
  setLanguage as setI18nLanguage,
  subscribeLanguage,
  type Language,
} from '@/ui/i18n'
import { MockEngine } from '@/ui/mock/mockEngine'
import { latestKey, type ChartFrame, type WorkerToUiMessage } from '@/workers/protocol'
import {
  buildInitialVitalsSeries,
  buildSleepHistory,
  computeBoneSummary,
  CREW_PROFILES,
  getCrewProfile,
  getScenarioMeta,
  type CrewBoneSummary,
  type CrewMetricBaseline,
  type CrewRadiationSummary,
  type DailySleepEntry,
} from './crewProfiles'
import { decimate, MAX_CHART_POINTS, type SeriesPoint } from './decimate'

export type WorkerLifecycleStatus = 'IDLE' | 'READY' | 'RUNNING' | 'PAUSED' | 'ERROR'

export interface WorkerErrorInfo {
  code: string
  message: string
}

export interface SessionState {
  scenarioId: ScenarioId
  speed: number
  running: boolean
  simT: SimTimeMs
  day: number
  selectedCrewId: CrewId
  language: Language
  workerStatus: WorkerLifecycleStatus
  workerError: WorkerErrorInfo | null
}

export interface CrewConfidenceInfo {
  crewId: CrewId
  confidence: number
  learningDay: number
  targetDays: number
  isLearning: boolean
}

export interface DataQualityIssue {
  crewId: CrewId
  metric: MetricId
  fault: boolean
  stale: boolean
}

export interface TelemetryState {
  series: Record<string, SeriesPoint[]>
  latestValues: Record<string, number>
  baselines: Record<string, CrewMetricBaseline>
  crewConfidence: Record<CrewId, CrewConfidenceInfo>
  sleepHistory: Record<CrewId, DailySleepEntry[]>
  radiationSummary: Record<CrewId, CrewRadiationSummary>
  boneSummary: Record<CrewId, CrewBoneSummary>
  dataQuality: Record<string, DataQualityIssue>
  dataQualityCount: number
}

export interface AlertState {
  alerts: Alert[]
}

export interface StateStoreState {
  byCrew: Record<CrewId, Record<StateId, StateEstimate>>
}

export interface DecisionState {
  cards: ActionCard[]
}

export interface EarthLinkStoreState {
  config: EarthLinkConfig
  roundTripMin: number
  pendingReplyCount: number
  nextReplyEtaSec: number | null
}

function computeRoundTripMin(config: EarthLinkConfig): number {
  if (config.blackout) return Number.POSITIVE_INFINITY
  const groundMin = getNumber('earth.groundProcessingMin')
  return Number(((2 * config.oneWayDelaySec) / 60 + groundMin).toFixed(1))
}

function classifyEarthDelay(alert: Alert, config: EarthLinkConfig): EarthDelayClass {
  const sevIdx = SEVERITIES.indexOf(alert.severity)
  const warnIdx = SEVERITIES.indexOf('WARNING')
  if (sevIdx < warnIdx) return 'CAN_WAIT_FOR_EARTH'
  if (alert.severity === 'CRITICAL' && alert.state === 'radiation_event') return 'ACT_NOW'
  if (config.blackout) return 'ACT_NOW'
  const rtMin = computeRoundTripMin(config)
  const harmMin = alert.timeToHarmMin ?? getNumber('earth.timeToHarmMin.fatigue')
  return harmMin <= rtMin ? 'ACT_NOW' : 'ACT_THEN_REPORT'
}

function buildInitialTelemetryState(
  scenarioId: ScenarioId,
  simDay = 0,
): Omit<TelemetryState, 'dataQuality' | 'dataQualityCount'> {
  const scenario = getScenarioMeta(scenarioId)
  const targetDays = getNumber('baseline.window.days.target')
  const capThreshold = getNumber('det.confidence.cap.threshold')
  const careerLimitMsv = getNumber('rad.career.limit.msv')
  const speTargetMsv = getNumber('rad.spe.limit.msv')

  const learningDay = Math.min(targetDays, Math.max(1, scenario.backfillDays + Math.max(0, simDay)))
  const confidence = Number(Math.min(1, learningDay / targetDays).toFixed(2))
  const isLearning = confidence < capThreshold

  const series: Record<string, SeriesPoint[]> = {}
  const latestValues: Record<string, number> = {}
  const baselines: Record<string, CrewMetricBaseline> = {}
  const crewConfidence: Record<CrewId, CrewConfidenceInfo> = {}
  const sleepHistory: Record<CrewId, DailySleepEntry[]> = {}
  const radiationSummary: Record<CrewId, CrewRadiationSummary> = {}
  const boneSummary: Record<CrewId, CrewBoneSummary> = {}

  for (const crew of CREW_PROFILES) {
    crewConfidence[crew.id] = {
      crewId: crew.id,
      confidence,
      learningDay,
      targetDays,
      isLearning,
    }

    const vitalsSeries = buildInitialVitalsSeries(crew)
    for (const metric of ['hr', 'spo2', 'hrv', 'rad.doseRateMsvDay'] as const) {
      const k = latestKey(crew.id, metric)
      const pts = vitalsSeries[metric]
      series[k] = pts
      latestValues[k] = pts[pts.length - 1]?.value ?? (crew.baselines[metric]?.mean ?? 0)
    }

    const sleepEntries = buildSleepHistory(crew, simDay, scenarioId)
    sleepHistory[crew.id] = sleepEntries
    const lastSleep = sleepEntries[sleepEntries.length - 1]

    latestValues[latestKey(crew.id, 'sleep.durationH')] =
      lastSleep?.durationH ?? (crew.baselines['sleep.durationH']?.mean ?? 6.8)
    latestValues[latestKey(crew.id, 'sleep.efficiency')] =
      crew.baselines['sleep.efficiency']?.mean ?? 0.88
    latestValues[latestKey(crew.id, 'sleep.midpointShiftMin')] =
      crew.baselines['sleep.midpointShiftMin']?.mean ?? 8
    latestValues[latestKey(crew.id, 'activity.exerciseMin')] =
      lastSleep?.exerciseMin ?? (crew.baselines['activity.exerciseMin']?.mean ?? 75)
    latestValues[latestKey(crew.id, 'activity.resistiveMin')] =
      lastSleep?.resistiveMin ?? (crew.baselines['activity.resistiveMin']?.mean ?? 45)
    latestValues[latestKey(crew.id, 'hydrationL')] = crew.baselines.hydrationL?.mean ?? 2.6
    latestValues[latestKey(crew.id, 'cabinCo2ppm')] = 1150
    latestValues[latestKey(crew.id, 'mood.stress')] = crew.baselines['mood.stress']?.mean ?? 3.2
    latestValues[latestKey(crew.id, 'mood.mood')] = crew.baselines['mood.mood']?.mean ?? 7.6
    latestValues[latestKey(crew.id, 'mood.motivation')] =
      crew.baselines['mood.motivation']?.mean ?? 8.0
    latestValues[latestKey(crew.id, 'pvt.medianMs')] = 248
    latestValues[latestKey(crew.id, 'pvt.lapses')] = 1

    for (const metricId of Object.keys(METRIC_META) as MetricId[]) {
      const baseParam = crew.baselines[metricId]
      const minScaleKey = `minScale.${metricId}` as Parameters<typeof getNumber>[0]
      let minScaleVal = 1
      try {
        minScaleVal = getNumber(minScaleKey)
      } catch {
        minScaleVal = 1
      }
      const median = baseParam?.mean ?? latestValues[latestKey(crew.id, metricId)] ?? 0
      const sigma = Math.max(baseParam?.withinSd ?? minScaleVal, minScaleVal)
      baselines[latestKey(crew.id, metricId)] = {
        crewId: crew.id,
        metric: metricId,
        median,
        sigma,
        confidence,
        learningDay,
        targetDays,
      }
    }

    const baseRate = crew.baselines['rad.doseRateMsvDay']?.mean ?? 0.35
    const initialMissionDose = Number((baseRate * 0.5).toFixed(2))
    const careerMsv = Number((crew.priorCareerDoseMsv + initialMissionDose).toFixed(2))
    radiationSummary[crew.id] = {
      crewId: crew.id,
      priorCareerDoseMsv: crew.priorCareerDoseMsv,
      cumulativeMissionMsv: initialMissionDose,
      careerMsv,
      careerLimitMsv,
      careerFraction: Number((careerMsv / careerLimitMsv).toFixed(4)),
      currentRateMsvDay: latestValues[latestKey(crew.id, 'rad.doseRateMsvDay')] ?? baseRate,
      baselineRateMsvDay: baseRate,
      speState: 'IDLE',
      speDoseMsv: 0,
      speTargetMsv,
      speFractionOfLimit: 0,
    }

    boneSummary[crew.id] = computeBoneSummary(crew, simDay)
  }

  return {
    series,
    latestValues,
    baselines,
    crewConfidence,
    sleepHistory,
    radiationSummary,
    boneSummary,
  }
}

function buildInitialStates(
  scenarioId: ScenarioId,
  simT: SimTimeMs = 0,
  incoming?: StateEstimate[],
): Record<CrewId, Record<StateId, StateEstimate>> {
  const scenario = getScenarioMeta(scenarioId)
  const targetDays = getNumber('baseline.window.days.target')
  const day = Math.max(0, Math.floor(msToDays(simT)))
  const confidence = Number(Math.min(1, (scenario.backfillDays + day) / targetDays).toFixed(2))

  const result: Record<CrewId, Record<StateId, StateEstimate>> = {}
  for (const crew of CREW_PROFILES) {
    const crewMap = {} as Record<StateId, StateEstimate>
    for (const stateId of STATE_IDS) {
      const fromEngine = incoming?.find((s) => s.crewId === crew.id && s.state === stateId)
      if (fromEngine) {
        crewMap[stateId] = {
          ...fromEngine,
          confidence: Math.min(fromEngine.confidence, confidence),
        }
        continue
      }

      let baseScore = 0.14
      let primaryMetric: MetricId = 'hr'
      let primaryZ = 0.4

      switch (stateId) {
        case 'fatigue':
          baseScore = crew.id === 'cdr' && day >= 1 ? 0.48 : 0.18
          primaryMetric = 'sleep.durationH'
          primaryZ = crew.id === 'cdr' && day >= 1 ? -2.2 : -0.4
          break
        case 'stress':
          baseScore = crew.id === 'sci' && day >= 1 ? 0.44 : 0.16
          primaryMetric = 'mood.stress'
          primaryZ = crew.id === 'sci' && day >= 1 ? 1.9 : 0.3
          break
        case 'dehydration':
          baseScore = crew.id === 'md' && scenarioId === 'dehydration_co2' ? 0.56 : 0.11
          primaryMetric = 'hydrationL'
          primaryZ = -0.3
          break
        case 'sleep_debt':
          baseScore = crew.id === 'cdr' && day >= 1 ? 0.62 : 0.12
          primaryMetric = 'sleep.durationH'
          primaryZ = crew.id === 'cdr' && day >= 1 ? -3.4 : -0.3
          break
        case 'radiation_event':
          baseScore = day >= 2 && day < 2.6 ? 0.96 : 0.06
          primaryMetric = 'rad.doseRateMsvDay'
          primaryZ = day >= 2 && day < 2.6 ? 6.0 : 0.1
          break
        case 'cardio_strain':
          baseScore = crew.id === 'eng' && scenarioId === 'comm_blackout' ? 0.54 : 0.15
          primaryMetric = 'hr'
          primaryZ = 0.5
          break
        case 'mood_decline':
          baseScore = crew.id === 'sci' && day >= 1 ? 0.52 : 0.13
          primaryMetric = 'mood.mood'
          primaryZ = crew.id === 'sci' && day >= 1 ? -2.1 : -0.2
          break
      }

      crewMap[stateId] = {
        crewId: crew.id,
        t: simT,
        state: stateId,
        score: Number(baseScore.toFixed(2)),
        confidence,
        contributors: [
          {
            metric: primaryMetric,
            weight: 0.65,
            z: primaryZ,
            contribution: Number((0.65 * baseScore).toFixed(2)),
          },
        ],
      }
    }
    result[crew.id] = crewMap
  }
  return result
}

const initialScenarioId: ScenarioId = 'demo_main'
const initialTelemetry = buildInitialTelemetryState(initialScenarioId, 0)
const initialEarthConfig: EarthLinkConfig = {
  oneWayDelaySec: getScenarioMeta(initialScenarioId).defaultOneWayDelaySec,
  preset: 'MARS_MIN',
  blackout: false,
}

export const useSessionStore = create<SessionState>(() => ({
  scenarioId: initialScenarioId,
  speed: 1,
  running: false,
  simT: 0,
  day: 0,
  selectedCrewId: 'cdr',
  language: getLanguage(),
  workerStatus: 'READY',
  workerError: null,
}))

export const useTelemetryStore = create<TelemetryState>(() => ({
  ...initialTelemetry,
  dataQuality: {},
  dataQualityCount: 0,
}))

export const useAlertStore = create<AlertState>(() => ({
  alerts: [],
}))

export const useStateStore = create<StateStoreState>(() => ({
  byCrew: buildInitialStates(initialScenarioId, 0),
}))

export const useDecisionStore = create<DecisionState>(() => ({
  cards: [],
}))

export const useEarthLinkStore = create<EarthLinkStoreState>(() => ({
  config: initialEarthConfig,
  roundTripMin: computeRoundTripMin(initialEarthConfig),
  pendingReplyCount: 0,
  nextReplyEtaSec: null,
}))

// Dil değişikliklerini sessionStore ile senkron tut
subscribeLanguage(() => {
  const lang = getLanguage()
  if (useSessionStore.getState().language !== lang) {
    useSessionStore.setState({ language: lang })
  }
})

// --- Seçiciler (Selectors — FAZ 9 §3.4 & FAZ 3 §3.5) ---

/**
 * Belirli bir kişi ve metrik için son `windowMs` penceresindeki grafik noktalarını döndürür (≤ 600 nokta).
 */
export function selectSeries(
  state: TelemetryState,
  crewId: CrewId,
  metric: MetricId,
  windowMs: number,
): SeriesPoint[] {
  const pts = state.series[latestKey(crewId, metric)]
  if (!pts || pts.length === 0) return []
  const lastT = pts[pts.length - 1]!.t
  const minT = lastT - windowMs
  const windowed = pts.filter((p) => p.t >= minT)
  return decimate(windowed, MAX_CHART_POINTS)
}

export function selectLatest(
  state: TelemetryState,
  crewId: CrewId,
  metric: MetricId,
): number | undefined {
  return state.latestValues[latestKey(crewId, metric)]
}

export function selectBaseline(
  state: TelemetryState,
  crewId: CrewId,
  metric: MetricId,
): CrewMetricBaseline | undefined {
  return state.baselines[latestKey(crewId, metric)]
}

export function selectCrewConfidence(
  state: TelemetryState,
  crewId: CrewId,
): CrewConfidenceInfo {
  return (
    state.crewConfidence[crewId] ?? {
      crewId,
      confidence: 1,
      learningDay: 14,
      targetDays: 14,
      isLearning: false,
    }
  )
}

export function selectActiveAlerts(state: AlertState, crewId?: CrewId): Alert[] {
  return state.alerts.filter(
    (a) => a.status !== 'RESOLVED' && (crewId === undefined || a.crewId === crewId),
  )
}

export function selectRecentAlerts(state: AlertState, crewId?: CrewId, limit = 5): Alert[] {
  const filtered = state.alerts.filter(
    (a) => a.status !== 'RESOLVED' && (crewId === undefined || a.crewId === crewId),
  )
  const sorted = [...filtered].sort((a, b) => {
    const sevDiff = SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity)
    if (sevDiff !== 0) return sevDiff
    if (a.earthDelayClass === 'ACT_NOW' && b.earthDelayClass !== 'ACT_NOW') return -1
    if (b.earthDelayClass === 'ACT_NOW' && a.earthDelayClass !== 'ACT_NOW') return 1
    return b.lastSeenT - a.lastSeenT
  })
  return sorted.slice(0, limit)
}

export function selectHighestSeverity(state: AlertState, crewId: CrewId): Severity | null {
  const active = state.alerts.filter((a) => a.crewId === crewId && a.status === 'ACTIVE')
  if (active.length === 0) return null
  let best: Severity = active[0]!.severity
  for (const a of active) {
    if (SEVERITIES.indexOf(a.severity) > SEVERITIES.indexOf(best)) {
      best = a.severity
    }
  }
  return best
}

export function selectCrewStates(state: StateStoreState, crewId: CrewId): StateEstimate[] {
  const crewStates = state.byCrew[crewId]
  if (!crewStates) return []
  return STATE_IDS.map((id) => crewStates[id]).filter((s): s is StateEstimate => s !== undefined)
}

export function selectPriorityCards(
  state: DecisionState,
  crewId?: CrewId,
  limit = 2,
): ActionCard[] {
  const filtered = state.cards.filter(
    (c) => c.state !== 'DISMISSED' && (crewId === undefined || c.crewId === crewId),
  )
  return [...filtered].sort((a, b) => a.priority - b.priority).slice(0, limit)
}

// --- EngineClient bağlantısı ve eylemler (actions) ---

let activeClient: EngineClient | null = null
let unsubscribeClient: (() => void) | null = null

function applyFramesBatch(frames: ChartFrame[]): void {
  if (frames.length === 0) return
  useTelemetryStore.setState((prev) => {
    const nextSeries = { ...prev.series }
    const nextLatest = { ...prev.latestValues }
    const nextRad = { ...prev.radiationSummary }
    const dtDays = VITALS_INTERVAL_MIN / MIN_PER_DAY
    const speDetectRatio = getNumber('rad.spe.detect.ratio')
    const speDecayRatio = getNumber('rad.spe.decay.ratio')

    for (const f of frames) {
      const k = latestKey(f.crewId, f.metric)
      const existing = nextSeries[k] ?? []
      const lastPoint = existing[existing.length - 1]
      const baseSeries =
        lastPoint !== undefined && f.t <= lastPoint.t
          ? existing.filter((p) => p.t < f.t)
          : existing
      const appended = [...baseSeries, { t: f.t, value: Number(f.value.toFixed(3)) }]
      nextSeries[k] = appended.length > MAX_CHART_POINTS ? decimate(appended, MAX_CHART_POINTS) : appended
      nextLatest[k] = Number(f.value.toFixed(2))

      // PROJECT_MEMORY §3.8: t < 0 backfill çerçeveleri doz birikimine katılmaz
      if (f.metric === 'rad.doseRateMsvDay' && f.t >= 0) {
        const curRad = nextRad[f.crewId]
        if (curRad) {
          const addedMsv = Math.max(0, f.value * dtDays)
          const cumulativeMissionMsv = Number((curRad.cumulativeMissionMsv + addedMsv).toFixed(3))
          const careerMsv = Number((curRad.priorCareerDoseMsv + cumulativeMissionMsv).toFixed(2))
          const careerFraction = Number((careerMsv / curRad.careerLimitMsv).toFixed(4))
          const ratio = f.value / Math.max(0.05, curRad.baselineRateMsvDay)

          let speState = curRad.speState
          let speDoseMsv = curRad.speDoseMsv

          if (ratio >= speDetectRatio) {
            speState = curRad.speState === 'IDLE' ? 'SUSPECTED' : 'CONFIRMED'
            // SPE sırasında olay dozu birikimi
            speDoseMsv = Number((Math.max(curRad.speDoseMsv, 18.5) + addedMsv * 12).toFixed(2))
          } else if (
            (curRad.speState === 'CONFIRMED' || curRad.speState === 'SUSPECTED') &&
            ratio >= speDecayRatio
          ) {
            speState = 'DECAYING'
          } else if (curRad.speState === 'DECAYING' && ratio < speDecayRatio) {
            speState = 'IDLE'
          }

          const speFractionOfLimit = Number(
            Math.min(1, speDoseMsv / curRad.speTargetMsv).toFixed(4),
          )

          nextRad[f.crewId] = {
            ...curRad,
            cumulativeMissionMsv,
            careerMsv,
            careerFraction,
            currentRateMsvDay: Number(f.value.toFixed(3)),
            speState,
            speDoseMsv,
            speFractionOfLimit,
          }
        }
      }
    }

    return {
      ...prev,
      series: nextSeries,
      latestValues: nextLatest,
      radiationSummary: nextRad,
    }
  })
}

function applyAlertEvents(events: AlertEvent[]): void {
  if (events.length === 0) return
  const earthConfig = useEarthLinkStore.getState().config

  useAlertStore.setState((prev) => {
    const nextAlerts = [...prev.alerts]
    for (const ev of events) {
      const classified: Alert = {
        ...ev.alert,
        earthDelayClass: classifyEarthDelay(ev.alert, earthConfig),
      }
      const idx = nextAlerts.findIndex((a) => a.id === classified.id)
      if (idx >= 0) {
        nextAlerts[idx] = classified
      } else {
        nextAlerts.unshift(classified)
      }
    }
    return { alerts: nextAlerts }
  })

  // Kritik radyasyon uyarısı açıldıysa radyasyon özetini CONFIRMED yap
  const hasSpeAlert = events.some(
    (e) => e.alert.state === 'radiation_event' && e.alert.status === 'ACTIVE',
  )
  if (hasSpeAlert) {
    useTelemetryStore.setState((prev) => {
      const nextRad = { ...prev.radiationSummary }
      for (const crew of CREW_PROFILES) {
        const cur = nextRad[crew.id]
        if (cur) {
          const speDose = Math.max(cur.speDoseMsv, 42.5)
          nextRad[crew.id] = {
            ...cur,
            speState: 'CONFIRMED',
            speDoseMsv: speDose,
            speFractionOfLimit: Number((speDose / cur.speTargetMsv).toFixed(4)),
          }
        }
      }
      return { ...prev, radiationSummary: nextRad }
    })
  }

  // WARNING+ uyarı varsa Earth Link bekleyen yanıt sayacını güncelle
  const activeWarnOrCrit = useAlertStore
    .getState()
    .alerts.filter(
      (a) => a.status === 'ACTIVE' && (a.severity === 'WARNING' || a.severity === 'CRITICAL'),
    )
  useEarthLinkStore.setState((prev) => ({
    ...prev,
    pendingReplyCount: activeWarnOrCrit.length,
    nextReplyEtaSec:
      activeWarnOrCrit.length > 0
        ? Math.round(computeRoundTripMin(prev.config) * 60)
        : null,
  }))
}

function handleWorkerMessage(msg: WorkerToUiMessage): void {
  switch (msg.type) {
    case 'READY':
      useSessionStore.setState({ workerStatus: 'READY', workerError: null })
      return
    case 'STATUS': {
      const prevDay = useSessionStore.getState().day
      const prevScenario = useSessionStore.getState().scenarioId
      const nextDay = msg.status.day
      const nextScenario = msg.status.scenarioId

      useSessionStore.setState({
        running: msg.status.running,
        simT: msg.status.simT,
        day: nextDay,
        speed: msg.status.speed,
        scenarioId: nextScenario,
        workerStatus: msg.status.running ? 'RUNNING' : 'PAUSED',
      })

      if (nextDay !== prevDay || nextScenario !== prevScenario) {
        const scenarioMeta = getScenarioMeta(nextScenario)
        const targetDays = getNumber('baseline.window.days.target')
        const capThreshold = getNumber('det.confidence.cap.threshold')
        const learningDay = Math.min(
          targetDays,
          Math.max(1, scenarioMeta.backfillDays + Math.max(0, nextDay)),
        )
        const confidence = Number(Math.min(1, learningDay / targetDays).toFixed(2))
        const isLearning = confidence < capThreshold

        useTelemetryStore.setState((prev) => {
          const nextConf = { ...prev.crewConfidence }
          const nextSleep = { ...prev.sleepHistory }
          const nextBone = { ...prev.boneSummary }
          const nextBaselines = { ...prev.baselines }
          const nextLatest = { ...prev.latestValues }

          for (const crew of CREW_PROFILES) {
            nextConf[crew.id] = {
              crewId: crew.id,
              confidence,
              learningDay,
              targetDays,
              isLearning,
            }
            const sleepEntries = buildSleepHistory(crew, nextDay, nextScenario)
            nextSleep[crew.id] = sleepEntries
            const latestSleep = sleepEntries[sleepEntries.length - 1]
            if (latestSleep) {
              nextLatest[latestKey(crew.id, 'sleep.durationH')] = latestSleep.durationH
            }
            nextBone[crew.id] = computeBoneSummary(crew, nextDay)
          }

          for (const key of Object.keys(nextBaselines)) {
            const b = nextBaselines[key]
            if (b) {
              nextBaselines[key] = {
                ...b,
                confidence,
                learningDay,
                targetDays,
              }
            }
          }

          return {
            ...prev,
            crewConfidence: nextConf,
            sleepHistory: nextSleep,
            boneSummary: nextBone,
            baselines: nextBaselines,
            latestValues: nextLatest,
          }
        })
      }
      return
    }
    case 'FRAMES_BATCH':
      applyFramesBatch(msg.frames)
      return
    case 'ENGINE_OUTPUT': {
      const { alertEvents, states, cards, dataQualityCount, t } = msg.output
      if (alertEvents && alertEvents.length > 0) {
        applyAlertEvents(alertEvents)
      }
      if (states) {
        const scenarioId = useSessionStore.getState().scenarioId
        useStateStore.setState({
          byCrew: buildInitialStates(scenarioId, t, states),
        })
      }
      if (cards) {
        const earthConfig = useEarthLinkStore.getState().config
        const alerts = useAlertStore.getState().alerts
        useDecisionStore.setState({
          cards: cards.map((c) => {
            const srcAlert = alerts.find((a) => c.sourceAlertIds.includes(a.id))
            return srcAlert
              ? { ...c, earthDelayClass: classifyEarthDelay(srcAlert, earthConfig) }
              : c
          }),
        })
      }
      useTelemetryStore.setState((prev) => ({
        ...prev,
        dataQualityCount: Math.max(prev.dataQualityCount, dataQualityCount),
      }))
      return
    }
    case 'SNAPSHOT': {
      const { scenarioId } = useSessionStore.getState()
      const simDay = Math.max(0, Math.floor(msToDays(msg.snapshot.t)))
      const seeded = buildInitialTelemetryState(scenarioId, simDay)

      // Snapshot içindeki latest değerleri varsa birleştir
      for (const [k, v] of Object.entries(msg.snapshot.latest)) {
        seeded.latestValues[k] = Number(v.toFixed(2))
      }

      useTelemetryStore.setState((prev) => ({
        ...seeded,
        dataQuality: prev.dataQuality,
        dataQualityCount: msg.snapshot.dataQualityCount,
      }))
      useAlertStore.setState({ alerts: msg.snapshot.activeAlerts })
      useStateStore.setState({
        byCrew: buildInitialStates(scenarioId, msg.snapshot.t, msg.snapshot.states),
      })
      useDecisionStore.setState({ cards: msg.snapshot.cards })
      return
    }
    case 'ERROR':
      useSessionStore.setState({
        workerStatus: 'ERROR',
        running: false,
        workerError: { code: msg.code, message: msg.message },
      })
      return
    case 'VALIDATION_PROGRESS':
    case 'VALIDATION_RESULT':
      return
  }
}

export type EngineClientFactory = () => EngineClient

let realEngineClientFactory: EngineClientFactory | null = null

/**
 * URL sorgusunda `?mock=1` olup olmadığını denetler.
 * `?mock=1` verildiğinde gerçek EngineClient yerine her zaman `MockEngine` kullanılır.
 */
export function isMockEngineRequested(search?: string): boolean {
  const rawSearch =
    search !== undefined
      ? search
      : typeof window !== 'undefined' && typeof window.location?.search === 'string'
        ? window.location.search
        : ''
  if (!rawSearch) return false
  const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch)
  return params.get('mock') === '1'
}

/**
 * Faz 3 gerçek EngineClient fabrikasını (`src/store/engineClient.ts`) kaydeder.
 * `src/store/engineClient.ts` somut fabrika (`createEngineClient`) sunduğunda buraya bağlanır.
 */
export function registerRealEngineClientFactory(factory: EngineClientFactory | null): void {
  realEngineClientFactory = factory
}

/**
 * Varsayılan EngineClient örneğini üretir:
 * 1) `?mock=1` ise `MockEngine` döner.
 * 2) Gerçek `EngineClient` fabrikası kayıtlıysa onu çağırır.
 * 3) Aksi halde (`src/store/engineClient.ts` henüz yalnız Faz 1 arayüzüyse) `MockEngine` yedeğine düşer.
 */
export function createDefaultEngineClient(search?: string): EngineClient {
  if (isMockEngineRequested(search)) {
    return new MockEngine()
  }
  if (realEngineClientFactory) {
    return realEngineClientFactory()
  }
  try {
    return createEngineClient()
  } catch {
    return new MockEngine()
  }
}

/**
 * Store'ları verilen EngineClient'a bağlar.
 * Testlerde sahte zamanlayıcılı MockEngine veya gerçek EngineClient enjekte etmek için doğrudan çağrılabilir.
 */
export function bindEngineClient(
  client: EngineClient,
  options: { scenarioId?: ScenarioId; speed?: number } = {},
): EngineClient {
  unsubscribeClient?.()
  activeClient?.dispose()

  activeClient = client
  unsubscribeClient = client.subscribe(handleWorkerMessage)

  const scenarioId = options.scenarioId ?? useSessionStore.getState().scenarioId
  const speed = options.speed ?? useSessionStore.getState().speed
  const scenarioMeta = getScenarioMeta(scenarioId)

  const earthConfig: EarthLinkConfig = {
    oneWayDelaySec: scenarioMeta.defaultOneWayDelaySec,
    preset:
      scenarioMeta.defaultOneWayDelaySec === getNumber('earth.oneWayDelaySec.moon')
        ? 'MOON'
        : scenarioMeta.defaultOneWayDelaySec === getNumber('earth.oneWayDelaySec.mars_max')
          ? 'MARS_MAX'
          : 'MARS_MIN',
    blackout: scenarioId === 'comm_blackout',
  }

  useEarthLinkStore.setState({
    config: earthConfig,
    roundTripMin: computeRoundTripMin(earthConfig),
    pendingReplyCount: 0,
    nextReplyEtaSec: null,
  })

  useTelemetryStore.setState({
    ...buildInitialTelemetryState(scenarioId, 0),
    dataQuality: {},
    dataQualityCount: 0,
  })

  client.send({ type: 'INIT', scenarioId, speed })
  return client
}

export function getActiveEngineClient(): EngineClient {
  if (!activeClient) {
    bindEngineClient(createDefaultEngineClient())
  }
  return activeClient!
}

export const actions = {
  init(scenarioId: ScenarioId = 'demo_main', speed = 1): void {
    getActiveEngineClient().send({ type: 'INIT', scenarioId, speed })
  },

  start(): void {
    getActiveEngineClient().send({ type: 'START' })
  },

  pause(): void {
    getActiveEngineClient().send({ type: 'PAUSE' })
  },

  reset(): void {
    useTelemetryStore.setState((prev) => ({
      ...prev,
      dataQuality: {},
      dataQualityCount: 0,
    }))
    useEarthLinkStore.setState((prev) => ({
      ...prev,
      pendingReplyCount: 0,
      nextReplyEtaSec: null,
    }))
    getActiveEngineClient().send({ type: 'RESET' })
  },

  setSpeed(speedMultiplier: number): void {
    getActiveEngineClient().send({ type: 'SET_SPEED', speedMultiplier })
  },

  setScenario(id: ScenarioId): void {
    const meta = getScenarioMeta(id)
    const preset: EarthLinkPreset =
      meta.defaultOneWayDelaySec === getNumber('earth.oneWayDelaySec.moon')
        ? 'MOON'
        : meta.defaultOneWayDelaySec === getNumber('earth.oneWayDelaySec.mars_max')
          ? 'MARS_MAX'
          : 'MARS_MIN'
    const config: EarthLinkConfig = {
      oneWayDelaySec: meta.defaultOneWayDelaySec,
      preset,
      blackout: id === 'comm_blackout',
    }
    useEarthLinkStore.setState({
      config,
      roundTripMin: computeRoundTripMin(config),
      pendingReplyCount: 0,
      nextReplyEtaSec: null,
    })
    useTelemetryStore.setState({
      ...buildInitialTelemetryState(id, 0),
      dataQuality: {},
      dataQualityCount: 0,
    })
    getActiveEngineClient().send({ type: 'SET_SCENARIO', id })
  },

  seekBookmark(index: number): void {
    getActiveEngineClient().send({ type: 'SEEK_BOOKMARK', index })
  },

  selectCrew(crewId: CrewId): void {
    getCrewProfile(crewId)
    useSessionStore.setState({ selectedCrewId: crewId })
  },

  setLanguage(lang: Language): void {
    setI18nLanguage(lang)
    useSessionStore.setState({ language: lang })
  },

  ackAlert(alertId: string): void {
    getActiveEngineClient().send({ type: 'ACK_ALERT', alertId })
  },

  acceptAction(cardId: string): void {
    getActiveEngineClient().send({ type: 'ACCEPT_ACTION', cardId })
  },

  dismissAction(cardId: string): void {
    getActiveEngineClient().send({ type: 'DISMISS_ACTION', cardId })
  },

  completeAction(cardId: string): void {
    getActiveEngineClient().send({ type: 'COMPLETE_ACTION', cardId })
  },

  setEarthLinkPreset(preset: EarthLinkPreset, customDelaySec?: number): void {
    const oneWayDelaySec =
      preset === 'MOON'
        ? getNumber('earth.oneWayDelaySec.moon')
        : preset === 'MARS_MIN'
          ? getNumber('earth.oneWayDelaySec.mars_min')
          : preset === 'MARS_MAX'
            ? getNumber('earth.oneWayDelaySec.mars_max')
            : (customDelaySec ?? useEarthLinkStore.getState().config.oneWayDelaySec)

    const prevConfig = useEarthLinkStore.getState().config
    const nextConfig: EarthLinkConfig = {
      ...prevConfig,
      preset,
      oneWayDelaySec,
    }
    const roundTripMin = computeRoundTripMin(nextConfig)

    useEarthLinkStore.setState((prev) => ({
      ...prev,
      config: nextConfig,
      roundTripMin,
      nextReplyEtaSec: prev.pendingReplyCount > 0 ? Math.round(roundTripMin * 60) : null,
    }))

    // Aktif uyarıların ve kartların EarthDelayClass sınıflarını yeniden hesapla
    useAlertStore.setState((prev) => ({
      alerts: prev.alerts.map((a) => ({
        ...a,
        earthDelayClass: classifyEarthDelay(a, nextConfig),
      })),
    }))
    useDecisionStore.setState((prev) => {
      const alerts = useAlertStore.getState().alerts
      return {
        cards: prev.cards.map((c) => {
          const srcAlert = alerts.find((a) => c.sourceAlertIds.includes(a.id))
          return srcAlert
            ? { ...c, earthDelayClass: classifyEarthDelay(srcAlert, nextConfig) }
            : c
        }),
      }
    })

    getActiveEngineClient().send({ type: 'SET_EARTH_LINK', config: nextConfig })
  },

  setEarthLinkBlackout(blackout: boolean): void {
    const prevConfig = useEarthLinkStore.getState().config
    const nextConfig: EarthLinkConfig = { ...prevConfig, blackout }
    const roundTripMin = computeRoundTripMin(nextConfig)
    useEarthLinkStore.setState((prev) => ({
      ...prev,
      config: nextConfig,
      roundTripMin,
    }))
    useAlertStore.setState((prev) => ({
      alerts: prev.alerts.map((a) => ({
        ...a,
        earthDelayClass: classifyEarthDelay(a, nextConfig),
      })),
    }))
    getActiveEngineClient().send({ type: 'SET_EARTH_LINK', config: { blackout } })
  },

  /** FAZ 9 §3.5: Worker ERROR kenar durumunu tetikler / test eder. */
  triggerWorkerError(code = 'ENGINE_FAULT', message = 'Simulated telemetry worker failure'): void {
    activeClient?.dispose()
    useSessionStore.setState({
      running: false,
      workerStatus: 'ERROR',
      workerError: { code, message },
    })
  },

  /** FAZ 9 §3.5: Worker ERROR sonrasında motoru yeniden başlatır (?mock=1 ise MockEngine, değilse gerçek EngineClient). */
  restartEngine(): void {
    const { scenarioId, speed } = useSessionStore.getState()
    useSessionStore.setState({ workerError: null, workerStatus: 'READY' })
    bindEngineClient(createDefaultEngineClient(), { scenarioId, speed })
  },

  /** FAZ 9 §3.5: Veri kalitesi (sensor fault/stale) durumunu ilgili kişi+metrik karosunda açar/kapatır. */
  toggleSensorFault(crewId: CrewId, metric: MetricId): void {
    useTelemetryStore.setState((prev) => {
      const key = latestKey(crewId, metric)
      const existing = prev.dataQuality[key]
      const nextMap = { ...prev.dataQuality }
      if (existing?.fault) {
        delete nextMap[key]
      } else {
        nextMap[key] = { crewId, metric, fault: true, stale: true }
      }
      return {
        ...prev,
        dataQuality: nextMap,
        dataQualityCount: Object.keys(nextMap).length,
      }
    })
  },
}

// İlk yüklemede varsayılan EngineClient (?mock=1 ise MockEngine, değilse gerçek EngineClient / yedek) bağlanır
bindEngineClient(createDefaultEngineClient())
