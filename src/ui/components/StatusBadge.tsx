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
  NOMINAL: 'border-primary/40 bg-primary/10 text-primary',
  INFO: 'border-status-info/40 bg-status-info/15 text-status-info',
  ADVISORY: 'border-status-advisory/40 bg-status-advisory/15 text-status-advisory',
  WARNING: 'border-status-warning/50 bg-status-warning/15 text-status-warning',
  CRITICAL:
    'border-status-critical/60 bg-status-critical/20 text-status-critical status-critical-pulse font-semibold',
}

export function StatusBadge({ severity, label, className, compact = false }: StatusBadgeProps) {
  const { t } = useT()
  const text = label ?? t(`severity.${severity}`)

  return (
    <span
      data-testid={`status-badge-${severity}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tracking-wide',
        compact && 'px-1.5 py-0 text-[11px]',
        BADGE_STYLE[severity],
        className,
      )}
    >
      <SeverityIcon severity={severity} pulse={false} className={compact ? 'size-3' : 'size-3.5'} />
      <span>{text}</span>
    </span>
  )
}

export interface EarthDelayBadgeProps {
  delayClass: EarthDelayClass
  className?: string
}

const EARTH_DELAY_STYLE: Record<EarthDelayClass, string> = {
  ACT_NOW: 'border-status-critical/60 bg-status-critical/20 text-status-critical font-semibold',
  ACT_THEN_REPORT: 'border-status-warning/50 bg-status-warning/15 text-status-warning',
  CAN_WAIT_FOR_EARTH: 'border-status-info/40 bg-status-info/15 text-status-info',
}

export function EarthDelayBadge({ delayClass, className }: EarthDelayBadgeProps) {
  const { t } = useT()

  const Icon =
    delayClass === 'ACT_NOW' ? Zap : delayClass === 'ACT_THEN_REPORT' ? Radio : Clock

  return (
    <span
      data-testid={`earth-delay-badge-${delayClass}`}
      title={t(`earthDelay.${delayClass}.desc`)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] tracking-tight',
        EARTH_DELAY_STYLE[delayClass],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span>{t(`earthDelay.${delayClass}`)}</span>
    </span>
  )
}
