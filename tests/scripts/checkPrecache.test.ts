// FAZ_11 §3.7: PWA önbellek betiği testi (saf fonksiyonlar fixture ile; dist varsa gerçek çıktı da).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { checkDist, checkPrecache, criticalFiles, parsePrecacheUrls } from '../../scripts/check-precache'
import { crc32, PWA_ICONS, renderPwaIcon } from '../../scripts/pwa/icons'

const ICONS = PWA_ICONS.map((i) => i.fileName)
const DIST = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'workbox-abc123.js',
  'favicon.svg',
  'assets/index-AAA.js',
  'assets/index-BBB.css',
  'assets/EvidencePage-CCC.js',
  'assets/sim.worker-DDD.js',
  ...ICONS,
]
const swWith = (urls: string[]): string =>
  `define(["./workbox-abc123"],(function(e){"use strict";self.skipWaiting;e.precacheAndRoute([${urls
    .map((u, i) => `{url:"${u}",revision:"r${i}"}`)
    .join(',')}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/index.html")))}));`

describe('check-precache', () => {
  it('küçültülmüş sw.js içinden url girdilerini çıkarır', () => {
    expect(parsePrecacheUrls(swWith(['index.html', './assets/a.js']))).toEqual(['assets/a.js', 'index.html'])
  })

  it('kritik dosyalar: index, manifest, ikonlar, tüm assets JS/CSS (lazy + worker bundle)', () => {
    const crit = criticalFiles(DIST)
    expect(crit).toEqual(
      expect.arrayContaining(['index.html', 'manifest.webmanifest', 'assets/sim.worker-DDD.js', ...ICONS]),
    )
    expect(crit).not.toContain('sw.js')
  })

  it('hepsi listede → ok; worker bundle eksik → missing; dist dışı girdi → dangling', () => {
    const all = DIST.filter((f) => f !== 'sw.js' && !f.startsWith('workbox-'))
    expect(checkPrecache(swWith(all), DIST).ok).toBe(true)

    const noWorker = checkPrecache(swWith(all.filter((f) => !f.includes('sim.worker'))), DIST)
    expect(noWorker.ok).toBe(false)
    expect(noWorker.missing).toEqual(['assets/sim.worker-DDD.js'])

    const dangling = checkPrecache(swWith([...all, 'assets/gone.js']), DIST)
    expect(dangling.ok).toBe(false)
    expect(dangling.dangling).toEqual(['assets/gone.js'])
  })

  it('sw.js yoksa başarısız', () => {
    expect(checkDist(path.resolve('does-not-exist-dist'))).toMatchObject({ ok: false, missing: ['sw.js'] })
  })

  it.runIf(existsSync(path.resolve('dist/sw.js')))('gerçek dist (build sonrası): kritik dosyaların hepsi precache\'te', () => {
    const r = checkDist(path.resolve('dist'))
    expect(r.missing).toEqual([])
    expect(r.ok).toBe(true)
    const manifest = JSON.parse(readFileSync(path.resolve('dist/manifest.webmanifest'), 'utf8')) as {
      display: string
      icons: { purpose: string; sizes: string }[]
    }
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true)
  })
})

describe('PWA ikonları', () => {
  it('geçerli PNG: imza, IHDR boyutu, CRC doğru, piksel verisi açılır; deterministik', () => {
    for (const spec of PWA_ICONS) {
      const png = renderPwaIcon(spec)
      expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(png.readUInt32BE(16)).toBe(spec.size)
      expect(png.readUInt32BE(20)).toBe(spec.size)
      // IHDR CRC
      expect(png.readUInt32BE(29)).toBe(crc32(png.subarray(12, 29)))
      const idatLen = png.readUInt32BE(33)
      const raw = inflateSync(png.subarray(41, 41 + idatLen))
      expect(raw.length).toBe((spec.size * 4 + 1) * spec.size)
      expect(renderPwaIcon(spec).equals(png)).toBe(true)
    }
  })

  it('maskable: köşe pikseli opak (tam zemin); any: köşe şeffaf (yuvarlatılmış)', () => {
    const corner = (purpose: 'any' | 'maskable'): number => {
      const png = renderPwaIcon({ size: 64, purpose })
      const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)))
      return raw[1 + 3] ?? -1 // satır 0, piksel 0, alfa
    }
    expect(corner('maskable')).toBe(255)
    expect(corner('any')).toBe(0)
  })
})
