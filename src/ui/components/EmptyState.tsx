// FAZ 9 §3.1 — EmptyState (Boş durum bileşeni).
import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-background/40 px-4 py-5 text-center',
        className,
      )}
    >
      <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon ?? <CheckCircle2 aria-hidden="true" className="size-4" />}
      </div>
      <div className="text-xs font-medium text-foreground">{title}</div>
      {description && <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
