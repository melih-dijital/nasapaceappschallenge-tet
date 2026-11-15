// FAZ 9 §3.4 & §3.5 — Telemetri Grafikleri (HR, SpO2, Uyku/Aktivite), Radyasyon Paneli ve Kemik Tahmini Kartı.
// Teknik şartlar: Recharts, ≤ 600 nokta, isAnimationActive={false}, ResponsiveContainer,
// eksenlerde birim, Tooltip (değer, z, baseline), renk-körü dostu çizgi stilleri, klavye odaklanılabilir aria-label.
import { memo, useMemo } from 'react'
import { Bone, Clock, Flame, Moon, Radiation, ShieldAlert } from 'lucide-react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getNumber, getRange } from '@/core/evidence/registry'
import type { Alert, CrewId, Severity } from '@/core/types'
import { msToHours } from '@/core/units'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import type {
  CrewBoneSummary,
  CrewConfidenceInfo,
  CrewMetricBaseline,
  CrewRadiationSummary,
  DailySleepEntry,
  SeriesPoint,
} from '@/ui/store'
import { getSimulatedSleepWindow, isWithinSleepWindow, useSessionStore } from '@/ui/store'
import { EmptyState } from './EmptyState'
import { ProvenanceTag } from './ProvenanceTag'
import { SectionCard } from './SectionCard'
import type { DisplaySeverity } from './SeverityIcon'
import { StatusBadge } from './StatusBadge'

// jsdom ortamında ResizeObserver yoksa güvenli yedek tanımla (konsol hatası olmaması için)
if (typeof globalThis !== 'undefined' && typeof globalThis.ResizeObserver === 'undefined') {
  class FallbackResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = FallbackResizeObserver as unknown as typeof ResizeObserver
}

function formatSimHourLabel(tMs: number): string {
  const totalHours = Math.floor(msToHours(tMs))
  const modHour = ((totalHours % 24) + 24) % 24
  return `${String(modHour).padStart(2, '0')}:00`
}

function TimeCompressedBadge({ speed }: { speed: number }) {
  const { t } = useT()
  const presenter = useSessionStore((s) => s.demoMode)
  if (!presenter || speed < 20) return null
  return (
    <span
      data-testid="time-compressed-badge"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
    >
      <Clock aria-hidden="true" className="size-3" />
      <span>
        {t('controls.timeCompressed')} ({speed}×)
      </span>
    </span>
  )
}

function LearningBaselineBadge({ confidenceInfo }: { confidenceInfo: CrewConfidenceInfo }) {
  const { t } = useT()
  if (!confidenceInfo.isLearning) return null
  return (
    <span
      data-testid="chart-learning-baseline-badge"
      className="inline-flex items-center gap-1 text-[11px] text-status-info"
    >
      <span>
        {t('cockpit.learningBaselineDay', {
          day: confidenceInfo.learningDay,
          target: confidenceInfo.targetDays,
        })}
      </span>
    </span>
  )
}

export interface HrTelemetryChartProps {
  crewId: CrewId
  points: readonly SeriesPoint[]
  baseline: CrewMetricBaseline | undefined
  confidenceInfo: CrewConfidenceInfo
  alerts: readonly Alert[]
  speed: number
}

export const HrTelemetryChart = memo(function HrTelemetryChart({
  crewId,
  points,
  baseline,
  confidenceInfo,
  alerts,
  speed,
}: HrTelemetryChartProps) {
  const { t, formatNumber } = useT()
  const zWarn = getNumber('det.z.warning')
  const median = baseline?.median ?? 62
  const sigma = baseline?.sigma ?? getNumber('minScale.hr')
  const bandLow = Number((median - zWarn * sigma).toFixed(1))
  const bandHigh = Number((median + zWarn * sigma).toFixed(1))
  // Uyku gölgesi: seçili kişinin simüle edilen CrewProfile.sleepWindow'u (sabit 22–06 değil).
  const scenarioId = useSessionStore((s) => s.scenarioId)
  const sleepWindow = useMemo(
    () => getSimulatedSleepWindow(scenarioId, crewId),
    [scenarioId, crewId],
  )

  const chartData = useMemo(
    () =>
      points.map((pt) => {
        const z = Number(((pt.value - median) / Math.max(0.1, sigma)).toFixed(2))
        const isNight = isWithinSleepWindow(pt.t, sleepWindow)
        return {
          t: pt.t,
          timeLabel: formatSimHourLabel(pt.t),
          hr: pt.value,
          median,
          band: confidenceInfo.isLearning ? undefined : ([bandLow, bandHigh] as [number, number]),
          bandLow,
          bandHigh,
          z,
          isNight,
        }
      }),
    [points, median, sigma, bandLow, bandHigh, confidenceInfo.isLearning, sleepWindow],
  )

  // Gece/uyku bloklarını belirle
  const nightBlocks = useMemo(() => {
    const blocks: { x1: number; x2: number }[] = []
    let currentStart: number | null = null
    for (let i = 0; i < chartData.length; i++) {
      const row = chartData[i]!
      if (row.isNight && currentStart === null) {
        currentStart = row.t
      } else if (!row.isNight && currentStart !== null) {
        blocks.push({ x1: currentStart, x2: chartData[i - 1]!.t })
        currentStart = null
      }
    }
    if (currentStart !== null && chartData.length > 0) {
      blocks.push({ x1: currentStart, x2: chartData[chartData.length - 1]!.t })
    }
    return blocks
  }, [chartData])

  return (
    <SectionCard
      title={t('cockpit.hrChartTitle')}
      tooltip={t('cockpit.hrChartSubtitle')}
      provenanceId="det.z.warning"
      headerRight={
        <div className="flex flex-wrap items-center gap-1.5">
          <LearningBaselineBadge confidenceInfo={confidenceInfo} />
          <TimeCompressedBadge speed={speed} />
        </div>
      }
    >
      {/* Grafik Açıklama & Efsane Şeridi */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 bg-[var(--chart-line)]" />
            <span>{t('metric.hr')} (bpm)</span>
          </span>
          {!confidenceInfo.isLearning ? (
            <span
              data-testid="hr-baseline-band-legend"
              className="inline-flex items-center gap-1.5 tabular-nums"
            >
              <span className="inline-block h-2.5 w-3 rounded-xs border border-[var(--chart-band)]/40 bg-[var(--chart-band)]/15" />
              <span>
                {t('cockpit.baselineBandLabel', { z: zWarn })}: {formatNumber(bandLow, 1)}–
                {formatNumber(bandHigh, 1)} bpm
              </span>
            </span>
          ) : (
            <span className="text-status-info">
              {t('cockpit.learningBaselineDay', {
                day: confidenceInfo.learningDay,
                target: confidenceInfo.targetDays,
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Moon aria-hidden="true" className="size-3 text-muted-foreground" />
            <span>{t('cockpit.nightSleepBlock')}</span>
          </span>
        </div>

        {/* Uyarı İşaretçileri Özeti */}
        {alerts.length > 0 && (
          <div data-testid="hr-alert-markers" className="flex flex-wrap items-center gap-1">
            {alerts.slice(0, 2).map((al) => (
              <span
                key={al.id}
                className="inline-flex items-center gap-1 rounded border border-status-warning/50 bg-status-warning/15 px-1.5 py-0.5 font-mono text-[10px] text-status-warning"
              >
                <span>⚑ {t(al.titleKey)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        tabIndex={0}
        role="img"
        aria-label={t('cockpit.hrChartAria')}
        data-testid="hr-chart-container"
        className="h-48 w-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 620, height: 185 }}
        >
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e242c" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatSimHourLabel}
              tick={{ fontSize: 10, fill: '#8a94a3' }}
            />
            <YAxis
              domain={[40, 110]}
              ticks={[40, 60, 80, 100]}
              tick={{ fontSize: 10, fill: '#8a94a3' }}
              width={32}
            />
            <Tooltip
              isAnimationActive={false}
              labelFormatter={(val) => formatSimHourLabel(Number(val))}
              formatter={(val, name) => {
                if (name === 'hr') return [`${Number(val).toFixed(1)} bpm`, t('metric.hr')]
                if (name === 'median') return [`${Number(val).toFixed(1)} bpm`, 'Baseline Median']
                return [String(val), String(name)]
              }}
              contentStyle={{
                backgroundColor: '#12161c',
                borderColor: '#1e242c',
                fontSize: '11px',
              }}
            />

            {/* Gece/Gündüz uyku bloğu şeritleri */}
            {nightBlocks.map((b, idx) => (
              <ReferenceArea
                key={`night-${idx}`}
                x1={b.x1}
                x2={b.x2}
                fill="#9aa9ba"
                fillOpacity={0.09}
              />
            ))}

            {/* Baseline bandı (confidence >= 0.5 iken) */}
            {!confidenceInfo.isLearning && (
              <>
                <ReferenceArea
                  y1={bandLow}
                  y2={bandHigh}
                  fill="#9aa9ba"
                  fillOpacity={0.14}
                  stroke="#c5cdd8"
                  strokeOpacity={0.25}
                />
                <ReferenceLine
                  y={median}
                  stroke="#c5cdd8"
                  strokeDasharray="4 4"
                  strokeWidth={1.2}
                />
              </>
            )}

            {/* Uyarı dikey işaretçileri */}
            {alerts.map((al) => (
              <ReferenceLine
                key={al.id}
                x={al.firstSeenT}
                stroke="#f0883e"
                strokeDasharray="2 2"
                strokeWidth={1.5}
              />
            ))}

            <Line
              type="monotone"
              dataKey="hr"
              stroke="#c5cdd8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  )
})

export interface Spo2TelemetryChartProps {
  points: readonly SeriesPoint[]
  baseline: CrewMetricBaseline | undefined
  speed: number
}

export const Spo2TelemetryChart = memo(function Spo2TelemetryChart({
  points,
  baseline,
  speed,
}: Spo2TelemetryChartProps) {
  const { t } = useT()
  const criticalThreshold = getNumber('spo2.critical')
  const median = baseline?.median ?? 97.6

  const chartData = useMemo(
    () =>
      points.map((pt) => ({
        t: pt.t,
        spo2: pt.value,
        median,
        critical: criticalThreshold,
      })),
    [points, median, criticalThreshold],
  )

  return (
    <SectionCard
      title={t('cockpit.spo2ChartTitle')}
      tooltip={t('cockpit.spo2ChartSubtitle')}
      provenanceId="spo2.critical"
      headerRight={<TimeCompressedBadge speed={speed} />}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-[var(--chart-line)]" />
          <span>{t('metric.spo2')} (%)</span>
        </span>
        <span
          data-testid="spo2-critical-legend"
          className="inline-flex items-center gap-1.5 text-status-critical tabular-nums"
        >
          <span className="inline-block h-0.5 w-3 border-b border-dashed border-status-critical" />
          <span>
            {t('cockpit.criticalThresholdLabel', { value: criticalThreshold, unit: '%' })}
          </span>
        </span>
      </div>

      <div
        tabIndex={0}
        role="img"
        aria-label={t('cockpit.spo2ChartAria')}
        data-testid="spo2-chart-container"
        className="h-40 w-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 620, height: 155 }}
        >
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e242c" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatSimHourLabel}
              tick={{ fontSize: 10, fill: '#8a94a3' }}
            />
            <YAxis
              unit="%"
              domain={[86, 100]}
              tick={{ fontSize: 10, fill: '#8a94a3' }}
              width={48}
            />
            <Tooltip
              isAnimationActive={false}
              labelFormatter={(val) => formatSimHourLabel(Number(val))}
              formatter={(val) => [`${Number(val).toFixed(1)}%`, t('metric.spo2')]}
              contentStyle={{
                backgroundColor: '#12161c',
                borderColor: '#1e242c',
                fontSize: '11px',
              }}
            />
            <ReferenceLine
              y={criticalThreshold}
              stroke="#f26b66"
              strokeDasharray="4 3"
              strokeWidth={1.75}
            />
            <ReferenceLine y={median} stroke="#c5cdd8" strokeDasharray="2 4" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="spo2"
              stroke="#c5cdd8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  )
})

export interface SleepActivityChartProps {
  entries: readonly DailySleepEntry[]
  confidenceInfo: CrewConfidenceInfo
}

export const SleepActivityChart = memo(function SleepActivityChart({
  entries,
  confidenceInfo,
}: SleepActivityChartProps) {
  const { t, formatNumber } = useT()
  const baselineH = entries.at(-1)?.baselineH ?? null

  return (
    <SectionCard
      title={t('cockpit.sleepChartTitle')}
      tooltip={t('cockpit.sleepChartSubtitle')}
      provenanceId="det.trend.sleep.hoursBelow"
      headerRight={<LearningBaselineBadge confidenceInfo={confidenceInfo} />}
    >
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-xs bg-[var(--chart-band)]" />
          <span>{t('metric.sleep.durationH')} (h)</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span className="inline-block h-0.5 w-3 border-b border-dashed border-[var(--chart-band)]" />
          <span>Baseline {baselineH === null ? '—' : `${formatNumber(baselineH, 1)} h`}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-xs bg-status-warning/50" />
          <span>{t('cockpit.sleepDebtLabel')}</span>
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState title={t('cockpit.sleepChartEmpty')} className="h-44" />
      ) : (
        <div
          tabIndex={0}
          role="img"
          aria-label={t('cockpit.sleepChartAria')}
          data-testid="sleep-chart-container"
          className="h-44 w-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 620, height: 170 }}
          >
            <ComposedChart data={[...entries]} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e242c" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8a94a3' }} />
              <YAxis
                unit=" h"
                domain={[0, (max: number) => Math.max(10, Math.ceil(max))]}
                tick={{ fontSize: 10, fill: '#8a94a3' }}
                width={44}
              />
              <Tooltip
                isAnimationActive={false}
                contentStyle={{
                  backgroundColor: '#12161c',
                  borderColor: '#1e242c',
                  fontSize: '11px',
                }}
              />
              <Area
                type="monotone"
                dataKey="debtH"
                fill="#e2c04a"
                fillOpacity={0.22}
                stroke="#e2c04a"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Bar
                dataKey="durationH"
                fill="#9aa9ba"
                radius={[3, 3, 0, 0]}
                barSize={16}
                isAnimationActive={false}
              />
              {!confidenceInfo.isLearning && baselineH !== null && (
                <ReferenceLine
                  y={baselineH}
                  stroke="#9aa9ba"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
})

export interface RadiationPanelProps {
  summary: CrewRadiationSummary
  rateSeries: readonly SeriesPoint[]
  speed: number
}

export const RadiationPanel = memo(function RadiationPanel({
  summary,
  rateSeries,
  speed,
}: RadiationPanelProps) {
  const { t, formatNumber } = useT()
  const warnFraction = getNumber('rad.career.warn.fraction')
  const critFraction = getNumber('rad.career.critical.fraction')
  const [issLow, issHigh] = getRange('rad.iss.rate.msv_day')
  const speDetectRatio = getNumber('rad.spe.detect.ratio')
  const speThresholdRate = summary.baselineRateMsvDay * speDetectRatio

  const speDisplaySeverity: DisplaySeverity =
    summary.speState === 'CONFIRMED'
      ? ('CRITICAL' satisfies Severity)
      : summary.speState === 'SUSPECTED' || summary.speState === 'DECAYING'
        ? ('WARNING' satisfies Severity)
        : 'NOMINAL'

  const speBarPct = Math.min(100, Math.round(summary.speFractionOfLimit * 100))

  // SPE aktif olan zaman aralıklarını gölgelemek için hesapla
  const speShadedBlocks = useMemo(() => {
    const blocks: { x1: number; x2: number }[] = []
    let start: number | null = null
    for (let i = 0; i < rateSeries.length; i++) {
      const pt = rateSeries[i]!
      if (pt.value >= speThresholdRate && start === null) {
        start = pt.t
      } else if (pt.value < speThresholdRate && start !== null) {
        blocks.push({ x1: start, x2: rateSeries[i - 1]!.t })
        start = null
      }
    }
    if (start !== null && rateSeries.length > 0) {
      blocks.push({ x1: start, x2: rateSeries[rateSeries.length - 1]!.t })
    }
    return blocks
  }, [rateSeries, speThresholdRate])

  const rateChartData = useMemo(
    () =>
      rateSeries.map((pt) => ({
        t: pt.t,
        doseRate: pt.value,
      })),
    [rateSeries],
  )

  return (
    <SectionCard
      title={t('radiation.panelTitle')}
      tooltip={t('radiation.panelSubtitle')}
      provenanceId="rad.career.limit.msv"
      headerRight={<TimeCompressedBadge speed={speed} />}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* (a) Kümülatif Kariyer Doz Göstergesi (Gauge: 600 mSv, %50 / %80 eşikleri) */}
        <div className="lg:col-span-5">
          <div className="space-y-1.5" data-testid="career-dose-box">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{t('radiation.careerGaugeLabel')}</span>
              <ProvenanceTag evidenceId="rad.career.limit.msv" />
            </div>
            <div className="font-mono text-2xl leading-none font-medium text-foreground tabular-nums">
              {formatNumber(summary.careerMsv, 1)}
              <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
                / {formatNumber(summary.careerLimitMsv, 0)} mSv
              </span>
            </div>
            <div
              role="meter"
              aria-label={t('radiation.careerGaugeLabel')}
              aria-valuemin={0}
              aria-valuemax={summary.careerLimitMsv}
              aria-valuenow={Number(summary.careerMsv.toFixed(1))}
              className="relative h-2 w-full rounded-full bg-muted"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  summary.careerFraction >= critFraction
                    ? 'bg-status-critical'
                    : summary.careerFraction >= warnFraction
                      ? 'bg-status-warning'
                      : 'bg-status-nominal',
                )}
                style={{ width: `${Math.max(1, Math.min(100, summary.careerFraction * 100))}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute -top-0.5 h-3 w-px bg-status-warning"
                style={{ left: `${warnFraction * 100}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute -top-0.5 h-3 w-px bg-status-critical"
                style={{ left: `${critFraction * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('radiation.careerPctOfLimit', {
                pct: Math.round(summary.careerFraction * 100),
                limit: formatNumber(summary.careerLimitMsv, 0),
              })}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('radiation.priorDose', { value: formatNumber(summary.priorCareerDoseMsv, 1) })} ·{' '}
              {t('radiation.missionDose', { value: formatNumber(summary.cumulativeMissionMsv, 2) })}
            </p>
          </div>
        </div>

        {/* (b) Doz Hızı Grafiği & (c) SPE Durum Rozeti + 250 mSv Koruma Hedefi Çubuğu */}
        <div className="flex flex-col justify-between gap-3 lg:col-span-7">
          {/* Doz Hızı Grafiği */}
          <div className="rounded-lg border border-border/70 bg-background/50 p-2.5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Radiation aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <span>{t('radiation.rateChartTitle')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {t('radiation.expectedBand')}: {issLow}–{issHigh} mSv/d
                </span>
                <ProvenanceTag evidenceId="rad.iss.rate.msv_day" />
              </div>
            </div>

            <div
              tabIndex={0}
              role="img"
              aria-label={t('radiation.rateChartAria')}
              data-testid="radiation-rate-chart"
              className="h-28 w-full rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 380, height: 110 }}
              >
                <ComposedChart
                  data={rateChartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e242c" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatSimHourLabel}
                    tick={{ fontSize: 9, fill: '#8a94a3' }}
                  />
                  <YAxis
                    unit=" mSv"
                    domain={[0, 'auto']}
                    tick={{ fontSize: 9, fill: '#8a94a3' }}
                    width={46}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    labelFormatter={(val) => formatSimHourLabel(Number(val))}
                    formatter={(val) => [
                      `${Number(val).toFixed(3)} mSv/day`,
                      t('metric.rad.doseRateMsvDay'),
                    ]}
                    contentStyle={{
                      backgroundColor: '#12161c',
                      borderColor: '#1e242c',
                      fontSize: '11px',
                    }}
                  />
                  {/* Beklenen ISS/referans aralık bandı */}
                  <ReferenceArea y1={issLow} y2={issHigh} fill="#9aa9ba" fillOpacity={0.14} />
                  {/* SPE gölgeli aralıkları */}
                  {speShadedBlocks.map((b, idx) => (
                    <ReferenceArea
                      key={`spe-${idx}`}
                      x1={b.x1}
                      x2={b.x2}
                      fill="#f26b66"
                      fillOpacity={0.22}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="doseRate"
                    stroke="#c5cdd8"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* (c) SPE Durum Rozeti + Olay Dozu / 250 mSv Çubuğu ("design reference SPE protection target") */}
          <div
            data-testid="spe-protection-target-box"
            className={cn(
              'rounded-lg border p-2.5',
              summary.speState === 'CONFIRMED'
                ? 'border-status-critical/70 bg-status-critical/10'
                : 'border-border/70 bg-background/50',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame
                  aria-hidden="true"
                  className={cn(
                    'size-4',
                    summary.speState === 'CONFIRMED'
                      ? 'text-status-critical'
                      : 'text-muted-foreground',
                  )}
                />
                <span className="text-xs font-medium text-foreground">
                  {t('radiation.speStateLabel')}:
                </span>
                <StatusBadge
                  severity={speDisplaySeverity}
                  label={t(`radiation.speState.${summary.speState}`)}
                  compact
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                  {t('radiation.speTargetLabel')}
                </span>
                <ProvenanceTag evidenceId="rad.spe.limit.msv" />
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                <span className="text-foreground">
                  {t('radiation.speEventDose', {
                    dose: formatNumber(summary.speDoseMsv, 1),
                    target: formatNumber(summary.speTargetMsv, 0),
                  })}
                </span>
                <span className="text-muted-foreground">{speBarPct}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={t('radiation.speTargetLabel')}
                aria-valuenow={Number(summary.speDoseMsv.toFixed(1))}
                aria-valuemin={0}
                aria-valuemax={summary.speTargetMsv}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn(
                    'h-full transition-all',
                    summary.speFractionOfLimit >= getNumber('rad.spe.critical.fraction')
                      ? 'bg-status-critical'
                      : summary.speFractionOfLimit >= getNumber('rad.spe.warn.fraction')
                        ? 'bg-status-warning'
                        : 'bg-status-nominal',
                  )}
                  style={{ width: `${Math.max(2, speBarPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{t('radiation.speTargetNote')}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
})

export interface BoneEstimateCardProps {
  bone: CrewBoneSummary
}

export const BoneEstimateCard = memo(function BoneEstimateCard({ bone }: BoneEstimateCardProps) {
  const { t, formatNumber } = useT()

  return (
    <SectionCard
      title={t('bone.cardTitle')}
      tooltip={t('bone.estimate.disclaimer')}
      provenanceId="bone.loss.pct_month"
      headerRight={
        <div className="flex items-center gap-1.5">
          <span
            data-testid="bone-indicative-estimate-badge"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <ShieldAlert aria-hidden="true" className="size-3" />
            <span>{t('bone.indicativeBadge')}</span>
          </span>
          <ProvenanceTag evidenceId="bone.estimate.efficacy" />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Bone aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span>{t('bone.monthlyLoss')}</span>
          </div>
          <div className="mt-1 font-mono text-base font-medium text-foreground tabular-nums">
            {bone.estimatedMonthlyLossPct === null
              ? '—'
              : `−${formatNumber(bone.estimatedMonthlyLossPct, 2)}%`}{' '}
            <span className="text-xs font-normal text-muted-foreground">/ mo</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
          <div className="text-[11px] text-muted-foreground">{t('bone.cumulativeLoss')}</div>
          <div className="mt-1 font-mono text-base font-medium text-foreground tabular-nums">
            {bone.estimatedCumulativeLossPct === null
              ? '—'
              : `−${formatNumber(bone.estimatedCumulativeLossPct, 3)}%`}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
          <div className="text-[11px] text-muted-foreground">{t('bone.resistiveAdherence')}</div>
          <div className="mt-1 font-mono text-base font-medium text-foreground tabular-nums">
            {bone.resistiveAdherence7d === null
              ? '—'
              : `${Math.round(bone.resistiveAdherence7d * 100)}%`}
          </div>
        </div>
      </div>
    </SectionCard>
  )
})
