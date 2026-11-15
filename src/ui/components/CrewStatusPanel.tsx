// Kokpit sol sütun: "Crew status" — 7 bileşik durum için yatay skor çubuğu listesi (ad · çubuk · seviye).
// Halka/daire göstergeleri yok; güven yalnızca düşükse küçük gri not olarak gösterilir.
import { memo } from 'react'
import { getNumber } from '@/core/evidence/registry'
import type { Severity, StateEstimate } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import type { CrewConfidenceInfo } from '@/ui/store'
import { SectionCard } from './SectionCard'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'

/** L4 skoru → gösterim seviyesi (eşikler Evidence; CRITICAL yalnızca radyasyon olayı, öğrenmede en fazla ADVISORY). */
export function stateScoreToSeverity(
  score: number,
  stateId: StateEstimate['state'],
  isLearning: boolean,
): DisplaySeverity {
  if (score < getNumber('det.state.score.advisory')) return 'NOMINAL'
  if (isLearning) return 'ADVISORY' satisfies Severity
  if (score >= getNumber('det.state.score.critical') && stateId === 'radiation_event')
    return 'CRITICAL'
  if (score >= getNumber('det.state.score.warning')) return 'WARNING'
  return 'ADVISORY'
}

const BAR_COLOR: Record<DisplaySeverity, string> = {
  NOMINAL: 'bg-status-nominal',
  INFO: 'bg-status-info',
  ADVISORY: 'bg-status-advisory',
  WARNING: 'bg-status-warning',
  CRITICAL: 'bg-status-critical',
}
const TEXT_COLOR: Record<DisplaySeverity, string> = {
  NOMINAL: 'text-muted-foreground',
  INFO: 'text-status-info',
  ADVISORY: 'text-status-advisory',
  WARNING: 'text-status-warning',
  CRITICAL: 'text-status-critical',
}

export interface CrewStatusPanelProps {
  states: readonly StateEstimate[]
  confidenceInfo: CrewConfidenceInfo
}

export const CrewStatusPanel = memo(function CrewStatusPanel({
  states,
  confidenceInfo,
}: CrewStatusPanelProps) {
  const { t } = useT()
  const lowConfidence = getNumber('det.confidence.cap.threshold')

  return (
    <SectionCard title={t('cockpit.crewStatusTitle')} provenanceId="det.state.score.warning">
      {confidenceInfo.isLearning && (
        <p data-testid="learning-baseline-label" className="mb-2 text-xs text-status-info">
          {t('cockpit.learningBaselineDay', {
            day: confidenceInfo.learningDay,
            target: confidenceInfo.targetDays,
          })}
        </p>
      )}
      <ul className="space-y-2" aria-label={t('cockpit.crewStatusTitle')}>
        {states.map((st) => {
          const severity = stateScoreToSeverity(st.score, st.state, confidenceInfo.isLearning)
          const pct = Math.round(Math.min(1, Math.max(0, st.score)) * 100)
          const level = t(`severity.${severity}`)
          return (
            <li
              key={st.state}
              data-testid={`state-chip-${st.state}`}
              data-score={st.score.toFixed(2)}
              data-severity={severity}
              className="grid grid-cols-[minmax(0,1fr)_minmax(32px,72px)_auto] items-center gap-2 text-[13px]"
            >
              <span className="min-w-0 text-foreground">{t(`state.${st.state}`)}</span>
              <span
                role="meter"
                aria-label={`${t(`state.${st.state}`)}: ${pct} %, ${level}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn('block h-full rounded-full', BAR_COLOR[severity])}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </span>
              <span
                className={cn(
                  'inline-flex min-w-[88px] items-center justify-end gap-1 text-xs',
                  TEXT_COLOR[severity],
                )}
              >
                <SeverityIcon severity={severity} className="size-3.5" />
                <span>{level}</span>
              </span>
              {st.confidence < lowConfidence && (
                <span className="col-span-3 -mt-1 text-[11px] text-muted-foreground">
                  {t('cockpit.lowConfidenceNote', { pct: Math.round(st.confidence * 100) })}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
})
