# React + TypeScript + Vite

> Bu README Faz 12'de yeniden yazılacak. Aşağıdaki iki bölüm Faz 11'e aittir.

## Çevrimdışı (PWA) ve yayın

- Uygulama tamamen tarayıcıda çalışır; ağ bağımlılığı yoktur. Servis çalışanı `prompt` modundadır: `?demo=1` ile güncelleme istemi kapanır.
- Üretim denemesi: `npm run build`, ardından **ayrı komut olarak** `npm run preview` (yayınla aynı CSP başlıklarıyla).
- Vercel: statik yayın, `vercel.json` (SPA rewrite + CSP). Canlı URL: _(ekip ekleyecek)_

## Opsiyonel yer istasyonu (ws)

Demo için gerekmez; yayında sunucu **yoktur**. İki terminal kullanın (Windows'ta tek komutta birleştirmeyin):

1. Terminal 1: `npm run dev`
2. Terminal 2: `npm run server` (ortam değişkenleri: `PORT`, varsayılan 8787; `SCENARIO`; `ALLOWED_ORIGINS`)

Worker'a `INIT {source: 'ws', wsUrl: 'ws://localhost:8787'}` gönderilirse çerçeveler sunucudan gelir; bağlantı kurulamazsa yerel simülatöre düşülür.
**Kimlik doğrulama ve veritabanı yoktur:** sunucu yalnızca yerel demo içindir, internete açmayın.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
