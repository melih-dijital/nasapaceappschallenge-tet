// FAZ 12 §3.2 — Presenter Mode denetleyicisi: klavye kısayolları, `?` yardım penceresi, ekran okuyucu duyuruları.
// `D` her zaman sunum modunu açar/kapatır; diğer kısayollar yalnızca sunum modunda. Yazı alanında kısayol yok;
// odak bir düğmedeyken `Space` o düğmenin işidir (klavye kullanıcısı engellenmez).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useT } from '@/ui/i18n'
import {
  DEMO_MAIN_BOOKMARKS,
  earthDelayCycleSec,
  presenterActions,
  resolvePresenterKey,
  setPresenterHelpOpen,
  usePresenterUiStore,
  type PresenterCommand,
} from '@/ui/store'

const INTERACTIVE_SELECTOR =
  'button, a[href], summary, [role="button"], [role="slider"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], [role="combobox"]'

function describeTarget(target: EventTarget | null): {
  inEditable: boolean
  onInteractive: boolean
} {
  if (!(target instanceof HTMLElement)) return { inEditable: false, onInteractive: false }
  const tag = target.tagName
  const inEditable =
    target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  return { inEditable, onInteractive: target.closest(INTERACTIVE_SELECTOR) !== null }
}

function useFormatDelay() {
  const { t, formatNumber } = useT()
  return useCallback(
    (sec: number): string =>
      sec < 60
        ? t('presenter.delay.seconds', { value: formatNumber(sec, 1) })
        : t('presenter.delay.minutes', { value: formatNumber(sec / 60, 0) }),
    [t, formatNumber],
  )
}

export function PresenterController({ presenterOn }: { presenterOn: boolean }) {
  const { t } = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const formatDelay = useFormatDelay()
  const helpOpen = usePresenterUiStore((s) => s.helpOpen)
  const [announcement, setAnnouncement] = useState('')

  // Sunum modunda kök font büyür (tokens.css: html.presenter).
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('presenter', presenterOn)
    return () => root.classList.remove('presenter')
  }, [presenterOn])

  useEffect(() => {
    if (!announcement) return
    const id = window.setTimeout(() => setAnnouncement(''), 2500)
    return () => window.clearTimeout(id)
  }, [announcement])

  useEffect(() => {
    const run = (cmd: PresenterCommand): void => {
      switch (cmd.type) {
        case 'TOGGLE': {
          const next = !presenterOn
          presenterActions.setEnabled(next)
          if (!next) {
            setPresenterHelpOpen(false)
            const params = new URLSearchParams(location.search)
            if (params.has('demo')) {
              params.delete('demo')
              const search = params.toString()
              navigate(
                { pathname: location.pathname, search: search ? `?${search}` : '' },
                { replace: true },
              )
            }
          }
          setAnnouncement(t(next ? 'presenter.announce.on' : 'presenter.announce.off'))
          return
        }
        case 'HELP':
          setPresenterHelpOpen(!usePresenterUiStore.getState().helpOpen)
          return
        case 'PLAY_PAUSE':
          presenterActions.togglePlay()
          return
        case 'RESET':
          presenterActions.reset()
          setAnnouncement(t('presenter.announce.reset'))
          return
        case 'EARTH_DELAY': {
          const sec = presenterActions.cycleEarthDelay()
          setAnnouncement(t('presenter.announce.earthDelay', { value: formatDelay(sec) }))
          return
        }
        case 'BOOKMARK': {
          presenterActions.seekBookmark(cmd.index)
          const bm = DEMO_MAIN_BOOKMARKS[cmd.index]
          if (bm) setAnnouncement(t(bm.labelKey))
          return
        }
      }
    }

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.defaultPrevented) return
      const cmd = resolvePresenterKey(
        {
          key: ev.key,
          ctrlKey: ev.ctrlKey,
          metaKey: ev.metaKey,
          altKey: ev.altKey,
          repeat: ev.repeat,
          ...describeTarget(ev.target),
        },
        presenterOn,
      )
      if (!cmd) return
      ev.preventDefault()
      run(cmd)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [presenterOn, location.pathname, location.search, navigate, t, formatDelay])

  return (
    <>
      {/* Ekran okuyucu + izleyici için kısa duyuru (Earth gecikmesi, bookmark, sıfırlama) */}
      <div aria-live="polite" role="status" className="sr-only" data-testid="presenter-announcer">
        {announcement}
      </div>
      {presenterOn && announcement && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/50 bg-card px-4 py-1.5 font-mono text-sm font-semibold text-primary shadow-lg"
        >
          {announcement}
        </div>
      )}
      <PresenterHelpDialog open={presenterOn && helpOpen} onOpenChange={setPresenterHelpOpen} />
    </>
  )
}

export function PresenterHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  const formatDelay = useFormatDelay()
  const cycle = useMemo(() => earthDelayCycleSec(), [])

  const rows: { keys: string; label: string }[] = [
    { keys: 'D', label: t('presenter.key.toggle') },
    ...DEMO_MAIN_BOOKMARKS.map((bm) => ({ keys: String(bm.index + 1), label: t(bm.labelKey) })),
    { keys: 'Space', label: t('presenter.key.playPause') },
    { keys: 'R', label: t('presenter.key.reset') },
    {
      keys: 'E',
      label: t('presenter.key.earthDelay', { values: cycle.map(formatDelay).join(' → ') }),
    },
    { keys: '?', label: t('presenter.key.help') },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="presenter-help" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('presenter.help.title')}</DialogTitle>
          <DialogDescription>{t('presenter.help.desc')}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <caption className="sr-only">{t('presenter.help.title')}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('presenter.help.colKey')}</th>
              <th scope="col">{t('presenter.help.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.keys} className="border-b border-border/50 last:border-0">
                <td className="py-1.5 pr-3 align-top">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {r.keys}
                  </kbd>
                </td>
                <td className="py-1.5 text-foreground">{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
