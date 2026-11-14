// FAZ 10 §3.6 — Dünya Yer İstasyonu Görünümü (/ground):
// YALNIZCA Earth Link'ten ulaşan gecikmeli ve onay kısıtlı veriyi gösterir (anlık vitals/journal asla sızmaz).
import { useState } from 'react'
import { Clock, Lock, Radio, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STATE_IDS } from '@/core/types'
import { EarthLinkPanel } from '@/ui/components/EarthLinkPanel'
import { EmptyState } from '@/ui/components/EmptyState'
import { GroundStationPanel } from '@/ui/components/GroundStationPanel'
import { SectionCard } from '@/ui/components/SectionCard'
import { SeverityIcon } from '@/ui/components/SeverityIcon'
import { EarthDelayBadge, StatusBadge } from '@/ui/components/StatusBadge'
import { useT } from '@/ui/i18n'
import {
  actions,
  CREW_PROFILES,
  GROUND_REPLY_TEMPLATE_IDS,
  useEarthLinkStore,
  useSessionStore,
  type GroundReplyTemplateId,
} from '@/ui/store'

export function GroundPage() {
  const { t, formatNumber } = useT()
  const simT = useSessionStore((s) => s.simT)
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)

  const consents = useEarthLinkStore((s) => s.consents)
  const groundDeliveredAt = useEarthLinkStore((s) => s.groundDeliveredAt)
  const groundDeliveredStates = useEarthLinkStore((s) => s.groundDeliveredStates)
  const groundDeliveredAlerts = useEarthLinkStore((s) => s.groundDeliveredAlerts)

  const [templateId, setTemplateId] = useState<GroundReplyTemplateId>('REPLY_GENERIC_ACK')
  const [replySent, setReplySent] = useState(false)

  const ageMin =
    groundDeliveredAt !== null ? Math.max(0, (simT - groundDeliveredAt) / 60_000) : null

  const crewStates = groundDeliveredStates[selectedCrewId]
  const vitalsAllowed = consents.includes('VITALS_SUMMARY')
  const alertsAllowed = consents.includes('ALERTS') || consents.includes('RADIATION')

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    actions.sendGroundReply(templateId, groundDeliveredAlerts[0]?.id)
    setReplySent(true)
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="ground-page">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {t('ground.pageTitle')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('ground.pageSubtitle')}</p>
      </div>

      {/* Karşıtlık ve Gecikme Etiketi */}
      <div
        role="note"
        data-testid="ground-contrast-banner"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs"
      >
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Radio aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('ground.contrastBanner')}</span>
        </div>
        <span
          data-testid="ground-data-age-badge"
          className="inline-flex items-center gap-1.5 rounded bg-background/80 px-2.5 py-1 font-mono text-[11px] text-foreground"
        >
          <Clock aria-hidden="true" className="size-3.5 text-primary" />
          <span>
            {ageMin !== null
              ? t('ground.dataAge', { age: `${formatNumber(ageMin, 1)} min` })
              : t('ground.noDataYet')}
          </span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Sol: Gecikmeli & Onay Kısıtlı Yer Verisi */}
        <div className="space-y-4 lg:col-span-7">
          {/* Ulaşan Uyarı Paketleri */}
          <SectionCard
            title={`${t('earth.consent.ALERTS')} (${groundDeliveredAlerts.length})`}
            rightSlot={
              !alertsAllowed ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-status-warning">
                  <Lock aria-hidden="true" className="size-3" />
                  <span>Consent Restricted</span>
                </span>
              ) : undefined
            }
          >
            {!alertsAllowed ? (
              <EmptyState title="Alert telemetry sharing is disabled by crew consent." />
            ) : groundDeliveredAlerts.length === 0 ? (
              <EmptyState title={t('ground.noDataYet')} />
            ) : (
              <div className="space-y-2" data-testid="ground-delivered-alerts">
                {groundDeliveredAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <SeverityIcon severity={al.severity} />
                      <div>
                        <div className="font-semibold">
                          {t(al.titleKey as Parameters<typeof t>[0])}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {al.crewId.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <EarthDelayBadge earthDelayClass={al.earthDelayClass} />
                      <StatusBadge severity={al.severity} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Ulaşan Son Durum Özetleri */}
          <SectionCard
            title={`${t('earth.consent.VITALS_SUMMARY')} — ${selectedCrewId.toUpperCase()}`}
          >
            {!vitalsAllowed ? (
              <EmptyState title="Vitals summary sharing is disabled by crew consent." />
            ) : groundDeliveredAt === null || !crewStates ? (
              <EmptyState title={t('ground.noDataYet')} />
            ) : (
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                data-testid="ground-delivered-states"
              >
                {STATE_IDS.map((sid) => {
                  const st = crewStates[sid]
                  if (!st) return null
                  return (
                    <div
                      key={sid}
                      className="rounded-lg border border-border/70 bg-background/60 p-2 text-xs"
                    >
                      <div className="truncate font-semibold">{t(`state.${sid}`)}</div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums">
                        {Math.round(st.score * 100)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Yer Desteği Yanıt Formu */}
          <SectionCard title={t('ground.replyFormTitle')}>
            <form onSubmit={handleSendReply} className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">
                  {t('ground.replyTemplateLabel')}
                </label>
                <Select
                  value={templateId}
                  onValueChange={(v) => {
                    setTemplateId(v as GroundReplyTemplateId)
                    setReplySent(false)
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="ground-reply-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUND_REPLY_TEMPLATE_IDS.map((tpl) => (
                      <SelectItem key={tpl} value={tpl}>
                        {t(`ground.reply.${tpl}.title`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="submit" size="sm" data-testid="ground-reply-send-btn">
                  <Send aria-hidden="true" className="size-3.5" />
                  <span>{t('ground.replySend')}</span>
                </Button>
                {replySent && (
                  <span
                    data-testid="ground-reply-sent-note"
                    className="font-mono text-[11px] text-primary"
                  >
                    ✓ {t('ground.replySentNote')}
                  </span>
                )}
              </div>
            </form>
          </SectionCard>
        </div>

        {/* Sağ: Tam Earth Link Kontrol & Kuyruk Paneli + İsteğe Bağlı Ground Station WS */}
        <div className="space-y-4 lg:col-span-5">
          <EarthLinkPanel />
          <GroundStationPanel />
          <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-[11px] text-muted-foreground">
            Crew directory on ground manifest: {CREW_PROFILES.map((c) => c.code).join(' · ')}
          </div>
        </div>
      </div>
    </div>
  )
}
