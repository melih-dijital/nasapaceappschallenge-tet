// Kanıt kayıt defteri — eşikler YALNIZCA buradan okunur (PROJECT_MEMORY §7). Saf TS, DOM yok.
// Kaynak: evidence.generated.json (npm run evidence:build, docs/sources/*.md'den).
import { z } from 'zod'
import { EvidenceEntrySchema } from '../schema/evidence.schema'
import type { EvidenceEntry, SourceType } from '../types/evidence'
import rawEntries from './evidence.generated.json'
import { EVIDENCE_IDS, type EvidenceId } from './evidenceIds.generated'

export type { EvidenceId } from './evidenceIds.generated'

export class EvidenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvidenceError'
  }
}

const ENTRIES: readonly EvidenceEntry[] = z.array(EvidenceEntrySchema).parse(rawEntries)
const BY_ID: ReadonlyMap<string, EvidenceEntry> = new Map(ENTRIES.map((entry) => [entry.id, entry]))

if (ENTRIES.length !== EVIDENCE_IDS.length || EVIDENCE_IDS.some((id) => !BY_ID.has(id))) {
  throw new EvidenceError(
    'evidence.generated.json ile evidenceIds.generated.ts uyuşmuyor — `npm run evidence:build` çalıştır.',
  )
}

const KNOWN_IDS: ReadonlySet<string> = new Set(EVIDENCE_IDS)

export function has(id: string): id is EvidenceId {
  return KNOWN_IDS.has(id)
}

export function getEvidence(id: EvidenceId): EvidenceEntry {
  const entry = BY_ID.get(id)
  if (!entry) {
    throw new EvidenceError(
      `Bilinmeyen evidence id "${String(id)}" — docs/sources/*.md'ye ekle ve npm run evidence:build çalıştır.`,
    )
  }
  return entry
}

/** Tek sayılık kayıt. Kayıt aralıksa EvidenceError (getRange/getMid kullan). */
export function getNumber(id: EvidenceId): number {
  const { value } = getEvidence(id)
  if (Array.isArray(value)) {
    throw new EvidenceError(
      `"${id}" bir aralık [${value[0]}, ${value[1]}]; getNumber yerine getRange veya getMid kullan.`,
    )
  }
  return value
}

/** Aralık kaydı. Kayıt tek sayıysa EvidenceError (getNumber kullan). */
export function getRange(id: EvidenceId): [number, number] {
  const { value } = getEvidence(id)
  if (!Array.isArray(value)) {
    throw new EvidenceError(`"${id}" tek bir sayı (${value}); getRange yerine getNumber kullan.`)
  }
  return [value[0], value[1]]
}

/** Aralığın orta noktası; tek sayıysa kendisi. */
export function getMid(id: EvidenceId): number {
  const { value } = getEvidence(id)
  return Array.isArray(value) ? (value[0] + value[1]) / 2 : value
}

/** Tüm kayıtlar, id'ye göre sıralı. */
export function all(): readonly EvidenceEntry[] {
  return ENTRIES
}

export function byType(sourceType: SourceType): EvidenceEntry[] {
  return ENTRIES.filter((entry) => entry.sourceType === sourceType)
}

/** verified === false olan kayıtlar (PARTIAL, CONFLICTING, UNVERIFIED). */
export function unverified(): EvidenceEntry[] {
  return ENTRIES.filter((entry) => !entry.verified)
}

/** Motor bileşenlerine enjekte edilen tek nesne (Faz 3 `Engine`, Faz 4 `BaselineEngine`). */
export const registry = {
  getEvidence,
  getNumber,
  getRange,
  getMid,
  has,
  all,
  byType,
  unverified,
} as const

export type EvidenceRegistry = typeof registry
