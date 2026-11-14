// FAZ 9 §3.1 — ProvenanceTag (Kanıt kaynak etiketi).
// Kaynak türü (NASA_STD / NASA_HRP / PEER / CLINICAL / DEMO) + doğrulama (✓ / ⚠).
// Tıklayınca Evidence ayrıntı çekmecesini (Sheet) açar ve /evidence sayfasına bağlantı sunar.
import { CheckCircle2, ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { getEvidence, has, type EvidenceId } from '@/core/evidence/registry'
import type { EvidenceEntry, SourceType, VerificationStatus } from '@/core/types'
import { cn } from '@/lib/utils'
import { useT } from '@/ui/i18n'

export interface ProvenanceTagProps {
  evidenceId?: EvidenceId | (string & {})
  entry?: EvidenceEntry
  sourceType?: SourceType
  verificationStatus?: VerificationStatus
  verified?: boolean
  customLabel?: string
  className?: string
}

const SOURCE_STYLE: Record<SourceType, string> = {
  NASA_STD: 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/25',
  NASA_HRP: 'border-status-info/50 bg-status-info/15 text-status-info hover:bg-status-info/25',
  PEER_REVIEWED:
    'border-emerald-400/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
  CLINICAL_CONVENTION:
    'border-status-advisory/50 bg-status-advisory/15 text-status-advisory hover:bg-status-advisory/25',
  DEMO_PARAMETER:
    'border-muted-foreground/40 bg-muted/60 text-muted-foreground hover:bg-muted',
}

function formatEntryValue(value: number | [number, number]): string {
  return Array.isArray(value) ? `${value[0]}–${value[1]}` : String(value)
}

export function ProvenanceTag({
  evidenceId,
  entry: explicitEntry,
  sourceType: explicitSourceType,
  verificationStatus: explicitStatus,
  verified: explicitVerified,
  customLabel,
  className,
}: ProvenanceTagProps) {
  const { t } = useT()

  const resolvedEntry: EvidenceEntry | undefined =
    explicitEntry ?? (evidenceId && has(evidenceId) ? getEvidence(evidenceId) : undefined)

  const sourceType: SourceType =
    explicitSourceType ?? resolvedEntry?.sourceType ?? 'DEMO_PARAMETER'
  const verificationStatus: VerificationStatus =
    explicitStatus ??
    resolvedEntry?.verificationStatus ??
    (explicitVerified ? 'VERIFIED' : 'UNVERIFIED')
  const isVerified = explicitVerified ?? resolvedEntry?.verified ?? verificationStatus === 'VERIFIED'

  const shortSource = t(`provenance.source.${sourceType}`)
  const statusSymbol = isVerified ? '✓' : '⚠'
  const statusText = t(`provenance.status.${verificationStatus}`)
  const idLabel = resolvedEntry?.id ?? evidenceId ?? sourceType

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid={`provenance-tag-${idLabel}`}
          data-source-type={sourceType}
          data-verified={String(isVerified)}
          aria-label={`${customLabel ? `${customLabel} · ` : ''}${shortSource} ${statusSymbol} (${statusText})`}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            SOURCE_STYLE[sourceType],
            className,
          )}
        >
          <span>{shortSource}</span>
          <span aria-hidden="true" className={isVerified ? 'text-emerald-300' : 'text-status-advisory'}>
            {statusSymbol}
          </span>
          {customLabel && <span className="ml-0.5 font-sans text-[11px]">{customLabel}</span>}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full border-border bg-card sm:max-w-md">
        <SheetHeader className="border-b border-border pb-3">
          <SheetTitle className="flex items-center gap-2 font-mono text-sm text-primary">
            <FileCheck2 aria-hidden="true" className="size-4" />
            <span>{t('provenance.sheetTitle')}</span>
          </SheetTitle>
          <SheetDescription>{t('provenance.sheetDescription')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 py-2 text-xs">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-[11px] text-muted-foreground">{t('provenance.parameterId')}</div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-foreground">{idLabel}</div>
          </div>

          {resolvedEntry && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <div className="text-[11px] text-muted-foreground">{t('provenance.valueUnit')}</div>
                <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatEntryValue(resolvedEntry.value)} {resolvedEntry.unit}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <div className="text-[11px] text-muted-foreground">{t('provenance.sourceType')}</div>
                <div className="mt-0.5 font-mono text-sm font-semibold">{shortSource}</div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-[11px] text-muted-foreground">{t('provenance.verification')}</div>
            <div className="mt-1 flex items-center gap-1.5 font-medium">
              {isVerified ? (
                <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-400" />
              ) : (
                <ShieldAlert aria-hidden="true" className="size-4 text-status-advisory" />
              )}
              <span>
                {verificationStatus} — {statusText}
              </span>
            </div>
          </div>

          {resolvedEntry && (
            <>
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">
                  {t('provenance.sourceTitle')}
                </div>
                <div className="text-foreground">{resolvedEntry.sourceTitle}</div>
              </div>

              {resolvedEntry.scope && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {t('provenance.scope')}
                  </div>
                  <div className="text-foreground">{resolvedEntry.scope}</div>
                </div>
              )}

              {resolvedEntry.note && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {t('provenance.note')}
                  </div>
                  <div className="text-muted-foreground">{resolvedEntry.note}</div>
                </div>
              )}

              {resolvedEntry.sourceUrl && resolvedEntry.sourceUrl !== '—' && (
                <a
                  href={resolvedEntry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                >
                  <span>{t('provenance.openSourceUrl')}</span>
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              )}
            </>
          )}

          <div className="pt-2">
            <Link
              to="/evidence"
              className="inline-flex w-full items-center justify-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
            >
              {t('provenance.viewAllEvidence')}
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
