import { describe, expect, it } from 'vitest'
import {
  buildAlertPacket,
  buildDailySummary,
  buildStatusPacket,
  containsForbiddenPrivacyKey,
  EARTH_CONSENT_CATEGORIES,
  estimatePacketBytes,
} from '@/core/earthlink/packets'
import type { Alert } from '@/core/types/alert'

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
})
