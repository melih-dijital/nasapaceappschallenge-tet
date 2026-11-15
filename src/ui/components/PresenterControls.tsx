// Sunum kontrolleri çekmecesi (sağdan): senaryo, oynat/duraklat/sıfırla, hız, yer imleri, Earth gecikmesi,
// veri boşluğu enjeksiyonu ve kısayol yardımı. Yalnızca Shift+P ile veya ?demo=1 iken üst çubuk düğmesiyle açılır;
// ana ekranda bu kontroller yoktur (sunum aracı, operatör konsolu değil).
import { Bookmark, Keyboard, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { METRIC_META, type MetricId } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import {
  actions,
  DEMO_MAIN_BOOKMARKS,
  earthDelayCycleSec,
  presenterActions,
  presetForDelay,
  setPresenterDrawerOpen,
  setPresenterHelpOpen,
  UI_SCENARIOS,
  useEarthLinkStore,
  usePresenterUiStore,
  useSessionStore,
  useTelemetryStore,
} from '@/ui/store'
import { latestKey } from '@/workers/protocol'
import { useDelayFormatter } from './EarthLinkSummary'

const SPEED_PRESETS = [0.5, 1, 5, 20, 50] as const
const DATA_GAP_METRICS: readonly MetricId[] = [
  'hr',
  'spo2',
  'hrv',
  'sleep.durationH',
  'hydrationL',
  'mood.mood',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

const chip = (active: boolean) =>
  cn(
    'rounded-md border px-2 py-1 font-mono text-xs tabular-nums transition-colors',
    active
      ? 'border-primary bg-accent text-foreground'
      : 'border-border text-muted-foreground hover:text-foreground',
  )

export function PresenterControls({ presenterOn }: { presenterOn: boolean }) {
  const { t } = useT()
  const formatDelay = useDelayFormatter()
  const open = usePresenterUiStore((s) => s.drawerOpen)
  const scenarioId = useSessionStore((s) => s.scenarioId)
  const running = useSessionStore((s) => s.running)
  const speed = useSessionStore((s) => s.speed)
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)
  const oneWay = useEarthLinkStore((s) => s.config.oneWayDelaySec)
  const blackout = useEarthLinkStore((s) => s.config.blackout)
  const dataQuality = useTelemetryStore((s) => s.dataQuality)

  return (
    <Sheet open={open} onOpenChange={setPresenterDrawerOpen}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-border bg-card sm:max-w-sm"
        data-testid="presenter-controls"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-sm font-medium">{t('presenterControls.title')}</SheetTitle>
          <SheetDescription className="text-xs">{t('presenterControls.desc')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto p-4 text-[13px]">
          <Section title={t('controls.scenario')}>
            <Select value={scenarioId} onValueChange={(v) => actions.setScenario(v)}>
              <SelectTrigger
                size="sm"
                aria-label={t('controls.scenario')}
                data-testid="scenario-select-trigger"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UI_SCENARIOS.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {t(sc.titleKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          <Section title={t('presenterControls.playback')}>
            <div className="flex flex-wrap gap-1.5">
              {running ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.pause()}
                  data-testid="sim-pause-btn"
                >
                  <Pause aria-hidden="true" className="size-3.5" />
                  <span>{t('controls.pause')}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => actions.start()}
                  data-testid="sim-play-btn"
                >
                  <Play aria-hidden="true" className="size-3.5" />
                  <span>{t('controls.play')}</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => actions.reset()}
                data-testid="sim-reset-btn"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                <span>{t('controls.reset')}</span>
              </Button>
            </div>
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label={t('controls.speed')}
            >
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => actions.setSpeed(p)}
                  aria-pressed={speed === p}
                  aria-label={`${t('controls.speed')} ${p}x`}
                  data-testid={`speed-preset-${p}`}
                  className={chip(speed === p)}
                >
                  {p}×
                </button>
              ))}
            </div>
            <Slider
              aria-label={t('controls.speed')}
              min={0.25}
              max={50}
              step={0.25}
              value={[speed]}
              onValueChange={(v) => {
                if (v[0] !== undefined) actions.setSpeed(v[0])
              }}
            />
            <p className="text-xs text-muted-foreground">{t('controls.speedScale')}</p>
          </Section>

          {scenarioId === 'demo_main' && (
            <Section title={t('controls.bookmarks')}>
              <div className="grid gap-1">
                {DEMO_MAIN_BOOKMARKS.map((bm) => (
                  <button
                    key={bm.index}
                    type="button"
                    onClick={() => actions.seekBookmark(bm.index)}
                    data-testid={`bookmark-btn-${bm.index}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                  >
                    <Bookmark aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    <span>{t(bm.labelKey)}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title={t('presenterControls.earthDelay')}>
            <div className="flex flex-wrap gap-1">
              {earthDelayCycleSec().map((sec) => (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={oneWay === sec}
                  onClick={() => {
                    const preset = presetForDelay(sec)
                    actions.setEarthLinkPreset(preset, preset === 'CUSTOM' ? sec : undefined)
                  }}
                  className={chip(oneWay === sec)}
                >
                  {formatDelay(sec)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={blackout}
                onChange={(e) => actions.setEarthLinkBlackout(e.target.checked)}
                className="size-3.5 accent-[var(--primary)]"
              />
              <span>{t('presenterControls.blackout')}</span>
            </label>
          </Section>

          <Section title={t('presenterControls.dataGap')}>
            <div className="flex flex-wrap gap-1">
              {DATA_GAP_METRICS.map((m) => {
                const on = Boolean(dataQuality[latestKey(selectedCrewId, m)]?.fault)
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => actions.toggleSensorFault(selectedCrewId, m)}
                    data-testid={`data-gap-toggle-${m}`}
                    className={chip(on)}
                  >
                    {t(METRIC_META[m].labelKey)}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t('presenterControls.presenterMode')}>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => presenterActions.setEnabled(!presenterOn)}
              >
                {presenterOn
                  ? t('presenterControls.presenterOff')
                  : t('presenterControls.presenterOn')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPresenterHelpOpen(true)}
                aria-label={t('presenter.help.open')}
                data-testid="presenter-help-btn"
              >
                <Keyboard aria-hidden="true" className="size-3.5" />
                <span>{t('presenter.help.title')}</span>
              </Button>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
