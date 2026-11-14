// Deterministik JSON ve jüri-sunumuna uygun Markdown doğrulama raporu biçimlendirici (FAZ_08 §3.4).
// Dosyaya duvar saati zaman damgası YAZMAZ (aynı kod + parametre → birebir aynı çıktı).
import type { ScenarioScore, ValidationReport, ValidationTargetCheck } from './types'

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtNum(v: number | null, digits = 3): string {
  if (v === null) return '—'
  return v.toFixed(digits)
}

function fmtTargetStatus(check: ValidationTargetCheck): string {
  const icon = check.status === 'PASS' ? '✅ PASS' : '⚠️ WARN'
  const op = check.comparator === 'LTE' ? '<=' : '>='
  const actualText =
    check.actual === null
      ? '—'
      : check.metricKey.toLowerCase().includes('recall')
        ? fmtPct(check.actual)
        : fmtNum(check.actual, check.metricKey === 'speDetectP90Min' ? 1 : 3)
  const targetText = check.metricKey.toLowerCase().includes('recall')
    ? fmtPct(check.target)
    : fmtNum(check.target, check.metricKey === 'speDetectP90Min' ? 1 : 3)
  return `| \`${check.metricKey}\` | ${actualText} | ${op} ${targetText} | ${icon} |`
}

function fmtScenarioRow(s: ScenarioScore): string {
  const nomClean =
    s.nominalAlertFreeDayPct !== null ? `${s.nominalAlertFreeDayPct.toFixed(1)}%` : '—'
  return `| \`${s.scenarioId}\` | ${s.eventStrength} | ${s.runsCount} | ${s.tp} | ${s.fn} | ${s.fp} | ${s.advisoryCount} | ${fmtPct(s.recall)} | ${fmtPct(s.precision)} | ${fmtPct(s.specificity)} | ${fmtNum(s.fpPerCrewDay, 4)} | ${fmtNum(s.medianLatencyMin, 1)} | ${fmtNum(s.p90LatencyMin, 1)} | ${fmtPct(s.triageAccuracy)} | ${nomClean} |`
}

export function formatValidationReportJson(report: ValidationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function formatValidationReportMarkdown(report: ValidationReport): string {
  const lines: string[] = []
  const agg = report.aggregate

  lines.push('# Validation Report — Astro Health Cockpit (Synthetic Benchmark)')
  lines.push('')
  lines.push(
    '> **Methodology Notice:** This report measures internal software consistency and rule-trigger behavior on deterministic synthetic scenarios. It is **not** clinical validation and makes **no** claim of medical diagnostic accuracy.',
  )
  lines.push('')

  lines.push('## Metadata & Reproducibility')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|---|---|')
  lines.push(`| Parameter Version | \`${report.params.paramsVersion}\` |`)
  lines.push(`| Evidence Fingerprint (FNV-1a DEMO) | \`${report.params.evidenceFingerprint}\` |`)
  lines.push(`| Execution Mode | ${report.quick ? 'quick' : 'full'} |`)
  lines.push(`| Tuning Seeds | \`[${report.params.tuningSeeds.join(', ')}]\` |`)
  lines.push(`| Report Seeds | \`[${report.params.reportSeeds.join(', ')}]\` |`)
  lines.push(`| Engine Batch Step | ${report.params.batchHours} sim-hours |`)
  lines.push('')

  lines.push('## Target Evaluation (Report Seed Set)')
  lines.push('')
  lines.push('| Target Metric | Actual | Threshold | Status |')
  lines.push('|---|---|---|---|')
  for (const check of report.targetChecks) {
    lines.push(fmtTargetStatus(check))
  }
  lines.push('')

  lines.push('## Aggregate Summary & Seed-Set Split (Tuning vs Report)')
  lines.push('')
  lines.push(
    '| Seed Set | Runs | Crew-Days | TP | FN | WARNING+ FP | ADVISORY Noise (excl. FP) | Recall | Precision | Specificity | Strong Recall | Moderate Recall | SPE Detect P90 (min) | Triage Accuracy |',
  )
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const set of [report.tuningSummary, report.reportSummary]) {
    const a = set.aggregate
    lines.push(
      `| ${set.label} (${set.seeds.length} seeds) | ${a.totalRuns} | ${a.totalCrewDays} | ${a.tp} | ${a.fn} | ${a.fp} | ${a.advisoryCount} | ${fmtPct(a.recall)} | ${fmtPct(a.precision)} | ${fmtPct(a.specificity)} | ${fmtPct(a.strongRecall)} | ${fmtPct(a.moderateRecall)} | ${fmtNum(a.speDetectP90Min, 1)} | ${fmtPct(a.triageAccuracy)} |`,
    )
  }
  lines.push('')

  const overfitStatus = report.overfitting.detected ? '⚠️ Overfitting risk' : '✅ Within gap'
  lines.push(
    `**Overfitting Check:** Tuning Recall = ${fmtPct(report.overfitting.tuningRecall)}, Report Recall = ${fmtPct(report.overfitting.reportRecall)}, Gap = ${report.overfitting.recallGap !== null ? fmtPct(report.overfitting.recallGap) : '—'} (Threshold <= ${fmtPct(report.overfitting.threshold)}) → **${overfitStatus}**`,
  )
  lines.push('')

  lines.push('## Scenario Breakdown (Report Seeds)')
  lines.push('')
  lines.push(
    '| Scenario | Strength | Runs | TP | FN | WARNING+ FP | ADVISORY Noise | Recall | Precision | Specificity | FP / Crew-Day | Median Delay (min) | P90 Delay (min) | Triage Acc | Nominal Alert-Free Days |',
  )
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const s of report.scenarios) {
    lines.push(fmtScenarioRow(s))
  }
  lines.push('')

  lines.push('## False Positive vs Advisory Separation')
  lines.push('')
  lines.push('| Alert Category | Total Count | Rate per Crew-Day | Included in FP / Specificity? |')
  lines.push('|---|---|---|---|')
  lines.push(
    `| Unmatched WARNING / CRITICAL (FP) | ${agg.fp} | ${fmtNum(agg.fpPerCrewDay, 4)} | Yes |`,
  )
  lines.push(
    `| Unmatched ADVISORY (Informational Noise) | ${agg.advisoryCount} | ${fmtNum(agg.advisoryPerCrewDay, 4)} | No (reported separately) |`,
  )
  lines.push('')

  if (report.sensitivity.length > 0) {
    lines.push('## Parameter Sensitivity Analysis (Temporary Overrides)')
    lines.push('')
    lines.push('| Parameter | Variation | Value | TP | FN | WARNING+ FP | Recall | FP / Crew-Day | ADVISORY / Crew-Day |')
    lines.push('|---|---|---|---|---|---|---|---|---|')
    for (const row of report.sensitivity) {
      for (const pt of row.points) {
        const label = pt.label === 'minus' ? `-${row.pct}%` : pt.label === 'plus' ? `+${row.pct}%` : 'base'
        lines.push(
          `| \`${row.parameter}\` | ${label} | ${pt.value} | ${pt.tp} | ${pt.fn} | ${pt.fp} | ${fmtPct(pt.recall)} | ${fmtNum(pt.fpPerCrewDay, 4)} | ${fmtNum(pt.advisoryPerCrewDay, 4)} |`,
        )
      }
    }
    lines.push('')
  }

  lines.push('## Limitations (Mandatory)')
  lines.push('')
  for (const lim of report.limitations) {
    lines.push(`- ${lim}`)
  }
  lines.push('')

  lines.push('## Scoring Assumptions')
  lines.push('')
  for (const assumption of report.assumptions) {
    lines.push(`- ${assumption}`)
  }
  lines.push('')

  return lines.join('\n')
}

export function formatValidationConsoleSummary(report: ValidationReport): string {
  const agg = report.aggregate
  const lines: string[] = [
    `Validation (${report.quick ? 'quick' : 'full'}) · fingerprint=${report.params.evidenceFingerprint}`,
    `Report seeds (${report.reportSummary.seeds.length}): TP=${agg.tp} FN=${agg.fn} FP(WARNING+)=${agg.fp} ADVISORY=${agg.advisoryCount} | Recall=${fmtPct(agg.recall)} Strong=${fmtPct(agg.strongRecall)} Moderate=${fmtPct(agg.moderateRecall)} Specificity=${fmtPct(agg.specificity)} NominalFP=${fmtNum(agg.nominalFpPerCrewDay, 4)}/cd SPE_P90=${fmtNum(agg.speDetectP90Min, 1)}min Triage=${fmtPct(agg.triageAccuracy)}`,
    ...report.targetChecks.map(
      (c) =>
        `  [${c.status}] ${c.metricKey}: actual=${c.actual ?? 'null'} (${c.comparator} ${c.target})`,
    ),
    `  Overfit check: ${report.overfitting.detected ? 'WARN' : 'OK'} (gap=${report.overfitting.recallGap ?? 'null'}, max=${report.overfitting.threshold})`,
  ]
  return lines.join('\n')
}
