// Doğrulama eşleştirme ve metrik hesaplayıcı (FAZ_08 §3.2). Saf TS.
import { median, quantile } from '../baseline/robustStats'
import type { ScenarioEvent } from '../../sim/scenario'
import type {
  AlertEvent,
  AlertKind,
  CrewId,
  EarthDelayClass,
  ExpectedDetection,
  MetricId,
  ScenarioId,
  Severity,
  SimTimeMs,
  StateId,
} from '../types'
import { MS_PER_DAY, MS_PER_MIN } from '../units'
import type {
  CrewBreakdown,
  ExpectedMatchRecord,
  ScenarioEventStrength,
  ScenarioRun,
  ScenarioScore,
  StateBreakdown,
  UnexpectedAlertRecord,
} from './types'

const SEVERITY_ORDER: Record<Severity, number> = {
  INFO: 0,
  ADVISORY: 1,
  WARNING: 2,
  CRITICAL: 3,
}

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER[s]
}

export function classifyScenarioStrength(scenarioId: ScenarioId): ScenarioEventStrength {
  switch (scenarioId) {
    case 'nominal':
    case 'new_crew_member':
      return 'NONE'
    case 'isolation_low_mood':
      return 'MODERATE'
    default:
      return 'STRONG'
  }
}

interface EpisodeRecord {
  t: SimTimeMs
  type: AlertEvent['type']
  severity: Severity
  earthDelayClass: EarthDelayClass
}

interface AlertEpisode {
  alertId: string
  crewId: CrewId
  state?: StateId
  kind: AlertKind
  metric?: MetricId
  openedT: SimTimeMs
  resolvedT: SimTimeMs | null
  maxSeverity: Severity
  firstWarningPlusT: SimTimeMs | null
  records: EpisodeRecord[]
}

export function extractAlertEpisodes(events: readonly AlertEvent[]): AlertEpisode[] {
  const byId = new Map<string, AlertEpisode>()

  for (const event of events) {
    const a = event.alert
    let ep = byId.get(a.id)
    if (!ep) {
      ep = {
        alertId: a.id,
        crewId: a.crewId,
        ...(a.state !== undefined ? { state: a.state } : {}),
        kind: a.kind,
        ...(a.metric !== undefined ? { metric: a.metric } : {}),
        openedT: event.t,
        resolvedT: null,
        maxSeverity: a.severity,
        firstWarningPlusT:
          event.type !== 'RESOLVED' && severityRank(a.severity) >= severityRank('WARNING')
            ? event.t
            : null,
        records: [],
      }
      byId.set(a.id, ep)
    }

    ep.records.push({
      t: event.t,
      type: event.type,
      severity: a.severity,
      earthDelayClass: a.earthDelayClass,
    })

    if (event.type === 'RESOLVED') {
      ep.resolvedT = event.t
    } else {
      if (severityRank(a.severity) > severityRank(ep.maxSeverity)) {
        ep.maxSeverity = a.severity
      }
      if (
        ep.firstWarningPlusT === null &&
        severityRank(a.severity) >= severityRank('WARNING')
      ) {
        ep.firstWarningPlusT = event.t
      }
    }
  }

  return [...byId.values()]
}

export interface ExpandedExpected {
  id: string
  crewId: CrewId
  state?: StateId
  alertKind?: AlertKind
  metric?: MetricId
  fromT: SimTimeMs
  toT: SimTimeMs
  minSeverity: Severity
  mustBeEarthClass?: EarthDelayClass
}

export function expandExpectedDetections(
  expected: readonly ExpectedDetection[],
  crewIds: readonly CrewId[],
): ExpandedExpected[] {
  const out: ExpandedExpected[] = []
  for (const exp of expected) {
    const targets = exp.crewId === 'ALL' ? crewIds : [exp.crewId]
    for (const crewId of targets) {
      out.push({
        id: exp.crewId === 'ALL' ? `${exp.id}:${crewId}` : exp.id,
        crewId,
        ...(exp.state !== undefined ? { state: exp.state } : {}),
        ...(exp.alertKind !== undefined ? { alertKind: exp.alertKind } : {}),
        ...(exp.metric !== undefined ? { metric: exp.metric } : {}),
        fromT: exp.fromT,
        toT: exp.toT,
        minSeverity: exp.minSeverity,
        ...(exp.mustBeEarthClass !== undefined ? { mustBeEarthClass: exp.mustBeEarthClass } : {}),
      })
    }
  }
  return out
}

function episodeMatchesExpectationMeta(ep: AlertEpisode, exp: ExpandedExpected): boolean {
  if (ep.crewId !== exp.crewId) return false
  if (exp.state !== undefined) {
    // AlertManager katmanları kişi+durum altında birleştirir (`kind: 'STATE'` ve metrik opsiyonel olabilir).
    return ep.state === exp.state
  }
  if (exp.alertKind !== undefined && ep.kind !== exp.alertKind) return false
  if (exp.metric !== undefined && ep.metric !== exp.metric) return false
  return true
}

function findFirstMatchInWindow(
  ep: AlertEpisode,
  exp: ExpandedExpected,
): EpisodeRecord | null {
  const minRank = severityRank(exp.minSeverity)
  for (const rec of ep.records) {
    if (rec.type === 'RESOLVED') continue
    if (severityRank(rec.severity) >= minRank) {
      // firstSeenT: minimum şiddete ilk kez ulaşılan zaman [fromT, toT] içinde olmalı (FAZ_08 §3.2)
      return rec.t >= exp.fromT && rec.t <= exp.toT ? rec : null
    }
  }
  return null
}

function episodeOverlapsExpectationWindow(ep: AlertEpisode, exp: ExpandedExpected): boolean {
  const endT = ep.resolvedT ?? Number.POSITIVE_INFINITY
  return ep.openedT <= exp.toT && endT >= exp.fromT && severityRank(ep.maxSeverity) >= severityRank(exp.minSeverity)
}

export interface ScoredRunDetail {
  score: ScenarioScore
  matches: ExpectedMatchRecord[]
  unexpected: UnexpectedAlertRecord[]
  latenciesMin: number[]
  eventFreeCrewDays: number
  cleanEventFreeCrewDays: number
  nominalDaysTotal: number
  nominalDaysClean: number
}

function isCrewDayEventful(
  crewId: CrewId,
  dayStart: SimTimeMs,
  dayEnd: SimTimeMs,
  events: readonly ScenarioEvent[],
  expected: readonly ExpandedExpected[],
): boolean {
  for (const ev of events) {
    const applies = ev.crewIds === 'ALL' || ev.crewIds.includes(crewId)
    if (applies && ev.fromT < dayEnd && ev.toT > dayStart) return true
  }
  for (const exp of expected) {
    if (exp.crewId === crewId && exp.fromT < dayEnd && exp.toT > dayStart) return true
  }
  return false
}

const emptyCrewBucket = (): {
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  latencies: number[]
} => ({ tp: 0, fn: 0, fp: 0, advisoryCount: 0, latencies: [] })

export function scoreScenarioRunDetailed(run: ScenarioRun): ScoredRunDetail {
  const episodes = extractAlertEpisodes(run.alertEvents)
  const expanded = expandExpectedDetections(run.expected, run.crewIds)
  const matchedEpisodeIds = new Set<string>()
  const matches: ExpectedMatchRecord[] = []
  const latenciesMin: number[] = []

  const crewBuckets = new Map<CrewId, ReturnType<typeof emptyCrewBucket>>()
  const stateBuckets = new Map<string, ReturnType<typeof emptyCrewBucket>>()
  for (const crewId of run.crewIds) {
    crewBuckets.set(crewId, emptyCrewBucket())
  }
  const getCrewBucket = (crewId: CrewId) => {
    let b = crewBuckets.get(crewId)
    if (!b) {
      b = emptyCrewBucket()
      crewBuckets.set(crewId, b)
    }
    return b
  }
  const getStateBucket = (stateKey: string) => {
    let b = stateBuckets.get(stateKey)
    if (!b) {
      b = emptyCrewBucket()
      stateBuckets.set(stateKey, b)
    }
    return b
  }

  let tp = 0
  let fn = 0
  let triageChecked = 0
  let triagePassed = 0

  for (const exp of expanded) {
    const eligible: Array<{ ep: AlertEpisode; rec: EpisodeRecord }> = []

    for (const ep of episodes) {
      if (!episodeMatchesExpectationMeta(ep, exp)) continue
      const hit = findFirstMatchInWindow(ep, exp)
      if (hit) {
        eligible.push({ ep, rec: hit })
      } else if (episodeOverlapsExpectationWindow(ep, exp)) {
        // Aynı olaya ait pencereyle örtüşen ek yinelemeleri FP saymamak için işaretle
        matchedEpisodeIds.add(ep.alertId)
      }
    }

    eligible.sort((a, b) => a.rec.t - b.rec.t)
    const stateKey = exp.state ?? exp.metric ?? exp.alertKind ?? 'unknown'
    const cBucket = getCrewBucket(exp.crewId)
    const sBucket = getStateBucket(stateKey)

    if (eligible.length > 0) {
      const winner = eligible[0]!
      for (const item of eligible) matchedEpisodeIds.add(item.ep.alertId)

      const latencyMin = (winner.rec.t - exp.fromT) / MS_PER_MIN
      const earthClass = winner.rec.earthDelayClass
      const earthClassOk =
        exp.mustBeEarthClass !== undefined ? earthClass === exp.mustBeEarthClass : null

      tp += 1
      cBucket.tp += 1
      sBucket.tp += 1
      latenciesMin.push(latencyMin)
      cBucket.latencies.push(latencyMin)
      sBucket.latencies.push(latencyMin)

      if (earthClassOk !== null) {
        triageChecked += 1
        if (earthClassOk) triagePassed += 1
      }

      matches.push({
        expectedId: exp.id,
        crewId: exp.crewId,
        ...(exp.state !== undefined ? { state: exp.state } : {}),
        ...(exp.alertKind !== undefined ? { alertKind: exp.alertKind } : {}),
        ...(exp.metric !== undefined ? { metric: exp.metric } : {}),
        fromT: exp.fromT,
        toT: exp.toT,
        minSeverity: exp.minSeverity,
        ...(exp.mustBeEarthClass !== undefined ? { mustBeEarthClass: exp.mustBeEarthClass } : {}),
        matched: true,
        alertId: winner.ep.alertId,
        firstSeenT: winner.rec.t,
        latencyMin,
        matchedSeverity: winner.rec.severity,
        earthClass,
        earthClassOk,
      })
    } else {
      fn += 1
      cBucket.fn += 1
      sBucket.fn += 1
      if (exp.mustBeEarthClass !== undefined) {
        triageChecked += 1
      }

      matches.push({
        expectedId: exp.id,
        crewId: exp.crewId,
        ...(exp.state !== undefined ? { state: exp.state } : {}),
        ...(exp.alertKind !== undefined ? { alertKind: exp.alertKind } : {}),
        ...(exp.metric !== undefined ? { metric: exp.metric } : {}),
        fromT: exp.fromT,
        toT: exp.toT,
        minSeverity: exp.minSeverity,
        ...(exp.mustBeEarthClass !== undefined ? { mustBeEarthClass: exp.mustBeEarthClass } : {}),
        matched: false,
        alertId: null,
        firstSeenT: null,
        latencyMin: null,
        matchedSeverity: null,
        earthClass: null,
        earthClassOk: exp.mustBeEarthClass !== undefined ? false : null,
      })
    }
  }

  let fp = 0
  let advisoryCount = 0
  const unexpected: UnexpectedAlertRecord[] = []
  const warnPlusEpisodes: AlertEpisode[] = []

  for (const ep of episodes) {
    if (ep.firstWarningPlusT !== null) {
      warnPlusEpisodes.push(ep)
    }
    if (matchedEpisodeIds.has(ep.alertId)) continue

    const cBucket = getCrewBucket(ep.crewId)
    const stateKey = ep.state ?? ep.metric ?? ep.kind
    const sBucket = getStateBucket(stateKey)

    if (severityRank(ep.maxSeverity) >= severityRank('WARNING')) {
      fp += 1
      cBucket.fp += 1
      sBucket.fp += 1
      unexpected.push({
        alertId: ep.alertId,
        crewId: ep.crewId,
        ...(ep.state !== undefined ? { state: ep.state } : {}),
        kind: ep.kind,
        ...(ep.metric !== undefined ? { metric: ep.metric } : {}),
        openedT: ep.openedT,
        resolvedT: ep.resolvedT,
        maxSeverity: ep.maxSeverity,
        category: 'FP',
      })
    } else if (ep.maxSeverity === 'ADVISORY') {
      advisoryCount += 1
      cBucket.advisoryCount += 1
      sBucket.advisoryCount += 1
      unexpected.push({
        alertId: ep.alertId,
        crewId: ep.crewId,
        ...(ep.state !== undefined ? { state: ep.state } : {}),
        kind: ep.kind,
        ...(ep.metric !== undefined ? { metric: ep.metric } : {}),
        openedT: ep.openedT,
        resolvedT: ep.resolvedT,
        maxSeverity: ep.maxSeverity,
        category: 'ADVISORY',
      })
    }
  }

  // Özgüllük (FAZ_08 §3.2): olaysız kişi-günlerin WARNING+ uyarısız kalma oranı
  const simEndT = run.durationDays * MS_PER_DAY
  let eventFreeCrewDays = 0
  let cleanEventFreeCrewDays = 0
  let nominalDaysTotal = 0
  let nominalDaysClean = 0

  for (let day = 0; day < run.durationDays; day++) {
    const dayStart = day * MS_PER_DAY
    const dayEnd = (day + 1) * MS_PER_DAY
    let dayHasWarnPlus = false

    for (const crewId of run.crewIds) {
      const crewWarnOnDay = warnPlusEpisodes.some((ep) => {
        if (ep.crewId !== crewId || ep.firstWarningPlusT === null) return false
        const end = ep.resolvedT ?? simEndT
        return ep.firstWarningPlusT < dayEnd && end >= dayStart
      })
      if (crewWarnOnDay) dayHasWarnPlus = true

      if (!isCrewDayEventful(crewId, dayStart, dayEnd, run.events, expanded)) {
        eventFreeCrewDays += 1
        if (!crewWarnOnDay) cleanEventFreeCrewDays += 1
      }
    }

    if (run.scenarioId === 'nominal') {
      nominalDaysTotal += 1
      if (!dayHasWarnPlus) nominalDaysClean += 1
    }
  }

  const recall = tp + fn > 0 ? tp / (tp + fn) : null
  const precision = tp + fp > 0 ? tp / (tp + fp) : null
  const specificity = eventFreeCrewDays > 0 ? cleanEventFreeCrewDays / eventFreeCrewDays : null
  const nominalAlertFreeDayPct =
    nominalDaysTotal > 0 ? (nominalDaysClean / nominalDaysTotal) * 100 : null
  const medianLatencyMin = median(latenciesMin) ?? null
  const p90LatencyMin = quantile(latenciesMin, 0.9) ?? null
  const triageAccuracy = triageChecked > 0 ? triagePassed / triageChecked : null

  const byCrew: Record<string, CrewBreakdown> = {}
  for (const [crewId, b] of crewBuckets) {
    byCrew[crewId] = {
      tp: b.tp,
      fn: b.fn,
      fp: b.fp,
      advisoryCount: b.advisoryCount,
      recall: b.tp + b.fn > 0 ? b.tp / (b.tp + b.fn) : null,
      precision: b.tp + b.fp > 0 ? b.tp / (b.tp + b.fp) : null,
      medianLatencyMin: median(b.latencies) ?? null,
    }
  }

  const byState: Record<string, StateBreakdown> = {}
  for (const [stateKey, b] of stateBuckets) {
    byState[stateKey] = {
      tp: b.tp,
      fn: b.fn,
      fp: b.fp,
      advisoryCount: b.advisoryCount,
      recall: b.tp + b.fn > 0 ? b.tp / (b.tp + b.fn) : null,
      precision: b.tp + b.fp > 0 ? b.tp / (b.tp + b.fp) : null,
      medianLatencyMin: median(b.latencies) ?? null,
    }
  }

  return {
    score: {
      scenarioId: run.scenarioId,
      eventStrength: classifyScenarioStrength(run.scenarioId),
      runsCount: 1,
      crewDays: run.crewDays,
      tp,
      fn,
      fp,
      advisoryCount,
      recall,
      precision,
      specificity,
      nominalAlertFreeDayPct,
      fpPerCrewDay: run.crewDays > 0 ? fp / run.crewDays : 0,
      advisoryPerCrewDay: run.crewDays > 0 ? advisoryCount / run.crewDays : 0,
      medianLatencyMin,
      p90LatencyMin,
      triageAccuracy,
      triageChecked,
      triagePassed,
      byCrew,
      byState,
    },
    matches,
    unexpected,
    latenciesMin,
    eventFreeCrewDays,
    cleanEventFreeCrewDays,
    nominalDaysTotal,
    nominalDaysClean,
  }
}

export function scoreScenarioRun(run: ScenarioRun): ScenarioScore {
  return scoreScenarioRunDetailed(run).score
}

interface MutableBreakdown {
  tp: number
  fn: number
  fp: number
  advisoryCount: number
  latencies: number[]
}

function mergeBreakdowns(
  target: Map<string, MutableBreakdown>,
  source: Record<string, CrewBreakdown | StateBreakdown>,
  latenciesSource?: number[],
): void {
  for (const [key, b] of Object.entries(source)) {
    let cur = target.get(key)
    if (!cur) {
      cur = { tp: 0, fn: 0, fp: 0, advisoryCount: 0, latencies: [] }
      target.set(key, cur)
    }
    cur.tp += b.tp
    cur.fn += b.fn
    cur.fp += b.fp
    cur.advisoryCount += b.advisoryCount
    if (b.medianLatencyMin !== null && latenciesSource === undefined) {
      cur.latencies.push(b.medianLatencyMin)
    }
  }
}

export function scoreScenarioRuns(runs: readonly ScenarioRun[]): ScenarioScore[] {
  const byScenario = new Map<ScenarioId, ScoredRunDetail[]>()
  for (const run of runs) {
    const list = byScenario.get(run.scenarioId) ?? []
    list.push(scoreScenarioRunDetailed(run))
    byScenario.set(run.scenarioId, list)
  }

  const out: ScenarioScore[] = []
  for (const [scenarioId, details] of byScenario) {
    let tp = 0
    let fn = 0
    let fp = 0
    let advisoryCount = 0
    let crewDays = 0
    let triageChecked = 0
    let triagePassed = 0
    let eventFreeCrewDays = 0
    let cleanEventFreeCrewDays = 0
    let nominalDaysTotal = 0
    let nominalDaysClean = 0
    const latenciesMin: number[] = []
    const crewMap = new Map<string, MutableBreakdown>()
    const stateMap = new Map<string, MutableBreakdown>()

    for (const d of details) {
      tp += d.score.tp
      fn += d.score.fn
      fp += d.score.fp
      advisoryCount += d.score.advisoryCount
      crewDays += d.score.crewDays
      triageChecked += d.score.triageChecked
      triagePassed += d.score.triagePassed
      eventFreeCrewDays += d.eventFreeCrewDays
      cleanEventFreeCrewDays += d.cleanEventFreeCrewDays
      nominalDaysTotal += d.nominalDaysTotal
      nominalDaysClean += d.nominalDaysClean
      latenciesMin.push(...d.latenciesMin)
      mergeBreakdowns(crewMap, d.score.byCrew)
      mergeBreakdowns(stateMap, d.score.byState)
    }

    // Ham eşleşme gecikmelerini yeniden topla (kaba medyan yerine kesin dağılım için)
    for (const b of crewMap.values()) b.latencies = []
    for (const b of stateMap.values()) b.latencies = []
    for (const d of details) {
      for (const m of d.matches) {
        if (!m.matched || m.latencyMin === null) continue
        crewMap.get(m.crewId)?.latencies.push(m.latencyMin)
        const sk = m.state ?? m.metric ?? m.alertKind ?? 'unknown'
        stateMap.get(sk)?.latencies.push(m.latencyMin)
      }
    }

    const byCrew: Record<string, CrewBreakdown> = {}
    for (const [k, b] of crewMap) {
      byCrew[k] = {
        tp: b.tp,
        fn: b.fn,
        fp: b.fp,
        advisoryCount: b.advisoryCount,
        recall: b.tp + b.fn > 0 ? b.tp / (b.tp + b.fn) : null,
        precision: b.tp + b.fp > 0 ? b.tp / (b.tp + b.fp) : null,
        medianLatencyMin: median(b.latencies) ?? null,
      }
    }

    const byState: Record<string, StateBreakdown> = {}
    for (const [k, b] of stateMap) {
      byState[k] = {
        tp: b.tp,
        fn: b.fn,
        fp: b.fp,
        advisoryCount: b.advisoryCount,
        recall: b.tp + b.fn > 0 ? b.tp / (b.tp + b.fn) : null,
        precision: b.tp + b.fp > 0 ? b.tp / (b.tp + b.fp) : null,
        medianLatencyMin: median(b.latencies) ?? null,
      }
    }

    out.push({
      scenarioId,
      eventStrength: classifyScenarioStrength(scenarioId),
      runsCount: details.length,
      crewDays,
      tp,
      fn,
      fp,
      advisoryCount,
      recall: tp + fn > 0 ? tp / (tp + fn) : null,
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
      specificity: eventFreeCrewDays > 0 ? cleanEventFreeCrewDays / eventFreeCrewDays : null,
      nominalAlertFreeDayPct:
        nominalDaysTotal > 0 ? (nominalDaysClean / nominalDaysTotal) * 100 : null,
      fpPerCrewDay: crewDays > 0 ? fp / crewDays : 0,
      advisoryPerCrewDay: crewDays > 0 ? advisoryCount / crewDays : 0,
      medianLatencyMin: median(latenciesMin) ?? null,
      p90LatencyMin: quantile(latenciesMin, 0.9) ?? null,
      triageAccuracy: triageChecked > 0 ? triagePassed / triageChecked : null,
      triageChecked,
      triagePassed,
      byCrew,
      byState,
    })
  }

  return out
}
