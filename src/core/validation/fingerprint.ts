// Saf JS FNV-1a parmak izi ve geçici parametre geçersiz kılma sarmalayıcısı (FAZ_08 §3.1, §3.3).
// `node:crypto` KULLANMAZ — tarayıcı Worker ve Node ortamında deterministik çalışır.
import {
  EvidenceError,
  registry as defaultRegistry,
  type EvidenceId,
  type EvidenceRegistry,
} from '../evidence/registry'
import type { EvidenceEntry, SourceType } from '../types/evidence'

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n
const FNV_PRIME_64 = 0x100000001b3n
const FNV_MASK_64 = 0xffffffffffffffffn

/** Saf JS 64-bit FNV-1a hex özeti (16 karakter). */
export function fnv1aHex(input: string): string {
  let hash = FNV_OFFSET_BASIS_64
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    hash ^= BigInt(code & 0xff)
    hash = (hash * FNV_PRIME_64) & FNV_MASK_64
    if (code > 0xff) {
      hash ^= BigInt((code >> 8) & 0xff)
      hash = (hash * FNV_PRIME_64) & FNV_MASK_64
    }
  }
  return hash.toString(16).padStart(16, '0')
}

function formatEntryValue(value: number | [number, number]): string {
  return Array.isArray(value) ? `[${value[0]},${value[1]}]` : String(value)
}

/**
 * Tüm DEMO_PARAMETER kayıtlarının sıralı deterministik FNV-1a özeti.
 * Herhangi bir DEMO parametresi değiştiğinde farklı parmak izi üretir.
 */
export function computeEvidenceFingerprint(evidence: EvidenceRegistry = defaultRegistry): string {
  const demoEntries = [...evidence.byType('DEMO_PARAMETER')].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const payload = demoEntries
    .map((entry) => `${entry.id}=${formatEntryValue(entry.value)}|${entry.unit}`)
    .join('\n')
  return `fnv1a-${fnv1aHex(payload)}`
}

export type ParameterOverrides = Readonly<Record<string, number | [number, number]>>

/**
 * Duyarlılık analizi / geçici koşular için kalıcı kayıt defterini bozmayan sarmalayıcı.
 * Bilinmeyen evidence id verilirse EvidenceError fırlatır.
 */
export function createOverrideRegistry(
  base: EvidenceRegistry = defaultRegistry,
  overrides?: ParameterOverrides,
): EvidenceRegistry {
  if (!overrides || Object.keys(overrides).length === 0) {
    return base
  }

  for (const key of Object.keys(overrides)) {
    if (!base.has(key)) {
      throw new EvidenceError(`Bilinmeyen evidence geçersiz kılma anahtarı: "${key}".`)
    }
  }

  const patchEntry = (entry: EvidenceEntry): EvidenceEntry => {
    const nextValue = overrides[entry.id]
    if (nextValue === undefined) return entry
    return {
      ...entry,
      value: Array.isArray(nextValue) ? [nextValue[0], nextValue[1]] : nextValue,
    }
  }

  const getEvidence = (id: EvidenceId): EvidenceEntry => patchEntry(base.getEvidence(id))

  const getNumber = (id: EvidenceId): number => {
    const { value } = getEvidence(id)
    if (Array.isArray(value)) {
      throw new EvidenceError(
        `"${id}" bir aralık [${value[0]}, ${value[1]}]; getNumber yerine getRange veya getMid kullan.`,
      )
    }
    return value
  }

  const getRange = (id: EvidenceId): [number, number] => {
    const { value } = getEvidence(id)
    if (!Array.isArray(value)) {
      throw new EvidenceError(`"${id}" tek bir sayı (${value}); getRange yerine getNumber kullan.`)
    }
    return [value[0], value[1]]
  }

  const getMid = (id: EvidenceId): number => {
    const { value } = getEvidence(id)
    return Array.isArray(value) ? (value[0] + value[1]) / 2 : value
  }

  const all = (): readonly EvidenceEntry[] => base.all().map(patchEntry)
  const byType = (sourceType: SourceType): EvidenceEntry[] => base.byType(sourceType).map(patchEntry)
  const unverified = (): EvidenceEntry[] => base.unverified().map(patchEntry)

  return {
    getEvidence,
    getNumber,
    getRange,
    getMid,
    has: base.has,
    all,
    byType,
    unverified,
  }
}
