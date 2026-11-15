// Earth view (/ground): Görev Kontrol'ün gördüğü — gemiden gecikmeli gelen veri. Görünüm YALNIZCA motorun
// groundMirror anlık görüntüsünden çizilir; motor bunu henüz göndermiyorsa ayna gizlenir ve tek gri satır kalır
// (UI veri üretmez). Yanıt formu, Earth Link kuyruğu ve isteğe bağlı yer istasyonu WS paneli korunur.
import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EarthLinkPanel } from '@/ui/components/EarthLinkPanel'
import { useDelayFormatter } from '@/ui/components/EarthLinkSummary'
import { GroundMirrorView } from '@/ui/components/GroundMirrorView'
import { GroundStationPanel } from '@/ui/components/GroundStationPanel'
import { SectionCard } from '@/ui/components/SectionCard'
import { useT } from '@/ui/i18n'
import {
  actions,
  GROUND_REPLY_TEMPLATE_IDS,
  useEarthLinkStore,
  useSessionStore,
  type GroundReplyTemplateId,
} from '@/ui/store'

export function GroundPage() {
  const { t, formatMissionClock } = useT()
  const formatDelay = useDelayFormatter()
  const simT = useSessionStore((s) => s.simT)
  const config = useEarthLinkStore((s) => s.config)
  const mirror = useEarthLinkStore((s) => s.groundMirror)

  const [templateId, setTemplateId] = useState<GroundReplyTemplateId>('REPLY_GENERIC_ACK')
  const [replySent, setReplySent] = useState(false)

  // Yer tarafının gördüğü en yeni an: motor aynası varsa onun zamanı, yoksa ışık gecikmesiyle hesaplanan an.
  const asOfT = mirror ? mirror.asOfT : Math.max(0, simT - config.oneWayDelaySec * 1000)
  const behindSec = Math.max(0, (simT - asOfT) / 1000)

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    actions.sendGroundReply(templateId, mirror?.alerts[0]?.id)
    setReplySent(true)
  }

  return (
    <div className="space-y-3" data-testid="ground-page">
      <h1 className="text-base font-medium text-foreground">{t('earthView.pageTitle')}</h1>

      <div
        role="note"
        data-testid="ground-contrast-banner"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
      >
        <span className="font-medium text-foreground">{t('earthView.stripTitle')}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span data-testid="ground-data-age-badge" className="text-muted-foreground tabular-nums">
          {config.blackout
            ? t('earthSummary.noDownlink')
            : t('earthView.stripAge', {
                time: formatMissionClock(asOfT).replace('MET ', ''),
                behind: formatDelay(behindSec),
              })}
        </span>
      </div>

      {mirror ? (
        <GroundMirrorView mirror={mirror} />
      ) : (
        <p className="text-xs text-muted-foreground" data-testid="ground-mirror-empty">
          {t('earthView.mirrorUnavailable')}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <SectionCard title={t('ground.replyFormTitle')} tooltip={t('earthSummary.onboardNote')}>
            <form onSubmit={handleSendReply} className="space-y-3 text-[13px]">
              <div className="space-y-1.5">
                <label htmlFor="ground-reply-select" className="text-xs text-muted-foreground">
                  {t('ground.replyTemplateLabel')}
                </label>
                <Select
                  value={templateId}
                  onValueChange={(v) => {
                    setTemplateId(v as GroundReplyTemplateId)
                    setReplySent(false)
                  }}
                >
                  <SelectTrigger
                    id="ground-reply-select"
                    className="w-full"
                    data-testid="ground-reply-select"
                  >
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
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  data-testid="ground-reply-send-btn"
                >
                  <Send aria-hidden="true" className="size-3.5" />
                  <span>{t('ground.replySend')}</span>
                </Button>
                {replySent && (
                  <span
                    data-testid="ground-reply-sent-note"
                    role="status"
                    className="text-xs text-muted-foreground"
                  >
                    {t('ground.replySentNote')}
                  </span>
                )}
              </div>
            </form>
          </SectionCard>
          <GroundStationPanel />
        </div>
        <div className="lg:col-span-7">
          <EarthLinkPanel />
        </div>
      </div>
    </div>
  )
}
