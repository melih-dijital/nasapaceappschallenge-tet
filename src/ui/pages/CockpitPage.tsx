// Kokpit (/): Sol — Crew status + son değerler · Orta — HR, SpO₂, uyku/borç, radyasyon · Sağ — Active alerts,
// Recommended actions, Earth link. Kritik durum ekran okuyucuya aria-live="assertive" ile duyurulur (görsel şerit
// AppShell'de). Worker hatasında kurtarma kutusu.
import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MS_PER_DAY } from '@/core/units'
import { CrewStatusPanel } from '@/ui/components/CrewStatusPanel'
import { EarthLinkSummary } from '@/ui/components/EarthLinkSummary'
import { ActiveAlertsPanel, RecommendedActionsPanel } from '@/ui/components/FeedPanels'
import { GroundMirrorView } from '@/ui/components/GroundMirrorView'
import { LatestReadingsPanel } from '@/ui/components/LatestReadingsPanel'
import { Skeleton } from '@/ui/components/Skeleton'
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
  const groundMirror = useEarthLinkStore((s) => s.groundMirror)
  const [showEarthView, setShowEarthView] = useState(false)

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
  const activeAlerts = useMemo(() => selectRecentAlerts({ alerts }, undefined, 5), [alerts])
  const crewAlerts = useMemo(
    () => selectActiveAlerts({ alerts }, selectedCrewId),
    [alerts, selectedCrewId],
  )
  const priorityCards = useMemo(() => selectPriorityCards({ cards }, undefined, 3), [cards])

  const topCritical = alerts.find((a) => a.status === 'ACTIVE' && a.severity === 'CRITICAL')
  const sleepEntries = telemetryState.sleepHistory[selectedCrewId] ?? []
  const radSummary = telemetryState.radiationSummary[selectedCrewId]
  const boneSummary = telemetryState.boneSummary[selectedCrewId]

  return (
    <div className="space-y-3" data-testid="cockpit-page">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-medium text-foreground">{t('nav.cockpit')}</h1>
          <span className="text-[13px] text-muted-foreground">
            {crewProfile.displayName} · {t(`crew.role.${crewProfile.role}`)}
          </span>
        </div>
        {/* Sunum karşılaştırması: yalnızca motor groundMirror gönderiyorsa */}
        {groundMirror && (
          <div
            role="group"
            aria-label={t('earthView.compareLabel')}
            className="flex rounded-md border border-border p-0.5 text-xs"
          >
            {[false, true].map((earth) => (
              <button
                key={String(earth)}
                type="button"
                aria-pressed={showEarthView === earth}
                onClick={() => setShowEarthView(earth)}
                className={
                  showEarthView === earth
                    ? 'rounded bg-accent px-2 py-0.5 text-foreground'
                    : 'px-2 py-0.5 text-muted-foreground'
                }
              >
                {earth ? t('earthView.earth') : t('earthView.onboard')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Kritik durum: ekran okuyucu duyurusu (görsel şerit AppShell'de) */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        data-testid="critical-live-region"
        className="sr-only"
      >
        {topCritical &&
          t('cockpit.criticalLiveAnnouncement', {
            crew: getCrewProfile(topCritical.crewId).displayName,
            title: t(topCritical.titleKey),
            triage: t(`earthDelay.${topCritical.earthDelayClass}`),
          })}
      </div>

      {workerStatus === 'ERROR' && (
        <div
          role="alert"
          data-testid="worker-error-alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-critical/50 bg-status-critical/10 px-3 py-2 text-[13px]"
        >
          <div>
            <div className="font-medium text-status-critical">{t('worker.errorTitle')}</div>
            <div className="font-mono text-xs text-muted-foreground">
              [{workerError?.code ?? 'ERR'}] {workerError?.message ?? 'Worker connection lost'}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => actions.restartEngine()}
            data-testid="restart-engine-btn"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            <span>{t('worker.restartButton')}</span>
          </Button>
        </div>
      )}

      {showEarthView && groundMirror ? (
        <GroundMirrorView mirror={groundMirror} />
      ) : workerStatus === 'IDLE' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Skeleton className="h-96 xl:col-span-3" label={t('worker.loading')} />
          <Skeleton className="h-96 xl:col-span-6" label={t('worker.loading')} />
          <Skeleton className="h-96 xl:col-span-3" label={t('worker.loading')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4 xl:col-span-3">
            <CrewStatusPanel states={crewStates} confidenceInfo={confidenceInfo} />
            <LatestReadingsPanel
              crewId={selectedCrewId}
              confidenceInfo={confidenceInfo}
              latestValues={telemetryState.latestValues}
              baselines={telemetryState.baselines}
              seriesByKey={telemetryState.series}
              dataQuality={telemetryState.dataQuality}
            />
            {boneSummary && <BoneEstimateCard bone={boneSummary} />}
          </div>

          <div className="space-y-3 lg:col-span-8 xl:col-span-6">
            <HrTelemetryChart
              crewId={selectedCrewId}
              points={hrSeries}
              baseline={hrBaseline}
              confidenceInfo={confidenceInfo}
              alerts={crewAlerts}
              speed={speed}
            />
            <Spo2TelemetryChart points={spo2Series} baseline={spo2Baseline} speed={speed} />
            <SleepActivityChart entries={sleepEntries} confidenceInfo={confidenceInfo} />
            {radSummary && (
              <RadiationPanel summary={radSummary} rateSeries={radSeries} speed={speed} />
            )}
          </div>

          <div className="space-y-3 lg:col-span-12 xl:col-span-3">
            <ActiveAlertsPanel alerts={activeAlerts} />
            <RecommendedActionsPanel cards={priorityCards} />
            <EarthLinkSummary />
          </div>
        </div>
      )}
    </div>
  )
}
