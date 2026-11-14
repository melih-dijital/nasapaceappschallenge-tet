// `npm run calibration:check`: docs/calibration/*.md başlık/sütun doğrulaması (Faz 1; kullanım Faz 2).
// `_` ile başlayan dosyalar atlanır. Hata varsa dosya:satır listesi ve exit 1.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { basename, formatIssue } from '../src/core/evidence/markdown'
import { checkCalibrationMd } from '../src/sim/calibrationMd'

const dir = process.argv[2] ?? 'docs/calibration'
const names = readdirSync(dir)
  .filter((name) => name.endsWith('.md') && !basename(name).startsWith('_'))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

const issues = names.flatMap((name) =>
  checkCalibrationMd({
    path: path.join(dir, name).split(path.sep).join('/'),
    content: readFileSync(path.join(dir, name), 'utf8'),
  }),
)

if (issues.length > 0) {
  for (const issue of issues) console.error(formatIssue(issue))
  console.error(`\ncalibration:check: ${issues.length} hata.`)
  process.exit(1)
}
console.log(
  `calibration:check: ${names.length} dosya geçerli${names.length === 0 ? ' (kalibrasyon md yok — Faz 2 DEMO varsayılanlarını kullanır)' : ''}.`,
)
