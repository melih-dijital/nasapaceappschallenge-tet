// FAZ 10 §3.4 — Kanıt Kayıt Defteri Sayfası (/evidence):
// Tüm EvidenceEntry tablosu, filtre/arama/sıralama, dürüstlük bandı, radyasyon hedefleri ve kalibrasyon provenance.
import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpDown, CheckCircle2, ExternalLink, Search, ShieldAlert } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { all as getAllEvidence, getEvidence } from '@/core/evidence/registry'
import { SOURCE_TYPES, type EvidenceEntry, type SourceType } from '@/core/types'
import { cn } from '@/lib/utils'
import { ProvenanceTag } from '@/ui/components/ProvenanceTag'
import { SectionCard } from '@/ui/components/SectionCard'
import { useT } from '@/ui/i18n'

type SortField = 'id' | 'sourceType' | 'verified'

function formatEvidenceValue(entry: EvidenceEntry): string {
  const val = Array.isArray(entry.value) ? `${entry.value[0]}–${entry.value[1]}` : String(entry.value)
  return entry.unit ? `${val} ${entry.unit}` : val
}

const CALIBRATION_PROVENANCE_ROWS = [
  { metric: 'hr', sourceType: 'DEMO_PARAMETER' as const, note: 'Resting & circadian baseline generator' },
  { metric: 'spo2', sourceType: 'DEMO_PARAMETER' as const, note: 'Nominal O2 saturation band' },
  { metric: 'hrv', sourceType: 'DEMO_PARAMETER' as const, note: 'RMSSD variability proxy' },
  { metric: 'sleep.durationH', sourceType: 'DEMO_PARAMETER' as const, note: 'Crew sleep window & debt model' },
  { metric: 'rad.doseRateMsvDay', sourceType: 'NASA_STD' as const, note: 'GCR + SPE curve anchored to ISS/transit references' },
] as const

export function EvidencePage() {
  const { t } = useT()
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('id') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'ALL'>('ALL')
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortAsc, setSortAsc] = useState(true)

  const entries = useMemo(() => getAllEvidence(), [])

  const counts = useMemo(() => {
    let nasaStd = 0
    let nasaHrp = 0
    let peer = 0
    let demo = 0
    for (const e of entries) {
      if (e.sourceType === 'NASA_STD') nasaStd++
      else if (e.sourceType === 'NASA_HRP') nasaHrp++
      else if (e.sourceType === 'PEER_REVIEWED') peer++
      else if (e.sourceType === 'DEMO_PARAMETER') demo++
    }
    return { total: entries.length, nasaStd, nasaHrp, peer, demo }
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = entries.filter((e) => {
      if (sourceFilter !== 'ALL' && e.sourceType !== sourceFilter) return false
      if (unverifiedOnly && e.verified) return false
      if (!q) return true
      return (
        e.id.toLowerCase().includes(q) ||
        e.sourceTitle.toLowerCase().includes(q) ||
        (e.note ?? '').toLowerCase().includes(q)
      )
    })

    return [...list].sort((a, b) => {
      const cmp =
        sortField === 'id'
          ? a.id.localeCompare(b.id)
          : sortField === 'sourceType'
            ? a.sourceType.localeCompare(b.sourceType)
            : Number(b.verified) - Number(a.verified)
      return sortAsc ? cmp : -cmp
    })
  }, [entries, query, sourceFilter, unverifiedOnly, sortField, sortAsc])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((v) => !v)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const radCareer = getEvidence('rad.career.limit.msv')
  const radSpe = getEvidence('rad.spe.limit.msv')
  const radIss = getEvidence('rad.iss.rate.msv_day')

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="evidence-page">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {t('evidence.pageTitle')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('evidence.pageSubtitle')}</p>
      </div>

      {/* Dürüstlük Bandı + Özet Sayılar */}
      <div
        role="note"
        data-testid="evidence-honesty-banner"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-warning/50 bg-status-warning/10 px-4 py-3 text-xs"
      >
        <div className="flex items-center gap-2 font-semibold text-status-warning">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>{t('evidence.honestyBanner')}</span>
        </div>
        <span data-testid="evidence-summary-counts" className="font-mono text-[11px] text-foreground">
          {t('evidence.summaryCounts', counts)}
        </span>
      </div>

      {/* Radyasyon Limitleri / Hedefleri & Kalibrasyon Provenance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('evidence.radCardTitle')}>
          <div className="space-y-2.5 text-xs">
            {[
              { label: t('evidence.radCareer'), entry: radCareer },
              { label: t('evidence.radSpe'), entry: radSpe },
              { label: t('evidence.radIss'), entry: radIss },
            ].map((item) => (
              <div
                key={item.entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 p-2.5"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground">{item.label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {formatEvidenceValue(item.entry)} · {item.entry.sourceTitle}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ProvenanceTag evidenceId={item.entry.id} />
                  {item.entry.sourceUrl && item.entry.sourceUrl !== '—' && (
                    <a
                      href={item.entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary underline"
                    >
                      <span>Link</span>
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={t('evidence.calCardTitle')}
          subtitle={t('evidence.calNote')}
        >
          <div className="space-y-1.5 text-xs">
            {CALIBRATION_PROVENANCE_ROWS.map((row) => (
              <div
                key={row.metric}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2"
              >
                <div>
                  <span className="font-mono font-semibold text-foreground">{row.metric}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">{row.note}</span>
                </div>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                    row.sourceType === 'DEMO_PARAMETER'
                      ? 'bg-status-warning/20 text-status-warning'
                      : 'bg-primary/20 text-primary',
                  )}
                >
                  {row.sourceType}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Filtreler & Tam Tablo */}
      <SectionCard title={`${t('nav.evidence')} (${filtered.length})`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('evidence.searchPlaceholder')}
              aria-label={t('evidence.searchPlaceholder')}
              data-testid="evidence-search-input"
              className="w-full rounded-lg border border-border/80 bg-background py-1.5 pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant={sourceFilter === 'ALL' ? 'secondary' : 'ghost'}
              onClick={() => setSourceFilter('ALL')}
              data-testid="evidence-filter-ALL"
            >
              {t('evidence.filterAll')}
            </Button>
            {SOURCE_TYPES.map((st) => (
              <Button
                key={st}
                type="button"
                size="xs"
                variant={sourceFilter === st ? 'secondary' : 'ghost'}
                onClick={() => setSourceFilter(st)}
                data-testid={`evidence-filter-${st}`}
              >
                {st}
              </Button>
            ))}
            <Button
              type="button"
              size="xs"
              variant={unverifiedOnly ? 'destructive' : 'outline'}
              onClick={() => setUnverifiedOnly((v) => !v)}
              data-testid="evidence-filter-unverified"
            >
              {t('evidence.filterUnverified')}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full border-collapse text-left text-xs" data-testid="evidence-table">
            <thead className="bg-secondary/60 font-mono text-[11px] text-muted-foreground">
              <tr>
                <th className="p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <span>{t('evidence.colId')}</span>
                    <ArrowUpDown aria-hidden="true" className="size-3" />
                  </button>
                </th>
                <th className="p-2.5">{t('evidence.colValue')}</th>
                <th className="p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('sourceType')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <span>{t('evidence.colType')}</span>
                    <ArrowUpDown aria-hidden="true" className="size-3" />
                  </button>
                </th>
                <th className="p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('verified')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <span>{t('evidence.colStatus')}</span>
                    <ArrowUpDown aria-hidden="true" className="size-3" />
                  </button>
                </th>
                <th className="p-2.5">{t('evidence.colSource')}</th>
                <th className="p-2.5">{t('evidence.colNote')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  data-testid={`evidence-row-${entry.id}`}
                  className="hover:bg-secondary/20"
                >
                  <td className="p-2.5 font-mono text-[11px] font-semibold text-foreground">
                    {entry.id}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] tabular-nums">
                    {formatEvidenceValue(entry)}
                  </td>
                  <td className="p-2.5">
                    <ProvenanceTag evidenceId={entry.id} />
                  </td>
                  <td className="p-2.5">
                    {entry.verified ? (
                      <span
                        data-testid={`evidence-verified-${entry.id}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-primary"
                      >
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                        <span>✓</span>
                      </span>
                    ) : (
                      <span
                        data-testid={`evidence-unverified-${entry.id}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-status-warning"
                      >
                        <ShieldAlert aria-hidden="true" className="size-3.5" />
                        <span>⚠ {entry.verificationStatus}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-[11px]">
                    {entry.sourceUrl && entry.sourceUrl !== '—' ? (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                      >
                        <span>{entry.sourceTitle}</span>
                        <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{entry.sourceTitle}</span>
                    )}
                  </td>
                  <td className="max-w-xs p-2.5 text-[11px] text-muted-foreground">{entry.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
