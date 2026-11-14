// Algılama testleri için ortak yardımcılar (test dosyası değildir).
import type { ZSnapshot } from '@/core/pipeline'
import { createDefaultEngine, type Engine } from '@/core/pipeline'
import {
  SEVERITIES,
  type AlertEvent,
  type CrewId,
  type ExpectedDetection,
  type MetricId,
  type Severity,
} from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR } from '@/core/units'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'

export function snap(
  metric: MetricId,
  z: number,
  t: number,
  opts: { crewId?: CrewId; confidence?: number; baseline?: boolean } = {},
): ZSnapshot {
  return {
    crewId: opts.crewId ?? 'cdr',
    metric,
    t,
    value: 0,
    z,
    confidence: opts.confidence ?? 1,
    baselineMedian: opts.baseline === false ? null : 0,
    baselineSigma: opts.baseline === false ? null : 1,
  }
}

export interface ScenarioRunResult {
  events: AlertEvent[]
  engine: Engine
  crewDays: number
}

/** Senaryoyu tam motordan (backfill + canlı) sabit batch boyutuyla geçirir. */
export function runScenario(id: string, opts: { seed?: number; batchHours?: number } = {}): ScenarioRunResult {
  const scenario = getScenario(id)
  const sim = new Simulator(scenario, opts.seed !== undefined ? { seed: opts.seed } : {})
  const engine = createDefaultEngine()
  engine.ingest(sim.backfill(), 0)
  const step = (opts.batchHours ?? 6) * MS_PER_HOUR
  const end = scenario.durationDays * MS_PER_DAY
  const events: AlertEvent[] = []
  for (let t = step; t <= end; t += step) {
    events.push(...(engine.ingest(sim.advanceTo(t), t).alertEvents ?? []))
  }
  return { events, engine, crewDays: scenario.crewCount * scenario.durationDays }
}

const rank = (s: Severity): number => SEVERITIES.indexOf(s)

/** WARNING+ seviyesine ulaşmış ayrı uyarı sayısı. */
export function warningPlusCount(events: readonly AlertEvent[]): number {
  return new Set(
    events.filter((e) => e.type !== 'RESOLVED' && rank(e.alert.severity) >= rank('WARNING')).map((e) => e.alert.id),
  ).size
}

/**
 * Beklenen pencere içinde (kişi + durum uyuşan, severity ≥ min) etkin bir uyarı var mı?
 * Faz 5 hızlı sürümü: uyarı pencerede açıldıysa/güncellendiyse ya da pencere başında zaten açıksa sayılır
 * (Faz 8'in firstSeenT kuralı daha katıdır).
 */
export function detectedInWindow(events: readonly AlertEvent[], exp: ExpectedDetection): boolean {
  const open = new Map<string, Severity>()
  for (const e of events) {
    const a = e.alert
    const crewOk = exp.crewId === 'ALL' || a.crewId === exp.crewId
    const stateOk = exp.state === undefined || a.state === exp.state
    if (!crewOk || !stateOk) continue
    if (e.t > exp.toT) break
    const before = open.get(a.id)
    if (e.type === 'RESOLVED') {
      open.delete(a.id)
      // Pencere içinde çözüldüyse, çözülene kadar pencerede etkindi.
      if (e.t >= exp.fromT && before !== undefined && rank(before) >= rank(exp.minSeverity)) return true
      continue
    }
    open.set(a.id, a.severity)
    if (e.t >= exp.fromT && rank(a.severity) >= rank(exp.minSeverity)) return true
  }
  // Pencere boyunca açık kalan uyarılar (pencereden önce açılmış, toT'ye kadar çözülmemiş)
  for (const severity of open.values()) {
    if (rank(severity) >= rank(exp.minSeverity)) return true
  }
  return false
}
