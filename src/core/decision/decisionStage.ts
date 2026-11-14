// DecisionStage (FAZ_07 §3.5): aktif uyarılar → triyaj → öncelikli/tekil eylem kartları → planlayıcı → Earth Link.
// Saf TypeScript; DOM, Math.random ve Date.now yok.
import {
  EarthLink,
  type EarthLinkOptions,
  type EarthLinkState,
} from '../earthlink/link'
import type { EarthConsentCategory } from '../earthlink/packets'
import { registry as defaultRegistry, type EvidenceRegistry } from '../evidence/registry'
import type { EngineContext, EngineStage } from '../pipeline/stages'
import type { ActionCard, ActionCardState, ActionId, ActionKind } from '../types/action'
import type { Alert, EarthDelayClass, Severity, WhyKey } from '../types/alert'
import type { CrewProfile, CrewRole } from '../types/crew'
import type { EarthLinkConfig, EarthLinkPreset, Message } from '../types/earthlink'
import type { CrewId, SimTimeMs } from '../types/frame'
import type { DaySchedule, ScheduleDiffItem } from '../types/schedule'
import { MIN_PER_HOUR, MS_PER_DAY } from '../units'
import { ACTION_CATALOG } from './actions'
import { applyAdjustments, buildBaseSchedule, type ActiveActionInput, type PlannerResult } from './planner'
import { classify, resolveTimeToHarmMin } from './triage'

export interface ScenarioLinkEvent {
  kind: string
  fromT: SimTimeMs
  toT: SimTimeMs
  oneWayDelaySec?: number
}

export interface ScenarioDecisionContext {
  earthLinkPreset?: {
    preset: EarthLinkPreset
    oneWayDelaySec: number
    blackout?: boolean
  }
  events: readonly ScenarioLinkEvent[]
}

export interface DecisionAuditEntry {
  t: SimTimeMs
  cardId: string
  actionId: ActionId
  crewId: CrewId
  decision: Extract<ActionCardState, 'ACCEPTED' | 'DISMISSED' | 'DONE'>
  sourceAlertIds: string[]
  appliedDiffCount: number
}

export interface CrewScheduleOutput {
  baseSchedule?: DaySchedule
  schedule: DaySchedule
  diff: ScheduleDiffItem[]
  acceptedSchedule?: DaySchedule
  acceptedDiff?: ScheduleDiffItem[]
  hydrationTargetL: number
}

export interface DecisionStageSnapshot {
  t: SimTimeMs
  cardsCount: number
  cards: ActionCard[]
  schedule: DaySchedule
  diff: ScheduleDiffItem[]
  hydrationTargetL: number
  schedulesByCrew: Record<CrewId, CrewScheduleOutput>
  earth: EarthLinkState
  triagedAlerts: Alert[]
}

export interface DecisionStageOptions {
  evidence?: EvidenceRegistry
  earthLink?: EarthLink
  earthLinkOptions?: EarthLinkOptions
  scenario?: ScenarioDecisionContext
  crewProfiles?: readonly CrewProfile[]
  defaultCrewIds?: readonly CrewId[]
}

export const DECISION_SNAPSHOT_SCRATCH_KEY = 'decisionSnapshot'
export const DECISION_CARDS_SCRATCH_KEY = 'decisionCards'
export const EARTH_LINK_STATE_SCRATCH_KEY = 'earthLinkState'

const SEVERITY_RANK: Record<Severity, number> = {
  INFO: 0,
  ADVISORY: 1,
  WARNING: 2,
  CRITICAL: 3,
}

const DELAY_CLASS_RANK: Record<EarthDelayClass, number> = {
  CAN_WAIT_FOR_EARTH: 0,
  ACT_THEN_REPORT: 1,
  ACT_NOW: 2,
}

const ACTION_KIND_RANK: Record<ActionKind, number> = {
  SHELTER: 7,
  HYDRATE: 6,
  REST: 5,
  EXERCISE: 4,
  ENVIRONMENT: 3,
  COMMS: 2,
  CHECK: 1,
}

const DEFAULT_CREW_ORDER: readonly CrewId[] = ['cdr', 'md', 'eng', 'sci']
const DEFAULT_SLEEP_START_MIN = 22 * MIN_PER_HOUR

function toCrewRole(crewId: CrewId): CrewRole {
  const upper = crewId.toUpperCase()
  if (upper === 'CDR' || upper === 'MD' || upper === 'ENG' || upper === 'SCI') {
    return upper
  }
  return 'CDR'
}

function createDefaultCrewProfile(crewId: CrewId, evidence: EvidenceRegistry): CrewProfile {
  const sleepDurationMin = evidence.getNumber('plan.sleep.durationH') * MIN_PER_HOUR
  return {
    id: crewId,
    displayName: crewId.toUpperCase(),
    role: toCrewRole(crewId),
    ageBand: '30-39',
    priorCareerDoseMsv: 0,
    baselines: {},
    circadianAmplitudeHr: 5,
    sleepWindow: {
      startMin: DEFAULT_SLEEP_START_MIN,
      durationMin: sleepDurationMin,
    },
  }
}

function fallbackActionsForAlert(alert: Alert): readonly ActionId[] {
  if (alert.kind === 'RADIATION' || alert.state === 'radiation_event') {
    return ['ACT_SHELTER', 'ACT_DOSE_CHECK']
  }
  if (alert.metric === 'spo2') {
    return ['ACT_CARDIO_CHECK', 'ACT_REST_BLOCK']
  }
  if (alert.metric === 'cabinCo2ppm') {
    return ['ACT_REST_BLOCK']
  }
  return []
}

function mergeWhyKeys(existing: WhyKey[], incoming: readonly WhyKey[]): WhyKey[] {
  const seen = new Set(existing.map((w) => `${w.key}|${JSON.stringify(w.params)}`))
  for (const wk of incoming) {
    const sig = `${wk.key}|${JSON.stringify(wk.params)}`
    if (seen.has(sig)) continue
    seen.add(sig)
    existing.push(wk)
  }
  return existing
}

interface CardAccumulator {
  id: string
  actionId: ActionId
  crewId: CrewId
  earthDelayClass: EarthDelayClass
  maxSeverity: Severity
  minTimeToHarmMin: number
  titleKey: string
  stepKeys: string[]
  whyKeys: WhyKey[]
  sourceAlertIds: Set<string>
  evidenceIds: Set<string>
}

export class DecisionStage implements EngineStage {
  readonly name = 'DecisionStage'
  readonly runOnBackfill = false

  private readonly evidence: EvidenceRegistry
  private earthLink: EarthLink
  private initialEarthLinkOptions: EarthLinkOptions
  private scenario: ScenarioDecisionContext | undefined
  private readonly crewProfiles = new Map<CrewId, CrewProfile>()
  private readonly activeAlerts = new Map<string, Alert>()
  private readonly triagedById = new Map<
    string,
    { earthDelayClass: EarthDelayClass; timeToHarmMin: number }
  >()
  private readonly cardStates = new Map<string, ActionCardState>()
  private readonly baselineMedians = new Map<string, number>()
  private readonly auditLog: DecisionAuditEntry[] = []
  private lastSimT: SimTimeMs = 0
  private lastSnapshot: DecisionStageSnapshot | null = null

  constructor(opts: DecisionStageOptions = {}) {
    this.evidence = opts.evidence ?? defaultRegistry
    this.scenario = opts.scenario
    this.initialEarthLinkOptions = {
      evidence: this.evidence,
      ...(opts.scenario?.earthLinkPreset
        ? {
            preset: opts.scenario.earthLinkPreset.preset,
            config: {
              preset: opts.scenario.earthLinkPreset.preset,
              oneWayDelaySec: opts.scenario.earthLinkPreset.oneWayDelaySec,
              blackout: opts.scenario.earthLinkPreset.blackout ?? false,
            },
          }
        : {}),
      ...opts.earthLinkOptions,
    }
    this.earthLink = opts.earthLink ?? new EarthLink(this.initialEarthLinkOptions)

    for (const id of opts.defaultCrewIds ?? DEFAULT_CREW_ORDER) {
      this.crewProfiles.set(id, createDefaultCrewProfile(id, this.evidence))
    }
    for (const profile of opts.crewProfiles ?? []) {
      this.crewProfiles.set(profile.id, profile)
    }
  }

  process(ctx: EngineContext): void {
    this.recordBaselineMedians(ctx)

    const hasAlertEvents = (ctx.output.alertEvents?.length ?? 0) > 0
    if (ctx.isBackfillOnly || (ctx.liveFrames.length === 0 && !hasAlertEvents)) {
      return
    }

    this.lastSimT = ctx.simT

    for (const frame of ctx.liveFrames) {
      if (!this.crewProfiles.has(frame.crewId)) {
        this.crewProfiles.set(frame.crewId, createDefaultCrewProfile(frame.crewId, this.evidence))
      }
    }

    const events = ctx.output.alertEvents ?? []
    if (events.length > 0) {
      const eventsByT = new Map<SimTimeMs, typeof events>()
      for (const ev of events) {
        const list = eventsByT.get(ev.t)
        if (list) list.push(ev)
        else eventsByT.set(ev.t, [ev])
      }
      const sortedTimes = [...eventsByT.keys()].sort((a, b) => a - b)
      for (const t of sortedTimes) {
        this.applyScenarioLinkEvents(t)
        const linkConfigAtT = this.earthLink.getConfig()

        for (const event of eventsByT.get(t) ?? []) {
          const result = classify(event.alert, linkConfigAtT, this.evidence)
          event.alert.earthDelayClass = result.cls
          event.alert.timeToHarmMin = result.timeToHarmMin
          this.triagedById.set(event.alert.id, {
            earthDelayClass: result.cls,
            timeToHarmMin: result.timeToHarmMin,
          })

          if (event.type === 'RESOLVED') {
            this.activeAlerts.delete(event.alert.id)
          } else {
            this.activeAlerts.set(event.alert.id, { ...event.alert })
          }
        }
      }
    }

    this.applyScenarioLinkEvents(ctx.simT)
    this.earthLink.tick(ctx.simT)

    const linkConfig = this.earthLink.getConfig()
    this.reclassifyActiveAlerts(linkConfig)

    for (const alert of this.activeAlerts.values()) {
      this.earthLink.reportAlert(alert)
    }

    const snapshot = this.buildAndStoreSnapshot(ctx.simT)
    ctx.output.decisions ??= []
    ctx.output.decisions.push(snapshot)
    ctx.scratch[DECISION_SNAPSHOT_SCRATCH_KEY] = snapshot
    ctx.scratch[DECISION_CARDS_SCRATCH_KEY] = snapshot.cards
    ctx.scratch[EARTH_LINK_STATE_SCRATCH_KEY] = snapshot.earth
  }

  ackAlert(alertId: string, t: SimTimeMs = this.lastSimT): import('../types/alert').AlertEvent | null {
    const existing = this.activeAlerts.get(alertId)
    if (!existing) return null
    const updated: Alert = {
      ...existing,
      status: 'ACKED',
      ackT: t,
    }
    this.activeAlerts.set(alertId, updated)
    if (this.lastSnapshot) {
      this.buildAndStoreSnapshot(t)
    }
    return { type: 'ACKED', alert: { ...updated }, t }
  }

  applyTriageToAlerts(alerts: readonly Alert[]): Alert[] {
    const linkConfig = this.earthLink.getConfig()
    return alerts.map((alert) => {
      const active = this.activeAlerts.get(alert.id)
      if (active) {
        return {
          ...alert,
          earthDelayClass: active.earthDelayClass,
          timeToHarmMin: active.timeToHarmMin,
        }
      }
      const cached = this.triagedById.get(alert.id)
      if (cached) {
        return {
          ...alert,
          earthDelayClass: cached.earthDelayClass,
          timeToHarmMin: cached.timeToHarmMin,
        }
      }
      const result = classify(alert, linkConfig, this.evidence)
      return {
        ...alert,
        earthDelayClass: result.cls,
        timeToHarmMin: result.timeToHarmMin,
      }
    })
  }

  snapshotDecision(simT: SimTimeMs = this.lastSimT): DecisionStageSnapshot {
    return this.lastSnapshot ?? this.computeSnapshot(simT)
  }

  acceptCard(cardId: string, t: SimTimeMs = this.lastSimT): ActionCard | null {
    return this.transitionCard(cardId, 'ACCEPTED', t)
  }

  dismissCard(cardId: string, t: SimTimeMs = this.lastSimT): ActionCard | null {
    return this.transitionCard(cardId, 'DISMISSED', t)
  }

  completeCard(cardId: string, t: SimTimeMs = this.lastSimT): ActionCard | null {
    return this.transitionCard(cardId, 'DONE', t)
  }

  setEarthLinkConfig(config: Partial<EarthLinkConfig>): void {
    this.earthLink.setUserConfig(config)
    this.reclassifyActiveAlerts(this.earthLink.getConfig())
    if (this.lastSnapshot) {
      this.buildAndStoreSnapshot(this.lastSimT)
    }
  }

  setConsentCategories(categories: readonly EarthConsentCategory[]): void {
    this.earthLink.setConsentCategories(categories)
    if (this.lastSnapshot) {
      this.buildAndStoreSnapshot(this.lastSimT)
    }
  }

  triggerGroundReply(templateId: string, relatedAlertId?: string): Message {
    const related = relatedAlertId ? this.activeAlerts.get(relatedAlertId) : undefined
    const msg = this.earthLink.triggerGroundReply(
      templateId,
      relatedAlertId,
      related?.suggestedActionIds ?? [],
    )
    if (this.lastSnapshot) {
      this.buildAndStoreSnapshot(this.lastSimT)
    }
    return msg
  }

  setScenario(scenario: ScenarioDecisionContext, crewProfiles?: readonly CrewProfile[]): void {
    this.scenario = scenario
    if (crewProfiles) {
      this.crewProfiles.clear()
      for (const profile of crewProfiles) {
        this.crewProfiles.set(profile.id, profile)
      }
    }
    this.initialEarthLinkOptions = {
      ...this.initialEarthLinkOptions,
      ...(scenario.earthLinkPreset
        ? {
            preset: scenario.earthLinkPreset.preset,
            config: {
              preset: scenario.earthLinkPreset.preset,
              oneWayDelaySec: scenario.earthLinkPreset.oneWayDelaySec,
              blackout: scenario.earthLinkPreset.blackout ?? false,
            },
          }
        : {}),
    }
    if (scenario.earthLinkPreset) {
      this.earthLink.applyScenarioConfig({
        preset: scenario.earthLinkPreset.preset,
        oneWayDelaySec: scenario.earthLinkPreset.oneWayDelaySec,
        blackout: scenario.earthLinkPreset.blackout ?? false,
      })
    }
  }

  getEarthLink(): EarthLink {
    return this.earthLink
  }

  getCards(): ActionCard[] {
    return this.lastSnapshot ? this.lastSnapshot.cards.map((c) => ({ ...c })) : []
  }

  getTriagedAlerts(): Alert[] {
    return [...this.activeAlerts.values()].map((a) => ({ ...a }))
  }

  getLastSnapshot(): DecisionStageSnapshot | null {
    return this.lastSnapshot
  }

  getAuditLog(): readonly DecisionAuditEntry[] {
    return [...this.auditLog]
  }

  reset(): void {
    this.activeAlerts.clear()
    this.triagedById.clear()
    this.cardStates.clear()
    this.baselineMedians.clear()
    this.auditLog.length = 0
    this.lastSimT = 0
    this.lastSnapshot = null
    this.earthLink = new EarthLink(this.initialEarthLinkOptions)
  }

  private transitionCard(
    cardId: string,
    nextState: Extract<ActionCardState, 'ACCEPTED' | 'DISMISSED' | 'DONE'>,
    t: SimTimeMs,
  ): ActionCard | null {
    const currentCards = this.lastSnapshot?.cards ?? this.buildCards()
    const existing = currentCards.find((c) => c.id === cardId)
    if (!existing) return null

    this.cardStates.set(cardId, nextState)
    const snapshot = this.buildAndStoreSnapshot(t)
    const updated = snapshot.cards.find((c) => c.id === cardId) ?? { ...existing, state: nextState }

    const crewSchedule = snapshot.schedulesByCrew[existing.crewId]
    const appliedDiffCount = crewSchedule
      ? crewSchedule.diff.filter((d) =>
          existing.sourceAlertIds.some((id) => id === d.byAlertId),
        ).length
      : 0

    this.auditLog.push({
      t,
      cardId,
      actionId: existing.actionId,
      crewId: existing.crewId,
      decision: nextState,
      sourceAlertIds: [...existing.sourceAlertIds],
      appliedDiffCount,
    })

    return { ...updated }
  }

  private recordBaselineMedians(ctx: EngineContext): void {
    for (const snap of ctx.output.baselines ?? []) {
      if (snap.baselineMedian === null) continue
      this.baselineMedians.set(`${snap.crewId}|${snap.metric}`, snap.baselineMedian)
    }
  }

  private applyScenarioLinkEvents(simT: SimTimeMs): void {
    if (!this.scenario) return

    let activeDelaySec: number | undefined
    let activeBlackout = false

    for (const event of this.scenario.events) {
      if (simT < event.fromT || simT >= event.toT) continue
      if (event.kind === 'EARTH_DELAY' && event.oneWayDelaySec !== undefined) {
        activeDelaySec = event.oneWayDelaySec
      } else if (event.kind === 'COMM_BLACKOUT') {
        activeBlackout = true
      }
    }

    const basePreset = this.scenario.earthLinkPreset
    if (activeDelaySec !== undefined) {
      this.earthLink.applyScenarioConfig({
        preset: 'CUSTOM',
        oneWayDelaySec: activeDelaySec,
      })
    } else if (basePreset) {
      this.earthLink.applyScenarioConfig({
        preset: basePreset.preset,
        oneWayDelaySec: basePreset.oneWayDelaySec,
      })
    }

    this.earthLink.applyScenarioConfig({
      blackout: activeBlackout || (basePreset?.blackout ?? false),
    })
  }

  private reclassifyActiveAlerts(linkConfig: EarthLinkConfig): void {
    for (const [id, alert] of this.activeAlerts) {
      const result = classify(alert, linkConfig, this.evidence)
      this.triagedById.set(id, {
        earthDelayClass: result.cls,
        timeToHarmMin: result.timeToHarmMin,
      })
      this.activeAlerts.set(id, {
        ...alert,
        earthDelayClass: result.cls,
        timeToHarmMin: result.timeToHarmMin,
      })
    }
  }

  private buildCards(): ActionCard[] {
    const buckets = new Map<string, CardAccumulator>()

    for (const alert of this.activeAlerts.values()) {
      if (alert.status === 'RESOLVED') continue
      const actionIds =
        alert.suggestedActionIds.length > 0
          ? alert.suggestedActionIds
          : fallbackActionsForAlert(alert)
      const harmMin = resolveTimeToHarmMin(alert, this.evidence)

      for (const actionId of actionIds) {
        const def = ACTION_CATALOG[actionId]
        const cardId = `card:${alert.crewId}:${actionId}`
        const existing = buckets.get(cardId)

        if (!existing) {
          const evIds = new Set<string>(alert.evidenceIds)
          for (const id of def?.evidenceIds ?? []) evIds.add(id)
          buckets.set(cardId, {
            id: cardId,
            actionId,
            crewId: alert.crewId,
            earthDelayClass: alert.earthDelayClass,
            maxSeverity: alert.severity,
            minTimeToHarmMin: harmMin,
            titleKey: def?.titleKey ?? `action.${actionId}.title`,
            stepKeys: def ? [...def.stepKeys] : [],
            whyKeys: alert.whyKeys.map((w) => ({ key: w.key, params: { ...w.params } })),
            sourceAlertIds: new Set([alert.id]),
            evidenceIds: evIds,
          })
        } else {
          if (DELAY_CLASS_RANK[alert.earthDelayClass] > DELAY_CLASS_RANK[existing.earthDelayClass]) {
            existing.earthDelayClass = alert.earthDelayClass
          }
          if (SEVERITY_RANK[alert.severity] > SEVERITY_RANK[existing.maxSeverity]) {
            existing.maxSeverity = alert.severity
          }
          existing.minTimeToHarmMin = Math.min(existing.minTimeToHarmMin, harmMin)
          existing.sourceAlertIds.add(alert.id)
          for (const id of alert.evidenceIds) existing.evidenceIds.add(id)
          mergeWhyKeys(existing.whyKeys, alert.whyKeys)
        }
      }
    }

    for (const key of this.cardStates.keys()) {
      if (!buckets.has(key)) {
        this.cardStates.delete(key)
      }
    }

    const sorted = [...buckets.values()].sort((a, b) => {
      const aTop = a.earthDelayClass === 'ACT_NOW' && a.maxSeverity === 'CRITICAL' ? 1 : 0
      const bTop = b.earthDelayClass === 'ACT_NOW' && b.maxSeverity === 'CRITICAL' ? 1 : 0
      if (aTop !== bTop) return bTop - aTop

      const sevDiff = SEVERITY_RANK[b.maxSeverity] - SEVERITY_RANK[a.maxSeverity]
      if (sevDiff !== 0) return sevDiff

      const delayDiff = DELAY_CLASS_RANK[b.earthDelayClass] - DELAY_CLASS_RANK[a.earthDelayClass]
      if (delayDiff !== 0) return delayDiff

      if (a.minTimeToHarmMin !== b.minTimeToHarmMin) {
        return a.minTimeToHarmMin - b.minTimeToHarmMin
      }

      const kindA = ACTION_KIND_RANK[ACTION_CATALOG[a.actionId]?.kind ?? 'CHECK']
      const kindB = ACTION_KIND_RANK[ACTION_CATALOG[b.actionId]?.kind ?? 'CHECK']
      if (kindA !== kindB) return kindB - kindA

      return a.id.localeCompare(b.id)
    })

    return sorted.map((item, idx): ActionCard => {
      const state = this.cardStates.get(item.id) ?? 'SUGGESTED'
      this.cardStates.set(item.id, state)
      return {
        id: item.id,
        actionId: item.actionId,
        crewId: item.crewId,
        priority: idx + 1,
        earthDelayClass: item.earthDelayClass,
        titleKey: item.titleKey,
        stepKeys: item.stepKeys,
        whyKeys: item.whyKeys,
        sourceAlertIds: [...item.sourceAlertIds].sort(),
        evidenceIds: [...item.evidenceIds].sort(),
        state,
      }
    })
  }

  private buildSchedules(
    simT: SimTimeMs,
    cards: readonly ActionCard[],
  ): Record<CrewId, CrewScheduleOutput> {
    const day = Math.max(0, Math.floor(simT / MS_PER_DAY))
    const byCrew: Record<CrewId, CrewScheduleOutput> = {}

    for (const [crewId, profile] of this.crewProfiles) {
      const base = buildBaseSchedule(profile, day, this.evidence)
      const crewCards = cards.filter(
        (c) => c.crewId === crewId && c.state !== 'DISMISSED' && c.state !== 'DONE',
      )
      const activeInputs: ActiveActionInput[] = crewCards.map((c) => ({
        actionId: c.actionId,
        sourceAlertIds: c.sourceAlertIds,
        ...(c.sourceAlertIds[0] ? { byAlertId: c.sourceAlertIds[0] } : {}),
      }))

      const sleepH = this.baselineMedians.get(`${crewId}|sleep.durationH`)
      const hydrationL = this.baselineMedians.get(`${crewId}|hydrationL`)
      const plannerOpts = {
        evidence: this.evidence,
        ...(sleepH !== undefined ? { baselineSleepMin: sleepH * MIN_PER_HOUR } : {}),
        ...(hydrationL !== undefined ? { baselineHydrationL: hydrationL } : {}),
      }
      const result: PlannerResult = applyAdjustments(base, activeInputs, plannerOpts)

      const acceptedCards = cards.filter(
        (c) => c.crewId === crewId && (c.state === 'ACCEPTED' || c.state === 'DONE'),
      )
      const acceptedInputs: ActiveActionInput[] = acceptedCards.map((c) => ({
        actionId: c.actionId,
        sourceAlertIds: c.sourceAlertIds,
        ...(c.sourceAlertIds[0] ? { byAlertId: c.sourceAlertIds[0] } : {}),
      }))
      const acceptedResult: PlannerResult =
        acceptedInputs.length > 0
          ? applyAdjustments(base, acceptedInputs, plannerOpts)
          : { schedule: base, diff: [], hydrationTargetL: result.hydrationTargetL }

      byCrew[crewId] = {
        baseSchedule: base,
        schedule: result.schedule,
        diff: result.diff,
        acceptedSchedule: acceptedResult.schedule,
        acceptedDiff: acceptedResult.diff,
        hydrationTargetL: result.hydrationTargetL,
      }
    }

    return byCrew
  }

  private computeSnapshot(simT: SimTimeMs): DecisionStageSnapshot {
    const cards = this.buildCards()
    const schedulesByCrew = this.buildSchedules(simT, cards)
    const primaryCrewId = cards[0]?.crewId ?? this.crewProfiles.keys().next().value ?? 'cdr'
    const fallbackBase = buildBaseSchedule(
      createDefaultCrewProfile(primaryCrewId, this.evidence),
      Math.max(0, Math.floor(simT / MS_PER_DAY)),
      this.evidence,
    )
    const primary = schedulesByCrew[primaryCrewId] ?? {
      baseSchedule: fallbackBase,
      schedule: fallbackBase,
      diff: [],
      acceptedSchedule: fallbackBase,
      acceptedDiff: [],
      hydrationTargetL: 0,
    }

    return {
      t: simT,
      cardsCount: cards.length,
      cards,
      schedule: primary.schedule,
      diff: primary.diff,
      hydrationTargetL: primary.hydrationTargetL,
      schedulesByCrew,
      earth: this.earthLink.getState(),
      triagedAlerts: this.getTriagedAlerts(),
    }
  }

  private buildAndStoreSnapshot(simT: SimTimeMs): DecisionStageSnapshot {
    const snapshot = this.computeSnapshot(simT)
    this.lastSnapshot = snapshot
    return snapshot
  }
}
