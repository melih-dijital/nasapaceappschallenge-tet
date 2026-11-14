// FAZ 9 §3.1 — SectionCard (Görev kontrol paneli kart kapsayıcısı).
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
      className={cn(
        'flex flex-col rounded-xl border border-border/80 bg-card/95 shadow-sm',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate font-heading text-xs font-semibold tracking-wider text-foreground uppercase">
              {title}
            </h2>
            {provenanceId && <ProvenanceTag evidenceId={provenanceId} />}
            {tooltip && <InfoTooltip text={tooltip} label={title} />}
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {headerRight && <div className="flex shrink-0 items-center gap-1.5">{headerRight}</div>}
      </header>
      <div className={cn('flex-1 p-3.5', contentClassName)}>{children}</div>
    </section>
  )
}
