// Panel kapsayıcısı: 1 px kenar, gölge yok, 8 px köşe; başlık "Sentence case" 13 px orta kalınlık.
// Açıklama satırı yerine (grafiklerde) `tooltip` kullanılır; kaynak ikonu başlığın yanında.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { InfoTooltip } from './InfoTooltip'
import { ProvenanceTag } from './ProvenanceTag'

export interface SectionCardProps {
  title: string
  subtitle?: string
  provenanceId?: string
  tooltip?: string
  headerRight?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  subtitle,
  provenanceId,
  tooltip,
  headerRight,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col rounded-lg border border-border bg-card', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h2 className="truncate text-[13px] font-medium text-foreground">{title}</h2>
            {tooltip && <InfoTooltip text={tooltip} label={title} />}
            {provenanceId && <ProvenanceTag evidenceId={provenanceId} />}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {headerRight && <div className="flex shrink-0 items-center gap-1.5">{headerRight}</div>}
      </header>
      <div className={cn('flex-1 px-3 pb-3', contentClassName)}>{children}</div>
    </section>
  )
}
