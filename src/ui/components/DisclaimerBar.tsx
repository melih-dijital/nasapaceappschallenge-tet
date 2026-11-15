// Sayfanın en altında tek ince sabit satır (app.disclaimer): veri kaynağı ve "tıbbi cihaz değildir" beyanı.
import { useT } from '@/ui/i18n'

export function DisclaimerBar() {
  const { t } = useT()
  return (
    <div
      role="note"
      data-i18n-key="app.disclaimer"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-1.5 text-center text-xs text-muted-foreground"
    >
      {t('app.disclaimer')}
    </div>
  )
}
