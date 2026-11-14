// FAZ 10 §3.5 — Doğrulama Sayfası (/validation):
// Run Quick/Full Validation, ilerleme çubuğu, senaryo x metrik tablosu, her zaman açık Limitations kutusu,
// duyarlılık tablosu, JSON/MD indirme ve "Replay in cockpit".
import { AlertTriangle, CheckCircle2, Download, Play, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { computeEvidenceFingerprint } from '@/core/validation/fingerprint'
import type { ScenarioId } from '@/core/types'
import { EmptyState } from '@/ui/components/EmptyState'
import { SectionCard } from '@/ui/components/SectionCard'
import { useT } from '@/ui/i18n'
import { actions, useValidationStore, type UiValidationReport } from '@/ui/store'

const DEFAULT_LIMITATIONS = [
  'Synthetic telemetry only: physiological signals are generated from seeded deterministic models, not human flight data.',
  'Bone mineral density loss is an indicative estimate from resistive exercise compliance; real measurement requires pre/post-flight DXA scans.',
  'New crew members (< 7 days baseline) intentionally cap automated severity at ADVISORY until baseline confidence reaches threshold.',
  'Parameters marked DEMO_PARAMETER are unverified heuristics tuned on seeds 1–5 and evaluated on held-out seeds 100–119.',
]

function reportToMarkdown(report: UiValidationReport): string {
  const lines: string[] = [
    `# Validation Report (${report.mode})`,
    `Parameters fingerprint: ${report.evidenceFingerprint}`,
    `Tuning seeds: ${report.tuningSeeds} | Held-out report seeds: ${report.reportSeeds}`,
    '',
    '## Scenarios',
    '| Scenario | Recall | Precision | FP/crew-day | Median/p90 Delay (min) | Triage Accuracy |',
    '|---|---|---|---|---|---|',
    ...report.scenarios.map(
      (s) =>
        `| ${s.scenarioId} | ${(s.recall * 100).toFixed(0)}% | ${(s.precision * 100).toFixed(0)}% | ${s.fpPerCrewDay.toFixed(2)} | ${s.medianDelayMin}/${s.p90DelayMin} | ${(s.triageAccuracy * 100).toFixed(0)}% |`,
    ),
    '',
    '## Known Limitations',
    ...report.limitations.map((l) => `- ${l}`),
  ]
  return lines.join('\n')
}

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

export function ValidationPage() {
  const { t, formatNumber } = useT()
  const navigate = useNavigate()
  const { running, progress, report } = useValidationStore()

  const fingerprint = report?.evidenceFingerprint ?? computeEvidenceFingerprint()
  const limitations = report?.limitations ?? DEFAULT_LIMITATIONS

  const handleReplay = (scenarioId: ScenarioId) => {
    actions.setScenario(scenarioId)
    navigate('/')
  }

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="validation-page">
      {/* Üst Başlık + Kontrol Düğmeleri */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {t('validation.pageTitle')}
            </h1>
            <span
              data-testid="validation-fingerprint-badge"
              className="rounded border border-border/70 bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              parameters v{fingerprint.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t('validation.pageSubtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={running}
            onClick={() => actions.requestValidation(true)}
            data-testid="validation-run-quick-btn"
          >
            <Play aria-hidden="true" className="size-3.5" />
            <span>{t('validation.runQuick')}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={running}
            onClick={() => actions.requestValidation(false)}
            data-testid="validation-run-full-btn"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            <span>{t('validation.runFull')}</span>
          </Button>
          {running && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => actions.cancelValidation()}
              data-testid="validation-cancel-btn"
            >
              <X aria-hidden="true" className="size-3.5" />
              <span>{t('validation.cancel')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      {running && progress && (
        <div
          data-testid="validation-progress-box"
          className="space-y-1.5 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs"
        >
          <div className="flex justify-between font-mono">
            <span>{t('validation.running', { done: progress.done, total: progress.total })}</span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} />
        </div>
      )}

      {/* Bilinen Sınırlamalar (HER ZAMAN GÖRÜNÜR, DARALTILAMAZ) */}
      <div
        data-testid="validation-limitations-box"
        className="rounded-xl border border-status-warning/60 bg-status-warning/10 p-4 text-xs"
      >
        <div className="mb-2 flex items-center gap-2 font-semibold text-status-warning">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('validation.limitationsTitle')}</span>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-[11px] text-foreground">
          {limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Rapor Sonuçları */}
      {!report ? (
        <SectionCard title={t('nav.validation')}>
          <EmptyState title={t('validation.emptyHint')} />
        </SectionCard>
      ) : (
        <>
          {report.overfittingWarning && (
            <div
              role="alert"
              data-testid="validation-overfitting-warning"
              className="rounded-xl border border-status-advisory/60 bg-status-advisory/10 px-4 py-2.5 text-xs text-status-advisory"
            >
              <span className="font-semibold">{t('validation.overfittingWarning')}: </span>
              <span>{report.overfittingWarning}</span>
            </div>
          )}

          <SectionCard
            title={`${t('nav.validation')} (${report.mode})`}
            subtitle={t('validation.seedsComparison', {
              tuning: report.tuningSeeds,
              report: report.reportSeeds,
            })}
            headerRight={
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  data-testid="validation-download-json"
                  onClick={() =>
                    triggerBlobDownload(
                      'validation-report.json',
                      JSON.stringify(report, null, 2),
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
                      reportToMarkdown(report),
                      'text/markdown',
                    )
                  }
                >
                  <Download aria-hidden="true" className="size-3" />
                  <span>{t('validation.downloadMd')}</span>
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table
                className="w-full border-collapse text-left text-xs"
                data-testid="validation-results-table"
              >
                <thead className="bg-secondary/60 font-mono text-[11px] text-muted-foreground">
                  <tr>
                    <th className="p-2.5">{t('validation.colScenario')}</th>
                    <th className="p-2.5">{t('validation.colRecall')}</th>
                    <th className="p-2.5">{t('validation.colPrecision')}</th>
                    <th className="p-2.5">{t('validation.colFp')}</th>
                    <th className="p-2.5">{t('validation.colDelay')}</th>
                    <th className="p-2.5">{t('validation.colTriage')}</th>
                    <th className="p-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {report.scenarios.map((row) => (
                    <tr key={row.scenarioId} className="hover:bg-secondary/20">
                      <td className="p-2.5 font-mono text-[11px] font-semibold">
                        {t(`scenario.${row.scenarioId}.title` as Parameters<typeof t>[0])}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {row.recallTargetMet ? (
                            <CheckCircle2 aria-hidden="true" className="size-3.5 text-primary" />
                          ) : (
                            <AlertTriangle
                              aria-hidden="true"
                              className="size-3.5 text-status-warning"
                            />
                          )}
                          <span>{Math.round(row.recall * 100)}%</span>
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] tabular-nums">
                        {Math.round(row.precision * 100)}%
                      </td>
                      <td className="p-2.5 font-mono text-[11px] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {row.fpTargetMet ? (
                            <CheckCircle2 aria-hidden="true" className="size-3.5 text-primary" />
                          ) : (
                            <AlertTriangle
                              aria-hidden="true"
                              className="size-3.5 text-status-warning"
                            />
                          )}
                          <span>{formatNumber(row.fpPerCrewDay, 2)}</span>
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] tabular-nums">
                        {row.medianDelayMin} / {row.p90DelayMin} min
                      </td>
                      <td className="p-2.5 font-mono text-[11px] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {row.triageTargetMet ? (
                            <CheckCircle2 aria-hidden="true" className="size-3.5 text-primary" />
                          ) : (
                            <AlertTriangle
                              aria-hidden="true"
                              className="size-3.5 text-status-warning"
                            />
                          )}
                          <span>{Math.round(row.triageAccuracy * 100)}%</span>
                        </span>
                      </td>
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

          {/* Duyarlılık Analizi Tablosu */}
          <SectionCard title={t('validation.sensitivityTitle')}>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-secondary/60 font-mono text-[11px] text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Evidence ID</th>
                    <th className="p-2.5">Δ Parameter</th>
                    <th className="p-2.5">Δ Recall</th>
                    <th className="p-2.5">Δ FP / crew-day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                  {report.sensitivity.map((row, idx) => (
                    <tr key={`${row.paramId}-${idx}`}>
                      <td className="p-2.5 font-semibold">{row.paramId}</td>
                      <td className="p-2.5">
                        {row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`}
                      </td>
                      <td className="p-2.5">{row.recallDelta.toFixed(2)}</td>
                      <td className="p-2.5">{row.fpDelta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
