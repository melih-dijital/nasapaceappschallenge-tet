// Earth view (Mission Control) verisi: motorun gönderdiği `groundMirror` — Dünya'nın gerçekte gördüğü, gecikmeli kopya.
// Bu dosya yalnızca UI sözleşmesidir; değer motor karar anlık görüntüsünde (decision.groundMirror veya
// decision.earth.groundMirror) gelirse şemayla doğrulanıp store'a alınır. Gelmezse null → Earth view gizlenir.
// UI bu veriyi ÜRETMEZ (önceki "teslimde onboard'un o anki durumunu kopyala" yaklaşımı gecikmeli değildi).
import { z } from 'zod'
import type { Alert, CrewId, SimTimeMs, StateEstimate } from '@/core/types'

export interface GroundMirrorSnapshot {
  /** Earth'te görünen verinin gemideki zamanı (ör. simT − tek yön gecikme). */
  asOfT: SimTimeMs
  states: Record<CrewId, StateEstimate[]>
  alerts: Alert[]
  /** İsteğe bağlı ana seriler: anahtar latestKey(crewId, metric). */
  series?: Record<string, { t: number; value: number }[]>
}

const LooseRecord = z.record(z.string(), z.array(z.unknown()))
const MirrorSchema = z.object({
  asOfT: z.number(),
  states: LooseRecord,
  alerts: z.array(z.unknown()),
  series: z.record(z.string(), z.array(z.object({ t: z.number(), value: z.number() }))).optional(),
})

/** Karar anlık görüntüsünden groundMirror'ı okur; yoksa veya şema tutmazsa null. */
export function readGroundMirror(decision: unknown): GroundMirrorSnapshot | null {
  if (typeof decision !== 'object' || decision === null) return null
  const d = decision as { groundMirror?: unknown; earth?: { groundMirror?: unknown } }
  const candidate = d.groundMirror ?? d.earth?.groundMirror
  if (candidate === undefined) return null
  const parsed = MirrorSchema.safeParse(candidate)
  if (!parsed.success) return null
  // Durum ve uyarı öğeleri motor tiplerinin aynısıdır (protocol üzerinden gelir); burada yalnız zarf doğrulanır.
  return parsed.data as unknown as GroundMirrorSnapshot
}
