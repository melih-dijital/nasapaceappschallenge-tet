// FAZ_11 §3.5: Vercel yapılandırması — SPA rewrite, kısıtlı CSP, güvenlik başlıkları; preview aynı başlıkları kullanır.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { globalVercelHeaders } from '../../scripts/pwa/vercelHeaders'

const file = path.resolve('vercel.json')
const cfg = JSON.parse(readFileSync(file, 'utf8')) as {
  outputDirectory: string
  rewrites: { source: string; destination: string }[]
}

describe('vercel.json', () => {
  it('SPA rewrite /(.*) → /index.html; çıktı dist', () => {
    expect(cfg.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' })
    expect(cfg.outputDirectory).toBe('dist')
  })

  it('CSP: harici kaynak yok, unsafe-eval yok; worker/ws izinleri FAZ_11 ile birebir', () => {
    const h = globalVercelHeaders(file)
    const csp = h['Content-Security-Policy'] ?? ''
    const directives = Object.fromEntries(
      csp.split(';').map((d) => {
        const [name, ...values] = d.trim().split(/\s+/)
        return [name, values.join(' ')]
      }),
    )
    expect(directives).toEqual({
      'default-src': "'self'",
      'script-src': "'self'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data: blob:",
      'worker-src': "'self' blob:",
      'connect-src': "'self' ws: wss:",
    })
    expect(csp).not.toMatch(/unsafe-eval|https?:\/\//)
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBeDefined()
  })
})
