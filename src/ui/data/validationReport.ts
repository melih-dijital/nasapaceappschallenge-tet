// Doğrulama sayfasının TEK veri kaynağı: `npm run validate` çıktısının UI anlık görüntüsü.
// Dosyayı `scripts/validate.ts` yazar (aynı rapor + üretim tarihi + komut); tarayıcıda doğrulama koşusu YOKTUR.
// Uygulamada elle yazılmış/sahte doğrulama sayısı bulunmaz: şema tutmazsa sayfa hata durumunu gösterir.
import { z } from 'zod'
import { ValidationReportSchema } from '@/core/validation/types'
import type { ValidationReport } from '@/core/validation/types'
import raw from './validation-report.json?raw'

const SnapshotSchema = z.object({
  generatedAt: z.string().min(1),
  command: z.string().min(1),
  report: ValidationReportSchema,
})

export interface ValidationSnapshot {
  generatedAt: string
  command: string
  report: ValidationReport
}

export type ValidationSnapshotResult =
  { ok: true; snapshot: ValidationSnapshot } | { ok: false; error: string }

export function parseValidationSnapshot(text: string): ValidationSnapshotResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'validation-report.json is not valid JSON' }
  }
  const parsed = SnapshotSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'schema mismatch'}`,
    }
  }
  return { ok: true, snapshot: parsed.data as ValidationSnapshot }
}

export const VALIDATION_SNAPSHOT: ValidationSnapshotResult = parseValidationSnapshot(raw)
