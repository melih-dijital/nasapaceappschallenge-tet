// FAZ 9 §3.4 & §3.5 — Kokpit Sayfası (/):
// Üç sütunlu görev kontrol düzeni (Sol: kişi özeti · Orta: telemetri, radyasyon, kemik tahmini · Sağ: uyarı/karar/Earth Link),
// kritik durum aria-live="assertive" bölgesi ve Worker ERROR -> Restart engine kurtarma kutusu.
import { useMemo } from 'react'
import { OctagonAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MS_PER_DAY } from '@/core/units'
import { CrewSummaryColumn, SummaryFeedColumn } from '@/ui/components/CockpitSidebars'
import { Skeleton } from '@/ui/components/Skeleton'
import { EarthDelayBadge, StatusBadge } from '@/ui/components/StatusBadge'
import {
  BoneEstimateCard,
  HrTelemetryChart,
  RadiationPanel,
  SleepActivityChart,
  Spo2TelemetryChart,
} from '@/ui/components/TelemetryCharts'
import { useT } from '@/ui/i18n'
import {
  actions,
  getCrewProfile,
  selectActiveAlerts,
  selectBaseline,
  selectCrewConfidence,
  selectCrewStates,
  selectPriorityCards,
  selectRecentAlerts,
  selectSeries,
  useAlertStore,
  useDecisionStore,
  useEarthLinkStore,
  useSessionStore,
  useStateStore,
  useTelemetryStore,
} from '@/ui/store'

export function CockpitPage() {
  const { t } = useT()

  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)
  const speed = useSessionStore((s) => s.speed)
  const workerStatus = useSessionStore((s) => s.workerStatus)
  const workerError = useSessionStore((s) => s.workerError)

  const telemetryState = useTelemetryStore()
  const alerts = useAlertStore((s) => s.alerts)
  const stateByCrew = useStateStore((s) => s.byCrew)
  const cards = useDecisionStore((s) => s.cards)
  const earthLink = useEarthLinkStore()

  const crewProfile = getCrewProfile(selectedCrewId)
  const confidenceInfo = useMemo(
    () => selectCrewConfidence(telemetryState, selectedCrewId),
    [telemetryState, selectedCrewId],
  )

  const hrSeries = useMemo(
    () => selectSeries(telemetryState, selectedCrewId, 'hr', MS_PER_DAY),
    [telemetryState, selectedCrewId],
  )
  const spo2Series = useMemo(
    () => selectSeries(telemetryState, selectedCrewId, 'spo2', MS_PER_DAY),
    [telemetryState, selectedCrewId],
  )
  const radSeries = useMemo(
    () => selectSeries(telemetryState, selectedCrewId, 'rad.doseRateMsvDay', MS_PER_DAY),
    [telemetryState, selectedCrewId],
  )

  const hrBaseline = useMemo(
    () => selectBaseline(telemetryState, selectedCrewId, 'hr'),
    [telemetryState, selectedCrewId],
  )
  const spo2Baseline = useMemo(
    () => selectBaseline(telemetryState, selectedCrewId, 'spo2'),
    [telemetryState, selectedCrewId],
  )

  const crewStates = useMemo(
    () => selectCrewStates({ byCrew: stateByCrew }, selectedCrewId),
    [stateByCrew, selectedCrewId],
  )

  const recentAlerts = useMemo(() => selectRecentAlerts({ alerts }, undefined, 5), [alerts])
  const crewAlerts = useMemo(
    () => selectActiveAlerts({ alerts }, selectedCrewId),
    [alerts, selectedCrewId],
  )
  const priorityCards = useMemo(() => selectPriorityCards({ cards }, undefined, 2), [cards])

  const criticalAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'ACTIVE' && a.severity === 'CRITICAL'),
    [alerts],
  )
  const topCritical = criticalAlerts[0]

  const sleepEntries = telemetryState.sleepHistory[selectedCrewId] ?? []
  const radSummary = telemetryState.radiationSummary[selectedCrewId]
  const boneSummary = telemetryState.boneSummary[selectedCrewId]

  return (
    <div className="space-y-3" data-testid="cockpit-page">
      {/* Sayfa Başlığı (h1: tests/ui/app.test.tsx ve ekran okuyucular için) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-base font-bold tracking-wide text-foreground">
            {t('nav.cockpit')}
          </h1>
          <span className="text-xs text-muted-foreground">
            · {crewProfile.displayName} ({crewProfile.role})
          </span>
        </div>
      </div>

      {/* Kritik Durum Ekran Okuyucu Duyuru Bölgesi (aria-live="assertive" — FAZ 9 §3.6) */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        data-testid="critical-live-region"
        className={topCritical ? 'block' : 'sr-only'}
      >
        {topCritical && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-critical bg-status-critical/20 px-4 py-2.5 text-xs text-foreground shadow-sm status-critical-pulse">
            <div className="flex flex-wrap items-center gap-2">
              <OctagonAlert aria-hidden="true" className="size-4 shrink-0 text-status-critical" />
              <StatusBadge severity="CRITICAL" compact />
              <EarthDelayBadge delayClass={topCritical.earthDelayClass} />
              <span className="font-semibold">
                {t('cockpit.criticalLiveAnnouncement', {
                  crew: getCrewProfile(topCritical.crewId).displayName,
                  title: t(topCritical.titleKey),
                  triage: t(`earthDelay.${topCritical.earthDelayClass}`),
                })}
              </span>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => actions.ackAlert(topCritical.id)}
              data-testid="critical-banner-ack-btn"
            >
              {t('cockpit.ackAlert')}
            </Button>
          </div>
        )}
      </div>

      {/* Worker ERROR Durumu + Restart Engine Düğmesi (FAZ 9 §3.5) */}
      {workerStatus === 'ERROR' && (
        <div
          role="alert"
          data-testid="worker-error-alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-critical/80 bg-status-critical/15 px-4 py-3 text-xs text-foreground"
        >
          <div className="space-y-0.5">
            <div className="font-semibold text-status-critical">{t('worker.errorTitle')}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              [{workerError?.code ?? 'ERR'}] {workerError?.message ?? 'Worker connection lost'}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => actions.restartEngine()}
            data-testid="restart-engine-btn"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            <span>{t('worker.restartButton')}</span>
          </Button>
        </div>
      )}

      {/* Yükleniyor Durumu */}
      {workerStatus === 'IDLE' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Skeleton className="h-96 xl:col-span-3" label={t('worker.loading')} />
          <Skeleton className="h-96 xl:col-span-6" label={t('worker.loading')} />
          <Skeleton className="h-96 xl:col-span-3" label={t('worker.loading')} />
        </div>
      ) : (
        /* Üç Sütunlu Kokpit Düzeni (≥ 1280px: 3 sütun; 1024px: uyumlu grid; mobil: tek sütun) */
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Sol Sütun: Kişi Özeti */}
          <div className="lg:col-span-4 xl:col-span-3">
            <CrewSummaryColumn
              crewId={selectedCrewId}
              confidenceInfo={confidenceInfo}
              states={crewStates}
              latestValues={telemetryState.latestValues}
              baselines={telemetryState.baselines}
              seriesByKey={telemetryState.series}
              dataQuality={telemetryState.dataQuality}
            />
          </div>

          {/* Orta Sütun: Canlı Telemetri, Radyasyon Paneli, Kemik Tahmini */}
          <div className="space-y-3 lg:col-span-8 xl:col-span-6">
            <HrTelemetryChart
              crewId={selectedCrewId}
              points={hrSeries}
              baseline={hrBaseline}
              confidenceInfo={confidenceInfo}
              alerts={crewAlerts}
              speed={speed}
            />

            <Spo2TelemetryChart
              points={spo2Series}
              baseline={spo2Baseline}
              speed={speed}
            />

            <SleepActivityChart
              entries={sleepEntries}
              confidenceInfo={confidenceInfo}
            />

            {radSummary && (
              <RadiationPanel
                summary={radSummary}
                rateSeries={radSeries}
                speed={speed}
              />
            )}

            {boneSummary && <BoneEstimateCard bone={boneSummary} />}
          </div>

          {/* Sağ Sütun: Özet Akış (Son 5 Uyarı, En Öncelikli 2 Eylem Kartı, Earth Link Sayacı) */}
          <div className="lg:col-span-12 xl:col-span-3">
            <SummaryFeedColumn
              alerts={recentAlerts}
              cards={priorityCards}
              earthLink={earthLink}
            />
          </div>
        </div>
      )}
    </div>
  )
}
