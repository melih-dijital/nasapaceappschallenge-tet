// FAZ 9 §3.1 — StatusBadge ve EarthDelayBadge.
// Renk tek başına anlam taşımaz: her rozette ikon + metin birlikte yer alır (PROJECT_MEMORY §10).
import { Clock, Radio, Zap } from 'lucide-react'
import type { EarthDelayClass } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'

export interface StatusBadgeProps {
  severity: DisplaySeverity
  label?: string
  className?: string
  compact?: boolean
}

const BADGE_STYLE: Record<DisplaySeverity, string> = {
  NOMINAL: 'border-status-nominal/40 bg-status-nominal/10 text-status-nominal',
  INFO: 'border-status-info/40 bg-status-info/10 text-status-info',
  ADVISORY: 'border-status-advisory/40 bg-status-advisory/10 text-status-advisory',
  WARNING: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  CRITICAL: 'border-status-critical/50 bg-status-critical/12 text-status-critical font-medium',
}

export function StatusBadge({ severity, label, className, compact = false }: StatusBadgeProps) {
  const { t } = useT()
  const text = label ?? t(`severity.${severity}`)

  return (
    <span
      data-testid={`status-badge-${severity}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
        compact && 'px-1.5 py-0 text-[11px]',
        BADGE_STYLE[severity],
        className,
      )}
    >
      <SeverityIcon severity={severity} className={compact ? 'size-3' : 'size-3.5'} />
      <span>{text}</span>
    </span>
  )
}

export interface EarthDelayBadgeProps {
  delayClass: EarthDelayClass
  className?: string
}

const EARTH_DELAY_STYLE: Record<EarthDelayClass, string> = {
  ACT_NOW: 'border-status-critical/50 bg-status-critical/12 text-status-critical font-medium',
  ACT_THEN_REPORT: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  CAN_WAIT_FOR_EARTH: 'border-border bg-transparent text-muted-foreground',
}

export function EarthDelayBadge({ delayClass, className }: EarthDelayBadgeProps) {
  const { t } = useT()

  const Icon = delayClass === 'ACT_NOW' ? Zap : delayClass === 'ACT_THEN_REPORT' ? Radio : Clock

  return (
    <span
      data-testid={`earth-delay-badge-${delayClass}`}
      title={t(`earthDelay.${delayClass}.desc`)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] whitespace-nowrap',
        EARTH_DELAY_STYLE[delayClass],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span>{t(`earthDelay.${delayClass}`)}</span>
    </span>
  )
}
