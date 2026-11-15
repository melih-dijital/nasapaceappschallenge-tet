// Son değer karosu: büyük sayısal değer (mono, tabular-nums), küçük gri etiket, nötr mini çizgi.
// Teknik veri kalitesi etiketleri (FAULT/stale) gösterilmez: sorun varsa gri "Data gap" notu.
import { memo } from 'react'
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
  /** Veri kalitesi sorunu (sensör arızası/bayat veri) → "Data gap". */
  sensorFault?: boolean
  className?: string
}

function buildSparklinePoints(points: readonly SeriesPoint[], width = 64, height = 20): string {
  if (points.length === 0) return ''
  const slice = points.slice(-32)
  if (slice.length === 1) return `0,${height / 2} ${width},${height / 2}`
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
  className,
}: MetricTileProps) {
  const { t, formatNumber } = useT()

  const absZ = Math.abs(z)
  const severity: DisplaySeverity =
    sensorFault || learningBaseline
      ? 'NOMINAL'
      : absZ >= getNumber('det.z.critical')
        ? ('CRITICAL' satisfies Severity)
        : absZ >= getNumber('det.z.warning')
          ? ('WARNING' satisfies Severity)
          : absZ >= getNumber('det.z.advisory')
            ? ('ADVISORY' satisfies Severity)
            : 'NOMINAL'
  const polyline = buildSparklinePoints(sparkline)

  return (
    <div
      data-testid={`metric-tile-${metric}`}
      data-severity={severity}
      className={cn(
        'flex flex-col gap-1 rounded-md border border-border bg-background/40 px-2.5 py-2',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {severity !== 'NOMINAL' && (
          <span className="inline-flex items-center gap-0.5" title={t(`severity.${severity}`)}>
            <SeverityIcon severity={severity} className="size-3.5" />
            <span className="sr-only">{t(`severity.${severity}`)}</span>
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="font-mono text-xl leading-none font-medium text-foreground tabular-nums">
          {value !== undefined && !sensorFault ? formatNumber(value, digits) : '—'}
          <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">{unit}</span>
        </div>
        {polyline && !sensorFault && (
          <svg
            viewBox="0 0 64 20"
            className="h-5 w-16 shrink-0 overflow-visible"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="#8a94a3"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
          </svg>
        )}
      </div>

      {sensorFault ? (
        <div
          role="status"
          data-testid={`sensor-fault-${metric}`}
          className="text-[11px] text-muted-foreground"
        >
          {t('cockpit.dataGap')}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-muted-foreground tabular-nums">
          {learningBaseline ? (
            <span>{t('cockpit.learningBaseline')}</span>
          ) : (
            <span className="font-mono">
              {t('cockpit.zScore', { z: `${z >= 0 ? '+' : ''}${z.toFixed(1)}` })}
            </span>
          )}
          {baselineMedian !== undefined && (
            <span className="font-mono">
              {t('cockpit.baselineMedian', { median: formatNumber(baselineMedian, digits), unit })}
            </span>
          )}
        </div>
      )}
    </div>
  )
})
