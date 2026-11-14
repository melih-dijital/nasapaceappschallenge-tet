// PWA ikonları (FAZ_11 §3.1): bağımlılıksız, deterministik PNG üretimi (node:zlib + CRC32).
// Marka/NASA logosu YOK: koyu zemin üzerinde basit bir gezegen + yörünge halkası ve küçük uydu.
// Dosyalar `public/`'e yazılmaz; Vite eklentisi (`vitePwaIcons.ts`) build'de `dist`'e yayar, dev'de sunar.
import { deflateSync } from 'node:zlib'

/** Tema renkleri (src/index.css `--background` ≈ oklch(0.16 0.03 262), `--primary` ≈ oklch(0.8 0.13 210)). */
export const PWA_THEME_COLOR = '#0b1220'
export const PWA_BACKGROUND_COLOR = '#0b1220'
const ACCENT: Rgb = [56, 208, 232]
const PLANET: Rgb = [30, 64, 110]
const BG: Rgb = [11, 18, 32]

type Rgb = readonly [number, number, number]

export interface PwaIconSpec {
  /** Yayın yolu (dist köküne göre). */
  fileName: string
  size: number
  /** maskable: içerik güvenli bölge (yarıçap %40) içinde, zemin tam dolu. */
  purpose: 'any' | 'maskable'
}

export const PWA_ICONS: readonly PwaIconSpec[] = [
  { fileName: 'pwa-192x192.png', size: 192, purpose: 'any' },
  { fileName: 'pwa-512x512.png', size: 512, purpose: 'any' },
  { fileName: 'pwa-maskable-192x192.png', size: 192, purpose: 'maskable' },
  { fileName: 'pwa-maskable-512x512.png', size: 512, purpose: 'maskable' },
]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  typeBytes.copy(out, 4)
  Buffer.from(data).copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 8 + data.length)
  return out
}

/** RGBA (8 bit) piksellerini PNG'ye kodlar. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) throw new Error('encodePng: piksel dizisi boyutu hatalı')
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit derinliği
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ])
}

const SUPERSAMPLE = 4

/** Birim karede (merkez 0,0; yarıçap 1) bir noktanın rengi; null = şeffaf. */
function shade(x: number, y: number, maskable: boolean): Rgb | null {
  // maskable: tam zemin + içerik %80 güvenli bölgede; any: yuvarlatılmış kare zemin.
  const scale = maskable ? 0.62 : 0.78
  const u = x / scale
  const v = y / scale
  let color: Rgb | null = null
  if (maskable) {
    color = BG
  } else {
    const r = 0.22
    const ax = Math.max(Math.abs(x) - (1 - r), 0)
    const ay = Math.max(Math.abs(y) - (1 - r), 0)
    if (ax * ax + ay * ay <= r * r) color = BG
  }
  if (color === null) return null

  // Yörünge halkası (eğik elips), gezegenin arkasında kalan yarı çizilmez.
  const tilt = -0.42
  const cr = Math.cos(tilt)
  const sr = Math.sin(tilt)
  const ex = u * cr - v * sr
  const ey = u * sr + v * cr
  const ringDist = Math.abs(Math.hypot(ex / 1.0, ey / 0.34) - 1)
  const planetR = 0.56
  const inPlanet = u * u + v * v <= planetR * planetR
  const onRing = ringDist <= 0.07
  const ringBehind = ey < 0

  if (onRing && ringBehind && !inPlanet) color = ACCENT
  if (inPlanet) {
    // Basit gölgeleme: sağ üstten ışık.
    const lit = Math.max(0, Math.min(1, 0.55 + 0.6 * (-u * 0.6 + -v * 0.8) / planetR))
    color = [
      Math.round(PLANET[0] + (ACCENT[0] - PLANET[0]) * lit * 0.55),
      Math.round(PLANET[1] + (ACCENT[1] - PLANET[1]) * lit * 0.55),
      Math.round(PLANET[2] + (ACCENT[2] - PLANET[2]) * lit * 0.55),
    ]
  }
  if (onRing && !ringBehind) color = ACCENT
  // Uydu (küçük nokta).
  if ((u - 0.78) ** 2 + (v + 0.62) ** 2 <= 0.09 * 0.09) color = ACCENT
  return color
}

/** Belirtilen ikonun PNG baytları (deterministik). */
export function renderPwaIcon(spec: Pick<PwaIconSpec, 'size' | 'purpose'>): Buffer {
  const { size } = spec
  const maskable = spec.purpose === 'maskable'
  const rgba = new Uint8Array(size * size * 4)
  const n = SUPERSAMPLE * SUPERSAMPLE
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = ((px + (sx + 0.5) / SUPERSAMPLE) / size) * 2 - 1
          const y = ((py + (sy + 0.5) / SUPERSAMPLE) / size) * 2 - 1
          const c = shade(x, y, maskable)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 1
          }
        }
      }
      const i = (py * size + px) * 4
      rgba[i] = a > 0 ? Math.round(r / a) : 0
      rgba[i + 1] = a > 0 ? Math.round(g / a) : 0
      rgba[i + 2] = a > 0 ? Math.round(b / a) : 0
      rgba[i + 3] = Math.round((a / n) * 255)
    }
  }
  return encodePng(size, size, rgba)
}
