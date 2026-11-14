// FAZ 9 §3.1, §3.4 & §3.5 — MetricTile (Son değer, birim, z skoru, mini sparkline ve veri kalitesi rozeti).
import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getNumber } from '@/core/evidence/registry'
import type { MetricId, Severity } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import type { SeriesPoint } from '@/ui/store/decimate'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'

export interface MetricTileProps {
  metric: MetricId
  label: string
  value: number | undefined
  unit: string
  digits?: number
  z?: number
  baselineMedian?: number
  sparkline?: readonly SeriesPoint[]
  learningBaseline?: boolean
  sensorFault?: boolean
  onToggleFault?: () => void
  className?: string
}

function buildSparklinePoints(points: readonly SeriesPoint[], width = 96, height = 24): string {
  if (points.length === 0) return ''
  const slice = points.slice(-32)
  if (slice.length === 1) {
    return `0,${height / 2} ${width},${height / 2}`
  }
  let min = slice[0]!.value
  let max = slice[0]!.value
  for (const p of slice) {
    if (p.value < min) min = p.value
    if (p.value > max) max = p.value
  }
  const range = Math.max(0.001, max - min)
  return slice
    .map((p, i) => {
      const x = (i / (slice.length - 1)) * width
      const y = height - 2 - ((p.value - min) / range) * (height - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export const MetricTile = memo(function MetricTile({
  metric,
  label,
  value,
  unit,
  digits = 1,
  z = 0,
  baselineMedian,
  sparkline = [],
  learningBaseline = false,
  sensorFault = false,
  onToggleFault,
  className,
}: MetricTileProps) {
  const { t, formatNumber } = useT()

  const zAdvisory = getNumber('det.z.advisory')
  const zWarning = getNumber('det.z.warning')
  const zCritical = getNumber('det.z.critical')

  const absZ = Math.abs(z)
  const severity: DisplaySeverity = sensorFault
    ? ('WARNING' satisfies Severity)
    : learningBaseline
      ? 'INFO'
      : absZ >= zCritical
        ? ('CRITICAL' satisfies Severity)
        : absZ >= zWarning
          ? ('WARNING' satisfies Severity)
          : absZ >= zAdvisory
            ? ('ADVISORY' satisfies Severity)
            : 'NOMINAL'

  const polyline = buildSparklinePoints(sparkline)
  const formattedZ = `${z >= 0 ? '+' : ''}${z.toFixed(1)}`

  return (
    <div
      data-testid={`metric-tile-${metric}`}
      className={cn(
        'flex flex-col justify-between rounded-lg border border-border/70 bg-background/60 p-2.5 transition-colors',
        sensorFault && 'border-status-warning/70 bg-status-warning/10',
        !sensorFault && severity === 'CRITICAL' && 'border-status-critical/70 bg-status-critical/10',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          {onToggleFault && (
            <button
              type="button"
              onClick={onToggleFault}
              aria-label={`${t('cockpit.simulateSensorFault')}: ${label}`}
              title={t('cockpit.simulateSensorFault')}
              className="rounded px-1 py-0.5 font-mono text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              FAULT
            </button>
          )}
          <SeverityIcon severity={severity} className="size-3.5" />
        </div>
      </div>

      {sensorFault && (
        <div
          role="status"
          data-testid={`sensor-fault-${metric}`}
          className="mt-1.5 inline-flex items-center gap-1 rounded border border-status-warning/50 bg-status-warning/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-status-warning"
        >
          <AlertTriangle aria-hidden="true" className="size-3 shrink-0" />
          <span>⚠ {t('cockpit.sensorFaultStale')}</span>
        </div>
      )}

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <div className="font-mono text-lg font-bold text-foreground tabular-nums">
          {value !== undefined ? formatNumber(value, digits) : '—'}{' '}
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </div>

        {polyline && (
          <svg
            viewBox="0 0 96 24"
            className="h-6 w-20 shrink-0 overflow-visible"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke={
                sensorFault
                  ? 'var(--status-warning)'
                  : severity === 'CRITICAL'
                    ? 'var(--status-critical)'
                    : 'var(--primary)'
              }
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
          </svg>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-border/40 pt-1 text-[10px] text-muted-foreground tabular-nums">
        {learningBaseline ? (
          <span className="font-mono text-status-info">{t('cockpit.learningBaseline')}</span>
        ) : (
          <span className="font-mono">{t('cockpit.zScore', { z: formattedZ })}</span>
        )}
        {baselineMedian !== undefined && (
          <span className="truncate font-mono">
            {t('cockpit.baselineMedian', {
              median: formatNumber(baselineMedian, digits),
              unit,
            })}
          </span>
        )}
      </div>
    </div>
  )
})
