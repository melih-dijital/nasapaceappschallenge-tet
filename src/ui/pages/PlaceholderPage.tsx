// FAZ 9 §3.3 — Faz 10 sayfaları için görev kontrol yer tutucu bileşeni.
import { Construction } from 'lucide-react'
import { useT } from '@/ui/i18n'

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useT()

  return (
    <section
      aria-labelledby="page-title"
      className="space-y-4 rounded-xl border border-border/80 bg-card/90 p-6"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Construction aria-hidden="true" className="size-4" />
        </div>
        <div>
          <h1 id="page-title" className="text-xl font-semibold text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{t('app.placeholderHint')}</p>
        </div>
      </div>
    </section>
  )
}
