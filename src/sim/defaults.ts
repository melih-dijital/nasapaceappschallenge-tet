// Kalibrasyon .md dosyaları yoksa/eksikse kullanılan DEMO varsayılanları (FAZ_02 §3.3).
// Tüm değerler DEMO_PARAMETER ve UNVERIFIED'dir; gerçek uçuş/klinik veri değildir.
import type { Environment, MetricId } from '../core/types'

export interface MetricCalibration {
  metric: MetricId
  unit: string
  mean: number
  betweenSd: number
  withinSd: number
  plausibleMin: number
  plausibleMax: number
  evidenceId: string | null
  demo: boolean
  sourceFile: string | null
}

export interface EnvironmentCalibration {
  environment: Environment
  doseRateMsvDayMean: number
  evidenceId: string | null
  demo: boolean
  sourceFile: string | null
}

// DEMO_PARAMETER — 16 metriğin tamamı için sentetik üretim aralığı ve yayılımı.
export const DEFAULT_METRIC_CALIBRATIONS: Record<MetricId, MetricCalibration> = {
  hr: {
    metric: 'hr',
    unit: 'bpm',
    mean: 64, // DEMO_PARAMETER
    betweenSd: 6, // DEMO_PARAMETER
    withinSd: 3.5, // DEMO_PARAMETER
    plausibleMin: 30, // DEMO_PARAMETER
    plausibleMax: 220, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  spo2: {
    metric: 'spo2',
    unit: '%',
    mean: 97.6, // DEMO_PARAMETER
    betweenSd: 0.4, // DEMO_PARAMETER
    withinSd: 0.5, // DEMO_PARAMETER
    plausibleMin: 70, // DEMO_PARAMETER
    plausibleMax: 100, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  hrv: {
    metric: 'hrv',
    unit: 'ms',
    mean: 54, // DEMO_PARAMETER
    betweenSd: 9, // DEMO_PARAMETER
    withinSd: 5, // DEMO_PARAMETER
    plausibleMin: 10, // DEMO_PARAMETER
    plausibleMax: 180, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'sleep.durationH': {
    metric: 'sleep.durationH',
    unit: 'h',
    mean: 6.8, // DEMO_PARAMETER
    betweenSd: 0.45, // DEMO_PARAMETER
    withinSd: 0.5, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 14, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'sleep.efficiency': {
    metric: 'sleep.efficiency',
    unit: 'ratio',
    mean: 0.87, // DEMO_PARAMETER
    betweenSd: 0.03, // DEMO_PARAMETER
    withinSd: 0.04, // DEMO_PARAMETER
    plausibleMin: 0.2, // DEMO_PARAMETER
    plausibleMax: 1.0, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'sleep.midpointShiftMin': {
    metric: 'sleep.midpointShiftMin',
    unit: 'min',
    mean: 0, // DEMO_PARAMETER
    betweenSd: 10, // DEMO_PARAMETER
    withinSd: 14, // DEMO_PARAMETER
    plausibleMin: -360, // DEMO_PARAMETER
    plausibleMax: 360, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'activity.exerciseMin': {
    metric: 'activity.exerciseMin',
    unit: 'min',
    mean: 60, // DEMO_PARAMETER
    betweenSd: 10, // DEMO_PARAMETER
    withinSd: 10, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 240, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'activity.resistiveMin': {
    metric: 'activity.resistiveMin',
    unit: 'min',
    mean: 35, // DEMO_PARAMETER
    betweenSd: 7, // DEMO_PARAMETER
    withinSd: 8, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 180, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  hydrationL: {
    metric: 'hydrationL',
    unit: 'L',
    mean: 2.5, // DEMO_PARAMETER
    betweenSd: 0.25, // DEMO_PARAMETER
    withinSd: 0.25, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 8, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  cabinCo2ppm: {
    metric: 'cabinCo2ppm',
    unit: 'ppm',
    mean: 2100, // DEMO_PARAMETER
    betweenSd: 40, // DEMO_PARAMETER
    withinSd: 100, // DEMO_PARAMETER
    plausibleMin: 350, // DEMO_PARAMETER
    plausibleMax: 10000, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'mood.stress': {
    metric: 'mood.stress',
    unit: 'score',
    mean: 3.0, // DEMO_PARAMETER
    betweenSd: 0.5, // DEMO_PARAMETER
    withinSd: 0.6, // DEMO_PARAMETER
    plausibleMin: 1, // DEMO_PARAMETER
    plausibleMax: 10, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'mood.mood': {
    metric: 'mood.mood',
    unit: 'score',
    mean: 7.2, // DEMO_PARAMETER
    betweenSd: 0.5, // DEMO_PARAMETER
    withinSd: 0.6, // DEMO_PARAMETER
    plausibleMin: 1, // DEMO_PARAMETER
    plausibleMax: 10, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'mood.motivation': {
    metric: 'mood.motivation',
    unit: 'score',
    mean: 7.4, // DEMO_PARAMETER
    betweenSd: 0.5, // DEMO_PARAMETER
    withinSd: 0.6, // DEMO_PARAMETER
    plausibleMin: 1, // DEMO_PARAMETER
    plausibleMax: 10, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'pvt.medianMs': {
    metric: 'pvt.medianMs',
    unit: 'ms',
    mean: 250, // DEMO_PARAMETER
    betweenSd: 16, // DEMO_PARAMETER
    withinSd: 14, // DEMO_PARAMETER
    plausibleMin: 150, // DEMO_PARAMETER
    plausibleMax: 1000, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'pvt.lapses': {
    metric: 'pvt.lapses',
    unit: 'count',
    mean: 0.8, // DEMO_PARAMETER
    betweenSd: 0.4, // DEMO_PARAMETER
    withinSd: 0.7, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 30, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  'rad.doseRateMsvDay': {
    metric: 'rad.doseRateMsvDay',
    unit: 'mSv/day',
    mean: 0.35, // DEMO_PARAMETER
    betweenSd: 0.02, // DEMO_PARAMETER
    withinSd: 0.03, // DEMO_PARAMETER
    plausibleMin: 0, // DEMO_PARAMETER
    plausibleMax: 50, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
}

// DEMO_PARAMETER — Ortam radyasyon ortalamaları.
export const DEFAULT_ENVIRONMENT_CALIBRATIONS: Record<Environment, EnvironmentCalibration> = {
  LEO: {
    environment: 'LEO',
    doseRateMsvDayMean: 0.35, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  MARS_TRANSIT: {
    environment: 'MARS_TRANSIT',
    doseRateMsvDayMean: 1.0, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  LUNAR_ORBIT: {
    environment: 'LUNAR_ORBIT',
    doseRateMsvDayMean: 0.8, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  LUNAR_SURFACE: {
    environment: 'LUNAR_SURFACE',
    doseRateMsvDayMean: 0.6, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
  MARS_SURFACE: {
    environment: 'MARS_SURFACE',
    doseRateMsvDayMean: 0.85, // DEMO_PARAMETER
    evidenceId: null,
    demo: true,
    sourceFile: null,
  },
}

// DEMO_PARAMETER — Mürettebat profil üretimi ve fizyolojik eşleştirme sabitleri.
export const SIM_DEMO_DEFAULTS = {
  priorCareerDoseMsvMin: 15, // DEMO_PARAMETER
  priorCareerDoseMsvMax: 135, // DEMO_PARAMETER
  circadianAmplitudeHrMin: 8, // DEMO_PARAMETER
  circadianAmplitudeHrMax: 12, // DEMO_PARAMETER
  defaultSleepStartMin: 22 * 60 + 30, // DEMO_PARAMETER (22:30)
  sleepStartJitterMin: 30, // DEMO_PARAMETER
  defaultSleepWindowDurationMin: 450, // DEMO_PARAMETER (7.5 h planlı uyku penceresi)
  exerciseWindowDurationMin: 30, // DEMO_PARAMETER (günlük kısa egzersiz zirvesi < 4 frame)
  exerciseHrBoostBpm: 18, // DEMO_PARAMETER
  vitalsAr1Phi: 0.7, // DEMO_PARAMETER
  dailyAr1Phi: 0.45, // DEMO_PARAMETER
  co2CabinPhi: 0.55, // DEMO_PARAMETER
  hrvInverseHrSlope: 0.65, // DEMO_PARAMETER
  dehydrationHrPerLiter: 5, // DEMO_PARAMETER
  sleepDebtDecayDaily: 0.75, // DEMO_PARAMETER
  sleepDebtToPvtMsPerH: 14, // DEMO_PARAMETER
  sleepDebtToLapsesPerH: 0.8, // DEMO_PARAMETER
  sleepDebtToEfficiencyPerH: 0.02, // DEMO_PARAMETER
  sleepDebtToMotivationPerH: 0.25, // DEMO_PARAMETER
  sleepDebtToStressPerH: 0.2, // DEMO_PARAMETER
  backgroundProtonFluxPfu: 0.4, // DEMO_PARAMETER
  backgroundProtonFluxSd: 0.12, // DEMO_PARAMETER
  minProtonFluxPfu: 0.05, // DEMO_PARAMETER
} as const
