export const METRIC_IDS = [
  'hr',
  'spo2',
  'hrv',
  'sleep.durationH',
  'sleep.efficiency',
  'sleep.midpointShiftMin',
  'activity.exerciseMin',
  'activity.resistiveMin',
  'hydrationL',
  'cabinCo2ppm',
  'mood.stress',
  'mood.mood',
  'mood.motivation',
  'pvt.medianMs',
  'pvt.lapses',
  'rad.doseRateMsvDay',
] as const

export type MetricId = (typeof METRIC_IDS)[number]

export type MetricDirection = 'higher_worse' | 'lower_worse' | 'both'
export type FrameKind = 'vitals' | 'daily' | 'radiation'

export interface MetricMeta {
  unit: string
  labelKey: string
  direction: MetricDirection
  frameKind: FrameKind
}

export const METRIC_META: Record<MetricId, MetricMeta> = {
  hr: { unit: 'bpm', labelKey: 'metric.hr', direction: 'higher_worse', frameKind: 'vitals' },
  spo2: { unit: '%', labelKey: 'metric.spo2', direction: 'lower_worse', frameKind: 'vitals' },
  hrv: { unit: 'ms', labelKey: 'metric.hrv', direction: 'lower_worse', frameKind: 'vitals' },
  'sleep.durationH': {
    unit: 'h',
    labelKey: 'metric.sleep.durationH',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  'sleep.efficiency': {
    unit: 'ratio',
    labelKey: 'metric.sleep.efficiency',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  'sleep.midpointShiftMin': {
    unit: 'min',
    labelKey: 'metric.sleep.midpointShiftMin',
    direction: 'both',
    frameKind: 'daily',
  },
  'activity.exerciseMin': {
    unit: 'min',
    labelKey: 'metric.activity.exerciseMin',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  'activity.resistiveMin': {
    unit: 'min',
    labelKey: 'metric.activity.resistiveMin',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  hydrationL: {
    unit: 'L',
    labelKey: 'metric.hydrationL',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  cabinCo2ppm: {
    unit: 'ppm',
    labelKey: 'metric.cabinCo2ppm',
    direction: 'higher_worse',
    frameKind: 'daily',
  },
  'mood.stress': {
    unit: 'score',
    labelKey: 'metric.mood.stress',
    direction: 'higher_worse',
    frameKind: 'daily',
  },
  'mood.mood': {
    unit: 'score',
    labelKey: 'metric.mood.mood',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  'mood.motivation': {
    unit: 'score',
    labelKey: 'metric.mood.motivation',
    direction: 'lower_worse',
    frameKind: 'daily',
  },
  'pvt.medianMs': {
    unit: 'ms',
    labelKey: 'metric.pvt.medianMs',
    direction: 'higher_worse',
    frameKind: 'daily',
  },
  'pvt.lapses': {
    unit: 'count',
    labelKey: 'metric.pvt.lapses',
    direction: 'higher_worse',
    frameKind: 'daily',
  },
  'rad.doseRateMsvDay': {
    unit: 'mSv/day',
    labelKey: 'metric.rad.doseRateMsvDay',
    direction: 'higher_worse',
    frameKind: 'radiation',
  },
}
