import type { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  CrewProfileSchema,
  DailyFrameSchema,
  EarthLinkConfigSchema,
  EvidenceEntrySchema,
  MessageSchema,
  RadiationFrameSchema,
  TelemetryFrameSchema,
  VitalsFrameSchema,
} from '@/core/schema'
import {
  METRIC_IDS,
  METRIC_META,
  STATE_IDS,
  type CrewProfile,
  type DailyFrame,
  type EarthLinkConfig,
  type EvidenceEntry,
  type Message,
  type MetricDirection,
  type MetricId,
  type RadiationFrame,
  type TelemetryFrame,
  type VitalsFrame,
} from '@/core/types'

// Derleme zamanı tip eşitliği: şema çıkarımı ile TS tipi birebir aynı olmalı (`npm run typecheck` denetler).
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Expect<T extends true> = T

export type SchemaTypeEqualityChecks = [
  Expect<Equal<z.infer<typeof VitalsFrameSchema>, VitalsFrame>>,
  Expect<Equal<z.infer<typeof DailyFrameSchema>, DailyFrame>>,
  Expect<Equal<z.infer<typeof RadiationFrameSchema>, RadiationFrame>>,
  Expect<Equal<z.infer<typeof TelemetryFrameSchema>, TelemetryFrame>>,
  Expect<Equal<z.infer<typeof CrewProfileSchema>, CrewProfile>>,
  Expect<Equal<z.infer<typeof EvidenceEntrySchema>, EvidenceEntry>>,
  Expect<Equal<z.infer<typeof EarthLinkConfigSchema>, EarthLinkConfig>>,
  Expect<Equal<z.infer<typeof MessageSchema>, Message>>,
]

const EXPECTED_DIRECTIONS: Record<MetricId, MetricDirection> = {
  hr: 'higher_worse',
  spo2: 'lower_worse',
  hrv: 'lower_worse',
  'sleep.durationH': 'lower_worse',
  'sleep.efficiency': 'lower_worse',
  'sleep.midpointShiftMin': 'both',
  'activity.exerciseMin': 'lower_worse',
  'activity.resistiveMin': 'lower_worse',
  hydrationL: 'lower_worse',
  cabinCo2ppm: 'higher_worse',
  'mood.stress': 'higher_worse',
  'mood.mood': 'lower_worse',
  'mood.motivation': 'lower_worse',
  'pvt.medianMs': 'higher_worse',
  'pvt.lapses': 'higher_worse',
  'rad.doseRateMsvDay': 'higher_worse',
}

describe('çekirdek tipler (PROJECT_MEMORY §6)', () => {
  it('16 MetricId ve 7 StateId var', () => {
    expect(METRIC_IDS).toHaveLength(16)
    expect(STATE_IDS).toEqual([
      'fatigue',
      'stress',
      'dehydration',
      'sleep_debt',
      'radiation_event',
      'cardio_strain',
      'mood_decline',
    ])
  })

  it('METRIC_META her metriği kapsar ve yönler FAZ_01 §3.1 ile aynı', () => {
    expect(Object.keys(METRIC_META).sort()).toEqual([...METRIC_IDS].sort())
    for (const id of METRIC_IDS) {
      expect(METRIC_META[id].direction, id).toBe(EXPECTED_DIRECTIONS[id])
      expect(METRIC_META[id].labelKey).toBe(`metric.${id}`)
    }
  })

  it('frameKind: vitals (hr, spo2, hrv), radiation (doz hızı), gerisi daily', () => {
    const byKind = (kind: string) => METRIC_IDS.filter((id) => METRIC_META[id].frameKind === kind)
    expect(byKind('vitals')).toEqual(['hr', 'spo2', 'hrv'])
    expect(byKind('radiation')).toEqual(['rad.doseRateMsvDay'])
    expect(byKind('daily')).toHaveLength(12)
  })
})
