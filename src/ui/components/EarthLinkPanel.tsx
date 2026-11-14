// FAZ 10 §3.2 — Paylaşılan Earth Link Paneli (Kokpit sağ sütunu compact + /ground tam görünüm).
import { Clock, Inbox, Lock, Radio, Send, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { EarthLinkPreset } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'
import {
  actions,
  selectPriorityCards,
  useDecisionStore,
  useEarthLinkStore,
} from '@/ui/store'
import { CONSENT_CATEGORIES, type ConsentCategory } from '@/workers/protocol'
import { SectionCard } from './SectionCard'

const EARTH_PRESETS: readonly EarthLinkPreset[] = ['MOON', 'MARS_MIN', 'MARS_MAX']

function formatCountdownSec(totalSec: number | null): string {
  if (totalSec === null || !Number.isFinite(totalSec)) return '—'
  const s = Math.max(0, Math.round(totalSec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function EarthLinkPanel({ compact = false }: { compact?: boolean }) {
  const { t, formatNumber, formatMissionClock } = useT()
  const earthLink = useEarthLinkStore()
  const cards = useDecisionStore((s) => s.cards)

  const localAdviceCards = selectPriorityCards({ cards }, undefined, 2).filter(
    (c) => c.earthDelayClass === 'ACT_NOW' || c.earthDelayClass === 'ACT_THEN_REPORT',
  )

  const toggleConsent = (cat: ConsentCategory) => {
    const exists = earthLink.consents.includes(cat)
    const next = exists
      ? earthLink.consents.filter((c) => c !== cat)
      : [...earthLink.consents, cat]
    actions.setConsentCategories(next)
  }

  const packetPreviewObj = {
    schema: 'earthlink.v1',
    oneWayDelaySec: earthLink.config.oneWayDelaySec,
    blackout: earthLink.config.blackout,
    consents: earthLink.consents,
    privacy: 'journal_entries_excluded',
    queuedCount: earthLink.outbox.filter((m) => m.status === 'QUEUED').length,
    samplePayload: earthLink.outbox[0]?.payload ?? { status: 'nominal_summary' },
  }

  return (
    <SectionCard
      title={t('earth.cardTitle')}
      subtitle={t('earth.cardSubtitle')}
      provenanceId="earth.groundProcessingMin"
      rightSlot={
        earthLink.config.blackout ? (
          <span
            data-testid="earth-link-down-badge"
            className="inline-flex items-center gap-1 rounded bg-status-critical/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-status-critical"
          >
            <ShieldAlert aria-hidden="true" className="size-3" />
            <span>{t('earth.linkDown')}</span>
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3 text-xs">
        {/* Gecikme Ön Ayarları */}
        <div className="flex flex-wrap items-center gap-1">
          {EARTH_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => actions.setEarthLinkPreset(preset)}
              aria-pressed={earthLink.config.preset === preset}
              data-testid={`earth-preset-${preset}`}
              className={cn(
                'rounded border px-2 py-1 font-mono text-[11px] transition-colors',
                earthLink.config.preset === preset
                  ? 'border-primary bg-primary/15 font-semibold text-primary'
                  : 'border-border/70 bg-background/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`earth.preset.${preset}`)}
            </button>
          ))}
        </div>

        {/* Özel Gecikme Kaydırıcısı (1 sn – 1800 sn / 30 dk) + Kesinti Anahtarı */}
        {!compact && (
          <div className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{t('earth.customDelay')}</span>
              <span className="font-mono text-xs font-semibold tabular-nums">
                {earthLink.config.oneWayDelaySec < 60
                  ? `${earthLink.config.oneWayDelaySec} s`
                  : `${formatNumber(earthLink.config.oneWayDelaySec / 60, 1)} min`}
              </span>
            </div>
            <Slider
              aria-label={t('earth.customDelay')}
              data-testid="earth-delay-slider"
              min={1}
              max={1800}
              step={10}
              value={[earthLink.config.oneWayDelaySec]}
              onValueChange={(vals) => {
                const val = vals[0]
                if (typeof val === 'number') {
                  actions.setEarthLinkCustomDelay(val)
                }
              }}
            />
            <div className="flex items-center justify-between pt-1">
              <label
                htmlFor="earth-blackout-switch"
                className="text-[11px] font-medium text-foreground"
              >
                {t('earth.blackoutToggle')}
              </label>
              <Switch
                id="earth-blackout-switch"
                data-testid="earth-blackout-switch"
                checked={earthLink.config.blackout}
                onCheckedChange={(checked) => actions.setEarthLinkBlackout(checked)}
              />
            </div>
          </div>
        )}

        {/* Tek yön / Gidiş-dönüş kutuları */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/70 bg-background/60 p-2">
            <div className="text-[10px] text-muted-foreground">{t('earth.oneWay')}</div>
            <div
              data-testid="earth-oneway-value"
              className="mt-0.5 font-mono text-sm font-bold text-foreground tabular-nums"
            >
              {earthLink.config.oneWayDelaySec < 60
                ? `${earthLink.config.oneWayDelaySec} s`
                : `${formatNumber(earthLink.config.oneWayDelaySec / 60, 1)} min`}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/60 p-2">
            <div className="text-[10px] text-muted-foreground">{t('earth.roundTrip')}</div>
            <div
              data-testid="earth-roundtrip-value"
              className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums"
            >
              {Number.isFinite(earthLink.roundTripMin)
                ? `${formatNumber(earthLink.roundTripMin, 1)} min`
                : '∞ (Blackout)'}
            </div>
          </div>
        </div>

        {/* Bekleyen Cevap Sayacı (Hero) */}
        <div
          data-testid="earth-link-counter-box"
          className={cn(
            'space-y-1.5 rounded-lg border p-2.5 font-mono text-xs tabular-nums',
            earthLink.config.blackout
              ? 'border-status-critical/60 bg-status-critical/10 text-status-critical'
              : earthLink.pendingReplyCount > 0
                ? 'border-status-warning/50 bg-status-warning/15 text-status-warning'
                : 'border-border/70 bg-background/60 text-muted-foreground',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {earthLink.pendingReplyCount > 0 ? (
                <Clock aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <Radio aria-hidden="true" className="size-4 shrink-0 text-primary" />
              )}
              <span>
                {earthLink.pendingReplyCount > 0
                  ? t('earth.replyEta', {
                      eta: formatCountdownSec(earthLink.nextReplyEtaSec),
                    })
                  : t('earth.noPendingReply')}
              </span>
            </div>
            {earthLink.pendingReplyCount > 0 && (
              <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-[10px] font-bold">
                {earthLink.pendingReplyCount}
              </span>
            )}
          </div>

          {localAdviceCards.length > 0 && (
            <div className="border-t border-current/20 pt-1.5 font-sans text-[11px]">
              <span className="font-semibold">{t('earth.meanwhileAdvises')} </span>
              <span>
                {localAdviceCards
                  .map((c) => t(c.titleKey as Parameters<typeof t>[0]))
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Dünya Yanıtı Ulaştı Bildirimi */}
        {earthLink.lastReplyReceivedToast && (
          <div
            role="status"
            data-testid="earth-reply-received-toast"
            className="flex items-center justify-between gap-2 rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary"
          >
            <span>
              {t('earth.replyReceivedToast')}:{' '}
              {t(`ground.reply.${earthLink.lastReplyReceivedToast.templateId}.title` as Parameters<typeof t>[0])}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label="Dismiss"
              onClick={() => actions.dismissReplyToast()}
            >
              <X aria-hidden="true" className="size-3" />
            </Button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {t('earth.triageRule', {
            rt: Number.isFinite(earthLink.roundTripMin)
              ? formatNumber(earthLink.roundTripMin, 0)
              : '∞',
          })}
        </p>

        {/* Tam görünüm: Giden/Gelen Kutusu, Onay Anahtarları ve Paket Önizleme */}
        {!compact && (
          <>
            {/* Gizlilik Etiketi */}
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary">
              <Lock aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{t('earth.privacyNotice')}</span>
            </div>

            {/* Onay Kategorileri */}
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
              <div className="font-semibold text-foreground">{t('earth.consentTitle')}</div>
              <div className="grid grid-cols-2 gap-2">
                {CONSENT_CATEGORIES.map((cat) => {
                  const enabled = earthLink.consents.includes(cat)
                  return (
                    <label
                      key={cat}
                      className="flex items-center justify-between gap-2 rounded border border-border/50 px-2 py-1 text-[11px]"
                    >
                      <span>{t(`earth.consent.${cat}`)}</span>
                      <Switch
                        data-testid={`consent-switch-${cat}`}
                        checked={enabled}
                        onCheckedChange={() => toggleConsent(cat)}
                      />
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Giden / Gelen Kutusu */}
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
                  <Send aria-hidden="true" className="size-3.5 text-primary" />
                  <span>{t('earth.outboxTitle')}</span>
                </div>
                {earthLink.outbox.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t('earth.emptyQueue')}</p>
                ) : (
                  <ul className="space-y-1" data-testid="earth-outbox-list">
                    {earthLink.outbox.slice(0, 5).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-1 rounded border border-border/50 px-2 py-1 font-mono text-[10px]"
                      >
                        <span className="truncate">
                          P{m.priority} · {m.category}
                        </span>
                        <span className="shrink-0 font-semibold text-primary">
                          {m.status}
                          {m.arriveT !== undefined ? ` @ ${formatMissionClock(m.arriveT)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
                  <Inbox aria-hidden="true" className="size-3.5 text-primary" />
                  <span>{t('earth.inboxTitle')}</span>
                </div>
                {earthLink.inbox.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{t('earth.emptyQueue')}</p>
                ) : (
                  <ul className="space-y-1" data-testid="earth-inbox-list">
                    {earthLink.inbox.slice(0, 5).map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-1 rounded border border-border/50 px-2 py-1 font-mono text-[10px]"
                      >
                        <span className="truncate">
                          {String((m.payload as { templateId?: string } | null)?.templateId ?? m.id)}
                        </span>
                        <span className="shrink-0 font-semibold text-primary">
                          {m.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Paket Önizleme (JSON) */}
            <details className="rounded-lg border border-border/70 bg-background/60 p-2">
              <summary className="cursor-pointer font-mono text-[11px] font-semibold text-muted-foreground">
                {t('earth.packetPreview')}
              </summary>
              <pre
                data-testid="earth-packet-preview"
                className="mt-2 max-h-36 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-foreground"
              >
                {JSON.stringify(packetPreviewObj, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </SectionCard>
  )
}
