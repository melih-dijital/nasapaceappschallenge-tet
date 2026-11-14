// FAZ 9 §3.2 & §3.3 — DisclaimerBar (i18n sözlüğüne bağlı sürekli uyarı bandı).
import { ShieldAlert } from 'lucide-react'
import { useT } from '@/ui/i18n'

export function DisclaimerBar() {
  const { t } = useT()

  return (
    <div
      role="note"
      data-i18n-key="app.disclaimer"
      className="flex w-full items-center justify-center gap-1.5 border-b border-status-advisory/40 bg-status-advisory/10 px-4 py-1 text-center text-xs font-medium text-status-advisory"
    >
      <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{t('app.disclaimer')}</span>
    </div>
  )
}
