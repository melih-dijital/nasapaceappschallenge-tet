import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { PWA_BACKGROUND_COLOR, PWA_ICONS, PWA_THEME_COLOR } from './scripts/pwa/icons.ts'
import { globalVercelHeaders } from './scripts/pwa/vercelHeaders.ts'
import { pwaIconsPlugin } from './scripts/pwa/vitePwaIcons.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaIconsPlugin(),
    // FAZ_11 §3.1: `prompt` modu (autoUpdate DEĞİL) — yeni sürüm kullanıcı onaylayana kadar bekler; `?demo=1`'de istem
    // hiç gösterilmez (src/pwa). Kayıt `virtual:pwa-register` ile elle yapılır (injectRegister: false).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      manifest: {
        name: 'Tether — Astronaut Health Cockpit',
        short_name: 'Tether',
        description:
          'Decision support prototype · synthetic data · not a medical device. Runs fully offline in the browser.',
        theme_color: PWA_THEME_COLOR,
        background_color: PWA_BACKGROUND_COLOR,
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: PWA_ICONS.map((i) => ({
          src: `/${i.fileName}`,
          sizes: `${i.size}x${i.size}`,
          type: 'image/png',
          purpose: i.purpose,
        })),
      },
      workbox: {
        // Tüm statik varlıklar: JS (worker bundle'ları dahil), CSS, HTML, ikonlar, JSON, manifest.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,jpg,ico,json,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Harici istek yok → çalışma zamanı önbelleği gerekmez.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  // `npm run preview` yayınla aynı CSP/güvenlik başlıklarıyla (çevrimdışı kontrol listesi CSP altında koşulur).
  preview: {
    headers: globalVercelHeaders(path.resolve(import.meta.dirname, 'vercel.json')),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // İki ortam: core/sim kodu Node'da, UI testleri jsdom'da (PROJECT_MEMORY §3.5, §5).
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/core/**/*.test.ts',
            'tests/sim/**/*.test.ts',
            'tests/store/**/*.test.ts',
            'tests/validation/**/*.test.ts',
            'tests/scripts/**/*.test.ts',
            'tests/server/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
  },
})
