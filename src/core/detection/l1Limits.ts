// L1 — Mutlak limitler (FAZ_05 §3.1). Baseline'dan BAĞIMSIZ; confidence = 1. Saf TS.
// Eşikler Evidence'tan. CO2 eşiği DEMO_PARAMETER'dır — NASA limiti gibi sunulmaz.
import type { EvidenceId, EvidenceRegistry } from '../evidence/registry'
import type { CrewId, MetricId, Severity, SimTimeMs, StateId, TelemetryFrame } from '../types'

export type L1Rule = 'SPO2_LOW' | 'CO2_HIGH' | 'CAREER_DOSE' | 'SPE_DOSE'

export interface L1Hit {
  crewId: CrewId
  t: SimTimeMs
  rule: L1Rule
  metric?: MetricId
  state?: StateId
  severity: Severity
  value: number
  threshold: number
  evidenceIds: string[]
  /** Eşiğin dayandığı kanıt kaydının `verified` değeri (UI "doğrulanmadı" etiketi için). */
  evidenceVerified: boolean
  timeToHarmMin: number
  confidence: 1
}

/** Faz 6 radyasyon modülünün sağlayacağı doz girdileri (bu fazda kanca; değer yoksa kural çalışmaz). */
export interface DoseInputs {
  careerMsv?: number
  /** Devam eden/son SPE olay dozu. */
  speDoseMsv?: number
}

export interface L1Context {
  evidence: EvidenceRegistry
  dose?: DoseInputs
}

function hit(
  ctx: L1Context,
  base: Omit<L1Hit, 'evidenceIds' | 'evidenceVerified' | 'timeToHarmMin' | 'confidence'>,
  thresholdId: EvidenceId,
  extraIds: EvidenceId[],
  timeToHarmId: EvidenceId,
): L1Hit {
  return {
    ...base,
    evidenceIds: [thresholdId, ...extraIds, timeToHarmId],
    evidenceVerified: ctx.evidence.getEvidence(thresholdId).verified,
    timeToHarmMin: ctx.evidence.getNumber(timeToHarmId),
    confidence: 1,
  }
}

/** Tek bir çerçeve için mutlak limit isabetleri. */
export function evaluateL1(frame: TelemetryFrame, ctx: L1Context): L1Hit[] {
  const hits: L1Hit[] = []
  if (frame.kind === 'vitals') {
    const threshold = ctx.evidence.getNumber('spo2.critical')
    if (frame.spo2 < threshold) {
      hits.push(
        hit(
          ctx,
          {
            crewId: frame.crewId,
            t: frame.t,
            rule: 'SPO2_LOW',
            metric: 'spo2',
            severity: 'CRITICAL',
            value: frame.spo2,
            threshold,
          },
          'spo2.critical',
          [],
          'earth.timeToHarmMin.spo2_low',
        ),
      )
    }
  } else if (frame.kind === 'daily' && frame.cabinCo2ppm !== undefined) {
    const threshold = ctx.evidence.getNumber('limit.cabinCo2ppm.warning')
    if (frame.cabinCo2ppm >= threshold) {
      hits.push(
        hit(
          ctx,
          {
            crewId: frame.crewId,
            t: frame.t,
            rule: 'CO2_HIGH',
            metric: 'cabinCo2ppm',
            severity: 'WARNING',
            value: frame.cabinCo2ppm,
            threshold,
          },
          'limit.cabinCo2ppm.warning',
          [],
          'earth.timeToHarmMin.co2_high',
        ),
      )
    }
  }
  return hits
}

/**
 * Doz yaklaşımı kancası (Faz 6 radyasyon modülü `DoseInputs` sağlar).
 * Kariyer: `rad.career.limit.msv` × warn/critical oranı. SPE: olay dozunun 250 mSv
 * "design reference SPE protection target"'a (`rad.spe.limit.msv`) oranı — kişisel limit DEĞİL.
 */
export function evaluateDoseL1(
  crewId: CrewId,
  t: SimTimeMs,
  dose: DoseInputs | undefined,
  ctx: L1Context,
): L1Hit[] {
  if (!dose) return []
  const hits: L1Hit[] = []
  const levelFor = (fraction: number, warnId: EvidenceId, critId: EvidenceId): Severity | null => {
    if (fraction >= ctx.evidence.getNumber(critId)) return 'CRITICAL'
    if (fraction >= ctx.evidence.getNumber(warnId)) return 'WARNING'
    return null
  }

  if (dose.careerMsv !== undefined) {
    const limit = ctx.evidence.getNumber('rad.career.limit.msv')
    const severity = levelFor(
      dose.careerMsv / limit,
      'rad.career.warn.fraction',
      'rad.career.critical.fraction',
    )
    if (severity) {
      hits.push(
        hit(
          ctx,
          { crewId, t, rule: 'CAREER_DOSE', severity, value: dose.careerMsv, threshold: limit },
          'rad.career.limit.msv',
          ['rad.career.warn.fraction', 'rad.career.critical.fraction'],
          'earth.timeToHarmMin.career_dose',
        ),
      )
    }
  }

  if (dose.speDoseMsv !== undefined) {
    const target = ctx.evidence.getNumber('rad.spe.limit.msv')
    const severity = levelFor(
      dose.speDoseMsv / target,
      'rad.spe.warn.fraction',
      'rad.spe.critical.fraction',
    )
    if (severity) {
      hits.push(
        hit(
          ctx,
          {
            crewId,
            t,
            rule: 'SPE_DOSE',
            state: 'radiation_event',
            severity,
            value: dose.speDoseMsv,
            threshold: target,
          },
          'rad.spe.limit.msv',
          ['rad.spe.warn.fraction', 'rad.spe.critical.fraction'],
          'earth.timeToHarmMin.radiation_event',
        ),
      )
    }
  }
  return hits
}
