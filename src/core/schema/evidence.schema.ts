import { z } from 'zod'
import { SOURCE_TYPES, VERIFICATION_STATUSES } from '../types/evidence'
import { finite } from './common.schema'

export const SourceTypeSchema = z.enum(SOURCE_TYPES)
export const VerificationStatusSchema = z.enum(VERIFICATION_STATUSES)

export const EvidenceEntrySchema = z
  .object({
    id: z.string().min(1),
    value: z.union([finite(), z.tuple([finite(), finite()])]),
    unit: z.string().min(1),
    sourceType: SourceTypeSchema,
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().min(1),
    note: z.string().optional(),
    verificationStatus: VerificationStatusSchema,
    verified: z.boolean(),
    owner: z.string().optional(),
    scope: z.string().optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.verified !== (entry.verificationStatus === 'VERIFIED')) {
      ctx.addIssue({
        code: 'custom',
        path: ['verified'],
        message: "verified, verificationStatus === 'VERIFIED' ile türetilmeli",
      })
    }
    if (entry.sourceType === 'DEMO_PARAMETER' && entry.verificationStatus !== 'UNVERIFIED') {
      ctx.addIssue({
        code: 'custom',
        path: ['verificationStatus'],
        message: 'DEMO_PARAMETER her zaman UNVERIFIED olmalı',
      })
    }
    if (Array.isArray(entry.value) && entry.value[0] > entry.value[1]) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'aralıkta min > max' })
    }
  })
