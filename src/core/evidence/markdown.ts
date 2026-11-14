// Kaynak/kalibrasyon md dosyaları için küçük, bağımlılıksız ayrıştırıcı:
// YAML benzeri front matter (anahtar: değer) + belirli bir başlığın altındaki ilk markdown tablo.
// Saf TS: dosya sistemi yok; içerik metin olarak gelir.

export interface MdIssue {
  file: string
  /** 1 tabanlı satır numarası. */
  line: number
  message: string
}

export interface FrontMatter {
  values: Record<string, string>
  /** anahtar → 1 tabanlı satır */
  lines: Record<string, number>
}

export interface MdTableRow {
  line: number
  cells: string[]
}

export interface MdTable {
  headingLine: number
  headerLine: number
  header: string[]
  rows: MdTableRow[]
}

export const formatIssue = (issue: MdIssue): string =>
  `${issue.file}:${issue.line}: ${issue.message}`

const BOM = 0xfeff

/** Satırlara böler; baştaki UTF-8 BOM'u atar, CRLF/LF ikisini de kabul eder (Windows). */
export const splitLines = (content: string): string[] =>
  (content.charCodeAt(0) === BOM ? content.slice(1) : content).split(/\r?\n/)

export const basename = (path: string): string => path.split(/[\\/]/).pop() ?? path

/** "x   # açıklama" → "x" (yalnızca boşluktan sonra gelen # yorum sayılır; URL içindeki # korunur). */
const stripInlineComment = (text: string): string => {
  const idx = text.search(/\s#/)
  return idx === -1 ? text : text.slice(0, idx)
}

export function parseFrontMatter(
  file: string,
  lines: readonly string[],
): { frontMatter: FrontMatter | null; issues: MdIssue[] } {
  if (lines[0]?.trim() !== '---') {
    return {
      frontMatter: null,
      issues: [{ file, line: 1, message: "front matter yok: dosya '---' satırıyla başlamalı" }],
    }
  }
  const issues: MdIssue[] = []
  const values: Record<string, string> = {}
  const keyLines: Record<string, number> = {}
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    if (raw.trim() === '---') {
      return { frontMatter: { values, lines: keyLines }, issues }
    }
    const text = stripInlineComment(raw).trim()
    if (text === '') continue
    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(text)
    if (!match) {
      issues.push({
        file,
        line: i + 1,
        message: `front matter satırı 'anahtar: değer' biçiminde değil: "${raw.trim()}"`,
      })
      continue
    }
    const [, key = '', value = ''] = match
    values[key] = value.trim()
    keyLines[key] = i + 1
  }
  issues.push({ file, line: 1, message: "front matter kapanmamış: ikinci '---' satırı yok" })
  return { frontMatter: null, issues }
}

export function splitTableRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|')) text = text.slice(0, -1)
  return text.split('|').map((cell) => cell.trim())
}

const isSeparatorRow = (cells: readonly string[]): boolean =>
  cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))

/**
 * `headingPrefix` ile başlayan başlığı (ör. "## Değerler") bulur ve altındaki ilk tabloyu döndürür.
 * Başlık ile tablo arasındaki boş satırlar ve HTML yorumları (<!-- ... -->, çok satırlı olabilir) atlanır.
 * Başlık yoksa `table: null` ve hata YOK (çağıran karar verir).
 */
export function findTableUnderHeading(
  file: string,
  lines: readonly string[],
  headingPrefix: string,
): { table: MdTable | null; issues: MdIssue[] } {
  const headingIdx = lines.findIndex((line) => line.trim().startsWith(headingPrefix))
  if (headingIdx === -1) return { table: null, issues: [] }
  const headingLine = headingIdx + 1

  let i = headingIdx + 1
  let inComment = false
  for (; i < lines.length; i++) {
    const text = (lines[i] ?? '').trim()
    if (inComment) {
      if (text.includes('-->')) inComment = false
      continue
    }
    if (text === '') continue
    if (text.startsWith('<!--')) {
      if (!text.includes('-->')) inComment = true
      continue
    }
    break
  }

  const headerText = (lines[i] ?? '').trim()
  if (i >= lines.length || !headerText.startsWith('|')) {
    return {
      table: null,
      issues: [{ file, line: headingLine, message: `"${headingPrefix}" başlığının altında tablo yok` }],
    }
  }
  const header = splitTableRow(headerText)
  const separator = splitTableRow(lines[i + 1] ?? '')
  if (!isSeparatorRow(separator)) {
    return {
      table: null,
      issues: [
        { file, line: i + 2, message: 'tablo başlığından sonra ayırıcı satır (|---|) bekleniyordu' },
      ],
    }
  }

  const rows: MdTableRow[] = []
  for (let j = i + 2; j < lines.length; j++) {
    const text = (lines[j] ?? '').trim()
    if (!text.startsWith('|')) break
    rows.push({ line: j + 1, cells: splitTableRow(text) })
  }
  return { table: { headingLine, headerLine: i + 1, header, rows }, issues: [] }
}
