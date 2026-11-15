// Kokpit sağ sütun: Earth link özeti. Tek yön gecikme, gidiş-dönüş + yer işlemi, bağlantı durumu, kuyruk,
// "Earth is seeing data from …" ve küçük downlink akışı (In flight / Delivered). Kararlar gemide verilir.
import { memo } from 'react'
import { useT } from '@/ui/i18n'
import { useEarthLinkStore, useSessionStore } from '@/ui/store'
import { SectionCard } from './SectionCard'
import { SeverityIcon } from './SeverityIcon'

function Row({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-[13px] text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

/** Aynı görev günündeyse yalnız "ss:dd", değilse "D+ggg ss:dd". */
export function shortClock(t: number, now: number, fmt: (ms: number) => string): string {
  const full = fmt(t).replace('MET ', '')
  return full.slice(0, 6) === fmt(now).replace('MET ', '').slice(0, 6) ? full.slice(-5) : full
}

export function useDelayFormatter() {
  const { t, formatNumber } = useT()
  return (sec: number): string =>
    sec < 60
      ? t('presenter.delay.seconds', { value: formatNumber(sec, 1) })
      : t('presenter.delay.minutes', { value: formatNumber(sec / 60, 0) })
}

export const EarthLinkSummary = memo(function EarthLinkSummary() {
  const { t, formatNumber, formatMissionClock } = useT()
  const formatDelay = useDelayFormatter()
  const simT = useSessionStore((s) => s.simT)
  const config = useEarthLinkStore((s) => s.config)
  const roundTripMin = useEarthLinkStore((s) => s.roundTripMin)
  const outbox = useEarthLinkStore((s) => s.outbox)
  const pendingReplyCount = useEarthLinkStore((s) => s.pendingReplyCount)
  const nextReplyEtaSec = useEarthLinkStore((s) => s.nextReplyEtaSec)

  const queued = outbox.filter((m) => m.status === 'QUEUED').length
  const inFlight = outbox.filter((m) => m.status === 'IN_FLIGHT').length
  const delivered = outbox.filter((m) => m.status === 'DELIVERED').length
  const earthSeesT = simT - config.oneWayDelaySec * 1000

  return (
    <SectionCard
      title={t('earthSummary.title')}
      tooltip={t('earthSummary.tooltip')}
      provenanceId="earth.groundProcessingMin"
    >
      <dl className="divide-y divide-border" data-testid="earth-link-summary">
        <Row
          label={t('earthSummary.status')}
          value={
            <span className="inline-flex items-center gap-1 font-sans">
              <SeverityIcon
                severity={config.blackout ? 'CRITICAL' : 'NOMINAL'}
                className="size-3.5"
              />
              {config.blackout ? t('earthSummary.blackout') : t('earthSummary.nominal')}
            </span>
          }
        />
        <Row label={t('earthSummary.oneWay')} value={formatDelay(config.oneWayDelaySec)} />
        <Row
          label={t('earthSummary.roundTrip')}
          value={
            Number.isFinite(roundTripMin)
              ? t('presenter.delay.minutes', { value: formatNumber(roundTripMin, 0) })
              : '—'
          }
        />
        <Row
          label={t('earthSummary.earthSees')}
          testId="earth-sees-row"
          value={
            <span className="font-sans whitespace-nowrap">
              {config.blackout
                ? t('earthSummary.noDownlink')
                : t('earthSummary.earthSeesValue', {
                    time: shortClock(Math.max(earthSeesT, 0), simT, formatMissionClock),
                    ago: formatDelay(config.oneWayDelaySec),
                  })}
            </span>
          }
        />
        <Row label={t('earthSummary.queue')} value={queued} />
        <Row
          label={t('earthSummary.downlink')}
          value={
            <span className="inline-flex gap-3">
              <span>
                <span className="font-sans text-xs text-muted-foreground">
                  {t('earthSummary.inFlight')}{' '}
                </span>
                {inFlight}
              </span>
              <span>
                <span className="font-sans text-xs text-muted-foreground">
                  {t('earthSummary.delivered')}{' '}
                </span>
                {delivered}
              </span>
            </span>
          }
        />
        {pendingReplyCount > 0 && (
          <Row
            label={t('earthSummary.pendingReplies', { count: pendingReplyCount })}
            value={nextReplyEtaSec !== null ? formatDelay(nextReplyEtaSec) : '—'}
          />
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{t('earthSummary.onboardNote')}</p>
    </SectionCard>
  )
})
