// Kaynak ikonu (eski ProvenanceTag rozeti yerine): her eşik/değer yanında küçük BookOpen ikonu.
// Üzerine gelince/odaklanınca tooltip "Threshold: 90 % · Clinical convention · Partial"; tıklayınca Kanıtlar
// sayfasında o kayda gider (/evidence?id=…). Renk yalnızca doğrulama durumunu ima etmez; metin tooltip'te.
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  /** Tooltip'teki değer etiketi (varsayılan "Threshold"). */
  customLabel?: string
  className?: string
}

function formatEntryValue(entry: EvidenceEntry): string {
  const v = Array.isArray(entry.value) ? `${entry.value[0]}–${entry.value[1]}` : String(entry.value)
  return entry.unit ? `${v} ${entry.unit}` : v
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

  const entry: EvidenceEntry | undefined =
    explicitEntry ?? (evidenceId && has(evidenceId) ? getEvidence(evidenceId) : undefined)
  const sourceType: SourceType = explicitSourceType ?? entry?.sourceType ?? 'DEMO_PARAMETER'
  const status: VerificationStatus =
    explicitStatus ?? entry?.verificationStatus ?? (explicitVerified ? 'VERIFIED' : 'UNVERIFIED')
  const isVerified = explicitVerified ?? entry?.verified ?? status === 'VERIFIED'
  const id = entry?.id ?? evidenceId ?? sourceType

  const text = t('provenance.tooltip', {
    label: customLabel ?? t('provenance.thresholdLabel'),
    value: entry ? formatEntryValue(entry) : '—',
    source: t(`provenance.sourceName.${sourceType}`),
    status: t(`provenance.statusShort.${status}`),
  })

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={`/evidence?id=${encodeURIComponent(String(id))}`}
            data-testid={`provenance-tag-${id}`}
            data-source-type={sourceType}
            data-verified={String(isVerified)}
            aria-label={`${text}. ${t('provenance.openInEvidence')}`}
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              className,
            )}
          >
            <BookOpen aria-hidden="true" className="size-3.5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
