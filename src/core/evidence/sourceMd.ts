// docs/sources/*.md → EvidenceEntry[] (PROJECT_MEMORY §7, §11; şablon: templates/SOURCE_TEMPLATE.md).
// Saf TS; dosya okuma/yazma scripts/build-evidence.ts'de.
import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  type EvidenceEntry,
  type SourceType,
  type VerificationStatus,
} from '../types/evidence'
import {
  basename,
  findTableUnderHeading,
  parseFrontMatter,
  splitLines,
  type MdIssue,
} from './markdown'

export const VALUES_HEADING = '## Değerler'
export const REQUIRED_COLUMNS = [
  'evidenceId',
  'metric',
  'value',
  'unit',
  'status',
  'scope',
  'note',
] as const
export const OPTIONAL_SOURCE_COLUMNS = ['sourceType', 'sourceTitle', 'sourceUrl'] as const
export const SEED_FILE_NAME = 'seed-verified-values.md'
export const NO_URL = '—'

const REQUIRED_FRONT_MATTER = ['id', 'title', 'url', 'sourceType'] as const
const EVIDENCE_ID_PATTERN = /^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/
const NUMBER = String.raw`[+-]?\d+(?:\.\d+)?`
const SCALAR_PATTERN = new RegExp(`^(${NUMBER})$`)
const RANGE_PATTERN = new RegExp(`^(${NUMBER})[-–](${NUMBER})$`)
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/

export interface SourceMdFile {
  /** Hata mesajlarında görünen yol, ör. "docs/sources/x.md". */
  path: string
  content: string
}

export interface ParsedEvidence {
  entry: EvidenceEntry
  file: string
  line: number
}

export interface EvidenceBuildResult {
  entries: EvidenceEntry[]
  issues: MdIssue[]
  parsedFiles: string[]
  skippedFiles: string[]
}

export const isSkippedSourceFile = (path: string): boolean => basename(path).startsWith('_')

const isSourceType = (value: string): value is SourceType =>
  (SOURCE_TYPES as readonly string[]).includes(value)

const isVerificationStatus = (value: string): value is VerificationStatus =>
  (VERIFICATION_STATUSES as readonly string[]).includes(value)

/** "600" → 600 · "0.2-0.5" / "0.2–0.5" → [0.2, 0.5] · "+10–12" → [10, 12]. Geçersizse hata metni. */
export function parseEvidenceValue(raw: string): number | [number, number] | string {
  const text = raw.replace(/\s+/g, '')
  const scalar = SCALAR_PATTERN.exec(text)
  if (scalar) return Number(scalar[1])
  const range = RANGE_PATTERN.exec(text)
  if (range) {
    const min = Number(range[1])
    const max = Number(range[2])
    return min <= max ? [min, max] : `aralıkta min > max: "${raw}"`
  }
  return `value sayı veya "min-max" aralığı olmalı, bulundu: "${raw}"`
}

function normalizeUrl(raw: string): string {
  return raw === '-' ? NO_URL : raw
}

/** Tek bir kaynak md dosyasını ayrıştırır (atlanacak `_` dosyaları çağıranın işi). */
export function parseSourceMd(file: SourceMdFile): {
  parsed: ParsedEvidence[]
  issues: MdIssue[]
} {
  const issues: MdIssue[] = []
  const lines = splitLines(file.content)
  const { frontMatter, issues: fmIssues } = parseFrontMatter(file.path, lines)
  issues.push(...fmIssues)
  if (!frontMatter) return { parsed: [], issues }

  const fm = frontMatter.values
  const fmLine = (key: string): number => frontMatter.lines[key] ?? 1
  for (const key of REQUIRED_FRONT_MATTER) {
    if (!fm[key]) issues.push({ file: file.path, line: 1, message: `front matter'da '${key}' eksik` })
  }
  if ('verified' in fm) {
    issues.push({
      file: file.path,
      line: fmLine('verified'),
      message: "front matter'da 'verified' alanı YOK; doğrulama satır başına 'status' sütunuyla",
    })
  }
  const expectedId = basename(file.path).replace(/\.md$/, '')
  if (fm.id && fm.id !== expectedId) {
    issues.push({
      file: file.path,
      line: fmLine('id'),
      message: `front matter id "${fm.id}" dosya adıyla aynı olmalı ("${expectedId}")`,
    })
  }
  const fmSourceType = fm.sourceType ?? ''
  if (fmSourceType && !isSourceType(fmSourceType)) {
    issues.push({
      file: file.path,
      line: fmLine('sourceType'),
      message: `bilinmeyen sourceType "${fmSourceType}" (geçerli: ${SOURCE_TYPES.join(', ')})`,
    })
  }
  const fmUrl = normalizeUrl(fm.url ?? '')
  if (fmUrl && fmUrl !== NO_URL && !HTTP_URL_PATTERN.test(fmUrl)) {
    issues.push({
      file: file.path,
      line: fmLine('url'),
      message: `url http(s):// ile başlamalı ve boşluk içermemeli (boşluk için %20), ya da '${NO_URL}'`,
    })
  }

  const { table, issues: tableIssues } = findTableUnderHeading(file.path, lines, VALUES_HEADING)
  issues.push(...tableIssues)
  if (!table) {
    if (tableIssues.length === 0) {
      issues.push({ file: file.path, line: 1, message: `"${VALUES_HEADING}" başlığı yok` })
    }
    return { parsed: [], issues }
  }

  const required: readonly string[] = REQUIRED_COLUMNS
  const optional: readonly string[] = OPTIONAL_SOURCE_COLUMNS
  const headerOk =
    table.header.length >= required.length &&
    required.every((col, idx) => table.header[idx] === col) &&
    table.header.slice(required.length).every((col) => optional.includes(col)) &&
    new Set(table.header).size === table.header.length
  if (!headerOk) {
    issues.push({
      file: file.path,
      line: table.headerLine,
      message:
        `tablo sütunları şablonla aynı olmalı: | ${REQUIRED_COLUMNS.join(' | ')} | ` +
        `(+ isteğe bağlı, sonda: ${OPTIONAL_SOURCE_COLUMNS.join(', ')}); bulundu: | ${table.header.join(' | ')} |`,
    })
    return { parsed: [], issues }
  }
  if (table.rows.length === 0) {
    issues.push({ file: file.path, line: table.headerLine, message: 'değer tablosunda satır yok' })
  }

  const parsed: ParsedEvidence[] = []
  for (const row of table.rows) {
    const at = (message: string): void => {
      issues.push({ file: file.path, line: row.line, message })
    }
    if (row.cells.length !== table.header.length) {
      at(`${table.header.length} sütun bekleniyordu, ${row.cells.length} bulundu`)
      continue
    }
    const cell = (col: string): string => row.cells[table.header.indexOf(col)] ?? ''
    const rowIssueCount = issues.length

    const id = cell('evidenceId')
    if (!EVIDENCE_ID_PATTERN.test(id)) {
      at(`geçersiz evidenceId "${id}" (küçük harfle başlayan, noktalı ad: ör. det.z.warning)`)
    }
    const value = parseEvidenceValue(cell('value'))
    if (typeof value === 'string') at(value)
    const unit = cell('unit')
    if (!unit) at("'unit' boş olamaz (birimsizse '—' yaz)")
    const status = cell('status')
    if (!isVerificationStatus(status)) {
      at(`bilinmeyen status "${status}" (geçerli: ${VERIFICATION_STATUSES.join(', ')})`)
    }
    const sourceType = cell('sourceType') || fmSourceType
    if (!isSourceType(sourceType)) {
      at(`bilinmeyen sourceType "${sourceType}" (geçerli: ${SOURCE_TYPES.join(', ')})`)
    }
    if (sourceType === 'DEMO_PARAMETER' && status !== 'UNVERIFIED') {
      at(`DEMO_PARAMETER satırı status=UNVERIFIED olmalı, bulundu: ${status}`)
    }
    const sourceTitle = cell('sourceTitle') || (fm.title ?? '')
    if (!sourceTitle) at('sourceTitle boş (satırda veya front matter "title")')
    const sourceUrl = normalizeUrl(cell('sourceUrl') || fmUrl)
    if (status === 'VERIFIED') {
      if (!HTTP_URL_PATTERN.test(sourceUrl)) {
        at(`VERIFIED satırda http(s):// URL zorunlu (boşluk yerine %20), bulundu: "${sourceUrl}"`)
      }
    } else if (sourceUrl !== NO_URL && !HTTP_URL_PATTERN.test(sourceUrl)) {
      at(`sourceUrl http(s):// (boşluksuz) ya da '${NO_URL}' olmalı, bulundu: "${sourceUrl}"`)
    }

    if (
      issues.length !== rowIssueCount ||
      typeof value === 'string' ||
      !isVerificationStatus(status) ||
      !isSourceType(sourceType)
    ) {
      continue
    }

    const note = cell('note')
    const scope = cell('scope')
    const owner = fm.owner ?? ''
    // Anahtar sırası sabit: JSON çıktısı deterministik.
    const entry: EvidenceEntry = {
      id,
      value,
      unit,
      sourceType,
      sourceTitle,
      sourceUrl,
      ...(note ? { note } : {}),
      verificationStatus: status,
      verified: status === 'VERIFIED',
      ...(owner ? { owner } : {}),
      ...(scope ? { scope } : {}),
    }
    parsed.push({ entry, file: file.path, line: row.line })
  }
  return { parsed, issues }
}

/** Tüm kaynak dosyalarından kayıt defterini üretir: `_` dosyaları atlanır, id'ler benzersiz, çıktı id'ye göre sıralı. */
export function buildEvidence(files: readonly SourceMdFile[]): EvidenceBuildResult {
  const issues: MdIssue[] = []
  const seen = new Map<string, ParsedEvidence>()
  const parsedFiles: string[] = []
  const skippedFiles: string[] = []

  for (const file of files) {
    if (isSkippedSourceFile(file.path)) {
      skippedFiles.push(file.path)
      continue
    }
    parsedFiles.push(file.path)
    const result = parseSourceMd(file)
    issues.push(...result.issues)
    for (const item of result.parsed) {
      const first = seen.get(item.entry.id)
      if (!first) {
        seen.set(item.entry.id, item)
        continue
      }
      const involvesSeed = [first.file, item.file].some((f) => basename(f) === SEED_FILE_NAME)
      issues.push({
        file: item.file,
        line: item.line,
        message:
          `evidenceId "${item.entry.id}" tekrar ediyor (ilk tanım: ${first.file}:${first.line})` +
          (involvesSeed
            ? `. Çözüm: docs/sources/${SEED_FILE_NAME} içindeki satırı sil, takım md'si tek kaynak olsun`
            : ''),
      })
    }
  }

  if (parsedFiles.length > 0 && seen.size === 0 && issues.length === 0) {
    issues.push({ file: parsedFiles[0] ?? 'docs/sources', line: 1, message: 'hiç evidence kaydı yok' })
  }

  const entries = [...seen.values()]
    .map((item) => item.entry)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  // Hatalar dosya, sonra satır sırasıyla (elle düzeltirken okunur olsun; deterministik).
  const sortedIssues = issues
    .map((issue, index) => ({ issue, index }))
    .sort(
      (a, b) =>
        (a.issue.file < b.issue.file ? -1 : a.issue.file > b.issue.file ? 1 : 0) ||
        a.issue.line - b.issue.line ||
        a.index - b.index,
    )
    .map(({ issue }) => issue)
  return { entries, issues: sortedIssues, parsedFiles, skippedFiles }
}

export const renderEvidenceJson = (entries: readonly EvidenceEntry[]): string =>
  `${JSON.stringify(entries, null, 2)}\n`

export function renderEvidenceIdsTs(entries: readonly EvidenceEntry[]): string {
  const ids = entries.map((entry) => `  '${entry.id}',`).join('\n')
  return [
    '// OTOMATİK ÜRETİLDİ — scripts/build-evidence.ts (kaynak: docs/sources/*.md). Elle düzenleme.',
    'export const EVIDENCE_IDS = [',
    ids,
    '] as const',
    '',
    'export type EvidenceId = (typeof EVIDENCE_IDS)[number]',
    '',
  ].join('\n')
}
