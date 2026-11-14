// FAZ 9 §3.1 — Durum ikonu (SeverityIcon).
// info=mavi/Info, advisory=sarı/AlertCircle, warning=turuncu/AlertTriangle, critical=kırmızı/OctagonAlert.
import { AlertCircle, AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react'
import type { Severity } from '@/core/types'
import { cn } from '@/lib/utils'

export type DisplaySeverity = Severity | 'NOMINAL'

export interface SeverityIconProps {
  severity: DisplaySeverity
  className?: string
  pulse?: boolean
}

const SEVERITY_COLOR_CLASS: Record<DisplaySeverity, string> = {
  NOMINAL: 'text-primary',
  INFO: 'text-status-info',
  ADVISORY: 'text-status-advisory',
  WARNING: 'text-status-warning',
  CRITICAL: 'text-status-critical',
}

export function SeverityIcon({ severity, className, pulse = true }: SeverityIconProps) {
  const baseClass = cn(
    ' size-4 shrink-0',
    SEVERITY_COLOR_CLASS[severity],
    severity === 'CRITICAL' && pulse && 'status-critical-pulse rounded-full',
    className,
  )

  switch (severity) {
    case 'INFO':
      return <Info data-testid="severity-icon-INFO" aria-hidden="true" className={baseClass} />
    case 'ADVISORY':
      return (
        <AlertCircle
          data-testid="severity-icon-ADVISORY"
          aria-hidden="true"
          className={baseClass}
        />
      )
    case 'WARNING':
      return (
        <AlertTriangle
          data-testid="severity-icon-WARNING"
          aria-hidden="true"
          className={baseClass}
        />
      )
    case 'CRITICAL':
      return (
        <OctagonAlert
          data-testid="severity-icon-CRITICAL"
          aria-hidden="true"
          className={baseClass}
        />
      )
    case 'NOMINAL':
    default:
      return (
        <CheckCircle2
          data-testid="severity-icon-NOMINAL"
          aria-hidden="true"
          className={baseClass}
        />
      )
  }
}
