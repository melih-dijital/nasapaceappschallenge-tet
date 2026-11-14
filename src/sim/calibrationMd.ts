// docs/calibration/*.md doğrulayıcısı (şablon: templates/CALIBRATION_TEMPLATE.md).
// Faz 1: yalnızca başlık/sütun/hücre biçimi. Değerlerin kullanımı Faz 2 (calibration:build).
import {
  basename,
  findTableUnderHeading,
  parseFrontMatter,
  splitLines,
  type MdIssue,
  type MdTable,
} from '../core/evidence/markdown'
import { ENVIRONMENTS } from '../core/types/frame'
import { METRIC_IDS } from '../core/types/metric'

export const POPULATION_HEADING = '## Popülasyon aralıkları'
export const POPULATION_COLUMNS = [
  'metric',
  'unit',
  'mean',
  'betweenSd',
  'withinSd',
  'plausibleMin',
  'plausibleMax',
  'evidenceId',
  'demo',
] as const
export const ENVIRONMENT_HEADING = '## Ortam çarpanları'
export const ENVIRONMENT_COLUMNS = ['environment', 'doseRateMsvDay (mean)', 'evidenceId', 'demo'] as const

const POPULATION_NUMERIC = ['mean', 'betweenSd', 'withinSd', 'plausibleMin', 'plausibleMax']
const ENVIRONMENT_NUMERIC = ['doseRateMsvDay (mean)']
const EVIDENCE_ID_OR_NONE = /^(—|-|[a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)$/
const NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?$/

export interface CalibrationMdFile {
  path: string
  content: string
}

function checkTable(
  file: string,
  table: MdTable,
  columns: readonly string[],
  numericColumns: readonly string[],
  keyColumn: string,
  allowedKeys: readonly string[],
): MdIssue[] {
  const issues: MdIssue[] = []
  const sameHeader =
    table.header.length === columns.length && columns.every((col, i) => table.header[i] === col)
  if (!sameHeader) {
    return [
      {
        file,
        line: table.headerLine,
        message: `tablo sütunları şablonla aynı olmalı: | ${columns.join(' | ')} |; bulundu: | ${table.header.join(' | ')} |`,
      },
    ]
  }
  for (const row of table.rows) {
    if (row.cells.length !== columns.length) {
      issues.push({
        file,
        line: row.line,
        message: `${columns.length} sütun bekleniyordu, ${row.cells.length} bulundu`,
      })
      continue
    }
    const cell = (col: string): string => row.cells[columns.indexOf(col)] ?? ''
    const key = cell(keyColumn)
    if (!allowedKeys.includes(key)) {
      issues.push({ file, line: row.line, message: `bilinmeyen ${keyColumn} "${key}"` })
    }
    for (const col of numericColumns) {
      if (!NUMBER_PATTERN.test(cell(col))) {
        issues.push({ file, line: row.line, message: `'${col}' sayı olmalı, bulundu: "${cell(col)}"` })
      }
    }
    if (!EVIDENCE_ID_OR_NONE.test(cell('evidenceId'))) {
      issues.push({
        file,
        line: row.line,
        message: `'evidenceId' bir docs/sources evidenceId'si ya da '—' olmalı, bulundu: "${cell('evidenceId')}"`,
      })
    }
    if (cell('demo') !== 'true' && cell('demo') !== 'false') {
      issues.push({ file, line: row.line, message: `'demo' true/false olmalı, bulundu: "${cell('demo')}"` })
    }
  }
  return issues
}

export function checkCalibrationMd(file: CalibrationMdFile): MdIssue[] {
  const lines = splitLines(file.content)
  const { frontMatter, issues } = parseFrontMatter(file.path, lines)
  if (!frontMatter) return issues

  for (const key of ['id', 'title']) {
    if (!frontMatter.values[key]) {
      issues.push({ file: file.path, line: 1, message: `front matter'da '${key}' eksik` })
    }
  }
  if ('verified' in frontMatter.values) {
    issues.push({
      file: file.path,
      line: frontMatter.lines.verified ?? 1,
      message: "front matter'da 'verified' alanı YOK; satır başına 'demo' sütunu kullan",
    })
  }
  const expectedId = basename(file.path).replace(/\.md$/, '')
  const id = frontMatter.values.id
  if (id && id !== expectedId) {
    issues.push({
      file: file.path,
      line: frontMatter.lines.id ?? 1,
      message: `front matter id "${id}" dosya adıyla aynı olmalı ("${expectedId}")`,
    })
  }

  const population = findTableUnderHeading(file.path, lines, POPULATION_HEADING)
  const environment = findTableUnderHeading(file.path, lines, ENVIRONMENT_HEADING)
  issues.push(...population.issues, ...environment.issues)
  if (population.table) {
    issues.push(
      ...checkTable(file.path, population.table, POPULATION_COLUMNS, POPULATION_NUMERIC, 'metric', METRIC_IDS),
    )
  }
  if (environment.table) {
    issues.push(
      ...checkTable(
        file.path,
        environment.table,
        ENVIRONMENT_COLUMNS,
        ENVIRONMENT_NUMERIC,
        'environment',
        ENVIRONMENTS,
      ),
    )
  }
  if (!population.table && !environment.table && issues.length === 0) {
    issues.push({
      file: file.path,
      line: 1,
      message: `"${POPULATION_HEADING}" veya "${ENVIRONMENT_HEADING}" tablosundan en az biri olmalı`,
    })
  }
  return issues
}
