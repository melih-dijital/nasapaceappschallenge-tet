# FAZ 11 — PWA/çevrimdışı, opsiyonel WebSocket yer istasyonu ve yayın
**Sorumlu:** Kişi B (yayın: Kişi A ile) · **Süre hedefi:** 2 saat · **Önkoşul:** Faz 9 ☑ (Faz 10 ile paralel olabilir)

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §4). Bu fazın başarı ölçütü: **Wi-Fi kapalıyken demo çalışır** ve canlı site açılır.

## 1. Amaç
"Dünya'dan bağımsız" iddiasını **kanıtlayan** çevrimdışı çalışma; isteğe bağlı olarak aynı `TelemetryFrame` şemasıyla çalışan bir `ws` "yer istasyonu"; Vercel'e statik yayın.

## 2. Kapsam
**Dahil:** vite-plugin-pwa, önbellekleme stratejisi, çevrimdışı rozeti, `WebSocketSource`, `server/` (opsiyonel), Vercel yapılandırması, bundle ve performans denetimi, çevrimdışı test prosedürü.
**Hariç:** yeni özellik.

## 3. Görevler

### 3.1 PWA
- `npm i -D vite-plugin-pwa` (§13'e yaz). `registerType: 'prompt'`, `workbox.globPatterns` tüm statik varlıklar (JS, CSS, HTML, ikonlar, JSON, **worker bundle'ları**); `navigateFallback: '/index.html'`; harici istek yok (zaten yok) — çalışma zamanı önbelleği gerekmez.
- Manifest: ad, kısa ad, tema rengi, arka plan, `display: 'standalone'`, ikonlar (192/512, maskable — basit SVG'den üret; marka/NASA logosu **kullanma**).
- Uygulama içi **bağlantı rozeti**: `navigator.onLine` (yalnızca bilgi): "Offline mode — fully operational". Ağ bağımlılığı olmadığını vurgulayan küçük metin.
- Servis çalışanı güncellemesi demo sırasında sürpriz yapmasın: **`prompt`** modu (autoUpdate DEĞİL) ve demo sırasında güncellemeyi bastır (`?demo=1` URL parametresi: güncelleme istemi kapalı; Faz 12 sunum moduyla aynı parametre).

### 3.2 Çevrimdışı doğrulama
- `docs/demo/offline-checklist.md` oluştur: (1) `npm run build`, ardından ayrı komut olarak `npm run preview`, (2) tarayıcıda aç, bir kez yükle, (3) DevTools → Network → Offline, (4) sayfayı yenile, (5) senaryoyu başlat, SPE'yi tetikle, ack/accept/check-in/PVT/Earth Link dene, (6) doğrulama koşusu çalıştır, (7) uçak modu ile gerçek test. Her adım ✅/❌.
- Otomatik: `vitest` ile `dist` içinde kritik dosyaların önbellek listesinde (sw manifest) olduğunu kontrol eden basit betik (`scripts/check-precache.ts`).

### 3.3 WebSocketSource (core, ortam bağımsız)
- `src/core/telemetry/webSocketSource.ts`: `TelemetrySource` arayüzünü uygular; **`WebSocket` kurucusu enjekte edilir** (core'da global yok); mesajlar Zod ile doğrulanır; bağlantı koparsa üstel geri çekilmeyle yeniden dener ve `SourceStatus.connected` yayınlar; sunucudan gelen `FRAMES` mesajlarını `onFrames`'e iletir. Bağlantı yokken **yerel simülatöre düşme** (fallback) seçeneği (`fallbackToLocal: true`) — kokpit asla "boş" kalmaz.
- Worker içinde kaynak seçimi: `INIT {source:'local'|'ws', wsUrl?}`; varsayılan **local**.

### 3.4 Opsiyonel sunucu (`server/`)
- Yalnızca `ws` + `tsx`. `server/index.ts`: `Simulator`'ı (core/sim) import eder, seçilen senaryoyu yayınlar (`FRAMES` toplu mesaj, ≤ 10 Hz), komutları alır (`SET_SPEED`, `SET_SCENARIO`, `RESET`). Aynı `TelemetryFrameSchema` ile doğrular. Port ortam değişkeni; CORS/Origin kontrolü basit. **Kimlik doğrulama/DB yok** (demo amaçlı; README'ye açık not).
- `npm run server`. **`dev:all` script'i YAZMA** (Windows'ta `cmd.exe` `a & b` ile ilk süreç hiç bitmez; `concurrently` de eklenmez). README'ye "iki terminal: biri `npm run dev`, diğeri `npm run server`" yaz.
- Test: sunucu birimleri (`ws` istemcisiyle yerel bağlantı, çerçeve geliyor mu).
- Not: Yayında sunucu **yok**; UI'da "Ground station (optional)" bağlanma alanı yalnızca geliştirme/demo rahatlığı; varsayılan kapalı.

### 3.5 Yayın (Vercel, statik)
- `vercel.json`: SPA yeniden yazma (`/(.*)` → `/index.html`), güvenlik başlıkları (`Content-Security-Policy` kısıtlı: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' ws: wss:` — çalıştığını doğrula, gerekirse minimal gevşet ve §13'e yaz), `X-Content-Type-Options`, `Referrer-Policy`.
- Build ayarları: `npm run build`, çıktı `dist`. Ortam değişkeni gerekmez.
- **Yayınlama talimatı** `docs/demo/deploy.md`: Vercel'e bağla (git entegrasyonu) ya da CLI ile `vercel build` ardından `vercel deploy --prebuilt` (`dist` klasörüyle `--prebuilt` ÇALIŞMAZ); canlı URL'yi README'ye ekle (kişi bunu kendisi yapar; yapay zekâ gizli anahtar istemez/yazmaz).

### 3.6 Performans ve boyut
- `npm run build` raporu: toplam JS gzip; hedef ≤ 500 kB gzip ana paket (Recharts ağır: rota bazlı **lazy import**; 3B/gereksiz kütüphane yok). `/evidence`, `/validation`, `/ground` sayfaları `React.lazy`.
- Lighthouse benzeri kaba kontrol (elle): ilk anlamlı boyama < 2 sn yerelde; konsol uyarısı yok.
- Bellek: 30 sim-gün çalıştırma sonrası sekme belleği stabil (DevTools heap karşılaştırması; not al).

### 3.7 Testler
- `WebSocketSource` sahte WebSocket ile: geçerli/geçersiz mesaj, yeniden bağlanma, fallback.
- Sunucu duman testi.
- PWA önbellek betiği testi.

## 4. Kabul kriterleri
- [ ] Çevrimdışı kontrol listesi baştan sona ✅ (en az DevTools Offline ile; mümkünse uçak modu).
- [ ] `WebSocketSource` + `server/` çalışıyor veya "kapsam dışı bırakıldı" olarak §13'te gerekçeli.
- [ ] Vercel yapılandırması hazır; CSP ile uygulama çalışıyor.
- [ ] Ana paket boyutu raporlanmış; lazy yükleme var.
- [ ] Demo modunda SW güncelleme istemi çıkmıyor.

## 5. Yasaklar
Gizli anahtar/ortam sırrı yazmak · uzak CDN · NASA/Space Apps logosunu izinsiz kullanmak · yayında zorunlu backend · yeni özellik.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir: canlı URL (kişi ekleyecek), çevrimdışı test sonuçları, bilinen kısıtlar.
