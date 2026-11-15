// Kokpit sol sütun: son değerler (büyük sayı, küçük gri etiket). Veri kalitesi sorunu → gri "Data gap".
import { memo } from 'react'
import { METRIC_META, type CrewId, type MetricId } from '@/core/types'
import { useT } from '@/ui/i18n'
import type {
  CrewConfidenceInfo,
  CrewMetricBaseline,
  DataQualityIssue,
  SeriesPoint,
} from '@/ui/store'
import { latestKey } from '@/workers/protocol'
import { MetricTile } from './MetricTile'
import { SectionCard } from './SectionCard'

const READING_METRICS: readonly { metric: MetricId; digits: number }[] = [
  { metric: 'hr', digits: 0 },
  { metric: 'spo2', digits: 1 },
  { metric: 'hrv', digits: 0 },
  { metric: 'sleep.durationH', digits: 1 },
  { metric: 'hydrationL', digits: 1 },
  { metric: 'mood.mood', digits: 1 },
]

export interface LatestReadingsPanelProps {
  crewId: CrewId
  confidenceInfo: CrewConfidenceInfo
  latestValues: Record<string, number>
  baselines: Record<string, CrewMetricBaseline>
  seriesByKey: Record<string, SeriesPoint[]>
  dataQuality: Record<string, DataQualityIssue>
}

export const LatestReadingsPanel = memo(function LatestReadingsPanel({
  crewId,
  confidenceInfo,
  latestValues,
  baselines,
  seriesByKey,
  dataQuality,
}: LatestReadingsPanelProps) {
  const { t } = useT()
  return (
    <SectionCard title={t('cockpit.latestReadingsTitle')}>
      <div className="@container">
        <div className="grid grid-cols-1 gap-2 @[22rem]:grid-cols-2">
          {READING_METRICS.map(({ metric, digits }) => {
            const key = latestKey(crewId, metric)
            const val = latestValues[key]
            const base = baselines[key]
            const z =
              val !== undefined && base
                ? Number(((val - base.median) / Math.max(0.05, base.sigma)).toFixed(2))
                : 0
            const meta = METRIC_META[metric]
            return (
              <MetricTile
                key={metric}
                metric={metric}
                label={t(meta.labelKey)}
                value={val}
                unit={meta.unit}
                digits={digits}
                z={z}
                baselineMedian={base?.median}
                sparkline={seriesByKey[key] ?? []}
                learningBaseline={confidenceInfo.isLearning}
                sensorFault={Boolean(dataQuality[key]?.fault)}
              />
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
})
