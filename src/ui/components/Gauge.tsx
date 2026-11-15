// FAZ 9 §3.1 & §3.4 — Gauge (Yarı-dairesel gösterge; örn. Kümülatif kariyer dozu / 600 mSv).
import type { Severity } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import { ProvenanceTag } from './ProvenanceTag'
import type { DisplaySeverity } from './SeverityIcon'
import { StatusBadge } from './StatusBadge'

/**
 * [0, 1] aralığındaki oranı derece cinsinden gösterge açısına dönüştürür.
 * Varsayılan yarı-daire: 0 → -90°, 0.5 → 0°, 1 → +90°.
 */
export function fractionToAngle(fraction: number, minDeg = -90, maxDeg = 90): number {
  if (!Number.isFinite(fraction)) return minDeg
  const clamped = Math.min(1, Math.max(0, fraction))
  return minDeg + clamped * (maxDeg - minDeg)
}

export interface GaugeProps {
  value: number
  max: number
  unit: string
  fraction?: number
  warnFraction?: number
  criticalFraction?: number
  label: string
  sublabel?: string
  provenanceId?: string
  className?: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function Gauge({
  value,
  max,
  unit,
  fraction,
  warnFraction = 0.5,
  criticalFraction = 0.8,
  label,
  sublabel,
  provenanceId,
  className,
}: GaugeProps) {
  const { formatNumber } = useT()
  const safeMax = max > 0 ? max : 1
  const computedFraction = fraction !== undefined ? fraction : value / safeMax
  const clampedFraction = Math.min(1, Math.max(0, computedFraction))
  const angle = fractionToAngle(clampedFraction, -90, 90)
  const pct = Math.round(clampedFraction * 100)

  const severity: DisplaySeverity =
    computedFraction >= criticalFraction
      ? ('CRITICAL' satisfies Severity)
      : computedFraction >= warnFraction
        ? ('WARNING' satisfies Severity)
        : 'NOMINAL'

  const strokeColor =
    severity === 'CRITICAL'
      ? 'var(--status-critical)'
      : severity === 'WARNING'
        ? 'var(--status-warning)'
        : 'var(--primary)'

  const cx = 100
  const cy = 92
  const r = 70
  const warnAngle = fractionToAngle(warnFraction, -90, 90)
  const critAngle = fractionToAngle(criticalFraction, -90, 90)
  const warnTickOuter = polarToCartesian(cx, cy, r + 7, warnAngle)
  const warnTickInner = polarToCartesian(cx, cy, r - 7, warnAngle)
  const critTickOuter = polarToCartesian(cx, cy, r + 7, critAngle)
  const critTickInner = polarToCartesian(cx, cy, r - 7, critAngle)
  const needleTip = polarToCartesian(cx, cy, r - 10, angle)

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={max}
      data-testid="gauge"
      data-angle={angle.toFixed(1)}
      data-fraction={clampedFraction.toFixed(4)}
      className={cn(
        'flex flex-col justify-between rounded-lg border border-border/70 bg-background/50 p-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <StatusBadge severity={severity} compact />
      </div>

      <div className="my-1 flex flex-col items-center">
        <svg viewBox="0 0 200 112" className="h-28 w-48 overflow-visible" aria-hidden="true">
          {/* Arka plan yarı-daire yay */}
          <path
            d={describeArc(cx, cy, r, -90, 90)}
            fill="none"
            stroke="currentColor"
            className="text-muted/70"
            strokeWidth={12}
            strokeLinecap="round"
          />

          {/* Değer yayı */}
          {clampedFraction > 0.005 && (
            <path
              d={describeArc(cx, cy, r, -90, angle)}
              fill="none"
              stroke={strokeColor}
              strokeWidth={12}
              strokeLinecap="round"
            />
          )}

          {/* %50 (warn) eşik işareti */}
          <line
            x1={warnTickInner.x}
            y1={warnTickInner.y}
            x2={warnTickOuter.x}
            y2={warnTickOuter.y}
            stroke="var(--status-warning)"
            strokeWidth={2.5}
          />
          <text
            x={warnTickOuter.x}
            y={warnTickOuter.y - 4}
            textAnchor="middle"
            className="fill-status-warning font-mono text-[9px]"
          >
            {Math.round(warnFraction * 100)}%
          </text>

          {/* %80 (critical) eşik işareti */}
          <line
            x1={critTickInner.x}
            y1={critTickInner.y}
            x2={critTickOuter.x}
            y2={critTickOuter.y}
            stroke="var(--status-critical)"
            strokeWidth={2.5}
          />
          <text
            x={critTickOuter.x + 8}
            y={critTickOuter.y - 2}
            textAnchor="start"
            className="fill-status-critical font-mono text-[9px]"
          >
            {Math.round(criticalFraction * 100)}%
          </text>

          {/* İbre */}
          <line
            data-testid="gauge-needle"
            data-angle={angle.toFixed(1)}
            x1={cx}
            y1={cy}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="currentColor"
            className="text-foreground"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={4} className="fill-foreground" />
        </svg>

        <div className="-mt-2 text-center">
          <div className="font-mono text-base font-medium text-foreground tabular-nums">
            {formatNumber(value, 1)}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              / {formatNumber(max, 0)} {unit}
            </span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {pct}% of {max} {unit}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/50 pt-2">
        {sublabel && <span className="text-[11px] text-muted-foreground">{sublabel}</span>}
        {provenanceId && <ProvenanceTag evidenceId={provenanceId} />}
      </div>
    </div>
  )
}
