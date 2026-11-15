// Uygulama kabuğu (uzay aracı sağlık konsolu): üst çubuk yalnızca ürün adı, görev saati, görev/ortam etiketi,
// Earth link durumu, ağ durumu, sesli uyarı ve dil. Simülasyon kontrolleri yalnızca "Presenter controls" çekmecesinde
// (Shift+P veya ?demo=1). Altında mürettebat şeridi; altta tek ince sabit uyarı satırı (app.disclaimer).
import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  Bell,
  Brain,
  FileCheck2,
  Gauge as GaugeIcon,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  WifiOff,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Alert, Severity } from '@/core/types'
import { cn } from '@/lib/utils'
import { getScenario } from '@/sim/scenarios'
import { useT } from '@/ui/i18n'
import { AlertsPage } from '@/ui/pages/AlertsPage'
import { BehavioralPage } from '@/ui/pages/BehavioralPage'
import {
  actions,
  CREW_PROFILES,
  isDemoModeQuery,
  selectActiveAlerts,
  selectCriticalActNowAlerts,
  setPresenterDrawerOpen,
  useAlertStore,
  useEarthLinkStore,
  useSessionStore,
} from '@/ui/store'
import '@/ui/theme/tokens.css'
import { AlertAudioToggle } from './AlertAudioMonitor'
import { DisclaimerBar } from './DisclaimerBar'
import { useDelayFormatter } from './EarthLinkSummary'
import { ErrorBoundary } from './ErrorBoundary'
import { PresenterControls } from './PresenterControls'
import { PresenterController } from './PresenterMode'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'

const MAIN_NAV_ITEMS = [
  { to: '/', labelKey: 'nav.cockpit' as const, icon: GaugeIcon },
  { to: '/evidence', labelKey: 'nav.evidence' as const, icon: FileCheck2 },
  { to: '/validation', labelKey: 'nav.validation' as const, icon: ShieldCheck },
  { to: '/ground', labelKey: 'nav.ground' as const, icon: Radio },
] as const

const MODULE_NAV_ITEMS = [
  { to: '/alerts', labelKey: 'nav.alerts' as const, icon: Bell },
  { to: '/behavioral', labelKey: 'nav.behavioral' as const, icon: Brain },
] as const

const SEVERITY_ORDER: readonly Severity[] = ['CRITICAL', 'WARNING', 'ADVISORY', 'INFO']
const DOT_COLOR: Record<DisplaySeverity, string> = {
  NOMINAL: 'bg-status-nominal',
  INFO: 'bg-status-info',
  ADVISORY: 'bg-status-advisory',
  WARNING: 'bg-status-warning',
  CRITICAL: 'bg-status-critical',
}

function topAlert(alerts: readonly Alert[]): Alert | undefined {
  return [...alerts].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )[0]
}

// İlk yüklemede telemetri akışı kendiliğinden başlar (worker'da autoStart yok → START gönderilir).
// Testlerde (vitest) devre dışı: testler akışı kendileri yönetir.
let autoStartDone = false

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, formatMissionClock } = useT()
  const location = useLocation()
  const formatDelay = useDelayFormatter()

  const scenarioId = useSessionStore((s) => s.scenarioId)
  const running = useSessionStore((s) => s.running)
  const simT = useSessionStore((s) => s.simT)
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)
  const storeDemoMode = useSessionStore((s) => s.demoMode)
  const demoMode = storeDemoMode || isDemoModeQuery(location.search)

  const alerts = useAlertStore((s) => s.alerts)
  const earthConfig = useEarthLinkStore((s) => s.config)
  const pendingReplyCount = useEarthLinkStore((s) => s.pendingReplyCount)

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (autoStartDone || import.meta.env.MODE === 'test') return
    autoStartDone = true
    if (!useSessionStore.getState().running) actions.start()
  }, [])

  const totalActiveAlerts = selectActiveAlerts({ alerts }).length
  const criticalActNowAlerts = selectCriticalActNowAlerts({ alerts })
  const environment = getScenario(scenarioId).environment

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

  return (
    <div
      className="flex min-h-screen flex-col bg-background pb-8 text-foreground"
      data-presenter={demoMode ? 'true' : 'false'}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {t('a11y.skipToContent')}
      </a>
      <PresenterController presenterOn={demoMode} />
      <PresenterControls presenterOn={demoMode} />

      {/* Kalıcı CRITICAL + ACT_NOW şeridi (ACK ile iner) */}
      {criticalActNowAlerts.length > 0 && (
        <div
          role="alert"
          data-testid="critical-act-now-banner"
          className="flex flex-wrap items-center justify-between gap-2 bg-status-critical-strong px-4 py-1.5 text-[13px] font-medium text-white"
        >
          <div className="flex items-center gap-2">
            <SeverityIcon severity="CRITICAL" className="text-white" />
            <span>{t('alerts.criticalBanner')}</span>
          </div>
          <div className="flex items-center gap-1.5">
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

      {/* Üst çubuk */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t('app.title')}</span>
          </div>

          <div
            data-testid="mission-clock"
            aria-label={t('controls.missionClock')}
            className="font-mono text-sm text-foreground tabular-nums"
          >
            {formatMissionClock(simT)}
            {demoMode && !running && (
              <span className="ml-2 font-sans text-xs text-muted-foreground">
                {t('controls.paused')}
              </span>
            )}
          </div>

          <span data-testid="mission-environment" className="text-[13px] text-muted-foreground">
            {t(`environment.${environment}`)}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div
              data-testid="earth-link-badge"
              className="inline-flex items-center gap-1.5 text-[13px] text-foreground"
              title={t('earthSummary.tooltip')}
            >
              <SeverityIcon
                severity={earthConfig.blackout ? 'CRITICAL' : 'NOMINAL'}
                className="size-3.5"
              />
              <span>
                {earthConfig.blackout
                  ? t('topbar.earthLinkBlackout')
                  : t('topbar.earthLink', { delay: formatDelay(earthConfig.oneWayDelaySec) })}
              </span>
              {pendingReplyCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  · {t('earth.pendingReplies', { count: pendingReplyCount })}
                </span>
              )}
            </div>

            <div
              role="status"
              data-testid="network-connection-badge"
              data-online={String(isOnline)}
              title={t('network.badge.title')}
              className={cn(
                'inline-flex items-center gap-1 text-xs',
                isOnline ? 'text-muted-foreground' : 'text-status-advisory',
              )}
            >
              {!isOnline && <WifiOff aria-hidden="true" className="size-3.5" />}
              <span>{isOnline ? t('network.badge.online') : t('network.badge.offline')}</span>
            </div>

            <AlertAudioToggle />

            {demoMode && (
              <div className="flex items-center gap-1">
                <span data-testid="demo-mode-badge" className="text-xs text-muted-foreground">
                  {t('demo.modeBadge')}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setPresenterDrawerOpen(true)}
                  data-testid="presenter-controls-btn"
                >
                  <SlidersHorizontal aria-hidden="true" className="size-3" />
                  <span>{t('presenterControls.title')}</span>
                </Button>
              </div>
            )}

            <div
              role="group"
              aria-label={t('controls.language')}
              className="flex items-center rounded-md border border-border p-0.5"
            >
              {(['en', 'tr'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => actions.setLanguage(code)}
                  aria-label={`${t('controls.language')} ${code.toUpperCase()}`}
                  aria-pressed={lang === code}
                  data-testid={`lang-btn-${code}`}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs',
                    lang === code
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mürettebat şeridi */}
        <div
          role="region"
          aria-label={t('crew.selectorLabel')}
          className="mx-auto grid max-w-[1920px] grid-cols-2 gap-2 px-4 pb-2 lg:grid-cols-4"
        >
          {CREW_PROFILES.map((crew) => {
            const crewAlerts = selectActiveAlerts({ alerts }, crew.id)
            const worst = topAlert(crewAlerts)
            const sev: DisplaySeverity = worst?.severity ?? 'NOMINAL'
            const isSelected = selectedCrewId === crew.id
            return (
              <button
                key={crew.id}
                type="button"
                onClick={() => actions.selectCrew(crew.id)}
                aria-pressed={isSelected}
                data-testid={`crew-selector-${crew.id}`}
                className={cn(
                  'flex min-w-0 items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors',
                  isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/60',
                )}
              >
                <span className="font-mono text-xs text-muted-foreground">{crew.role}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-foreground">
                    {crew.displayName}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <span
                      data-testid={`crew-ring-${crew.id}`}
                      data-severity={sev}
                      aria-hidden="true"
                      className={cn('inline-block size-2 shrink-0 rounded-full', DOT_COLOR[sev])}
                    />
                    <span className="truncate">
                      {worst
                        ? `${t(`severity.${sev}`)} · ${t(worst.titleKey)}`
                        : t('severity.NOMINAL')}
                    </span>
                    {crewAlerts.length > 1 && (
                      <span className="shrink-0">+{crewAlerts.length - 1}</span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col md:flex-row">
        <aside
          className={cn(
            'shrink-0 border-b border-border bg-sidebar md:border-r md:border-b-0',
            demoMode ? 'md:w-14' : 'md:w-44',
          )}
        >
          <nav aria-label="Main" className="flex flex-row gap-0.5 overflow-x-auto p-2 md:flex-col">
            {MAIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={demoMode ? t(item.labelKey) : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                      isActive && 'bg-accent text-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className={demoMode ? 'md:sr-only' : undefined}>{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </nav>
          <div className="border-t border-border px-2 py-2">
            <div
              className={cn(
                'mb-1 hidden px-2.5 text-xs text-muted-foreground',
                !demoMode && 'md:block',
              )}
            >
              {t('nav.modulesLabel')}
            </div>
            <nav
              aria-label={t('nav.modulesLabel')}
              className="flex flex-row gap-0.5 overflow-x-auto md:flex-col"
            >
              {MODULE_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={demoMode ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                        isActive && 'bg-accent text-foreground',
                      )
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className={demoMode ? 'md:sr-only' : undefined}>
                        {t(item.labelKey)}
                      </span>
                    </span>
                    {item.to === '/alerts' && totalActiveAlerts > 0 && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {totalActiveAlerts}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none">
          {routedContent}
        </main>
      </div>

      <DisclaimerBar />
    </div>
  )
}
