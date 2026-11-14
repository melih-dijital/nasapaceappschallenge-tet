// Saf kalibrasyon derleyicisi (dosya sistemi yok, üretilmiş JSON'u içe aktarmaz).
import { EVIDENCE_IDS } from '../core/evidence/evidenceIds.generated'
import { basename, findTableUnderHeading, splitLines, type MdIssue } from '../core/evidence/markdown'
import { ENVIRONMENTS, METRIC_IDS, type Environment, type MetricId } from '../core/types'
import {
  checkCalibrationMd,
  ENVIRONMENT_COLUMNS,
  ENVIRONMENT_HEADING,
  POPULATION_COLUMNS,
  POPULATION_HEADING,
  type CalibrationMdFile,
} from './calibrationMd'
import {
  DEFAULT_ENVIRONMENT_CALIBRATIONS,
  DEFAULT_METRIC_CALIBRATIONS,
  type EnvironmentCalibration,
  type MetricCalibration,
} from './defaults'

export interface CalibrationData {
  metrics: Record<MetricId, MetricCalibration>
  environments: Record<Environment, EnvironmentCalibration>
}

export interface CalibrationBuildResult {
  data: CalibrationData
  issues: MdIssue[]
  parsedFiles: string[]
  skippedFiles: string[]
}

const KNOWN_EVIDENCE_SET: ReadonlySet<string> = new Set(EVIDENCE_IDS)

function normalizeEvidenceId(raw: string): string | null {
  return raw === '—' || raw === '-' || raw === '' ? null : raw
}

export function defaultCalibrationData(): CalibrationData {
  const metrics = {} as Record<MetricId, MetricCalibration>
  for (const id of METRIC_IDS) {
    metrics[id] = { ...DEFAULT_METRIC_CALIBRATIONS[id] }
  }
  const environments = {} as Record<Environment, EnvironmentCalibration>
  for (const env of ENVIRONMENTS) {
    environments[env] = { ...DEFAULT_ENVIRONMENT_CALIBRATIONS[env] }
  }
  return { metrics, environments }
}

/** Saf derleyici: dosya metinlerinden CalibrationData üretir (test edilebilir, FS yok). */
export function buildCalibration(
  files: readonly CalibrationMdFile[],
  knownEvidenceIds: ReadonlySet<string> = KNOWN_EVIDENCE_SET,
): CalibrationBuildResult {
  const issues: MdIssue[] = []
  const parsedFiles: string[] = []
  const skippedFiles: string[] = []
  const data = defaultCalibrationData()
  const seenMetrics = new Map<MetricId, { file: string; line: number }>()
  const seenEnvs = new Map<Environment, { file: string; line: number }>()

  for (const file of files) {
    if (basename(file.path).startsWith('_')) {
      skippedFiles.push(file.path)
      continue
    }
    parsedFiles.push(file.path)
    const fileIssues = checkCalibrationMd(file)
    issues.push(...fileIssues)
    if (fileIssues.length > 0) continue

    const lines = splitLines(file.content)
    const pop = findTableUnderHeading(file.path, lines, POPULATION_HEADING)
    if (pop.table) {
      const col = (name: (typeof POPULATION_COLUMNS)[number], cells: readonly string[]): string =>
        cells[POPULATION_COLUMNS.indexOf(name)] ?? ''

      for (const row of pop.table.rows) {
        const metric = col('metric', row.cells) as MetricId
        const unit = col('unit', row.cells)
        const mean = Number(col('mean', row.cells))
        const betweenSd = Number(col('betweenSd', row.cells))
        const withinSd = Number(col('withinSd', row.cells))
        const plausibleMin = Number(col('plausibleMin', row.cells))
        const plausibleMax = Number(col('plausibleMax', row.cells))
        const evidenceId = normalizeEvidenceId(col('evidenceId', row.cells))
        const demo = col('demo', row.cells) === 'true'

        const prev = seenMetrics.get(metric)
        if (prev) {
          issues.push({
            file: file.path,
            line: row.line,
            message: `metric "${metric}" tekrar ediyor (ilk tanım: ${prev.file}:${prev.line})`,
          })
          continue
        }
        if (betweenSd < 0 || withinSd < 0) {
          issues.push({ file: file.path, line: row.line, message: 'betweenSd ve withinSd >= 0 olmalı' })
          continue
        }
        if (plausibleMin > plausibleMax) {
          issues.push({ file: file.path, line: row.line, message: 'plausibleMin <= plausibleMax olmalı' })
          continue
        }
        if (evidenceId !== null && !knownEvidenceIds.has(evidenceId)) {
          issues.push({
            file: file.path,
            line: row.line,
            message: `bilinmeyen evidenceId "${evidenceId}" — docs/sources/*.md içinde tanımlı değil`,
          })
          continue
        }
        seenMetrics.set(metric, { file: file.path, line: row.line })
        data.metrics[metric] = {
          metric,
          unit,
          mean,
          betweenSd,
          withinSd,
          plausibleMin,
          plausibleMax,
          evidenceId,
          demo,
          sourceFile: file.path,
        }
      }
    }

    const envTable = findTableUnderHeading(file.path, lines, ENVIRONMENT_HEADING)
    if (envTable.table) {
      const col = (name: (typeof ENVIRONMENT_COLUMNS)[number], cells: readonly string[]): string =>
        cells[ENVIRONMENT_COLUMNS.indexOf(name)] ?? ''

      for (const row of envTable.table.rows) {
        const environment = col('environment', row.cells) as Environment
        const doseRateMsvDayMean = Number(col('doseRateMsvDay (mean)', row.cells))
        const evidenceId = normalizeEvidenceId(col('evidenceId', row.cells))
        const demo = col('demo', row.cells) === 'true'

        const prev = seenEnvs.get(environment)
        if (prev) {
          issues.push({
            file: file.path,
            line: row.line,
            message: `environment "${environment}" tekrar ediyor (ilk tanım: ${prev.file}:${prev.line})`,
          })
          continue
        }
        if (doseRateMsvDayMean < 0) {
          issues.push({ file: file.path, line: row.line, message: 'doseRateMsvDay (mean) >= 0 olmalı' })
          continue
        }
        if (evidenceId !== null && !knownEvidenceIds.has(evidenceId)) {
          issues.push({
            file: file.path,
            line: row.line,
            message: `bilinmeyen evidenceId "${evidenceId}" — docs/sources/*.md içinde tanımlı değil`,
          })
          continue
        }
        seenEnvs.set(environment, { file: file.path, line: row.line })
        data.environments[environment] = {
          environment,
          doseRateMsvDayMean,
          evidenceId,
          demo,
          sourceFile: file.path,
        }
      }
    }
  }

  return { data, issues, parsedFiles, skippedFiles }
}

export const renderCalibrationJson = (data: CalibrationData): string =>
  `${JSON.stringify(data, null, 2)}\n`
