// CLI doğrulama koşucusu (FAZ_08 §3.4): `npm run validate` / `npm run validate:quick`
// Çıktılar deterministiktir; duvar saati zaman damgası yazılmaz.
import fs from 'node:fs'
import path from 'node:path'
import type { ScenarioId } from '../src/core/types'
import { BUILTIN_SCENARIO_IDS } from '../src/sim/scenarios'
import {
  formatValidationConsoleSummary,
  formatValidationReportJson,
  formatValidationReportMarkdown,
  runSuite,
} from '../src/core/validation'

interface CliArgs {
  quick: boolean
  outDir: string
  scenarios?: ScenarioId[]
  includeSensitivity: boolean
}

function parseArgs(argv: readonly string[]): CliArgs {
  let quick = false
  let outDir = path.resolve(process.cwd(), 'docs/demo')
  let scenarios: ScenarioId[] | undefined
  let includeSensitivity = true

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--quick') {
      quick = true
    } else if (arg === '--no-sensitivity') {
      includeSensitivity = false
    } else if (arg === '--scenarios') {
      const next = argv[i + 1]
      if (next) {
        const validSet = new Set<string>(BUILTIN_SCENARIO_IDS)
        const parsed = next
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is ScenarioId => validSet.has(s))
        if (parsed.length > 0) scenarios = parsed
        i += 1
      }
    } else if (arg === '--out-dir') {
      const next = argv[i + 1]
      if (next) {
        outDir = path.resolve(process.cwd(), next)
        i += 1
      }
    }
  }

  return { quick, outDir, scenarios, includeSensitivity }
}

function main(): void {
  const { quick, outDir, scenarios, includeSensitivity } = parseArgs(process.argv.slice(2))
  const report = runSuite({ quick, scenarios, includeSensitivity })

  fs.mkdirSync(outDir, { recursive: true })
  const jsonPath = path.join(outDir, 'validation-report.json')
  const mdPath = path.join(outDir, 'validation-report.md')

  fs.writeFileSync(jsonPath, formatValidationReportJson(report), 'utf8')
  fs.writeFileSync(mdPath, formatValidationReportMarkdown(report), 'utf8')

  console.log(formatValidationConsoleSummary(report))
  console.log('\nScenario Summary (Report Seeds):')
  console.table(
    report.scenarios.map((s) => ({
      scenario: s.scenarioId,
      strength: s.eventStrength,
      runs: s.runsCount,
      TP: s.tp,
      FN: s.fn,
      'FP(WARN+)': s.fp,
      ADVISORY: s.advisoryCount,
      Recall: s.recall !== null ? `${(s.recall * 100).toFixed(1)}%` : '—',
      Specificity: s.specificity !== null ? `${(s.specificity * 100).toFixed(1)}%` : '—',
      'FP/cd': Number(s.fpPerCrewDay.toFixed(4)),
      'P90(min)': s.p90LatencyMin !== null ? Number(s.p90LatencyMin.toFixed(1)) : '—',
      Triage: s.triageAccuracy !== null ? `${(s.triageAccuracy * 100).toFixed(1)}%` : '—',
    })),
  )
  console.log(`Written: ${jsonPath}`)
  console.log(`Written: ${mdPath}`)
}

main()
