import { describe, expect, it } from 'vitest'
import {
  buildAlertPacket,
  buildDailySummary,
  buildStatusPacket,
  buildTelemetryBatchPacket,
  containsForbiddenPrivacyKey,
  EARTH_CONSENT_CATEGORIES,
  estimatePacketBytes,
} from '@/core/earthlink/packets'
import type { Alert } from '@/core/types/alert'
import type { DailyFrame } from '@/core/types/frame'

describe('Earth Link Packets & Privacy Gate (Faz 7 §3.4)', () => {
  const sampleAlert: Alert = {
    id: 'AL_PRIV',
    crewId: 'CREW_01',
    kind: 'STATE',
    severity: 'WARNING',
    state: 'stress',
    titleKey: 'alert.stress.title',
    whyKeys: [
      {
        key: 'why.stress.elevated',
        params: {
          score: 82,
          journalEntry: 'GIZLI_GUNLUK_METNI_ASLA_GITMEMELI',
          rawCheckinNote: 'HAM_NOT_ASLA_GITMEMELI',
        },
      },
    ],
    evidenceIds: [],
    suggestedActionIds: ['ACT_BREATHING', 'ACT_JOURNAL'],
    earthDelayClass: 'ACT_THEN_REPORT',
    confidence: 0.85,
    status: 'ACTIVE',
    firstSeenT: 60_000,
    lastSeenT: 60_000,
  }

  it('yalnızca onaylı consentCategories kategorilerini taşır', () => {
    expect(buildStatusPacket({ t: 1000, latest: { 'CREW_01|hr': 72 } }, [])).toBeNull()
    expect(buildAlertPacket(sampleAlert, ['VITALS_SUMMARY'])).toBeNull()

    const statusVitalsOnly = buildStatusPacket(
      {
        t: 2000,
        latest: {
          'CREW_01|hr': 75,
          'CREW_01|rad.doseRateMsvDay': 0.5,
          'CREW_01|mood.stress': 80,
          'CREW_01|journal': 1,
        },
        activeAlerts: [sampleAlert],
        radiationSummary: { speMsv: 12 },
        behaviorSummary: { moodScore: 45 },
      },
      ['VITALS_SUMMARY'],
    )

    expect(statusVitalsOnly).not.toBeNull()
    expect(statusVitalsOnly?.vitalsSummary).toEqual({ 'CREW_01|hr': 75 })
    expect(statusVitalsOnly?.alerts).toBeUndefined()
    expect(statusVitalsOnly?.radiation).toBeUndefined()
    expect(statusVitalsOnly?.behaviorSummary).toBeUndefined()
    expect(containsForbiddenPrivacyKey(statusVitalsOnly)).toBe(false)
  })

  it('buildAlertPacket ve buildDailySummary içine journal / ham check-in notu asla sızmaz', () => {
    const alertPacket = buildAlertPacket(sampleAlert, ['ALERTS'])
    expect(alertPacket).not.toBeNull()
    expect(containsForbiddenPrivacyKey(alertPacket)).toBe(false)
    expect(JSON.stringify(alertPacket)).not.toContain('GIZLI_GUNLUK_METNI')
    expect(JSON.stringify(alertPacket)).not.toContain('HAM_NOT')

    const dailyUnsafeInput = {
      vitals: { hrMean: 70, spo2Min: 97 },
      radiation: { dayDoseMsv: 0.4 },
      behavior: {
        checkinCompleted: true,
        moodScore: 60,
        journalText: 'BU_GUNLUK_ASLA_PAKETE_GIRMEMELI',
        rawCheckinNotes: 'BU_DA_GIRMEMELI',
      },
      alertCount: 1,
    }

    const daily = buildDailySummary('CREW_01', 3, dailyUnsafeInput, EARTH_CONSENT_CATEGORIES)
    expect(daily).not.toBeNull()
    expect(containsForbiddenPrivacyKey(daily)).toBe(false)
    expect(JSON.stringify(daily)).not.toContain('BU_GUNLUK_ASLA_PAKETE_GIRMEMELI')
    expect(JSON.stringify(daily)).not.toContain('BU_DA_GIRMEMELI')
    expect(daily?.behavior).toEqual({ checkinCompleted: true, moodScore: 60 })
    expect(estimatePacketBytes(daily)).toBeGreaterThan(0)
  })

  it('buildTelemetryBatchPacket: tüm telemetri türlerini paketler, onay filtrelerine uyar ve derin gizlilik taramasını geçer', () => {
    const unsafeDaily = {
      kind: 'daily' as const,
      t: 900_000,
      crewId: 'cdr',
      day: 0,
      sleep: { durationH: 7.2, efficiency: 0.9, midpointShiftMin: 10 },
      activity: { exerciseMin: 45, resistiveMin: 30 },
      hydrationL: 2.4,
      cabinCo2ppm: 2800,
      mood: { stress: 4, mood: 7, motivation: 8 },
      pvt: { medianMs: 260, lapses: 1 },
      userSubmitted: true,
      source: 'SYNTHETIC' as const,
      journalText: 'COK_GIZLI_GUNLUK_ASLA_SIZMAMALI',
      rawCheckinNote: 'HAM_CHECKIN_NOTU_ASLA_SIZMAMALI',
      privateNote: 'OZEL_NOT_ASLA_SIZMAMALI',
    } as unknown as DailyFrame

    const batch = buildTelemetryBatchPacket(
      {
        t: 900_000,
        fromT: 0,
        vitalsFrames: [
          { kind: 'vitals', t: 900_000, crewId: 'cdr', hr: 64, spo2: 98, hrv: 54, source: 'SYNTHETIC' },
        ],
        radiationFrames: [
          {
            kind: 'radiation',
            t: 900_000,
            crewId: 'cdr',
            doseRateMsvDay: 0.42,
            protonFluxPfu: 1.2,
            environment: 'MARS_TRANSIT',
            source: 'SYNTHETIC',
          },
        ],
        dailyFrames: [unsafeDaily],
        latest: {
          'cdr|hr': 64,
          'cdr|rad.doseRateMsvDay': 0.42,
          'cdr|mood.stress': 4,
          'cdr|journalSecret': 999,
        },
        states: [
          {
            crewId: 'cdr',
            state: 'fatigue',
            t: 900_000,
            score: 0.35,
            confidence: 1,
            contributors: [{ metric: 'hr', z: 0.5, weight: 0.1, contribution: 0.05 }],
          },
        ],
        activeAlerts: [sampleAlert],
        alertEvents: [{ type: 'OPENED', t: 900_000, alert: sampleAlert }],
        cumulativeDoseByCrew: { cdr: 1.25 },
      },
      EARTH_CONSENT_CATEGORIES,
    )

    expect(batch).not.toBeNull()
    expect(batch?.kind).toBe('TELEMETRY_BATCH')
    expect(batch?.vitalsFrames).toHaveLength(1)
    expect(batch?.radiationFrames).toHaveLength(1)
    expect(batch?.dailyFrames).toHaveLength(1)
    expect(batch?.states).toHaveLength(1)
    expect(batch?.activeAlerts).toHaveLength(1)
    expect(batch?.alertEvents).toHaveLength(1)
    expect(batch?.cumulativeDoseByCrew).toEqual({ cdr: 1.25 })
    expect(batch?.latest).toEqual({
      'cdr|hr': 64,
      'cdr|rad.doseRateMsvDay': 0.42,
      'cdr|mood.stress': 4,
    })

    // Derin gizlilik taraması: hiçbir düğümde journal / rawCheckin / privateNote anahtarı veya değeri bulunmamalı
    expect(containsForbiddenPrivacyKey(batch)).toBe(false)
    const serialized = JSON.stringify(batch)
    expect(serialized).not.toContain('COK_GIZLI_GUNLUK_ASLA_SIZMAMALI')
    expect(serialized).not.toContain('HAM_CHECKIN_NOTU_ASLA_SIZMAMALI')
    expect(serialized).not.toContain('OZEL_NOT_ASLA_SIZMAMALI')
    expect(serialized).not.toContain('GIZLI_GUNLUK_METNI_ASLA_GITMEMELI')
    expect(serialized).not.toContain('HAM_NOT_ASLA_GITMEMELI')
  })
})
