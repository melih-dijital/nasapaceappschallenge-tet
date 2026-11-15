// Doğrulama sayfası (/validation): YALNIZCA `npm run validate` raporunu gösterir (src/ui/data/validation-report.json).
// Tarayıcıda doğrulama koşusu yoktur; elle yazılmış ya da örnek doğrulama sayısı da yoktur.
// Hedefler, rapor seed'leri üzerinde senaryo tablosu, ADVISORY ayrımı, aşırı uyum kontrolü, duyarlılık,
// parametre parmak izi, rapor tarihi ve her zaman görünür SINIRLAMALAR.
import { AlertTriangle, CheckCircle2, Download, FileWarning, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { computeEvidenceFingerprint } from '@/core/validation/fingerprint'
import {
  formatValidationReportJson,
  formatValidationReportMarkdown,
} from '@/core/validation/formatReport'
import type { ScenarioId } from '@/core/types'
import { VALIDATION_SNAPSHOT } from '@/ui/data/validationReport'
import { EmptyState } from '@/ui/components/EmptyState'
import { SectionCard } from '@/ui/components/SectionCard'
import { useT } from '@/ui/i18n'
import { actions } from '@/ui/store'

function triggerBlobDownload(filename: string, content: string, mimeType: string): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
  ) : (
    <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-status-warning" />
  )
}

export function ValidationPage() {
  const { t, lang, formatNumber } = useT()
  const navigate = useNavigate()

  const pct = (v: number | null): string => (v === null ? '—' : `${formatNumber(v * 100, 1)}%`)
  const num = (v: number | null, digits = 3): string => (v === null ? '—' : formatNumber(v, digits))
  const min = (v: number | null): string => (v === null ? '—' : `${formatNumber(v, 0)} min`)

  if (!VALIDATION_SNAPSHOT.ok) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="validation-page">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {t('validation.pageTitle')}
        </h1>
        <div role="alert" data-testid="validation-load-error">
          <EmptyState
            icon={<FileWarning aria-hidden="true" className="size-4" />}
            title={t('validation.loadError', { error: VALIDATION_SNAPSHOT.error })}
          />
        </div>
      </div>
    )
  }

  const { report, generatedAt, command } = VALIDATION_SNAPSHOT.snapshot
  const summary = report.reportSummary.aggregate
  const reportFingerprint = report.params.evidenceFingerprint
  const currentFingerprint = computeEvidenceFingerprint()
  const generatedDate = new Date(generatedAt)
  const dateText = Number.isNaN(generatedDate.getTime())
    ? generatedAt
    : new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(generatedDate) + ' UTC'

  const handleReplay = (scenarioId: ScenarioId) => {
    actions.setScenario(scenarioId)
    navigate('/')
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: t('validation.metric.strongRecall'), value: pct(summary.strongRecall) },
    { label: t('validation.metric.recall'), value: pct(summary.recall) },
    { label: t('validation.metric.specificity'), value: pct(summary.specificity) },
    { label: t('validation.metric.nominalFp'), value: num(summary.nominalFpPerCrewDay) },
    { label: t('validation.metric.speP90'), value: min(summary.speDetectP90Min) },
    { label: t('validation.metric.triage'), value: pct(summary.triageAccuracy) },
    { label: t('validation.metric.advisory'), value: num(summary.advisoryPerCrewDay) },
  ]

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="validation-page">
      {/* Başlık + kaynak notu */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {t('validation.pageTitle')}
            </h1>
            <span
              data-testid="validation-fingerprint-badge"
              title={reportFingerprint}
              className="rounded border border-border/70 bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {t('validation.fingerprint', { value: reportFingerprint })}
            </span>
            {report.quick && (
              <span className="rounded border border-status-advisory/60 bg-status-advisory/10 px-2 py-0.5 font-mono text-[10px] text-status-advisory">
                {t('validation.quickBadge')}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('validation.pageSubtitle')}</p>
          <p data-testid="validation-source-note" className="text-xs text-foreground">
            {t('validation.sourceNote', { command, date: dateText })}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            data-testid="validation-download-json"
            onClick={() =>
              triggerBlobDownload(
                'validation-report.json',
                formatValidationReportJson(report),
                'application/json',
              )
            }
          >
            <Download aria-hidden="true" className="size-3" />
            <span>{t('validation.downloadJson')}</span>
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            data-testid="validation-download-md"
            onClick={() =>
              triggerBlobDownload(
                'validation-report.md',
                formatValidationReportMarkdown(report),
                'text/markdown',
              )
            }
          >
            <Download aria-hidden="true" className="size-3" />
            <span>{t('validation.downloadMd')}</span>
          </Button>
        </div>
      </div>

      {reportFingerprint !== currentFingerprint && (
        <div
          role="alert"
          data-testid="validation-fingerprint-stale"
          className="rounded-xl border border-status-warning/60 bg-status-warning/10 px-4 py-2.5 text-xs text-status-warning"
        >
          {t('validation.fingerprintStale', {
            report: reportFingerprint,
            current: currentFingerprint,
          })}
        </div>
      )}

      {/* Bilinen sınırlamalar (HER ZAMAN GÖRÜNÜR, rapordan) */}
      <div
        data-testid="validation-limitations-box"
        className="rounded-xl border border-status-warning/60 bg-status-warning/10 p-4 text-xs"
      >
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-status-warning">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('validation.limitationsTitle')}</span>
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-[11px] text-foreground">
          {report.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Hedefler */}
        <SectionCard title={t('validation.targetsTitle')}>
          <table
            className="w-full border-collapse text-left text-xs"
            data-testid="validation-targets-table"
          >
            <thead className="font-mono text-[11px] text-muted-foreground">
              <tr>
                <th className="p-2">{t('validation.colMetric')}</th>
                <th className="p-2">{t('validation.colActual')}</th>
                <th className="p-2">{t('validation.colTarget')}</th>
                <th className="p-2">{t('validation.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {report.targetChecks.map((c) => {
                const fmt = (v: number | null) =>
                  c.metricKey === 'strongRecall'
                    ? pct(v)
                    : c.metricKey === 'speDetectP90Min'
                      ? min(v)
                      : num(v)
                return (
                  <tr key={c.id}>
                    <td className="p-2">
                      {t(`validation.target.${c.metricKey}` as Parameters<typeof t>[0])}
                    </td>
                    <td className="p-2 font-mono tabular-nums">{fmt(c.actual)}</td>
                    <td className="p-2 font-mono tabular-nums">
                      {c.comparator === 'LTE' ? '≤' : '≥'} {fmt(c.target)}
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        <StatusIcon ok={c.status === 'PASS'} />
                        <span>
                          {t(
                            c.status === 'PASS'
                              ? 'validation.status.pass'
                              : 'validation.status.notMet',
                          )}
                        </span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </SectionCard>

        {/* Özet (rapor seed'leri) + aşırı uyum */}
        <SectionCard
          title={t('validation.summaryTitle')}
          subtitle={t('validation.seedsComparison', {
            tuning: report.params.tuningSeeds.join(', '),
            report: report.params.reportSeeds.join(', '),
          })}
        >
          <dl
            className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2"
            data-testid="validation-summary"
          >
            {summaryRows.map((r) => (
              <div
                key={r.label}
                className="flex justify-between gap-3 border-b border-border/40 py-1"
              >
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-mono tabular-nums text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-xs" data-testid="validation-overfit">
            <StatusIcon ok={!report.overfitting.detected} />
            <span>
              {t('validation.overfit', {
                tuning: pct(report.overfitting.tuningRecall),
                report: pct(report.overfitting.reportRecall),
                gap: pct(report.overfitting.recallGap),
                limit: pct(report.overfitting.threshold),
                status: t(
                  report.overfitting.detected
                    ? 'validation.overfitDetected'
                    : 'validation.overfitOk',
                ),
              })}
            </span>
          </p>
        </SectionCard>
      </div>

      {/* Senaryo tablosu (rapor seed'leri) */}
      <SectionCard title={t('validation.scenariosTitle')} subtitle={t('validation.advisoryNote')}>
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table
            className="w-full border-collapse text-left text-xs"
            data-testid="validation-results-table"
          >
            <thead className="bg-secondary/60 font-mono text-[11px] text-muted-foreground">
              <tr>
                <th className="p-2.5">{t('validation.colScenario')}</th>
                <th className="p-2.5">{t('validation.colStrength')}</th>
                <th className="p-2.5">{t('validation.colRuns')}</th>
                <th className="p-2.5">{t('validation.colTpFn')}</th>
                <th className="p-2.5">{t('validation.colRecall')}</th>
                <th className="p-2.5">{t('validation.colSpecificity')}</th>
                <th className="p-2.5">{t('validation.colFpCount')}</th>
                <th className="p-2.5">{t('validation.colFp')}</th>
                <th className="p-2.5">{t('validation.colAdvisory')}</th>
                <th className="p-2.5">{t('validation.colDelay')}</th>
                <th className="p-2.5">{t('validation.colTriage')}</th>
                <th className="p-2.5">
                  <span className="sr-only">{t('validation.replayCockpit')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-[11px] tabular-nums">
              {report.scenarios.map((row) => (
                <tr key={row.scenarioId} className="hover:bg-secondary/20">
                  <td className="p-2.5 font-sans font-semibold">
                    {t(`scenario.${row.scenarioId}.title` as Parameters<typeof t>[0])}
                  </td>
                  <td className="p-2.5">{row.eventStrength}</td>
                  <td className="p-2.5">{row.runsCount}</td>
                  <td className="p-2.5">
                    {row.tp} / {row.fn}
                  </td>
                  <td className="p-2.5">{pct(row.recall)}</td>
                  <td className="p-2.5">{pct(row.specificity)}</td>
                  <td className="p-2.5">{row.fp}</td>
                  <td className="p-2.5">{num(row.fpPerCrewDay, 4)}</td>
                  <td className="p-2.5">{row.advisoryCount}</td>
                  <td className="p-2.5">
                    {min(row.medianLatencyMin)} / {min(row.p90LatencyMin)}
                  </td>
                  <td className="p-2.5">{pct(row.triageAccuracy)}</td>
                  <td className="p-2.5">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => handleReplay(row.scenarioId)}
                      data-testid={`replay-scenario-${row.scenarioId}`}
                    >
                      <RotateCcw aria-hidden="true" className="size-3" />
                      <span>{t('validation.replayCockpit')}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Duyarlılık */}
      <SectionCard
        title={t('validation.sensitivityTitle')}
        subtitle={t('validation.sensitivityNote')}
      >
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table
            className="w-full border-collapse text-left text-xs"
            data-testid="validation-sensitivity-table"
          >
            <thead className="bg-secondary/60 font-mono text-[11px] text-muted-foreground">
              <tr>
                <th className="p-2.5">{t('validation.colParameter')}</th>
                <th className="p-2.5">{t('validation.colDelta')}</th>
                <th className="p-2.5">{t('validation.colRecallRange')}</th>
                <th className="p-2.5">{t('validation.colFpRange')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-[11px] tabular-nums">
              {report.sensitivity.map((row) => {
                const point = (label: 'minus' | 'base' | 'plus') =>
                  row.points.find((p) => p.label === label)
                const series = (pick: (p: NonNullable<ReturnType<typeof point>>) => string) =>
                  (['minus', 'base', 'plus'] as const)
                    .map((l) => {
                      const p = point(l)
                      return p ? pick(p) : '—'
                    })
                    .join(' / ')
                return (
                  <tr key={row.parameter}>
                    <td className="p-2.5 font-semibold">{row.parameter}</td>
                    <td className="p-2.5">
                      ±{formatNumber(row.pct, 0)}% ({formatNumber(row.baseValue, 2)})
                    </td>
                    <td className="p-2.5">{series((p) => pct(p.recall))}</td>
                    <td className="p-2.5">{series((p) => num(p.fpPerCrewDay))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Puanlama varsayımları */}
      <SectionCard title={t('validation.assumptionsTitle')}>
        <ul
          className="list-disc space-y-1 pl-5 text-[11px] text-muted-foreground"
          data-testid="validation-assumptions"
        >
          {report.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
