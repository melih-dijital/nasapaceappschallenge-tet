// FAZ 9 §3.1 — Skeleton (Yükleniyor iskeleti).
import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
  label?: string
}

export function Skeleton({ className, label = 'Loading' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="skeleton"
      className={cn('animate-pulse rounded-md bg-muted/70', className)}
    />
  )
}
