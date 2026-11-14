// FAZ 9 §3.4 — Kokpit Sol Sütun (Kişi Özeti: 7 durum çipi + baseline güveni + 6 son değer karosu)
// ve Sağ Sütun (Son 5 uyarı + En öncelikli 2 eylem kartı + Earth Link sayacı mini kartı).
import { memo } from 'react'
import { Check, Clock, Radio, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { getNumber } from '@/core/evidence/registry'
import {
  METRIC_META,
  type ActionCard,
  type Alert,
  type CrewId,
  type EarthLinkPreset,
  type MetricId,
  type Severity,
  type StateEstimate,
} from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import {
  actions,
  getCrewProfile,
  type CrewConfidenceInfo,
  type CrewMetricBaseline,
  type DataQualityIssue,
  type EarthLinkStoreState,
  type SeriesPoint,
} from '@/ui/store'
import { latestKey } from '@/workers/protocol'
import { EmptyState } from './EmptyState'
import { MetricTile } from './MetricTile'
import { ProvenanceTag } from './ProvenanceTag'
import { SectionCard } from './SectionCard'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'
import { EarthDelayBadge, StatusBadge } from './StatusBadge'

const COCKPIT_TILE_METRICS: readonly { metric: MetricId; digits: number }[] = [
  { metric: 'hr', digits: 0 },
  { metric: 'spo2', digits: 1 },
  { metric: 'hrv', digits: 0 },
  { metric: 'sleep.durationH', digits: 1 },
  { metric: 'hydrationL', digits: 1 },
  { metric: 'mood.mood', digits: 1 },
] as const

function stateScoreToSeverity(
  score: number,
  stateId: StateEstimate['state'],
  isLearning: boolean,
): DisplaySeverity {
  const adv = getNumber('det.state.score.advisory')
  const warn = getNumber('det.state.score.warning')
  const crit = getNumber('det.state.score.critical')

  if (score < adv) return 'NOMINAL'
  if (isLearning) return 'ADVISORY' satisfies Severity
  if (score >= crit && stateId === 'radiation_event') return 'CRITICAL' satisfies Severity
  if (score >= warn) return 'WARNING' satisfies Severity
  return 'ADVISORY' satisfies Severity
}

function StateChip({
  estimate,
  isLearning,
}: {
  estimate: StateEstimate
  isLearning: boolean
}) {
  const { t } = useT()
  const pct = Math.round(Math.min(1, Math.max(0, estimate.score)) * 100)
  const confPct = Math.round(estimate.confidence * 100)
  const severity = stateScoreToSeverity(estimate.score, estimate.state, isLearning)

  const radius = 14
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, estimate.score)))

  const ringStroke =
    severity === 'CRITICAL'
      ? 'var(--status-critical)'
      : severity === 'WARNING'
        ? 'var(--status-warning)'
        : severity === 'ADVISORY'
          ? 'var(--status-advisory)'
          : 'var(--primary)'

  return (
    <div
      data-testid={`state-chip-${estimate.state}`}
      data-score={estimate.score.toFixed(2)}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-2',
        severity === 'CRITICAL' && 'border-status-critical/70 bg-status-critical/10',
        severity === 'WARNING' && 'border-status-warning/60 bg-status-warning/10',
        severity === 'ADVISORY' && 'border-status-advisory/50 bg-status-advisory/10',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* 0–1 Skor Halkası (SVG) */}
        <div className="relative flex size-9 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden="true">
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-muted/70"
              strokeWidth="3.5"
            />
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={ringStroke}
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute font-mono text-[10px] font-bold text-foreground tabular-nums">
            {estimate.score.toFixed(2)}
          </span>
        </div>

        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">
            {t(`state.${estimate.state}`)}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            <span>{t('cockpit.stateConfidence', { pct: confPct })}</span>
            <span>·</span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>

      <SeverityIcon severity={severity} className="size-4" />
    </div>
  )
}

export interface CrewSummaryColumnProps {
  crewId: CrewId
  confidenceInfo: CrewConfidenceInfo
  states: readonly StateEstimate[]
  latestValues: Record<string, number>
  baselines: Record<string, CrewMetricBaseline>
  seriesByKey: Record<string, SeriesPoint[]>
  dataQuality: Record<string, DataQualityIssue>
}

export const CrewSummaryColumn = memo(function CrewSummaryColumn({
  crewId,
  confidenceInfo,
  states,
  latestValues,
  baselines,
  seriesByKey,
  dataQuality,
}: CrewSummaryColumnProps) {
  const { t } = useT()
  const crewProfile = getCrewProfile(crewId)
  const confPct = Math.round(confidenceInfo.confidence * 100)

  return (
    <div className="space-y-3">
      {/* Baseline Güveni Kartı */}
      <SectionCard
        title={t('cockpit.baselineConfidence')}
        subtitle={`${crewProfile.displayName} (${crewProfile.role})`}
        provenanceId="baseline.window.days.target"
        headerRight={<ProvenanceTag evidenceId="det.confidence.cap.threshold" />}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs tabular-nums">
            <span className="font-semibold text-foreground">
              {confPct}% ({confidenceInfo.learningDay}/{confidenceInfo.targetDays}d)
            </span>
            {confidenceInfo.isLearning ? (
              <span
                data-testid="learning-baseline-label"
                className="rounded border border-status-info/50 bg-status-info/15 px-2 py-0.5 text-[11px] font-semibold text-status-info"
              >
                {t('cockpit.learningBaselineDay', {
                  day: confidenceInfo.learningDay,
                  target: confidenceInfo.targetDays,
                })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                <span>{t('cockpit.baselineReady')}</span>
              </span>
            )}
          </div>
          <Progress
            value={confPct}
            aria-label={t('cockpit.baselineConfidence')}
            className="h-2"
          />
          {confidenceInfo.isLearning && (
            <p className="font-mono text-[11px] text-status-info">
              {t('cockpit.learningBaseline')}
            </p>
          )}
        </div>
      </SectionCard>

      {/* 7 Durum Çipi (Composite State Estimates) */}
      <SectionCard
        title={t('cockpit.stateChipsTitle')}
        provenanceId="det.state.score.warning"
      >
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
          {states.map((st) => (
            <StateChip
              key={st.state}
              estimate={st}
              isLearning={confidenceInfo.isLearning}
            />
          ))}
        </div>
      </SectionCard>

      {/* 6 Son Değer Karosu (HR, SpO2, HRV, Uyku, Su, Ruh Hali) */}
      <SectionCard title={t('cockpit.latestTilesTitle')}>
        <div className="grid grid-cols-2 gap-2">
          {COCKPIT_TILE_METRICS.map(({ metric, digits }) => {
            const key = latestKey(crewId, metric)
            const val = latestValues[key]
            const base = baselines[key]
            const meta = METRIC_META[metric]
            const z =
              val !== undefined && base
                ? Number(((val - base.median) / Math.max(0.05, base.sigma)).toFixed(2))
                : 0
            const spark = seriesByKey[key] ?? []
            const faultInfo = dataQuality[key]

            return (
              <MetricTile
                key={metric}
                metric={metric}
                label={t(meta.labelKey)}
                value={val}
                unit={meta.unit}
                digits={digits}
                z={z}
                baselineMedian={base?.median}
                sparkline={spark}
                learningBaseline={confidenceInfo.isLearning}
                sensorFault={Boolean(faultInfo?.fault)}
                onToggleFault={() => actions.toggleSensorFault(crewId, metric)}
              />
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
})

export interface SummaryFeedColumnProps {
  alerts: readonly Alert[]
  cards: readonly ActionCard[]
  earthLink: EarthLinkStoreState
}

const EARTH_PRESETS: readonly EarthLinkPreset[] = ['MOON', 'MARS_MIN', 'MARS_MAX'] as const

function formatCountdownSec(totalSec: number | null): string {
  if (totalSec === null || !Number.isFinite(totalSec) || totalSec <= 0) return '00:00'
  const mins = Math.floor(totalSec / 60)
  const secs = Math.floor(totalSec % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export const SummaryFeedColumn = memo(function SummaryFeedColumn({
  alerts,
  cards,
  earthLink,
}: SummaryFeedColumnProps) {
  const { t, formatNumber } = useT()

  return (
    <div className="space-y-3">
      {/* Son 5 Uyarı (Kompakt) */}
      <SectionCard
        title={t('cockpit.recentAlertsTitle')}
        headerRight={
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] tabular-nums">
            {alerts.length}
          </span>
        }
      >
        {alerts.length === 0 ? (
          <EmptyState
            title={t('cockpit.noActiveAlerts')}
            description={t('cockpit.noActiveAlertsDesc')}
          />
        ) : (
          <div className="space-y-2" data-testid="recent-alerts-list">
            {alerts.map((al) => {
              const crew = getCrewProfile(al.crewId)
              const firstWhy = al.whyKeys[0]
              const firstEvidence = al.evidenceIds[0]

              return (
                <article
                  key={al.id}
                  data-testid={`alert-item-${al.id}`}
                  className={cn(
                    'space-y-1.5 rounded-lg border p-2.5 text-xs',
                    al.severity === 'CRITICAL'
                      ? 'border-status-critical/70 bg-status-critical/10'
                      : al.severity === 'WARNING'
                        ? 'border-status-warning/60 bg-status-warning/10'
                        : 'border-border/70 bg-background/60',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge severity={al.severity} compact />
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {crew.role}
                      </span>
                    </div>
                    <EarthDelayBadge delayClass={al.earthDelayClass} />
                  </div>

                  <div className="font-medium text-foreground">{t(al.titleKey)}</div>

                  {firstWhy && (
                    <p className="text-[11px] text-muted-foreground">
                      {t(firstWhy.key, firstWhy.params)}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                    {firstEvidence ? (
                      <ProvenanceTag evidenceId={firstEvidence} />
                    ) : (
                      <span />
                    )}

                    {al.status === 'ACTIVE' ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => actions.ackAlert(al.id)}
                        data-testid={`ack-alert-${al.id}`}
                      >
                        <Check aria-hidden="true" className="size-3" />
                        <span>{t('cockpit.ackAlert')}</span>
                      </Button>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ✓ {t('cockpit.acked')}
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* En Öncelikli 2 Eylem Kartı Özeti */}
      <SectionCard
        title={t('cockpit.priorityActionsTitle')}
        headerRight={
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] tabular-nums">
            {cards.length}
          </span>
        }
      >
        {cards.length === 0 ? (
          <EmptyState
            title={t('cockpit.noActionCards')}
            description={t('cockpit.noActionCardsDesc')}
            icon={<Sparkles aria-hidden="true" className="size-4" />}
          />
        ) : (
          <div className="space-y-2" data-testid="priority-cards-list">
            {cards.map((card) => {
              const crew = getCrewProfile(card.crewId)
              const firstEv = card.evidenceIds[0]

              return (
                <article
                  key={card.id}
                  data-testid={`action-card-${card.id}`}
                  className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                        P{card.priority} · {crew.role}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t(`cockpit.cardState.${card.state}`)}
                      </span>
                    </div>
                    <EarthDelayBadge delayClass={card.earthDelayClass} />
                  </div>

                  <div className="font-semibold text-foreground">{t(card.titleKey)}</div>

                  <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                    {card.stepKeys.map((sk) => (
                      <li key={sk}>{t(sk)}</li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                    {firstEv ? <ProvenanceTag evidenceId={firstEv} /> : <span />}

                    <div className="flex items-center gap-1">
                      {card.state === 'SUGGESTED' && (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            variant="default"
                            onClick={() => actions.acceptAction(card.id)}
                            data-testid={`accept-card-${card.id}`}
                          >
                            <Check aria-hidden="true" className="size-3" />
                            <span>{t('cockpit.acceptAction')}</span>
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => actions.dismissAction(card.id)}
                            data-testid={`dismiss-card-${card.id}`}
                          >
                            <X aria-hidden="true" className="size-3" />
                            <span>{t('cockpit.dismissAction')}</span>
                          </Button>
                        </>
                      )}
                      {card.state === 'ACCEPTED' && (
                        <Button
                          type="button"
                          size="xs"
                          variant="secondary"
                          onClick={() => actions.completeAction(card.id)}
                          data-testid={`complete-card-${card.id}`}
                        >
                          <Check aria-hidden="true" className="size-3" />
                          <span>{t('cockpit.completeAction')}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Earth Link Sayacı Mini Kartı */}
      <SectionCard
        title={t('earth.cardTitle')}
        subtitle={t('earth.cardSubtitle')}
        provenanceId="earth.groundProcessingMin"
      >
        <div className="space-y-2.5 text-xs">
          {/* Gecikme Ön Ayarları */}
          <div className="flex flex-wrap items-center gap-1">
            {EARTH_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => actions.setEarthLinkPreset(preset)}
                aria-pressed={earthLink.config.preset === preset}
                data-testid={`earth-preset-${preset}`}
                className={cn(
                  'rounded border px-2 py-1 font-mono text-[11px] transition-colors',
                  earthLink.config.preset === preset
                    ? 'border-primary bg-primary/15 font-semibold text-primary'
                    : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`earth.preset.${preset}`)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/70 bg-background/60 p-2">
              <div className="text-[10px] text-muted-foreground">{t('earth.oneWay')}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-foreground tabular-nums">
                {earthLink.config.oneWayDelaySec < 60
                  ? `${earthLink.config.oneWayDelaySec} s`
                  : `${formatNumber(earthLink.config.oneWayDelaySec / 60, 1)} min`}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-2">
              <div className="text-[10px] text-muted-foreground">{t('earth.roundTrip')}</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums">
                {Number.isFinite(earthLink.roundTripMin)
                  ? `${formatNumber(earthLink.roundTripMin, 1)} min`
                  : '∞ (Blackout)'}
              </div>
            </div>
          </div>

          {/* Bekleyen Cevap Sayacı */}
          <div
            data-testid="earth-link-counter-box"
            className={cn(
              'flex items-center justify-between rounded-lg border p-2.5 font-mono text-xs tabular-nums',
              earthLink.pendingReplyCount > 0
                ? 'border-status-warning/50 bg-status-warning/15 text-status-warning'
                : 'border-border/70 bg-background/60 text-muted-foreground',
            )}
          >
            <div className="flex items-center gap-2">
              {earthLink.pendingReplyCount > 0 ? (
                <Clock aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <Radio aria-hidden="true" className="size-4 shrink-0 text-primary" />
              )}
              <span>
                {earthLink.pendingReplyCount > 0
                  ? t('earth.replyEta', {
                      eta: formatCountdownSec(earthLink.nextReplyEtaSec),
                    })
                  : t('earth.noPendingReply')}
              </span>
            </div>
            {earthLink.pendingReplyCount > 0 && (
              <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-[10px] font-bold">
                {earthLink.pendingReplyCount}
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t('earth.triageRule', {
              rt: Number.isFinite(earthLink.roundTripMin)
                ? formatNumber(earthLink.roundTripMin, 0)
                : '∞',
            })}
          </p>
        </div>
      </SectionCard>
    </div>
  )
})
