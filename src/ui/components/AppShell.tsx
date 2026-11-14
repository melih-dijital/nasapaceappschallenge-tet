// FAZ 9 §3.3 — AppShell: Üst çubuk (Mission Clock, Senaryo, Hız, Play/Pause/Reset, Bookmark, Dil, Earth Link),
// Kişi seçici (4 astronot + durum halkası + aktif uyarı sayısı) ve Sol ince navigasyon.
import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  Bookmark,
  Brain,
  FileCheck2,
  Gauge as GaugeIcon,
  Globe,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { Severity } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import { AlertsPage } from '@/ui/pages/AlertsPage'
import { BehavioralPage } from '@/ui/pages/BehavioralPage'
import {
  actions,
  CREW_PROFILES,
  DEMO_MAIN_BOOKMARKS,
  isDemoModeQuery,
  selectActiveAlerts,
  selectCriticalActNowAlerts,
  selectHighestSeverity,
  UI_SCENARIOS,
  useAlertStore,
  useEarthLinkStore,
  useSessionStore,
} from '@/ui/store'
import '@/ui/theme/tokens.css'
import { AlertAudioToggle } from './AlertAudioMonitor'
import { DisclaimerBar } from './DisclaimerBar'
import { ErrorBoundary } from './ErrorBoundary'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'

const SPEED_PRESETS = [0.5, 1, 5, 20, 50] as const

const MAIN_NAV_ITEMS = [
  { to: '/', labelKey: 'nav.cockpit' as const, icon: GaugeIcon },
  { to: '/evidence', labelKey: 'nav.evidence' as const, icon: FileCheck2 },
  { to: '/validation', labelKey: 'nav.validation' as const, icon: ShieldCheck },
  { to: '/ground', labelKey: 'nav.ground' as const, icon: Radio },
] as const

const PHASE10_NAV_ITEMS = [
  { to: '/alerts', labelKey: 'nav.alerts' as const, icon: Bell },
  { to: '/behavioral', labelKey: 'nav.behavioral' as const, icon: Brain },
] as const

const RING_COLOR_BY_SEVERITY: Record<DisplaySeverity, string> = {
  NOMINAL: 'ring-primary/60 border-primary/50',
  INFO: 'ring-status-info/70 border-status-info/60',
  ADVISORY: 'ring-status-advisory/80 border-status-advisory/70',
  WARNING: 'ring-status-warning/90 border-status-warning/80',
  CRITICAL: 'ring-status-critical border-status-critical status-critical-pulse',
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, formatMissionClock, formatNumber } = useT()
  const location = useLocation()

  const scenarioId = useSessionStore((s) => s.scenarioId)
  const speed = useSessionStore((s) => s.speed)
  const running = useSessionStore((s) => s.running)
  const simT = useSessionStore((s) => s.simT)
  const day = useSessionStore((s) => s.day)
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)

  const alerts = useAlertStore((s) => s.alerts)
  const earthConfig = useEarthLinkStore((s) => s.config)
  const roundTripMin = useEarthLinkStore((s) => s.roundTripMin)
  const pendingReplyCount = useEarthLinkStore((s) => s.pendingReplyCount)
  const storeDemoMode = useSessionStore((s) => s.demoMode)
  const demoMode = storeDemoMode || isDemoModeQuery(location.search)

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const totalActiveAlerts = selectActiveAlerts({ alerts }).length
  const criticalActNowAlerts = selectCriticalActNowAlerts({ alerts })

  const routedContent = (
    <ErrorBoundary resetKey={location.pathname}>
      {location.pathname === '/alerts' ? (
        <AlertsPage />
      ) : location.pathname === '/behavioral' ? (
        <BehavioralPage />
      ) : (
        children
      )}
    </ErrorBoundary>
  )

  const oneWayText =
    earthConfig.oneWayDelaySec < 60
      ? `${earthConfig.oneWayDelaySec}s`
      : `${formatNumber(earthConfig.oneWayDelaySec / 60, 1)}m`

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <DisclaimerBar />

      {/* Kalıcı CRITICAL + ACT_NOW Bandı (ACK ile iner, kapatılamaz) */}
      {criticalActNowAlerts.length > 0 && (
        <div
          role="alert"
          data-testid="critical-act-now-banner"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-status-critical bg-status-critical px-4 py-2 text-xs font-semibold text-white"
        >
          <div className="flex items-center gap-2">
            <SeverityIcon severity="CRITICAL" />
            <span>{t('alerts.criticalBanner')}</span>
          </div>
          <div className="flex items-center gap-2">
            {criticalActNowAlerts.slice(0, 2).map((al) => (
              <Button
                key={al.id}
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => actions.ackAlert(al.id)}
                data-testid={`banner-ack-${al.id}`}
              >
                {t('alerts.ackButton')} ({al.crewId.toUpperCase()})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Üst Görev Kontrol Çubuğu */}
      <header className="border-b border-border/80 bg-card/95 px-3 py-2 backdrop-blur-xs">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2.5">
          {/* Sol: Başlık + Mission Clock */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                <Activity aria-hidden="true" className="size-4" />
              </div>
              <div>
                <div className="font-mono text-xs font-bold tracking-wider text-primary">
                  {t('app.title')}
                </div>
                <div className="hidden text-[10px] text-muted-foreground sm:block">
                  {t('app.subtitle')}
                </div>
              </div>
            </div>

            {/* Mission Clock (MET D+012 14:32) */}
            <div
              data-testid="mission-clock"
              aria-label={t('controls.missionClock')}
              className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 font-mono text-xs tabular-nums"
            >
              <span
                className={cn(
                  'inline-block size-2 rounded-full',
                  running ? 'bg-emerald-400' : 'bg-muted-foreground',
                )}
              />
              <span className="font-semibold text-foreground">{formatMissionClock(simT)}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t('controls.day', { day })}
              </span>
              <span className="text-[10px] font-semibold text-primary">
                {running ? t('controls.running') : t('controls.paused')}
              </span>
            </div>
          </div>

          {/* Orta: Senaryo + Play/Pause/Reset + Hız + Bookmark */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Senaryo Seçici */}
            <div className="flex items-center gap-1.5">
              <Select
                value={scenarioId}
                onValueChange={(value) => actions.setScenario(value)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={t('controls.scenario')}
                  data-testid="scenario-select-trigger"
                  className="w-48 bg-background/70 font-mono text-xs"
                >
                  <SelectValue placeholder={t('controls.scenario')} />
                </SelectTrigger>
                <SelectContent>
                  {UI_SCENARIOS.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id} className="font-mono text-xs">
                      {t(sc.titleKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Play / Pause / Reset */}
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/60 p-0.5">
              {running ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => actions.pause()}
                  aria-label={t('controls.pause')}
                  data-testid="sim-pause-btn"
                >
                  <Pause aria-hidden="true" className="size-3" />
                  <span>{t('controls.pause')}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="default"
                  onClick={() => actions.start()}
                  aria-label={t('controls.play')}
                  data-testid="sim-play-btn"
                >
                  <Play aria-hidden="true" className="size-3" />
                  <span>{t('controls.play')}</span>
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => actions.reset()}
                aria-label={t('controls.reset')}
                data-testid="sim-reset-btn"
              >
                <RotateCcw aria-hidden="true" className="size-3" />
                <span className="sr-only sm:not-sr-only">{t('controls.reset')}</span>
              </Button>
            </div>

            {/* Hız Kontrolleri (0.5×, 1×, 5×, 20×, 50× + Slider) */}
            <div
              aria-label={t('controls.speed')}
              className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-2 py-1"
            >
              <div className="flex items-center gap-0.5">
                {SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => actions.setSpeed(preset)}
                    aria-label={`${t('controls.speed')} ${preset}x`}
                    aria-pressed={speed === preset}
                    data-testid={`speed-preset-${preset}`}
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors',
                      speed === preset
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {preset}×
                  </button>
                ))}
              </div>
              <div className="hidden w-20 items-center lg:flex">
                <Slider
                  aria-label={t('controls.speed')}
                  min={0.25}
                  max={50}
                  step={0.25}
                  value={[speed]}
                  onValueChange={(vals) => {
                    const next = vals[0]
                    if (next !== undefined) actions.setSpeed(next)
                  }}
                />
              </div>
              <span
                className="hidden font-mono text-[10px] text-muted-foreground xl:inline"
                title={t('controls.speedScale')}
              >
                ({t('controls.speedScale')})
              </span>
            </div>

            {/* Bookmark Atla Menüsü (demo_main için) */}
            {scenarioId === 'demo_main' && (
              <div
                aria-label={t('controls.bookmarks')}
                className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/60 px-2 py-1"
              >
                <Bookmark aria-hidden="true" className="size-3 text-primary" />
                {DEMO_MAIN_BOOKMARKS.map((bm) => (
                  <button
                    key={bm.index}
                    type="button"
                    onClick={() => actions.seekBookmark(bm.index)}
                    aria-label={t(bm.labelKey)}
                    title={t(bm.labelKey)}
                    data-testid={`bookmark-btn-${bm.index}`}
                    className="rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    B{bm.index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sağ: Bağlantı Rozeti + Demo Rozeti + Earth Link Rozeti + Dil Değiştirici */}
          <div className="flex items-center gap-2">
            {/* Tarayıcı Ağ Bağlantısı Rozeti (navigator.onLine, bilgi amaçlı) */}
            <div
              role="status"
              data-testid="network-connection-badge"
              data-online={String(isOnline)}
              title={t('network.badge.title')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] font-semibold',
                isOnline
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-status-warning/60 bg-status-warning/15 text-status-warning',
              )}
            >
              {isOnline ? (
                <Wifi aria-hidden="true" className="size-3.5 shrink-0" />
              ) : (
                <WifiOff aria-hidden="true" className="size-3.5 shrink-0" />
              )}
              <span>
                {isOnline ? t('network.badge.online') : t('network.badge.offline')}
              </span>
            </div>

            {demoMode && (
              <span
                data-testid="demo-mode-badge"
                className="rounded-lg border border-status-info/50 bg-status-info/15 px-2 py-1 font-mono text-[11px] font-semibold text-status-info"
              >
                {t('demo.modeBadge')}
              </span>
            )}

            {/* Earth Link Rozeti */}
            <div
              data-testid="earth-link-badge"
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1 font-mono text-xs tabular-nums',
                earthConfig.blackout
                  ? 'border-status-critical/60 bg-status-critical/15 text-status-critical'
                  : 'border-border/80 bg-background/70 text-foreground',
              )}
            >
              <Radio
                aria-hidden="true"
                className={cn(
                  'size-3.5 shrink-0',
                  earthConfig.blackout ? 'text-status-critical' : 'text-primary',
                )}
              />
              <span className="text-[11px] font-semibold">
                {earthConfig.blackout
                  ? t('earth.status.blackout')
                  : t('earth.status.connected')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                1W {oneWayText} · RT{' '}
                {Number.isFinite(roundTripMin) ? `${formatNumber(roundTripMin, 0)}m` : '∞'}
              </span>
              {pendingReplyCount > 0 && (
                <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-status-warning">
                  {t('earth.pendingReplies', { count: pendingReplyCount })}
                </span>
              )}
            </div>

            {/* Sesli Uyarı Anahtarı (Web Audio Sentez) */}
            <AlertAudioToggle />

            {/* Dil Değiştirici (EN / TR) */}
            <div
              role="group"
              aria-label={t('controls.language')}
              className="flex items-center rounded-lg border border-border/70 bg-background/70 p-0.5"
            >
              <Globe aria-hidden="true" className="mx-1 size-3.5 text-muted-foreground" />
              {(['en', 'tr'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => actions.setLanguage(code)}
                  aria-label={`${t('controls.language')} ${code.toUpperCase()}`}
                  aria-pressed={lang === code}
                  data-testid={`lang-btn-${code}`}
                  className={cn(
                    'rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase transition-colors',
                    lang === code
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kişi Seçici Barı (4 Astronot: CDR, MD, ENG, SCI) */}
        <div
          role="region"
          aria-label={t('crew.selectorLabel')}
          className="mx-auto mt-2 grid max-w-[1600px] grid-cols-2 gap-2 border-t border-border/50 pt-2 sm:grid-cols-4"
        >
          {CREW_PROFILES.map((crew) => {
            const isSelected = selectedCrewId === crew.id
            const highestSev: Severity | null = selectHighestSeverity({ alerts }, crew.id)
            const displaySev: DisplaySeverity = highestSev ?? 'NOMINAL'
            const crewActiveCount = selectActiveAlerts({ alerts }, crew.id).length

            return (
              <button
                key={crew.id}
                type="button"
                onClick={() => actions.selectCrew(crew.id)}
                aria-pressed={isSelected}
                data-testid={`crew-selector-${crew.id}`}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-border/60 bg-background/50 hover:bg-muted/50',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* Genel Durum Halkası */}
                  <div
                    data-testid={`crew-ring-${crew.id}`}
                    data-severity={displaySev}
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-card font-mono text-xs font-bold ring-2',
                      RING_COLOR_BY_SEVERITY[displaySev],
                    )}
                  >
                    {crew.role}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-foreground">
                      {crew.displayName}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {t(`crew.role.${crew.role}`)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <SeverityIcon severity={displaySev} className="size-3.5" />
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                      crewActiveCount > 0
                        ? 'bg-status-warning/20 font-semibold text-status-warning'
                        : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {crewActiveCount > 0
                      ? t('crew.activeAlerts', { count: crewActiveCount })
                      : t('crew.noAlerts')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </header>

      {/* Gövde: Sol İnce Navigasyon + Sayfa İçeriği */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-border/70 bg-sidebar md:w-48 md:border-r md:border-b-0">
          {/* Ana 4 rota (tests/ui/app.test.tsx ile %100 uyumlu: aria-label="Main", 4 bağlantı) */}
          <nav
            aria-label="Main"
            className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col"
          >
            {MAIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                      isActive && 'bg-accent font-semibold text-accent-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Faz 10 Modül Rotaları (Alerts & Actions, Behavioral) */}
          <div className="border-t border-border/50 px-2 py-2">
            <div className="mb-1 hidden px-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase md:block">
              {t('nav.modulesLabel')}
            </div>
            <nav
              aria-label={t('nav.modulesLabel')}
              className="flex flex-row gap-1 overflow-x-auto md:flex-col"
            >
              {PHASE10_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        isActive && 'bg-accent font-semibold text-accent-foreground',
                      )
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </span>
                    {item.to === '/alerts' && totalActiveAlerts > 0 && (
                      <span className="rounded-full bg-status-critical/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-status-critical tabular-nums">
                        {totalActiveAlerts}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 lg:p-4">{routedContent}</main>
      </div>
    </div>
  )
}
