// FAZ_11 §3.2: `dist` içindeki kritik dosyaların servis çalışanı precache listesinde olduğunu doğrular.
// Kullanım: `npm run pwa:check` (build sonrası `postbuild` ile otomatik). Saf mantık `checkPrecache` testlerde kullanılır.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PWA_ICONS } from './pwa/icons'

export interface PrecacheCheckResult {
  ok: boolean
  precached: string[]
  missing: string[]
  /** Precache listesinde olan ama dist'te bulunmayan (bozuk liste). */
  dangling: string[]
}

/** sw.js (generateSW, küçültülmüş) içinden `{url:"…",revision:…}` girdilerini çıkarır. */
export function parsePrecacheUrls(swSource: string): string[] {
  const urls = new Set<string>()
  const re = /\burl\s*:\s*(["'])([^"']+)\1/g
  for (const m of swSource.matchAll(re)) {
    const url = m[2]
    if (url) urls.add(url.replace(/^\.?\//, ''))
  }
  return [...urls].sort()
}

/**
 * Kritik dosyalar: index.html, manifest, PWA ikonları, `assets/` altındaki TÜM JS/CSS (ana paket, lazy rotalar,
 * worker bundle'ları). Yollar dist köküne göre, `/` ayırıcıyla.
 */
export function criticalFiles(distFiles: readonly string[]): string[] {
  const fixed = ['index.html', 'manifest.webmanifest', ...PWA_ICONS.map((i) => i.fileName)]
  const assets = distFiles.filter((f) => /^assets\/.+\.(?:m?js|css)$/.test(f))
  return [...new Set([...fixed, ...assets])].sort()
}

export function checkPrecache(swSource: string, distFiles: readonly string[]): PrecacheCheckResult {
  const precached = parsePrecacheUrls(swSource)
  const set = new Set(precached)
  const present = new Set(distFiles)
  const missing = criticalFiles(distFiles).filter((f) => !set.has(f))
  const dangling = precached.filter((f) => !present.has(f))
  return { ok: missing.length === 0 && dangling.length === 0, precached, missing, dangling }
}

function listFiles(root: string, dir = root): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(root, full))
    else out.push(path.relative(root, full).split(path.sep).join('/'))
  }
  return out.sort()
}

export function checkDist(distDir: string): PrecacheCheckResult {
  const swPath = path.join(distDir, 'sw.js')
  if (!existsSync(swPath)) {
    return { ok: false, precached: [], missing: ['sw.js'], dangling: [] }
  }
  return checkPrecache(readFileSync(swPath, 'utf8'), listFiles(distDir))
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const distDir = path.resolve(process.argv[2] ?? 'dist')
  const result = checkDist(distDir)
  if (result.ok) {
    console.log(`pwa:check: ${result.precached.length} dosya precache listesinde; kritik dosyaların hepsi var.`)
  } else {
    if (result.missing.length > 0) console.error(`pwa:check: precache'te EKSİK: ${result.missing.join(', ')}`)
    if (result.dangling.length > 0) console.error(`pwa:check: dist'te OLMAYAN girdi: ${result.dangling.join(', ')}`)
    process.exit(1)
  }
}
