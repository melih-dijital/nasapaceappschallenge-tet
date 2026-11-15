// FAZ 11 §3.4 — İsteğe bağlı yerel WebSocket yer istasyonu ("Ground station (optional)").
// Varsayılan kapalıdır (açılır kapanır kutu); canlı/yayın ortamında sunucu yoktur.
import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, Plug, Server, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import { actions, useSessionStore } from '@/ui/store'

const WS_URL_PATTERN = /^wss?:\/\/\S+$/i

export function GroundStationPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useT()
  const telemetrySource = useSessionStore((s) => s.telemetrySource)
  const storedWsUrl = useSessionStore((s) => s.wsUrl)
  const wsConnected = useSessionStore((s) => s.wsConnected)

  // Varsayılan kapalı (FAZ_11 §3.4: "varsayılan kapalı")
  const [open, setOpen] = useState(false)
  const [urlInput, setUrlInput] = useState(storedWsUrl)
  const [urlError, setUrlError] = useState(false)

  const statusText =
    telemetrySource === 'local'
      ? t('groundStation.status.local')
      : wsConnected
        ? t('groundStation.status.connected')
        : t('groundStation.status.connecting')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = urlInput.trim()
    if (!WS_URL_PATTERN.test(trimmed)) {
      setUrlError(true)
      return
    }
    setUrlError(false)
    actions.connectGroundStation(trimmed)
  }

  return (
    <div
      data-testid="ground-station-panel"
      className={cn(
        'rounded-lg border border-border/80 bg-card/60 text-xs',
        compact ? 'p-2.5' : 'p-3',
      )}
    >
      <button
        type="button"
        data-testid="ground-station-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left font-medium text-foreground hover:text-primary"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {open ? (
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <Server aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t('groundStation.toggleTitle')}</span>
        </span>
        <span
          data-testid="ground-station-status"
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 tabular-nums text-[10px]',
            telemetrySource === 'ws' && wsConnected
              ? 'bg-status-info/20 text-status-info'
              : telemetrySource === 'ws'
                ? 'bg-status-advisory/20 text-status-advisory'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {statusText}
        </span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('groundStation.hint')}
          </p>

          <div className="space-y-1">
            <label
              htmlFor="ground-station-ws-input"
              className="block text-[11px] font-medium text-foreground"
            >
              {t('groundStation.urlLabel')}
            </label>
            <input
              id="ground-station-ws-input"
              data-testid="ground-station-ws-input"
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                if (urlError) setUrlError(false)
              }}
              placeholder={t('groundStation.urlPlaceholder')}
              aria-label={t('groundStation.urlLabel')}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 tabular-nums text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {urlError && (
              <p
                role="alert"
                data-testid="ground-station-error"
                className="text-[11px] text-status-critical"
              >
                {t('groundStation.invalidUrl')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              data-testid="ground-station-connect-btn"
              className="h-7 px-2.5 text-xs"
            >
              <Plug aria-hidden="true" className="mr-1 size-3" />
              {t('groundStation.connect')}
            </Button>
            {telemetrySource === 'ws' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="ground-station-disconnect-btn"
                onClick={() => actions.disconnectGroundStation()}
                className="h-7 px-2.5 text-xs"
              >
                <Unplug aria-hidden="true" className="mr-1 size-3" />
                {t('groundStation.disconnect')}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
