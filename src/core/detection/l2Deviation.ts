// L2 — Kişisel sapma (FAZ_05 §3.2). Girdi: BaselineStage'in ZSnapshot'ları. Saf TS.
// Yalnızca "kötü" yöndeki z kullanılır; tek kare yetmez (kalıcılık); düşük baseline güveninde en fazla ADVISORY.
import type { ZSnapshot } from '../pipeline/stages'
import { METRIC_META, type CrewId, type MetricId, type Severity, type SimTimeMs } from '../types'
import { minSeverity, type DetectionParams } from './params'

export interface L2Hit {
  crewId: CrewId
  metric: MetricId
  t: SimTimeMs
  severity: Severity
  /** İşaretli ham z. */
  z: number
  /** Kötü yöndeki z (higher_worse → +z, lower_worse → −z, both → |z|). */
  zBad: number
  persistFrames: number
  baselineConfidence: number
  lowBaselineConfidence: boolean
}

export function badDirectionZ(metric: MetricId, z: number): number {
  const direction = METRIC_META[metric].direction
  if (direction === 'higher_worse') return z
  if (direction === 'lower_worse') return -z
  return Math.abs(z)
}

export function isVitalsCadence(metric: MetricId): boolean {
  return METRIC_META[metric].frameKind !== 'daily'
}

/** z düzeyi (kalıcılık öncesi). det.z.critical düzeyi de raporlanır; nihai CRITICAL politikasını AlertManager uygular. */
export function zLevel(zBad: number, params: DetectionParams): Severity | null {
  if (zBad >= params.z.critical) return 'CRITICAL'
  if (zBad >= params.z.warning) return 'WARNING'
  if (zBad >= params.z.advisory) return 'ADVISORY'
  return null
}

interface SeriesState {
  /** Son N karenin düzeyleri (null = eşik altı). */
  levels: (Severity | null)[]
  run: number
}

export class L2Detector {
  private readonly series = new Map<string, SeriesState>()
  private readonly params: DetectionParams

  constructor(params: DetectionParams) {
    this.params = params
  }

  /** Tek bir z anlık görüntüsünü işler; kalıcılık şartı sağlanırsa isabet döner. */
  process(snap: ZSnapshot): L2Hit | null {
    const key = `${snap.crewId}|${snap.metric}`
    let state = this.series.get(key)
    if (!state) {
      state = { levels: [], run: 0 }
      this.series.set(key, state)
    }

    // Soğuk başlangıç: baseline yoksa z kullanılmaz (FAZ_04 sözleşmesi) — seri sıfırlanır.
    if (snap.baselineMedian === null || !Number.isFinite(snap.z)) {
      state.levels = []
      state.run = 0
      return null
    }

    const required = Math.max(
      1,
      isVitalsCadence(snap.metric) ? this.params.persistFrames.vitals : this.params.persistFrames.daily,
    )
    const zBad = badDirectionZ(snap.metric, snap.z)
    const level = zLevel(zBad, this.params)

    state.levels.push(level)
    if (state.levels.length > required) state.levels.shift()
    state.run = level ? state.run + 1 : 0

    if (state.levels.length < required || state.levels.some((l) => l === null)) return null

    // Kalıcı düzey: son `required` karenin hepsinin ulaştığı en yüksek düzey.
    let persistent: Severity = 'CRITICAL'
    for (const l of state.levels) if (l) persistent = minSeverity(persistent, l)

    const lowBaselineConfidence = snap.confidence < this.params.confidenceCap
    const severity = lowBaselineConfidence ? minSeverity(persistent, 'ADVISORY') : persistent

    return {
      crewId: snap.crewId,
      metric: snap.metric,
      t: snap.t,
      severity,
      z: snap.z,
      zBad,
      persistFrames: state.run,
      baselineConfidence: snap.confidence,
      lowBaselineConfidence,
    }
  }

  reset(): void {
    this.series.clear()
  }
}
