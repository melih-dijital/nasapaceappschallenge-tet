// Vite eklentisi: PWA ikonlarını build'de `dist` köküne yayar (Workbox precache'i yakalar), dev sunucusunda sunar.
import type { Plugin } from 'vite'
import { PWA_ICONS, renderPwaIcon } from './icons.ts'

export function pwaIconsPlugin(): Plugin {
  const cache = new Map<string, Buffer>()
  const get = (fileName: string): Buffer | undefined => {
    const spec = PWA_ICONS.find((i) => i.fileName === fileName)
    if (!spec) return undefined
    let png = cache.get(fileName)
    if (!png) {
      png = renderPwaIcon(spec)
      cache.set(fileName, png)
    }
    return png
  }

  return {
    name: 'astro-pwa-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? ''
        const png = get(name)
        if (!png) {
          next()
          return
        }
        res.setHeader('Content-Type', 'image/png')
        res.end(png)
      })
    },
    generateBundle() {
      for (const spec of PWA_ICONS) {
        const source = get(spec.fileName)
        if (source) this.emitFile({ type: 'asset', fileName: spec.fileName, source })
      }
    },
  }
}
