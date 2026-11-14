import { describe, expect, it } from 'vitest'
import {
  CrewProfileSchema,
  EarthLinkConfigSchema,
  EvidenceEntrySchema,
  MessageSchema,
  TelemetryFrameSchema,
} from '@/core/schema'
import type { CrewProfile, DailyFrame, EvidenceEntry, RadiationFrame, VitalsFrame } from '@/core/types'

const vitals: VitalsFrame = { kind: 'vitals', t: 0, crewId: 'cdr', hr: 62, spo2: 97.5, source: 'SYNTHETIC' }
const daily: DailyFrame = {
  kind: 'daily',
  t: -86_400_000,
  crewId: 'md',
  day: -1,
  sleep: { durationH: 6.5, efficiency: 0.9, midpointShiftMin: 10 },
  activity: { exerciseMin: 60, resistiveMin: 30 },
  hydrationL: 2.5,
  source: 'SYNTHETIC',
}
const radiation: RadiationFrame = {
  kind: 'radiation',
  t: 900_000,
  crewId: 'eng',
  doseRateMsvDay: 0.35,
  environment: 'LEO',
  source: 'SYNTHETIC',
}

describe('TelemetryFrameSchema', () => {
  it.each([vitals, daily, radiation])('geçerli $kind çerçevesini kabul eder', (frame) => {
    expect(TelemetryFrameSchema.safeParse(frame).success).toBe(true)
  })

  it('opsiyonel alanlar dolu da geçerli', () => {
    const full: DailyFrame = {
      ...daily,
      cabinCo2ppm: 2500,
      mood: { stress: 3, mood: 7, motivation: 8 },
      pvt: { medianMs: 250, lapses: 1 },
      userSubmitted: true,
    }
    expect(TelemetryFrameSchema.safeParse(full).success).toBe(true)
    expect(TelemetryFrameSchema.safeParse({ ...vitals, hrv: 55 }).success).toBe(true)
    expect(TelemetryFrameSchema.safeParse({ ...radiation, protonFluxPfu: 0.4 }).success).toBe(true)
  })

  it.each([
    ['NaN', { ...vitals, hr: Number.NaN }],
    ['Infinity', { ...vitals, spo2: Number.POSITIVE_INFINITY }],
    ['-Infinity', { ...radiation, doseRateMsvDay: Number.NEGATIVE_INFINITY }],
    ['iç içe NaN', { ...daily, sleep: { ...daily.sleep, durationH: Number.NaN } }],
  ])('%s reddedilir', (_label, frame) => {
    expect(TelemetryFrameSchema.safeParse(frame).success).toBe(false)
  })

  it('eksik alan reddedilir', () => {
    const { spo2, ...noSpo2 } = vitals
    void spo2
    expect(TelemetryFrameSchema.safeParse(noSpo2).success).toBe(false)
    const { sleep, ...noSleep } = daily
    void sleep
    expect(TelemetryFrameSchema.safeParse(noSleep).success).toBe(false)
  })

  it('yanlış kind ve bilinmeyen ortam/kaynak reddedilir', () => {
    expect(TelemetryFrameSchema.safeParse({ ...vitals, kind: 'heartbeat' }).success).toBe(false)
    expect(TelemetryFrameSchema.safeParse({ ...radiation, environment: 'VENUS' }).success).toBe(false)
    expect(TelemetryFrameSchema.safeParse({ ...vitals, source: 'CLOUD' }).success).toBe(false)
  })

  it('aralık kontrolü şemada YOK (Faz 3 plausibility): HR 400 biçimce geçerli', () => {
    expect(TelemetryFrameSchema.safeParse({ ...vitals, hr: 400 }).success).toBe(true)
  })
})

describe('CrewProfileSchema', () => {
  const crew: CrewProfile = {
    id: 'cdr',
    displayName: 'Cmdr. A. Rivera',
    role: 'CDR',
    ageBand: '40-49',
    priorCareerDoseMsv: 80,
    baselines: { hr: { mean: 58, withinSd: 3 } },
    circadianAmplitudeHr: 6,
    sleepWindow: { startMin: 1350, durationMin: 480 },
  }
  it('geçerli profil', () => {
    expect(CrewProfileSchema.safeParse(crew).success).toBe(true)
  })
  it('bilinmeyen rol, bilinmeyen metrik ve eksik sleepWindow reddedilir', () => {
    expect(CrewProfileSchema.safeParse({ ...crew, role: 'PILOT' }).success).toBe(false)
    expect(
      CrewProfileSchema.safeParse({ ...crew, baselines: { heartRate: { mean: 1, withinSd: 1 } } }).success,
    ).toBe(false)
    const { sleepWindow, ...noWindow } = crew
    void sleepWindow
    expect(CrewProfileSchema.safeParse(noWindow).success).toBe(false)
  })
})

describe('EvidenceEntrySchema', () => {
  const entry: EvidenceEntry = {
    id: 'det.z.warning',
    value: 3,
    unit: 'z',
    sourceType: 'DEMO_PARAMETER',
    sourceTitle: 'DEMO',
    sourceUrl: '—',
    verificationStatus: 'UNVERIFIED',
    verified: false,
  }
  it('geçerli kayıt ve aralık değeri', () => {
    expect(EvidenceEntrySchema.safeParse(entry).success).toBe(true)
    expect(EvidenceEntrySchema.safeParse({ ...entry, value: [0.2, 0.5] }).success).toBe(true)
  })
  it('verified türetilmiş alanla çelişirse reddedilir', () => {
    expect(EvidenceEntrySchema.safeParse({ ...entry, verified: true }).success).toBe(false)
  })
  it('DEMO_PARAMETER VERIFIED olamaz; ters aralık reddedilir', () => {
    expect(
      EvidenceEntrySchema.safeParse({ ...entry, verificationStatus: 'VERIFIED', verified: true }).success,
    ).toBe(false)
    expect(EvidenceEntrySchema.safeParse({ ...entry, value: [5, 1] }).success).toBe(false)
  })
})

describe('Earth Link şemaları', () => {
  it('config ve QUEUED mesaj (sendT/arriveT henüz yok)', () => {
    expect(
      EarthLinkConfigSchema.safeParse({ oneWayDelaySec: 840, preset: 'CUSTOM', blackout: false }).success,
    ).toBe(true)
    const queued = {
      id: 'm1',
      direction: 'UP',
      priority: 3,
      category: 'ALERTS',
      createdT: 0,
      payload: { any: 'thing' },
      status: 'QUEUED',
    }
    expect(MessageSchema.safeParse(queued).success).toBe(true)
    expect(MessageSchema.safeParse({ ...queued, priority: 4 }).success).toBe(false)
  })
})
