// `npm run evidence:build`: docs/sources/*.md → src/core/evidence/evidence.generated.json + evidenceIds.generated.ts
// Hata varsa dosya:satır listesi basar, hiçbir çıktı yazmaz ve exit 1 ile biter.
// Test/deneme için: --dir <kaynak klasörü> --out <çıktı klasörü>
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { formatIssue } from '../src/core/evidence/markdown'
import {
  buildEvidence,
  renderEvidenceIdsTs,
  renderEvidenceJson,
  type SourceMdFile,
} from '../src/core/evidence/sourceMd'

const args = process.argv.slice(2)
const argValue = (name: string, fallback: string): string => {
  const idx = args.indexOf(name)
  return idx >= 0 ? (args[idx + 1] ?? fallback) : fallback
}

const sourcesDir = argValue('--dir', 'docs/sources')
const outDir = argValue('--out', 'src/core/evidence')
const toPosix = (p: string): string => p.split(path.sep).join('/')

const files: SourceMdFile[] = readdirSync(sourcesDir)
  .filter((name) => name.endsWith('.md'))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  .map((name) => ({
    path: toPosix(path.join(sourcesDir, name)),
    content: readFileSync(path.join(sourcesDir, name), 'utf8'),
  }))

const result = buildEvidence(files)

if (result.issues.length > 0) {
  for (const issue of result.issues) console.error(formatIssue(issue))
  console.error(`\nevidence:build: ${result.issues.length} hata — çıktı yazılmadı.`)
  process.exit(1)
}

const writeIfChanged = (file: string, content: string): boolean => {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false
  writeFileSync(file, content, 'utf8')
  return true
}

mkdirSync(outDir, { recursive: true })
const jsonChanged = writeIfChanged(
  path.join(outDir, 'evidence.generated.json'),
  renderEvidenceJson(result.entries),
)
const idsChanged = writeIfChanged(
  path.join(outDir, 'evidenceIds.generated.ts'),
  renderEvidenceIdsTs(result.entries),
)

const byStatus = new Map<string, number>()
for (const entry of result.entries) {
  byStatus.set(entry.verificationStatus, (byStatus.get(entry.verificationStatus) ?? 0) + 1)
}
const statusSummary = [...byStatus.entries()].map(([status, n]) => `${status} ${n}`).join(', ')
console.log(
  `evidence:build: ${result.parsedFiles.length} dosya → ${result.entries.length} kayıt (${statusSummary}); ` +
    `atlanan: ${result.skippedFiles.length > 0 ? result.skippedFiles.join(', ') : 'yok'}; ` +
    `çıktı ${jsonChanged || idsChanged ? 'güncellendi' : 'değişmedi'}.`,
)
