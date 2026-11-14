export const SOURCE_TYPES = [
  'NASA_STD',
  'NASA_HRP',
  'PEER_REVIEWED',
  'CLINICAL_CONVENTION',
  'DEMO_PARAMETER',
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const VERIFICATION_STATUSES = ['VERIFIED', 'PARTIAL', 'CONFLICTING', 'UNVERIFIED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export interface EvidenceEntry {
  id: string
  value: number | [number, number]
  unit: string
  sourceType: SourceType
  sourceTitle: string
  /** http(s) URL veya (status ≠ VERIFIED ise) '—'. */
  sourceUrl: string
  note?: string
  verificationStatus: VerificationStatus
  /** Türetilmiş: verificationStatus === 'VERIFIED'. */
  verified: boolean
  owner?: string
  scope?: string
}
