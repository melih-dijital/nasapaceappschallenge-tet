// Earth view (Mission Control): kokpitin sadeleştirilmiş kopyası, YALNIZCA motorun groundMirror verisiyle.
// Veri yoksa hiçbir şey çizmez (UI veri üretmez). Mürettebat durumu, açık uyarılar, ana seriler.
import { memo } from 'react'
import type { MetricId } from '@/core/types'
import { useT } from '@/ui/i18n'
import { CREW_PROFILES, type GroundMirrorSnapshot } from '@/ui/store'
import { latestKey } from '@/workers/protocol'
import { stateScoreToSeverity } from './CrewStatusPanel'
import { SectionCard } from './SectionCard'
import { SeverityIcon, type DisplaySeverity } from './SeverityIcon'
import { EarthDelayBadge } from './StatusBadge'

const SEVERITY_RANK: Record<DisplaySeverity, number> = {
  NOMINAL: 0,
  INFO: 1,
  ADVISORY: 2,
  WARNING: 3,
  CRITICAL: 4,
}
const MIRROR_SERIES: readonly MetricId[] = ['hr', 'spo2', 'rad.doseRateMsvDay']

export const GroundMirrorView = memo(function GroundMirrorView({
  mirror,
}: {
  mirror: GroundMirrorSnapshot | null
}) {
  const { t, formatNumber } = useT()
  if (!mirror) return null

  return (
    <div className="grid gap-3 lg:grid-cols-12" data-testid="ground-mirror-view">
      <SectionCard title={t('earthView.crewTitle')} className="lg:col-span-4">
        <ul className="space-y-2">
          {CREW_PROFILES.map((c) => {
            const worst = (mirror.states[c.id] ?? []).reduce<DisplaySeverity>((acc, st) => {
              const s = stateScoreToSeverity(st.score, st.state, false)
              return SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc
            }, 'NOMINAL')
            return (
              <li key={c.id} className="flex items-center justify-between text-[13px]">
                <span>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{c.role}</span>
                  {c.displayName}
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <SeverityIcon severity={worst} className="size-3.5" />
                  {t(`severity.${worst}`)}
                </span>
              </li>
            )
          })}
        </ul>
      </SectionCard>
      <SectionCard title={t('earthView.alertsTitle')} className="lg:col-span-4">
        {mirror.alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('cockpit.noActiveAlerts')}</p>
        ) : (
          <ul className="space-y-2">
            {mirror.alerts.map((al) => (
              <li key={al.id} className="flex items-start gap-2 text-[13px]">
                <SeverityIcon severity={al.severity} className="mt-0.5 size-4" />
                <span className="min-w-0 flex-1">{t(al.titleKey)}</span>
                <EarthDelayBadge delayClass={al.earthDelayClass} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title={t('earthView.seriesTitle')} className="lg:col-span-4">
        <dl className="space-y-1.5">
          {CREW_PROFILES.map((c) =>
            MIRROR_SERIES.map((m) => {
              const pts = mirror.series?.[latestKey(c.id, m)]
              const last = pts?.at(-1)
              if (!last) return null
              return (
                <div key={`${c.id}-${m}`} className="flex justify-between text-xs">
                  <dt className="text-muted-foreground">
                    {c.role} · {t(`metric.${m}`)}
                  </dt>
                  <dd className="font-mono tabular-nums">{formatNumber(last.value, 1)}</dd>
                </div>
              )
            }),
          )}
        </dl>
      </SectionCard>
    </div>
  )
})
