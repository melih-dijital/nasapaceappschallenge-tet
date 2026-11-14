# FAZ 0 — Proje iskeleti, araç zinciri ve hafıza sistemi
**Sorumlu:** Kişi B · **Süre hedefi:** 30–45 dk · **Önkoşul:** Boş depo; `PROJECT_MEMORY.md`, `CLAUDE.md`, `templates/` dosyaları kök dizine kopyalanmış.

## 0. Başlamadan (zorunlu)
Kök dizindeki `PROJECT_MEMORY.md` dosyasını tamamen oku. Bu fazda özellikle §3, §4, §5, §10 ve §16'ya uy.

## 1. Amaç
Çalışan, boş ama doğru yapılandırılmış bir Vite + React + TypeScript uygulaması; tüm klasör iskeleti; test/lint/typecheck altyapısı; hafıza dosyalarının yerinde olması. Hiçbir iş mantığı yazma.

## 2. Kapsam
**Dahil:** proje oluşturma, bağımlılıklar, TS/ESLint/Prettier/Vitest yapılandırması, klasör iskeleti, npm script'leri, Tailwind + shadcn/ui kurulumu, temel tema (koyu "mission control"), boş sayfa yönlendirmesi, `.gitignore`, ilk commit.
**Hariç:** simülatör, tipler (Faz 1), grafikler, PWA (Faz 11).

## 3. Görevler
1. **Oluştur:** Dolu klasörde `npm create vite` etkileşimli soru sorar ve `--overwrite` mevcut dosyaları siler; bu yüzden **önce geçici `_scaffold/` klasörüne kur**: `npm create vite@latest _scaffold -- --template react-ts`. Sonra `_scaffold/` içeriğini köke taşı; kökteki `PROJECT_MEMORY.md`, `CLAUDE.md`, `AGENTS.md`, `templates/`, `prompts/`, `docs/` dosyalarına DOKUNMA (çakışma olursa dur ve raporla). Taşıma bitince `_scaffold/`'ı sil (kabuktan bağımsız: `node -e "require('fs').rmSync('_scaffold',{recursive:true,force:true})"`). Node ≥ 20 olduğunu doğrula.
2. **Önce TypeScript'i sabitle:** `npm i -D typescript@~6.0.3` (create-vite şablonu typescript ~7 getirir; typescript-eslint yalnızca <6.1 kabul eder, sabitlemezsen `npm i -D typescript-eslint` sürüm çakışmasıyla durur; ileride çakışma olursa typescript-eslint'in desteklediği sürüme sabitle). **Lint = eslint:** şablonun `oxlint`'ini kaldır (`.oxlintrc.json` sil, `lint` script'i `eslint`). Sonra **Bağımlılıklar** (çalışma zamanı): `zustand`, `zod`, `dexie`, `recharts`, `lucide-react`, `react-router-dom`, `clsx`, `tailwind-merge`, `class-variance-authority`. (geliştirme): `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `tsx`, `eslint` (+ typescript-eslint, react-hooks), `prettier`, `fake-indexeddb`. `ws` ve `vite-plugin-pwa` **şimdi kurma** (Faz 11).
3. **Tailwind + shadcn/ui** (**sıra: 2 → 4 → 3**; madde 4'teki tsconfig + Vite `@/*` alias'ı HAZIR olmadan shadcn "No import alias found" diye durur): shadcn CLI'nin güncel yönergesine göre kur, ama **etkileşimsiz**: `npx shadcn@latest init -t vite -b radix --no-monorepo` (`-d` KULLANMA: yeni CLI'de `--template=next` dayatır; bayrak kombinasyonu çalışmazsa `npx shadcn@latest init --help`'e bak, etkileşimsiz eşdeğerini seç) ve `npx shadcn@latest add -y <bileşenler>` (soru soran komut çalıştırma; takılırsa dur ve raporla). Tailwind sürümü CLI'nin desteklediği. Bileşenleri ekle: `button card badge tabs tooltip dialog sheet select slider switch progress separator scroll-area toggle`. Kurulan Tailwind ve shadcn sürümlerini §13'e yaz.
4. **tsconfig:** `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: false`, path alias `@/* → src/*`. Vite ve Vitest'te aynı alias.
5. **Çift ortam:** `src/core` ve `src/sim` kodunun Node'da (vitest `environment: 'node'`) çalışabilmesi için vitest config'te **`test.projects`** ile iki proje tanımla (`environmentMatchGlobs` KULLANMA; Vitest 3'te kullanımdan kalktı, 4'te yok): proje `node` (`environment:'node'`; `tests/core/**`, `tests/sim/**`, `tests/store/**`, `tests/validation/**`) ve proje `jsdom` (`environment:'jsdom'`; `tests/ui/**`). Her projede aynı `@` alias'ı (`extends: true`). ESLint kuralı: `src/core/**` ve `src/sim/**` içinde `document`, `window`, `localStorage`, `React` import'u ve `Math.random` yasak (`no-restricted-globals`, `no-restricted-imports`, `no-restricted-properties`).
6. **Klasör iskeleti:** `PROJECT_MEMORY.md §5` ağacındaki tüm klasörleri oluştur; boş klasörlere `.gitkeep`. `docs/sources`, `docs/calibration`, `docs/demo` **yoksa oluştur** (+ `.gitkeep`); `templates/` ve `prompts/` zaten varsa dokunma. Ağaçta ayrıca `src/core/storage/`, `src/core/validation/`, `tests/store/`, `tests/validation/` bulunur.
7. **npm script'leri:** `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck` (`tsc -b --noEmit`), `lint`, `format`, `test` (`vitest run`), `test:watch`, `test:cov`, **`check`** (typecheck + lint + test + build'i sırayla çalıştıran tek komut; bash'e özgü sözdizimi YOK — gerekirse küçük bir `scripts/check.ts` + tsx). Proje Windows'ta da çalışacak: yol ayırıcı ve kabuk farklarına dikkat. Windows'ta `&&`/bash'e özgü sözdizimi yok. Placeholder: `evidence:build` ("Faz 1'de eklenecek" yazdıran), `validate` (aynı).
8. **Tema ve kabuk:** Koyu tema CSS değişkenleri (arka plan çok koyu lacivert/siyah, vurgu rengi camgöbeği; durumlar: info=mavi, advisory=sarı, warning=turuncu, critical=kırmızı — her durum ikonla da ayırt edilecek). Font: sistem fontları (CDN yok). `App.tsx` yalnızca `react-router` ile 4 boş sayfa: `/` (Cockpit), `/evidence`, `/validation`, `/ground`; üstte basit nav; sayfa gövdelerinde "Faz 9–10'da doldurulacak".
9. **Zorunlu sürekli bant:** Tüm sayfalarda üstte ince bir `DisclaimerBar` bileşeni: "Decision support prototype · synthetic data · not a medical device" (i18n anahtarı `app.disclaimer`; Faz 9'da i18n bağlanacak, şimdilik sabit metin).
10. **Hafıza:** `PROJECT_MEMORY.md §12` tablosunda Faz 0'ı ☑ yap; §13'e kurulum kararlarını (sürümler, alias, lint kuralları) ekle; §15'e ilk değişiklik kaydını yaz.
11. **Git:** `git init` (yoksa) en başta yap; şablonun kendi `.gitignore`'u varsa **birleştir** (node_modules, dist, .env*, coverage, *.log ekli olsun); **ilk commit en SONDA**, tüm görevler bitince: `faz-0: iskelet`. Kökte kitten kalma boş `astro-cockpit-kit/` klasörü varsa sil.
12. **AGENTS.md:** kökteki `CLAUDE.md`'yi aynen `AGENTS.md` olarak kopyala (iki dosya özdeş kalmalı).
13. **Test örneği:** `tests/core/smoke.test.ts` (1+1) ve `tests/ui/app.test.tsx` (App render olur) — altyapının çalıştığını kanıtlamak için.

## 4. Kabul kriterleri
- [ ] `npm run dev` açılır, 4 rota gezilebilir, üstte disclaimer bandı görünür.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` hatasız.
- [ ] ESLint, `src/core` içine `window`/`Math.random` yazılınca hata verir (kanıtla: geçici satırla dene, sonra sil).
- [ ] `PROJECT_MEMORY.md`, `CLAUDE.md`, `AGENTS.md`, `templates/*`, `prompts/*` bozulmadan yerinde.
- [ ] §5'teki bütün klasörler var.
- [ ] §12/§13/§15 güncellendi; ilk commit atıldı.

## 5. Yasaklar
İş mantığı yazma · CDN/harici font · `ws`/pwa kurma · dosya adlarını değiştirme · gereksiz paket.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B) FAZ BİTİRME / DEVİR** bloğunu uygula.
