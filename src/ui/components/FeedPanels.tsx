// Kokpit sağ sütun: "Active alerts" ve "Recommended actions". Boş durum: tek satır gri metin.
import { memo } from 'react'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { ActionCard, Alert } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import { actions, getCrewProfile } from '@/ui/store'
import { ProvenanceTag } from './ProvenanceTag'
import { SectionCard } from './SectionCard'
import { SeverityIcon } from './SeverityIcon'
import { EarthDelayBadge } from './StatusBadge'

function CountBadge({ n }: { n: number }) {
  return <span className="font-mono text-xs text-muted-foreground tabular-nums">{n}</span>
}

export const ActiveAlertsPanel = memo(function ActiveAlertsPanel({
  alerts,
}: {
  alerts: readonly Alert[]
}) {
  const { t } = useT()
  return (
    <SectionCard
      title={t('cockpit.activeAlertsTitle')}
      headerRight={
        <>
          <CountBadge n={alerts.length} />
          <Link
            to="/alerts"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('cockpit.viewAll')}
          </Link>
        </>
      }
    >
      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('cockpit.noActiveAlerts')}</p>
      ) : (
        <ul className="divide-y divide-border" data-testid="recent-alerts-list">
          {alerts.map((al) => {
            const crew = getCrewProfile(al.crewId)
            const firstWhy = al.whyKeys[0]
            return (
              <li
                key={al.id}
                data-testid={`alert-item-${al.id}`}
                className="space-y-1 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={al.severity} className="mt-0.5 size-4" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-snug font-medium text-foreground">
                      {t(al.titleKey)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{crew.role}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t(`severity.${al.severity}`)}</span>
                    </div>
                  </div>
                  <EarthDelayBadge delayClass={al.earthDelayClass} />
                </div>
                {firstWhy && (
                  <p className="pl-6 text-xs text-muted-foreground">
                    {t(firstWhy.key, firstWhy.params)}
                  </p>
                )}
                <div className="flex items-center justify-between pl-6">
                  {al.evidenceIds[0] ? <ProvenanceTag evidenceId={al.evidenceIds[0]} /> : <span />}
                  {al.status === 'ACTIVE' ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => actions.ackAlert(al.id)}
                      data-testid={`ack-alert-${al.id}`}
                    >
                      <Check aria-hidden="true" className="size-3" />
                      <span>{t('cockpit.ackAlert')}</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('cockpit.acked')}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
})

export const RecommendedActionsPanel = memo(function RecommendedActionsPanel({
  cards,
}: {
  cards: readonly ActionCard[]
}) {
  const { t } = useT()
  return (
    <SectionCard
      title={t('cockpit.recommendedActionsTitle')}
      headerRight={<CountBadge n={cards.length} />}
    >
      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('cockpit.noActionCards')}</p>
      ) : (
        <ul className="space-y-2" data-testid="priority-cards-list">
          {cards.map((card) => {
            const crew = getCrewProfile(card.crewId)
            return (
              <li
                key={card.id}
                data-testid={`action-card-${card.id}`}
                className={cn(
                  'space-y-1.5 rounded-md border border-border bg-background/40 p-2.5',
                  card.earthDelayClass === 'ACT_NOW' && 'border-status-critical/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] leading-snug font-medium text-foreground">
                      {t(card.titleKey)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {crew.role} · {t(`cockpit.cardState.${card.state}`)}
                    </div>
                  </div>
                  <EarthDelayBadge delayClass={card.earthDelayClass} />
                </div>
                <ol className="list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                  {card.stepKeys.map((sk) => (
                    <li key={sk}>{t(sk)}</li>
                  ))}
                </ol>
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  {card.evidenceIds[0] ? (
                    <ProvenanceTag evidenceId={card.evidenceIds[0]} />
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1">
                    {card.state === 'SUGGESTED' && (
                      <>
                        <Button
                          type="button"
                          size="xs"
                          onClick={() => actions.acceptAction(card.id)}
                          data-testid={`accept-card-${card.id}`}
                        >
                          <Check aria-hidden="true" className="size-3" />
                          <span>{t('cockpit.acceptAction')}</span>
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => actions.dismissAction(card.id)}
                          data-testid={`dismiss-card-${card.id}`}
                        >
                          <X aria-hidden="true" className="size-3" />
                          <span>{t('cockpit.dismissAction')}</span>
                        </Button>
                      </>
                    )}
                    {card.state === 'ACCEPTED' && (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => actions.completeAction(card.id)}
                        data-testid={`complete-card-${card.id}`}
                      >
                        <Check aria-hidden="true" className="size-3" />
                        <span>{t('cockpit.completeAction')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
})
