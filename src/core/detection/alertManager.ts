// Uyarı yöneticisi (FAZ_05 §3.5): L1–L4 → Alert; birleştirme, histerezis, soğuma, ACK yaşam döngüsü. Saf TS.
import type { EvidenceId, EvidenceRegistry } from '../evidence/registry'
import type {
  Alert,
  AlertEvent,
  AlertKind,
  CrewId,
  MetricId,
  Severity,
  SimTimeMs,
  StateEstimate,
  StateId,
  WhyKey,
} from '../types'
import { suggestedActionsFor } from './actionMap'
import type { L1Hit } from './l1Limits'
import { isVitalsCadence, type L2Hit } from './l2Deviation'
import type { L3Hit } from './l3Trend'
import { explainState } from './l4States'
import { maxSeverity, minSeverity, severityRank, type DetectionParams } from './params'

export interface StateHit {
  estimate: StateEstimate
  severity: Severity
}

export interface DetectionInputs {
  l1: readonly L1Hit[]
  l2: readonly L2Hit[]
  l3: readonly L3Hit[]
  states: readonly StateHit[]
}

interface Candidate {
  key: string
  crewId: CrewId
  kind: AlertKind
  kindSeverity: Severity
  state?: StateId
  metric?: MetricId
  severity: Severity
  whyKeys: WhyKey[]
  evidenceIds: Set<string>
  confidence: number
  timeToHarmMin?: number
  fromL1: boolean
  holdMs: number
  titleKey: string
}

interface Tracked {
  alert: Alert
  key: string
  holdMs: number
  lowerSinceT: SimTimeMs | null
  absentSinceT: SimTimeMs | null
}

/** Eşit severity'de hangi katmanın türü uyarıya yazılır. */
const KIND_PRIORITY: Record<AlertKind, number> = {
  STATE: 5,
  RADIATION: 4,
  LIMIT: 3,
  DEVIATION: 2,
  TREND: 1,
}

const zThresholdId = (s: Severity): EvidenceId =>
  s === 'CRITICAL' ? 'det.z.critical' : s === 'WARNING' ? 'det.z.warning' : 'det.z.advisory'

const stateScoreId = (s: Severity): EvidenceId =>
  s === 'CRITICAL'
    ? 'det.state.score.critical'
    : s === 'WARNING'
      ? 'det.state.score.warning'
      : 'det.state.score.advisory'

const round = (x: number): number => Math.round(x * 100) / 100

export class AlertManager {
  private readonly open = new Map<string, Tracked>()
  private readonly resolved: Tracked[] = []
  private readonly lastResolvedByKey = new Map<string, Alert>()
  private seq = 0
  private readonly params: DetectionParams
  private readonly evidence: EvidenceRegistry

  constructor(params: DetectionParams, evidence: EvidenceRegistry) {
    this.params = params
    this.evidence = evidence
  }

  /** Tek bir zaman adımı: aday uyarıları kurar, yaşam döngüsünü ilerletir, olayları döner. */
  step(t: SimTimeMs, inputs: DetectionInputs): AlertEvent[] {
    const candidates = this.buildCandidates(inputs)
    const events: AlertEvent[] = []

    for (const cand of candidates.values()) {
      const tracked = this.open.get(cand.key)
      if (tracked) {
        this.updateExisting(tracked, cand, t, events)
      } else {
        this.maybeOpen(cand, t, events)
      }
    }

    for (const [key, tracked] of this.open) {
      if (candidates.has(key)) continue
      tracked.absentSinceT ??= t
      if (t - tracked.absentSinceT >= tracked.holdMs) {
        const alert = { ...tracked.alert, status: 'RESOLVED' as const, resolvedT: t }
        tracked.alert = alert
        this.open.delete(key)
        this.resolved.push(tracked)
        this.lastResolvedByKey.set(key, alert)
        events.push({ type: 'RESOLVED', alert: { ...alert }, t })
      }
    }

    this.pruneResolved(t)
    return events
  }

  ack(alertId: string, t: SimTimeMs): AlertEvent | null {
    for (const tracked of this.open.values()) {
      if (tracked.alert.id !== alertId || tracked.alert.status !== 'ACTIVE') continue
      tracked.alert = { ...tracked.alert, status: 'ACKED', ackT: t }
      return { type: 'ACKED', alert: { ...tracked.alert }, t }
    }
    return null
  }

  /** Açık (ACTIVE/ACKED) uyarılar. */
  openAlerts(): Alert[] {
    return [...this.open.values()].map((tr) => ({ ...tr.alert }))
  }

  /** Açık + son `alert.recentResolvedHours` içinde çözülmüş uyarılar (snapshot için). */
  listAlerts(t: SimTimeMs): Alert[] {
    const recent = this.resolved
      .filter((tr) => (tr.alert.resolvedT ?? t) >= t - this.params.recentResolvedMs)
      .map((tr) => ({ ...tr.alert }))
    return [...this.openAlerts(), ...recent]
  }

  hasWarningPlus(crewId: CrewId): boolean {
    for (const tr of this.open.values()) {
      if (tr.alert.crewId === crewId && severityRank(tr.alert.severity) >= severityRank('WARNING')) {
        return true
      }
    }
    return false
  }

  reset(): void {
    this.open.clear()
    this.resolved.length = 0
    this.lastResolvedByKey.clear()
    this.seq = 0
  }

  private updateExisting(tracked: Tracked, cand: Candidate, t: SimTimeMs, events: AlertEvent[]): void {
    tracked.absentSinceT = null
    tracked.holdMs = Math.max(tracked.holdMs, cand.holdMs)
    const prev = tracked.alert
    let severity = prev.severity
    let status = prev.status
    let changed = false

    if (severityRank(cand.severity) > severityRank(prev.severity)) {
      severity = cand.severity
      tracked.lowerSinceT = null
      if (status === 'ACKED') status = 'ACTIVE'
      changed = true
    } else if (severityRank(cand.severity) < severityRank(prev.severity)) {
      // Kademeli düşüş: düşük seviye hold süresi boyunca sürerse bir basamak in.
      tracked.lowerSinceT ??= t
      if (t - tracked.lowerSinceT >= tracked.holdMs) {
        const oneDown = SEVERITY_DOWN[prev.severity]
        severity = maxSeverity(oneDown, cand.severity)
        tracked.lowerSinceT = t
        changed = true
      }
    } else {
      tracked.lowerSinceT = null
    }

    tracked.alert = {
      ...prev,
      kind: cand.kind,
      severity,
      status,
      whyKeys: cand.whyKeys,
      evidenceIds: [...new Set([...prev.evidenceIds, ...cand.evidenceIds])].sort(),
      confidence: cand.confidence,
      ...(cand.timeToHarmMin !== undefined ? { timeToHarmMin: cand.timeToHarmMin } : {}),
      lastSeenT: t,
    }
    if (changed) events.push({ type: 'UPDATED', alert: { ...tracked.alert }, t })
  }

  private maybeOpen(cand: Candidate, t: SimTimeMs, events: AlertEvent[]): void {
    const last = this.lastResolvedByKey.get(cand.key)
    // Soğuma: aynı uyarı det.cooldownMin içinde tekrar OPENED olmaz (daha yüksek severity hariç).
    if (
      last?.resolvedT !== undefined &&
      t - last.resolvedT < this.params.cooldownMs &&
      severityRank(cand.severity) <= severityRank(last.severity)
    ) {
      return
    }
    this.seq++
    const alert: Alert = {
      id: `${cand.key}#${this.seq}`,
      crewId: cand.crewId,
      kind: cand.kind,
      severity: cand.severity,
      ...(cand.state ? { state: cand.state } : {}),
      ...(cand.metric ? { metric: cand.metric } : {}),
      titleKey: cand.titleKey,
      whyKeys: cand.whyKeys,
      evidenceIds: [...cand.evidenceIds].sort(),
      suggestedActionIds: suggestedActionsFor(cand.state),
      // Ön sınıflama; nihai triyaj Faz 7 `triage()`.
      earthDelayClass: 'CAN_WAIT_FOR_EARTH',
      ...(cand.timeToHarmMin !== undefined ? { timeToHarmMin: cand.timeToHarmMin } : {}),
      confidence: cand.confidence,
      status: 'ACTIVE',
      firstSeenT: t,
      lastSeenT: t,
    }
    this.open.set(cand.key, { alert, key: cand.key, holdMs: cand.holdMs, lowerSinceT: null, absentSinceT: null })
    events.push({ type: 'OPENED', alert: { ...alert }, t })
  }

  private pruneResolved(t: SimTimeMs): void {
    const cutoff = t - this.params.recentResolvedMs
    while (this.resolved.length > 0 && (this.resolved[0]!.alert.resolvedT ?? t) < cutoff) {
      this.resolved.shift()
    }
  }

  // --- aday kurulumu ---

  private buildCandidates(inputs: DetectionInputs): Map<string, Candidate> {
    const out = new Map<string, Candidate>()
    for (const h of inputs.l1) this.merge(out, this.fromL1(h))
    for (const h of inputs.l2) this.merge(out, this.fromL2(h))
    for (const h of inputs.l3) this.merge(out, this.fromL3(h))
    for (const h of inputs.states) this.merge(out, this.fromState(h))

    for (const cand of out.values()) {
      // CRITICAL yalnızca L1 doğrulaması veya radiation_event yoluyla.
      if (!cand.fromL1 && cand.state !== 'radiation_event') {
        cand.severity = minSeverity(cand.severity, 'WARNING')
      }
      if (cand.timeToHarmMin === undefined) {
        const harmId = this.timeToHarmId(cand.state, cand.metric)
        if (harmId) {
          cand.timeToHarmMin = this.evidence.getNumber(harmId)
          cand.evidenceIds.add(harmId)
        }
      }
    }
    return out
  }

  private merge(out: Map<string, Candidate>, cand: Candidate): void {
    const existing = out.get(cand.key)
    if (!existing) {
      out.set(cand.key, cand)
      return
    }
    const takeKind =
      severityRank(cand.kindSeverity) > severityRank(existing.kindSeverity) ||
      (cand.kindSeverity === existing.kindSeverity && KIND_PRIORITY[cand.kind] > KIND_PRIORITY[existing.kind])
    if (takeKind) {
      existing.kind = cand.kind
      existing.kindSeverity = cand.kindSeverity
      existing.titleKey = cand.titleKey
    }
    existing.severity = maxSeverity(existing.severity, cand.severity)
    existing.whyKeys.push(...cand.whyKeys)
    for (const id of cand.evidenceIds) existing.evidenceIds.add(id)
    existing.confidence = Math.max(existing.confidence, cand.confidence)
    existing.fromL1 ||= cand.fromL1
    existing.holdMs = Math.max(existing.holdMs, cand.holdMs)
    existing.metric ??= cand.metric
    if (cand.timeToHarmMin !== undefined) {
      existing.timeToHarmMin =
        existing.timeToHarmMin === undefined
          ? cand.timeToHarmMin
          : Math.min(existing.timeToHarmMin, cand.timeToHarmMin)
    }
  }

  private keyFor(crewId: CrewId, state: StateId | undefined, metric: MetricId | undefined): string {
    return state ? `${crewId}|state:${state}` : `${crewId}|metric:${metric ?? 'unknown'}`
  }

  private holdFor(metric: MetricId | undefined): number {
    return metric && isVitalsCadence(metric) ? this.params.holdMs.vitals : this.params.holdMs.daily
  }

  private timeToHarmId(state: StateId | undefined, metric: MetricId | undefined): EvidenceId | null {
    if (state) {
      const id = `earth.timeToHarmMin.${state}`
      return this.evidence.has(id) ? id : null
    }
    if (metric === 'cabinCo2ppm') return 'earth.timeToHarmMin.co2_high'
    if (metric === 'spo2') return 'earth.timeToHarmMin.spo2_low'
    return null
  }

  private fromL1(h: L1Hit): Candidate {
    const kind: AlertKind = h.rule === 'CAREER_DOSE' || h.rule === 'SPE_DOSE' ? 'RADIATION' : 'LIMIT'
    return {
      key: `${h.crewId}|L1:${h.rule}`,
      crewId: h.crewId,
      kind,
      kindSeverity: h.severity,
      ...(h.state ? { state: h.state } : {}),
      ...(h.metric ? { metric: h.metric } : {}),
      severity: h.severity,
      whyKeys: [
        {
          key: `why.l1.${h.rule}`,
          params: { value: round(h.value), threshold: h.threshold, verified: h.evidenceVerified ? 1 : 0 },
        },
      ],
      evidenceIds: new Set(h.evidenceIds),
      confidence: h.confidence,
      timeToHarmMin: h.timeToHarmMin,
      fromL1: true,
      holdMs: this.holdFor(h.metric ?? 'rad.doseRateMsvDay'),
      titleKey: `alert.l1.${h.rule}.title`,
    }
  }

  private fromL2(h: L2Hit): Candidate {
    const state = this.params.metricState[h.metric]
    const whyKeys: WhyKey[] = [
      {
        key: 'why.l2.deviation',
        params: { metric: h.metric, z: round(h.z), persistFrames: h.persistFrames },
      },
    ]
    const evidenceIds = new Set<string>([
      zThresholdId(h.severity),
      isVitalsCadence(h.metric) ? 'det.persist.minFrames.vitals' : 'det.persist.minFrames.daily',
      `minScale.${h.metric}`,
    ])
    if (h.lowBaselineConfidence) {
      whyKeys.push({ key: 'why.baseline.lowConfidence', params: { confidence: round(h.baselineConfidence) } })
      evidenceIds.add('det.confidence.cap.threshold')
    }
    return {
      key: this.keyFor(h.crewId, state, h.metric),
      crewId: h.crewId,
      kind: 'DEVIATION',
      kindSeverity: h.severity,
      ...(state ? { state } : {}),
      metric: h.metric,
      severity: h.severity,
      whyKeys,
      evidenceIds,
      confidence: h.baselineConfidence,
      fromL1: false,
      holdMs: this.holdFor(h.metric),
      titleKey: state ? `alert.${state}.title` : `alert.metric.${h.metric}.title`,
    }
  }

  private fromL3(h: L3Hit): Candidate {
    const state = this.params.metricState[h.metric]
    const ruleIds: Record<L3Hit['rule'], string[]> = {
      CONSECUTIVE:
        h.metric === 'sleep.durationH'
          ? ['det.trend.sleep.minDays', 'det.trend.sleep.hoursBelow']
          : ['det.trend.exercise.minDays', 'det.trend.exercise.minutesBelow'],
      CUSUM: ['det.cusum.k', 'det.cusum.h'],
      THEIL_SEN: ['det.theilSen.windowDays', 'det.theilSen.minSameSign', `minScale.${h.metric}`],
    }
    const params: Record<string, string | number> = { metric: h.metric }
    for (const [k, v] of Object.entries(h.detail)) params[k] = round(v)
    return {
      key: this.keyFor(h.crewId, state, h.metric),
      crewId: h.crewId,
      kind: 'TREND',
      kindSeverity: h.severity,
      ...(state ? { state } : {}),
      metric: h.metric,
      severity: h.severity,
      whyKeys: [{ key: `why.l3.${h.rule.toLowerCase()}`, params }],
      evidenceIds: new Set(ruleIds[h.rule]),
      confidence: h.confidence,
      fromL1: false,
      holdMs: this.params.holdMs.daily,
      titleKey: state ? `alert.${state}.title` : `alert.metric.${h.metric}.title`,
    }
  }

  private fromState(h: StateHit): Candidate {
    const est = h.estimate
    const evidenceIds = new Set<string>([
      'det.state.sigmoid.k',
      'det.state.sigmoid.bias',
      'det.z.critical',
      stateScoreId(h.severity),
    ])
    let anyDaily = false
    for (const c of est.contributors) {
      if (c.contribution <= 0) continue
      evidenceIds.add(`state.${est.state}.w.${c.metric}`)
      if (!isVitalsCadence(c.metric)) anyDaily = true
    }
    if (est.confidence < this.params.confidenceCap) evidenceIds.add('det.confidence.cap.threshold')
    return {
      key: this.keyFor(est.crewId, est.state, undefined),
      crewId: est.crewId,
      kind: est.state === 'radiation_event' ? 'RADIATION' : 'STATE',
      kindSeverity: h.severity,
      state: est.state,
      severity: h.severity,
      whyKeys: explainState(est, this.params),
      evidenceIds,
      confidence: est.confidence,
      fromL1: false,
      holdMs: anyDaily ? this.params.holdMs.daily : this.params.holdMs.vitals,
      titleKey: `alert.${est.state}.title`,
    }
  }
}

const SEVERITY_DOWN: Record<Severity, Severity> = {
  CRITICAL: 'WARNING',
  WARNING: 'ADVISORY',
  ADVISORY: 'INFO',
  INFO: 'INFO',
}
