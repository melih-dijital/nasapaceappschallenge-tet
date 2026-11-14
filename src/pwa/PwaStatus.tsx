// SW güncelleme istemi (FAZ_11 §3.1). Bağlantı rozeti FAZ 12'de tekilleştirildi: üst çubuktaki `AppShell`
// `network-connection-badge` ("Offline mode — fully operational"). Sunum modunda (`?demo=1` / `D`) istem hiç çıkmaz.
import { Button } from '@/components/ui/button'
import { useT } from '@/ui/i18n'
import { usePwaStore } from './pwaStore'

export function PwaStatus() {
  const { t } = useT()
  const demo = usePwaStore((s) => s.demo)
  const needRefresh = usePwaStore((s) => s.needRefresh)
  const applyUpdate = usePwaStore((s) => s.applyUpdate)
  const dismissUpdate = usePwaStore((s) => s.dismissUpdate)

  if (!needRefresh || demo) return null

  return (
    <div className="fixed right-3 bottom-3 z-50">
      <div
        role="alertdialog"
        aria-label={t('pwa.update.available')}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
      >
        <span>{t('pwa.update.available')}</span>
        <Button size="sm" onClick={applyUpdate}>
          {t('pwa.update.reload')}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismissUpdate}>
          {t('pwa.update.later')}
        </Button>
      </div>
    </div>
  )
}
