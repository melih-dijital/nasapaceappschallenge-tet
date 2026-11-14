// `npm run calibration:build`: docs/calibration/*.md → src/sim/calibration.generated.json
// Dosya yoksa/eksikse src/sim/defaults.ts DEMO varsayılanları (demo:true) kullanılır.
// Hata varsa dosya:satır listesi basar, hiçbir çıktı yazmaz ve exit 1 ile biter.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { formatIssue } from '../src/core/evidence/markdown'
import type { CalibrationMdFile } from '../src/sim/calibrationMd'
import { buildCalibration, renderCalibrationJson } from '../src/sim/calibrationBuilder'

const args = process.argv.slice(2)
const argValue = (name: string, fallback: string): string => {
  const idx = args.indexOf(name)
  return idx >= 0 ? (args[idx + 1] ?? fallback) : fallback
}

const calDir = argValue('--dir', 'docs/calibration')
const outFile = argValue('--out', 'src/sim/calibration.generated.json')
const toPosix = (p: string): string => p.split(path.sep).join('/')

const files: CalibrationMdFile[] = existsSync(calDir)
  ? readdirSync(calDir)
      .filter((name) => name.endsWith('.md'))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((name) => ({
        path: toPosix(path.join(calDir, name)),
        content: readFileSync(path.join(calDir, name), 'utf8'),
      }))
  : []

const result = buildCalibration(files)

if (result.issues.length > 0) {
  for (const issue of result.issues) console.error(formatIssue(issue))
  console.error(`\ncalibration:build: ${result.issues.length} hata — çıktı yazılmadı.`)
  process.exit(1)
}

const content = renderCalibrationJson(result.data)
const outDir = path.dirname(outFile)
mkdirSync(outDir, { recursive: true })
const changed = !existsSync(outFile) || readFileSync(outFile, 'utf8') !== content
if (changed) {
  writeFileSync(outFile, content, 'utf8')
}

const demoMetricCount = Object.values(result.data.metrics).filter((m) => m.demo).length
const totalMetrics = Object.keys(result.data.metrics).length
console.log(
  `calibration:build: ${result.parsedFiles.length} dosya, ${totalMetrics} metrik (${demoMetricCount} DEMO); ` +
    `atlanan: ${result.skippedFiles.length > 0 ? result.skippedFiles.join(', ') : 'yok'}; ` +
    `çıktı ${changed ? 'güncellendi' : 'değişmedi'}.`,
)
