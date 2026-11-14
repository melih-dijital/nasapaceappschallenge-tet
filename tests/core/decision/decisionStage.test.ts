// DecisionStage ve Faz 5 → Faz 7 uçtan uca entegrasyon testleri (FAZ_07 §3.5–§3.6).
import { describe, expect, it } from 'vitest'
import { DecisionStage, type DecisionStageSnapshot } from '@/core/decision'
import { DetectionStage } from '@/core/detection'
import { registry } from '@/core/evidence/registry'
import {
  BaselineStage,
  BufferStage,
  Engine,
  IngestStage,
  ModulesStage,
  PersistStage,
} from '@/core/pipeline'
import type { AlertEvent } from '@/core/types'
import { minToMs, MS_PER_DAY, MS_PER_HOUR, VITALS_INTERVAL_MIN } from '@/core/units'
import { generateCrew } from '@/sim/crew'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'

function buildDecisionPipeline(scenarioId: string) {
  const scenario = getScenario(scenarioId)
  const sim = new Simulator(scenario)
  const crewProfiles = generateCrew(scenario.crewCount, scenario.seed)
  const detection = new DetectionStage({ evidence: registry })
  const decision = new DecisionStage({
    evidence: registry,
    scenario,
    crewProfiles,
  })
  const engine = new Engine({
    evidence: registry,
    stages: [
      new IngestStage({ evidence: registry }),
      new BufferStage(),
      new BaselineStage({ evidence: registry }),
      new ModulesStage(),
      detection,
      decision,
      new PersistStage(),
    ],
  })
  return { scenario, sim, engine, detection, decision }
}

describe('DecisionStage birim ve motor entegrasyonu', () => {
  it('backfill atlanır; Faz 5 uyarılarının earthDelayClass alanını triage() ile günceller ve gecikmede yeniden sınıflar', () => {
    const { sim, engine, decision } = buildDecisionPipeline('sleep_debt')

    const backfillOut = engine.ingest(sim.backfill(), 0)
    expect(backfillOut.decisions).toBeUndefined()
    expect(decision.getLastSnapshot()).toBeNull()

    const step = 6 * MS_PER_HOUR
    const alertEvents: AlertEvent[] = []
    let latestSnap: DecisionStageSnapshot | undefined

    for (let t = step; t <= 9 * MS_PER_DAY; t += step) {
      const out = engine.ingest(sim.advanceTo(t), t)
      alertEvents.push(...(out.alertEvents ?? []))
      const snap = out.decisions?.at(-1) as DecisionStageSnapshot | undefined
      if (snap) latestSnap = snap
    }

    expect(latestSnap).toBeDefined()
    const warningEvents = alertEvents.filter(
      (e) => e.type !== 'RESOLVED' && e.alert.severity === 'WARNING' && e.alert.state === 'sleep_debt',
    )
    expect(warningEvents.length).toBeGreaterThan(0)
    // Faz 5 varsayılanı CAN_WAIT_FOR_EARTH yerine triage() sonucu ACT_THEN_REPORT olmalı (MARS_MIN: 21 dk < 720 dk)
    expect(warningEvents.some((e) => e.alert.earthDelayClass === 'ACT_THEN_REPORT')).toBe(true)

    const sleepCards = decision.getCards().filter((c) => c.actionId === 'ACT_SLEEP_SHIFT')
    expect(sleepCards.length).toBeGreaterThan(0)
    expect(sleepCards[0]?.earthDelayClass).toBe('ACT_THEN_REPORT')

    // Gidiş-dönüş gecikmesini sleep_debt timeToHarmMin üzerine çıkar → aktif uyarı ve kart ACT_NOW olur
    const sleepHarmMin = registry.getNumber('earth.timeToHarmMin.sleep_debt')
    decision.setEarthLinkConfig({ preset: 'CUSTOM', oneWayDelaySec: sleepHarmMin * 30 })
    const updatedSleepCards = decision.getCards().filter((c) => c.actionId === 'ACT_SLEEP_SHIFT')
    expect(updatedSleepCards[0]?.earthDelayClass).toBe('ACT_NOW')
    expect(
      decision.getTriagedAlerts().some((a) => a.state === 'sleep_debt' && a.earthDelayClass === 'ACT_NOW'),
    ).toBe(true)
  })

  it('aynı kişi ve eylem için birden çok uyarıyı tek kartta birleştirir ve ACT_NOW + CRITICAL kartı en üste koyar', () => {
    const decision = new DecisionStage({ evidence: registry })
    const now = 2 * MS_PER_DAY

    const fakeStageCtx = {
      simT: now,
      rawFrames: [],
      acceptedFrames: [],
      backfillFrames: [],
      liveFrames: [
        {
          kind: 'vitals' as const,
          t: now,
          crewId: 'cdr',
          hr: 95,
          spo2: 97,
          source: 'SYNTHETIC' as const,
        },
      ],
      dataQuality: [],
      faults: [],
      buffers: {} as never,
      evidence: registry,
      previousOutput: null,
      output: {
        t: now,
        acceptedFrames: [],
        dataQuality: [],
        faults: [],
        alertEvents: [
          {
            type: 'OPENED' as const,
            t: now,
            alert: {
              id: 'cdr|state:fatigue#1',
              crewId: 'cdr',
              kind: 'STATE' as const,
              severity: 'WARNING' as const,
              state: 'fatigue' as const,
              titleKey: 'alert.fatigue.title',
              whyKeys: [{ key: 'why.state.score', params: { state: 'fatigue', score: 0.72, confidence: 1 } }],
              evidenceIds: ['det.state.score.warning'],
              suggestedActionIds: ['ACT_REST_BLOCK', 'ACT_REDUCE_WORKLOAD'],
              earthDelayClass: 'CAN_WAIT_FOR_EARTH' as const,
              confidence: 1,
              status: 'ACTIVE' as const,
              firstSeenT: now,
              lastSeenT: now,
            },
          },
          {
            type: 'OPENED' as const,
            t: now,
            alert: {
              id: 'cdr|state:cardio_strain#2',
              crewId: 'cdr',
              kind: 'STATE' as const,
              severity: 'WARNING' as const,
              state: 'cardio_strain' as const,
              titleKey: 'alert.cardio_strain.title',
              whyKeys: [{ key: 'why.state.score', params: { state: 'cardio_strain', score: 0.75, confidence: 1 } }],
              evidenceIds: ['det.state.score.warning'],
              suggestedActionIds: ['ACT_REST_BLOCK', 'ACT_CARDIO_CHECK'],
              earthDelayClass: 'CAN_WAIT_FOR_EARTH' as const,
              confidence: 1,
              status: 'ACTIVE' as const,
              firstSeenT: now,
              lastSeenT: now,
            },
          },
          {
            type: 'OPENED' as const,
            t: now,
            alert: {
              id: 'sci|state:radiation_event#3',
              crewId: 'sci',
              kind: 'RADIATION' as const,
              severity: 'CRITICAL' as const,
              state: 'radiation_event' as const,
              titleKey: 'alert.radiation_event.title',
              whyKeys: [{ key: 'why.state.score', params: { state: 'radiation_event', score: 0.95, confidence: 1 } }],
              evidenceIds: ['rad.spe.limit.msv'],
              suggestedActionIds: ['ACT_SHELTER', 'ACT_DOSE_CHECK'],
              earthDelayClass: 'CAN_WAIT_FOR_EARTH' as const,
              confidence: 1,
              status: 'ACTIVE' as const,
              firstSeenT: now,
              lastSeenT: now,
            },
          },
        ],
      },
      scratch: {},
      isBackfillOnly: false,
    }

    decision.process(fakeStageCtx)
    const cards = decision.getCards()

    // ACT_NOW + CRITICAL kart (ACT_SHELTER) en üstte (priority 1)
    expect(cards[0]?.actionId).toBe('ACT_SHELTER')
    expect(cards[0]?.earthDelayClass).toBe('ACT_NOW')
    expect(cards[0]?.priority).toBe(1)

    // ACT_REST_BLOCK tekilleşmiş ve iki uyarı ID'sini taşıyor
    const restCards = cards.filter((c) => c.crewId === 'cdr' && c.actionId === 'ACT_REST_BLOCK')
    expect(restCards).toHaveLength(1)
    expect(restCards[0]?.sourceAlertIds).toEqual(['cdr|state:cardio_strain#2', 'cdr|state:fatigue#1'])
    expect(restCards[0]?.whyKeys).toHaveLength(2)

    // Kart kabul/yoksay/tamamla yaşam döngüsü ve denetim izi
    const restId = restCards[0]!.id
    expect(decision.acceptCard(restId, now + 1000)?.state).toBe('ACCEPTED')
    expect(decision.getAuditLog()).toHaveLength(1)

    const workloadCard = cards.find((c) => c.crewId === 'cdr' && c.actionId === 'ACT_REDUCE_WORKLOAD')!
    expect(decision.dismissCard(workloadCard.id, now + 2000)?.state).toBe('DISMISSED')
    const cdrScheduleAfterDismiss = decision.getLastSnapshot()?.schedulesByCrew['cdr']
    expect(
      cdrScheduleAfterDismiss?.diff.some((d) => d.reasonKey === 'plan.diff.ACT_REDUCE_WORKLOAD'),
    ).toBe(false)

    expect(decision.completeCard(restId, now + 3000)?.state).toBe('DONE')
    expect(decision.getAuditLog().map((a) => a.decision)).toEqual(['ACCEPTED', 'DISMISSED', 'DONE'])
  })

  it('demo_main uçtan uca: SPE + 14 dk gecikmede CRITICAL ACT_NOW, ACT_SHELTER kartı, egzersiz iptali ve yer cevabı akışı', () => {
    const { scenario, sim, engine, decision } = buildDecisionPipeline('demo_main')
    engine.ingest(sim.backfill(), 0)

    const speEvent = scenario.events.find((e) => e.kind === 'SPE')!
    const step = minToMs(VITALS_INTERVAL_MIN)
    const speWindowEvents: AlertEvent[] = []
    let speSnap: DecisionStageSnapshot | undefined

    for (let t = step; t <= speEvent.fromT + minToMs(120); t += step) {
      const out = engine.ingest(sim.advanceTo(t), t)
      const events = out.alertEvents ?? []
      if (t >= speEvent.fromT && t <= speEvent.fromT + minToMs(60)) {
        speWindowEvents.push(...events)
      }
      const snap = out.decisions?.at(-1) as DecisionStageSnapshot | undefined
      if (t >= speEvent.fromT && snap?.cards.some((c) => c.actionId === 'ACT_SHELTER')) {
        speSnap ??= snap
      }
    }

    // SPE başlangıcında EARTH_DELAY (840 sn) devreye girmiş ve CRITICAL radiation_event ACT_NOW olmuş olmalı
    const speAlertEvents = speWindowEvents.filter(
      (e) => e.alert.state === 'radiation_event' && e.alert.severity === 'CRITICAL',
    )
    expect(speAlertEvents.length).toBeGreaterThan(0)
    expect(speAlertEvents.every((e) => e.alert.earthDelayClass === 'ACT_NOW')).toBe(true)

    expect(speSnap).toBeDefined()
    expect(speSnap!.earth.config.oneWayDelaySec).toBe(840)
    const shelterCard = speSnap!.cards.find((c) => c.actionId === 'ACT_SHELTER')
    expect(shelterCard).toBeDefined()
    expect(shelterCard!.earthDelayClass).toBe('ACT_NOW')

    // Plan diff'inde egzersiz blokları kaldırılmış olmalı
    const crewDiff = speSnap!.schedulesByCrew[shelterCard!.crewId]?.diff ?? []
    expect(crewDiff.some((d) => d.change === 'REMOVED' && d.reasonKey === 'plan.diff.ACT_SHELTER')).toBe(
      true,
    )

    // Earth Link kuyruk + pending reply sayacı aktif
    expect(speSnap!.earth.outbox.length).toBeGreaterThan(0)
    expect(speSnap!.earth.pending.length).toBeGreaterThan(0)

    // Gidiş-dönüş süresi (2*14 + 15 = 43 dk) + aktarım sonrası yer cevabı inbox'a ulaşır
    const afterRoundTripT = speEvent.fromT + minToMs(180)
    let latestAfterReply: DecisionStageSnapshot | undefined
    for (let t = speEvent.fromT + minToMs(135); t <= afterRoundTripT; t += step) {
      const out = engine.ingest(sim.advanceTo(t), t)
      const snap = out.decisions?.at(-1) as DecisionStageSnapshot | undefined
      if (snap) latestAfterReply = snap
    }

    expect(latestAfterReply?.earth.inbox.length).toBeGreaterThan(0)
    expect(decision.getEarthLink().getState().stats.delivered).toBeGreaterThan(0)
  })

  it('solar_particle_event uçtan uca: CRITICAL radiation_event → ACT_NOW → ACT_SHELTER → plan diff → paket & yer cevabı', () => {
    const { scenario, sim, engine } = buildDecisionPipeline('solar_particle_event')
    engine.ingest(sim.backfill(), 0)

    const speEvent = scenario.events.find((e) => e.kind === 'SPE')!
    const step = minToMs(VITALS_INTERVAL_MIN)
    const speWindowEvents: AlertEvent[] = []
    let speSnap: DecisionStageSnapshot | undefined
    let finalSnap: DecisionStageSnapshot | undefined

    for (let t = step; t <= speEvent.fromT + minToMs(180); t += step) {
      const out = engine.ingest(sim.advanceTo(t), t)
      const events = out.alertEvents ?? []
      if (t >= speEvent.fromT && t <= speEvent.fromT + minToMs(60)) {
        speWindowEvents.push(...events)
      }
      const snap = out.decisions?.at(-1) as DecisionStageSnapshot | undefined
      if (t >= speEvent.fromT && snap?.cards.some((c) => c.actionId === 'ACT_SHELTER')) {
        speSnap ??= snap
      }
      if (snap) finalSnap = snap
    }

    const speCritical = speWindowEvents.filter(
      (e) => e.alert.state === 'radiation_event' && e.alert.severity === 'CRITICAL',
    )
    expect(speCritical.length).toBeGreaterThan(0)
    expect(speCritical.every((e) => e.alert.earthDelayClass === 'ACT_NOW')).toBe(true)
    expect(speSnap?.cards[0]?.actionId).toBe('ACT_SHELTER')
    expect(speSnap?.diff.some((d) => d.change === 'REMOVED' && d.reasonKey === 'plan.diff.ACT_SHELTER')).toBe(
      true,
    )
    expect(speSnap?.earth.outbox.length).toBeGreaterThan(0)
    expect(finalSnap?.earth.inbox.length).toBeGreaterThan(0)
  })

  it('onay kategorileri (setConsentCategories), manuel yer cevabı (triggerGroundReply) ve reset() doğru çalışır', () => {
    const decision = new DecisionStage({ evidence: registry })
    decision.setConsentCategories(['VITALS_SUMMARY'])
    expect(decision.getEarthLink().getConsentCategories()).toEqual(['VITALS_SUMMARY'])

    const reply = decision.triggerGroundReply('REPLY_SPE_ACK', 'sci|state:radiation_event#1')
    expect(reply.direction).toBe('DOWN')

    decision.reset()
    expect(decision.getCards()).toEqual([])
    expect(decision.getTriagedAlerts()).toEqual([])
    expect(decision.getAuditLog()).toEqual([])
    expect(decision.getLastSnapshot()).toBeNull()
  })
})
