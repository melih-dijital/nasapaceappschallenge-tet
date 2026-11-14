// FAZ 10 §3.1 — Uyarılar, "Why?" çekmecesi, Eylem Kartları ve 24 Saatlik Görev Takvimi (/alerts).
import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Check,
  Clock,
  Droplets,
  Dumbbell,
  HelpCircle,
  Radio,
  ShieldAlert,
  Sparkles,
  Utensils,
  Wrench,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getNumber } from '@/core/evidence/registry'
import type { Alert, MetricId, ScheduleBlockType } from '@/core/types'
import { MS_PER_HOUR } from '@/core/units'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/ui/components/EmptyState'
import { ProvenanceTag } from '@/ui/components/ProvenanceTag'
import { SectionCard } from '@/ui/components/SectionCard'
import { SeverityIcon } from '@/ui/components/SeverityIcon'
import { EarthDelayBadge, StatusBadge } from '@/ui/components/StatusBadge'
import { useT } from '@/ui/i18n'
import {
  actions,
  buildCrewScheduleViews,
  getCrewProfile,
  selectAlertsSorted,
  selectCrewConfidence,
  selectCrewStates,
  selectSeries,
  useAlertStore,
  useDecisionStore,
  useEarthLinkStore,
  useSessionStore,
  useStateStore,
  useTelemetryStore,
} from '@/ui/store'

function blockIcon(type: ScheduleBlockType) {
  switch (type) {
    case 'SLEEP':
      return BedDouble
    case 'MEAL':
      return Utensils
    case 'HYDRATION':
      return Droplets
    case 'EXERCISE_AERO':
    case 'EXERCISE_RESISTIVE':
      return Dumbbell
    case 'SHELTER':
      return ShieldAlert
    case 'COMMS':
      return Radio
    case 'EVA':
    case 'WORK':
      return Wrench
    default:
      return Clock
  }
}

function blockColorClass(type: ScheduleBlockType, isChanged: boolean, isConflict: boolean): string {
  if (isConflict) return 'border-status-warning bg-status-warning/20 text-status-warning'
  if (isChanged) return 'border-primary bg-primary/20 text-primary ring-1 ring-primary/50'
  switch (type) {
    case 'SLEEP':
      return 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
    case 'SHELTER':
      return 'border-status-critical/70 bg-status-critical/20 text-status-critical'
    case 'HYDRATION':
      return 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
    case 'EXERCISE_AERO':
    case 'EXERCISE_RESISTIVE':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
    case 'EVA':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-200'
    default:
      return 'border-border/70 bg-secondary/60 text-foreground'
  }
}

function MiniSparkline({ crewId, metric }: { crewId: string; metric: MetricId }) {
  const seriesState = useTelemetryStore()
  const points = selectSeries(seriesState, crewId, metric, 24 * MS_PER_HOUR)
  if (points.length < 2) {
    return (
      <div className="rounded border border-border/60 bg-background/60 p-2 font-mono text-[11px] text-muted-foreground">
        {metric}: —
      </div>
    )
  }

  const minVal = Math.min(...points.map((p) => p.value))
  const maxVal = Math.max(...points.map((p) => p.value))
  const span = Math.max(0.01, maxVal - minVal)
  const w = 260
  const h = 44
  const coords = points
    .map((p, idx) => {
      const x = (idx / Math.max(1, points.length - 1)) * w
      const y = h - ((p.value - minVal) / span) * (h - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{metric}</span>
        <span>
          {minVal.toFixed(1)} – {maxVal.toFixed(1)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" aria-hidden="true">
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    </div>
  )
}

export function AlertsPage() {
  const { t, formatMissionClock, formatNumber } = useT()
  const navigate = useNavigate()

  const simT = useSessionStore((s) => s.simT)
  const day = useSessionStore((s) => s.day)
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)
  const alerts = useAlertStore((s) => s.alerts)
  const cards = useDecisionStore((s) => s.cards)
  const schedulesByCrew = useDecisionStore((s) => s.schedulesByCrew)
  const byCrewStates = useStateStore((s) => s.byCrew)
  const telemetry = useTelemetryStore()
  const earthLink = useEarthLinkStore()

  const [scope, setScope] = useState<'all' | 'crew'>('all')
  const [whyAlertId, setWhyAlertId] = useState<string | null>(null)
  const [scheduleTab, setScheduleTab] = useState<'suggested' | 'accepted'>('suggested')
  const scheduleSectionRef = useRef<HTMLDivElement | null>(null)

  const sortedAlerts = useMemo(
    () => selectAlertsSorted({ alerts }, simT, scope === 'crew' ? selectedCrewId : undefined),
    [alerts, simT, scope, selectedCrewId],
  )

  const whyAlert: Alert | null = useMemo(
    () => alerts.find((a) => a.id === whyAlertId) ?? null,
    [alerts, whyAlertId],
  )

  const visibleCards = useMemo(
    () =>
      cards
        .filter((c) => c.state !== 'DISMISSED' && (scope === 'all' || c.crewId === selectedCrewId))
        .sort((a, b) => a.priority - b.priority),
    [cards, scope, selectedCrewId],
  )

  const scheduleViews = useMemo(() => {
    const fromEngine = schedulesByCrew?.[selectedCrewId]
    if (fromEngine) {
      const base = fromEngine.baseSchedule ?? fromEngine.schedule
      return {
        base,
        suggested: fromEngine.schedule,
        accepted: fromEngine.acceptedSchedule ?? fromEngine.schedule,
        diffs:
          scheduleTab === 'accepted' &&
          fromEngine.acceptedDiff &&
          fromEngine.acceptedDiff.length > 0
            ? fromEngine.acceptedDiff
            : fromEngine.diff,
      }
    }
    return buildCrewScheduleViews(selectedCrewId, day, cards, alerts)
  }, [schedulesByCrew, selectedCrewId, day, cards, alerts, scheduleTab])

  const activeSchedule =
    scheduleTab === 'suggested' ? scheduleViews.suggested : scheduleViews.accepted
  const changedBlockIds = new Set(scheduleViews.diffs.map((d) => d.blockId))
  const conflictBlockIds = new Set(
    scheduleViews.diffs.filter((d) => d.change === 'CONFLICT').map((d) => d.blockId),
  )

  const handleAcceptCard = (cardId: string) => {
    actions.acceptAction(cardId)
    setScheduleTab('accepted')
    scheduleSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
  }

  const whyAlertCrewStates = whyAlert ? selectCrewStates({ byCrew: byCrewStates }, whyAlert.crewId) : []
  const whyAlertStateEstimate = whyAlert?.state
    ? whyAlertCrewStates.find((s) => s.state === whyAlert.state)
    : undefined
  const whyAlertConfidence = whyAlert
    ? selectCrewConfidence(telemetry, whyAlert.crewId)
    : undefined
  const whySparklineMetric: MetricId =
    whyAlert?.metric ??
    (whyAlert?.state === 'radiation_event'
      ? 'rad.doseRateMsvDay'
      : whyAlert?.state === 'sleep_debt'
        ? 'sleep.durationH'
        : 'hr')

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="alerts-page">
      {/* Başlık + Kapsam Filtresi */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {t('alerts.pageTitle')}
          </h1>
          <p className="text-xs text-muted-foreground">{t('alerts.pageSubtitle')}</p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card p-1">
          <Button
            type="button"
            size="xs"
            variant={scope === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setScope('all')}
            data-testid="alerts-scope-all"
          >
            {t('alerts.filterAll')}
          </Button>
          <Button
            type="button"
            size="xs"
            variant={scope === 'crew' ? 'secondary' : 'ghost'}
            onClick={() => setScope('crew')}
            data-testid="alerts-scope-crew"
          >
            {t('alerts.filterSelected')} ({selectedCrewId.toUpperCase()})
          </Button>
        </div>
      </div>

      {/* Üst Izgara: Uyarı Listesi + Eylem Kartları */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Sol: Uyarı Listesi */}
        <div className="lg:col-span-7">
          <SectionCard
            title={t('nav.alerts')}
            headerRight={
              <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] tabular-nums">
                {sortedAlerts.length}
              </span>
            }
          >
            {sortedAlerts.length === 0 ? (
              <EmptyState title={t('alerts.empty')} />
            ) : (
              <div className="space-y-2.5" data-testid="alerts-sorted-list">
                {sortedAlerts.map((al) => {
                  const crew = getCrewProfile(al.crewId)
                  const confPct = Math.round(al.confidence * 100)

                  return (
                    <article
                      key={al.id}
                      data-testid={`alerts-page-item-${al.id}`}
                      className={cn(
                        'space-y-2 rounded-xl border p-3 text-xs',
                        al.status === 'RESOLVED'
                          ? 'border-border/50 bg-background/40 opacity-75'
                          : al.severity === 'CRITICAL'
                            ? 'border-status-critical/70 bg-status-critical/10'
                            : al.severity === 'WARNING'
                              ? 'border-status-warning/60 bg-status-warning/10'
                              : 'border-border/70 bg-background/70',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <SeverityIcon severity={al.severity} />
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground">
                              {t(al.titleKey as Parameters<typeof t>[0])}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                              <span>
                                {crew.role} · {crew.displayName}
                              </span>
                              <span>·</span>
                              <span>
                                {al.state
                                  ? t(`state.${al.state}`)
                                  : al.metric
                                    ? t(`metric.${al.metric}`)
                                    : al.kind}
                              </span>
                              <span>·</span>
                              <span>{formatMissionClock(al.lastSeenT)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <EarthDelayBadge delayClass={al.earthDelayClass} />
                          <StatusBadge severity={al.severity} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {t('alerts.confidence', { pct: confPct })}
                          </span>
                          {al.evidenceIds.slice(0, 2).map((evId) => (
                            <ProvenanceTag key={evId} evidenceId={evId} />
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setWhyAlertId(al.id)}
                            data-testid={`why-btn-${al.id}`}
                          >
                            <HelpCircle aria-hidden="true" className="size-3" />
                            <span>{t('alerts.whyButton')}</span>
                          </Button>

                          {al.status === 'ACTIVE' ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              onClick={() => actions.ackAlert(al.id)}
                              data-testid={`ack-btn-${al.id}`}
                            >
                              <Check aria-hidden="true" className="size-3" />
                              <span>{t('alerts.ackButton')}</span>
                            </Button>
                          ) : (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {al.status === 'ACKED'
                                ? t('alerts.ackedLabel')
                                : t('alerts.resolvedLabel')}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sağ: Eylem Kartları */}
        <div className="lg:col-span-5">
          <SectionCard title={t('alerts.actionCardsTitle')}>
            {visibleCards.length === 0 ? (
              <EmptyState title={t('alerts.actionCardsEmpty')} />
            ) : (
              <div className="space-y-2.5" data-testid="alerts-action-cards">
                {visibleCards.map((card) => {
                  const crew = getCrewProfile(card.crewId)
                  const srcAlertId = card.sourceAlertIds[0]

                  return (
                    <article
                      key={card.id}
                      data-testid={`alerts-card-${card.id}`}
                      className={cn(
                        'space-y-2 rounded-xl border p-3 text-xs',
                        card.state === 'ACCEPTED'
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/70 bg-background/70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                          <span>{t(card.titleKey as Parameters<typeof t>[0])}</span>
                        </div>
                        <EarthDelayBadge delayClass={card.earthDelayClass} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{crew.role}</span>
                        <span>·</span>
                        <span>{card.state}</span>
                        {srcAlertId && (
                          <button
                            type="button"
                            onClick={() => setWhyAlertId(srcAlertId)}
                            className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                          >
                            <span>{t('alerts.sourceAlertLink')}</span>
                            <ArrowRight aria-hidden="true" className="size-2.5" />
                          </button>
                        )}
                      </div>

                      <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                        {card.stepKeys.map((sk) => (
                          <li key={sk}>{t(sk as Parameters<typeof t>[0])}</li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-1">
                          {card.evidenceIds.slice(0, 2).map((evId) => (
                            <ProvenanceTag key={evId} evidenceId={evId} />
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          {card.state === 'SUGGESTED' && (
                            <>
                              <Button
                                type="button"
                                size="xs"
                                onClick={() => handleAcceptCard(card.id)}
                                data-testid={`alerts-accept-${card.id}`}
                              >
                                <Check aria-hidden="true" className="size-3" />
                                <span>{t('cockpit.acceptAction')}</span>
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={() => actions.dismissAction(card.id)}
                                data-testid={`alerts-dismiss-${card.id}`}
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
                              data-testid={`alerts-done-${card.id}`}
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
        </div>
      </div>

      {/* Alt: 24 Saatlik Görev Takvimi ve Plan Farkı */}
      <div ref={scheduleSectionRef}>
        <SectionCard
          title={`${t('alerts.scheduleTitle')} — ${selectedCrewId.toUpperCase()}`}
          headerRight={
            <Tabs
              value={scheduleTab}
              onValueChange={(v) => setScheduleTab(v as 'suggested' | 'accepted')}
            >
              <TabsList>
                <TabsTrigger value="suggested" data-testid="schedule-tab-suggested">
                  {t('alerts.scheduleTabSuggested')}
                </TabsTrigger>
                <TabsTrigger value="accepted" data-testid="schedule-tab-accepted">
                  {t('alerts.scheduleTabAccepted')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="suggested" className="hidden" />
              <TabsContent value="accepted" className="hidden" />
            </Tabs>
          }
        >
          <div className="space-y-3">
            {/* 24 Saatlik Yatay Zaman Çizelgesi */}
            <div
              data-testid="mission-schedule-timeline"
              className="relative flex h-16 w-full overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-1"
            >
              {activeSchedule.blocks.map((block) => {
                const Icon = blockIcon(block.type)
                const isChanged = changedBlockIds.has(block.id)
                const isConflict = conflictBlockIds.has(block.id)
                const widthPct = Math.max(2.5, (block.durationMin / 1440) * 100)

                return (
                  <div
                    key={block.id}
                    data-testid={`schedule-block-${block.id}`}
                    data-changed={isChanged ? 'true' : 'false'}
                    data-conflict={isConflict ? 'true' : 'false'}
                    style={{ width: `${widthPct}%` }}
                    title={`${t(`schedule.block.${block.type}`)} (${block.durationMin}m)`}
                    className={cn(
                      'mx-0.5 flex h-full shrink-0 flex-col justify-between overflow-hidden rounded border px-1.5 py-1 text-[10px]',
                      blockColorClass(block.type, isChanged, isConflict),
                    )}
                  >
                    <div className="flex items-center gap-1 truncate font-semibold">
                      <Icon aria-hidden="true" className="size-3 shrink-0" />
                      <span className="truncate">{t(`schedule.block.${block.type}`)}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[9px] opacity-80">
                      <span>{String(Math.floor(block.startMin / 60)).padStart(2, '0')}:00</span>
                      {isConflict && <AlertTriangle aria-hidden="true" className="size-2.5" />}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Neden Değişti? (ScheduleDiffItem listesi) */}
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 text-xs">
              <div className="mb-1.5 font-semibold text-foreground">
                {t('alerts.scheduleWhyChanged')}
              </div>
              {scheduleViews.diffs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{t('alerts.scheduleNoDiff')}</p>
              ) : (
                <ul className="space-y-1.5" data-testid="schedule-diff-list">
                  {scheduleViews.diffs.map((diff, idx) => (
                    <li
                      key={`${diff.blockId}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold',
                            diff.change === 'CONFLICT'
                              ? 'bg-status-warning/20 text-status-warning'
                              : 'bg-primary/20 text-primary',
                          )}
                        >
                          {diff.change}
                        </span>
                        <span>{t(diff.reasonKey as Parameters<typeof t>[0])}</span>
                      </div>
                      {diff.byAlertId && (
                        <button
                          type="button"
                          onClick={() => setWhyAlertId(diff.byAlertId ?? null)}
                          className="font-mono text-[10px] text-primary underline underline-offset-2"
                        >
                          {t('alerts.sourceAlertLink')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* "Why?" Açıklanabilirlik Çekmecesi (Sheet) */}
      <Sheet open={whyAlert !== null} onOpenChange={(open) => !open && setWhyAlertId(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-lg"
          data-testid="why-drawer"
        >
          {whyAlert && (
            <div className="space-y-4 p-1">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SeverityIcon severity={whyAlert.severity} />
                  <StatusBadge severity={whyAlert.severity} />
                  <EarthDelayBadge delayClass={whyAlert.earthDelayClass} />
                </div>
                <SheetTitle>{t('alerts.whyDrawerTitle')}</SheetTitle>
                <SheetDescription>
                  {t(whyAlert.titleKey as Parameters<typeof t>[0])} ·{' '}
                  {getCrewProfile(whyAlert.crewId).displayName} ({formatMissionClock(whyAlert.lastSeenT)})
                </SheetDescription>
              </SheetHeader>

              {/* Why Keys Madde Madde */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-foreground">{t('alerts.whyDrivers')}</h3>
                <ul
                  data-testid="why-drivers-list"
                  className="list-disc space-y-1 pl-4 text-xs text-muted-foreground"
                >
                  {whyAlert.whyKeys.map((wk, idx) => (
                    <li key={`${wk.key}-${idx}`}>
                      {t(wk.key as Parameters<typeof t>[0], wk.params)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* L4 Katkı Çubukları */}
              {whyAlertStateEstimate && whyAlertStateEstimate.contributors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-foreground">
                    {t('alerts.whyContributors')}
                  </h3>
                  <div className="space-y-1.5" data-testid="why-contributors-list">
                    {whyAlertStateEstimate.contributors.map((contrib) => {
                      const barPct = Math.min(100, Math.max(6, Math.round(contrib.weight * 100)))
                      return (
                        <div key={contrib.metric} className="space-y-0.5 text-[11px]">
                          <div className="flex justify-between font-mono">
                            <span>{t(`metric.${contrib.metric}`)}</span>
                            <span>
                              z={contrib.z.toFixed(1)} · {Math.round(contrib.weight * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Baseline Güveni & Öğrenme Günü */}
              {whyAlertConfidence && (
                <div className="rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs">
                  <div className="font-semibold text-foreground">{t('alerts.whyBaseline')}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {t('alerts.whyBaselineValue', {
                      pct: Math.round(whyAlertConfidence.confidence * 100),
                      day: whyAlertConfidence.learningDay,
                      target: whyAlertConfidence.targetDays,
                    })}
                  </div>
                </div>
              )}

              {/* Mini Grafik */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-foreground">
                  {t('alerts.whySparkline')}
                </h3>
                <MiniSparkline crewId={whyAlert.crewId} metric={whySparklineMetric} />
              </div>

              {/* Kanıt Etiketleri (tıkla -> /evidence) */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-foreground">{t('alerts.whyEvidence')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {whyAlert.evidenceIds.map((evId) => (
                    <button
                      key={evId}
                      type="button"
                      onClick={() => {
                        setWhyAlertId(null)
                        navigate(`/evidence?id=${encodeURIComponent(evId)}`)
                      }}
                      className="rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <ProvenanceTag evidenceId={evId} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Earth Delay Sınıf Gerekçesi */}
              <div
                data-testid="why-earth-rationale"
                className="rounded-lg border border-border/70 bg-background/60 p-3 text-xs"
              >
                <div className="font-semibold text-foreground">{t('alerts.whyEarthClass')}</div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {earthLink.config.blackout
                    ? t('alerts.whyEarthBlackout')
                    : t('alerts.whyEarthClassDetail', {
                        rt: formatNumber(earthLink.roundTripMin, 1),
                        harm: formatNumber(
                          whyAlert.timeToHarmMin ?? getNumber('earth.timeToHarmMin.fatigue'),
                          0,
                        ),
                      })}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
