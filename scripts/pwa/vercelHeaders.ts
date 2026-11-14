// `vercel.json` içindeki global (`/(.*)`) güvenlik başlıklarını okur; `vite preview` aynı CSP ile çalışsın (tek kaynak).
import { readFileSync } from 'node:fs'

interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

export function globalVercelHeaders(vercelJsonPath: string): Record<string, string> {
  const cfg = JSON.parse(readFileSync(vercelJsonPath, 'utf8')) as VercelConfig
  const out: Record<string, string> = {}
  for (const h of cfg.headers?.find((x) => x.source === '/(.*)')?.headers ?? []) out[h.key] = h.value
  return out
}
