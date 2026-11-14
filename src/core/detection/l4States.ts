// L4 — Durum çıkarımı (FAZ_05 §3.4). Açıklanabilir: her durum skoru katkı listesiyle gelir. Saf TS.
import {
  STATE_IDS,
  type CrewId,
  type MetricId,
  type Severity,
  type SimTimeMs,
  type StateContributor,
  type StateEstimate,
  type StateId,
} from '../types'
import { minSeverity, type DetectionParams } from './params'

/** Metrik başına L4 girdisi: kötü yöndeki z ve baseline güveni. */
export interface MetricZInput {
  zBad: number
  confidence: number
}

/** Faz 6 modüllerinin ek girdisi (bu fazda arayüz var, değer yok). */
export interface ExtraStateInput {
  score: number
  confidence: number
  contributors: StateContributor[]
  /**
   * true ise bu durum modülce belirlenir ve metrik tabanlı L4 tahmini yok sayılır
   * (ör. `radiation_event` = SPE durum makinesi; tek metrikli doz-hızı gürültüsü uyarı üretmesin).
   */
  replace?: boolean
}

export interface StateInputs {
  crewId: CrewId
  t: SimTimeMs
  metrics: Partial<Record<MetricId, MetricZInput>>
  extra?: Partial<Record<StateId, ExtraStateInput>>
}

export interface ExplanationItem {
  key: string
  params: Record<string, string | number>
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Tek durum: eksik metrikler ağırlıktan düşülür ve kalan ağırlıklar yeniden normalize edilir. */
export function estimateState(
  state: StateId,
  inputs: StateInputs,
  params: DetectionParams,
): StateEstimate | null {
  const replaced = inputs.extra?.[state]
  if (replaced?.replace) {
    return {
      crewId: inputs.crewId,
      t: inputs.t,
      state,
      score: replaced.score,
      confidence: replaced.confidence,
      contributors: [...replaced.contributors],
    }
  }

  const weights = params.weights[state]
  let totalW = 0
  let presentW = 0
  let confSum = 0
  let confN = 0
  const present: { metric: MetricId; w: number; zBad: number }[] = []

  for (const [metric, w] of Object.entries(weights) as [MetricId, number][]) {
    totalW += w
    const input = inputs.metrics[metric]
    if (!input || !Number.isFinite(input.zBad)) continue
    presentW += w
    confSum += input.confidence
    confN++
    present.push({ metric, w, zBad: input.zBad })
  }

  const extra = inputs.extra?.[state]
  if (presentW <= 0 && !extra) return null

  const contributors: StateContributor[] = present.map(({ metric, w, zBad }) => {
    const weight = w / presentW
    const f = clamp01(zBad / params.z.critical)
    return { metric, weight, z: zBad, contribution: weight * f }
  })
  const raw = contributors.reduce((acc, c) => acc + c.contribution, 0)
  let score =
    presentW > 0 ? sigmoid(params.state.sigmoidK * (raw - params.state.sigmoidBias)) : 0
  const coverage = totalW > 0 ? presentW / totalW : 0
  let confidence = confN > 0 ? (confSum / confN) * coverage : 0

  if (extra) {
    score = Math.max(score, extra.score)
    confidence = Math.max(confidence, extra.confidence)
    contributors.push(...extra.contributors)
  }
  contributors.sort((a, b) => b.contribution - a.contribution || a.metric.localeCompare(b.metric))

  return { crewId: inputs.crewId, t: inputs.t, state, score, confidence, contributors }
}

export function estimateStates(inputs: StateInputs, params: DetectionParams): StateEstimate[] {
  const out: StateEstimate[] = []
  for (const state of STATE_IDS) {
    const est = estimateState(state, inputs, params)
    if (est) out.push(est)
  }
  return out
}

/**
 * Skor → seviye. Durum çıkarımı tek başına CRITICAL üretmez (üst sınır WARNING); tek istisna `radiation_event`.
 * Güven det.confidence.cap.threshold altındaysa en fazla ADVISORY.
 */
export function stateSeverity(est: StateEstimate, params: DetectionParams): Severity | null {
  const p = params.state
  let level: Severity | null = null
  if (est.score >= p.scoreCritical) level = 'CRITICAL'
  else if (est.score >= p.scoreWarning) level = 'WARNING'
  else if (est.score >= p.scoreAdvisory) level = 'ADVISORY'
  if (!level) return null
  if (est.state !== 'radiation_event') level = minSeverity(level, 'WARNING')
  if (est.confidence < params.confidenceCap) level = minSeverity(level, 'ADVISORY')
  return level
}

/** "Why?" maddeleri: i18n anahtarı + parametre (metinler Faz 9 sözlüğünde). */
export function explainState(est: StateEstimate, params?: DetectionParams): ExplanationItem[] {
  const items: ExplanationItem[] = [
    {
      key: 'why.state.score',
      params: { state: est.state, score: round(est.score), confidence: round(est.confidence) },
    },
  ]
  for (const c of est.contributors) {
    if (c.contribution <= 0) continue
    items.push({
      key: 'why.state.contributor',
      params: {
        metric: c.metric,
        z: round(c.z),
        weightPct: Math.round(c.weight * 100),
        contribution: round(c.contribution),
      },
    })
  }
  if (params && est.confidence < params.confidenceCap) {
    items.push({ key: 'why.baseline.lowConfidence', params: { confidence: round(est.confidence) } })
  }
  return items
}

const round = (x: number): number => Math.round(x * 100) / 100
