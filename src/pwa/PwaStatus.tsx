// Bağlantı rozeti + SW güncelleme istemi (FAZ_11 §3.1). Metinler şimdilik sabit İngilizce; Faz 9 i18n sözlüğüne
// `pwa.*` anahtarlarıyla taşınabilir (data-i18n-key). Rozet yalnızca bilgi verir: uygulama ağa bağımlı değildir.
import { Button } from '@/components/ui/button'
import { usePwaStore } from './pwaStore'

export function PwaStatus() {
  const online = usePwaStore((s) => s.online)
  const demo = usePwaStore((s) => s.demo)
  const needRefresh = usePwaStore((s) => s.needRefresh)
  const applyUpdate = usePwaStore((s) => s.applyUpdate)
  const dismissUpdate = usePwaStore((s) => s.dismissUpdate)

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2">
      {needRefresh && !demo && (
        <div
          role="alertdialog"
          aria-label="Update available"
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
        >
          <span data-i18n-key="pwa.update.available">A new version is available.</span>
          <Button size="sm" onClick={applyUpdate} data-i18n-key="pwa.update.reload">
            Reload
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissUpdate} data-i18n-key="pwa.update.later">
            Later
          </Button>
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        data-online={online}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground"
      >
        <span
          aria-hidden="true"
          className={online ? 'size-2 rounded-full bg-status-info' : 'size-2 rounded-full bg-status-advisory'}
        />
        {online ? (
          <span data-i18n-key="pwa.online">Online · no network dependency</span>
        ) : (
          <span data-i18n-key="pwa.offline" className="text-foreground">
            Offline mode — fully operational
          </span>
        )}
      </div>
    </div>
  )
}
