# Bilinen sorunlar ve tarayıcı uyumluluğu (FAZ_12 §3.1)

Son güncelleme: 2026-11-14 · Commit: Faz 12 UI cilası (Presenter Mode, erişilebilirlik, boş/hata durumları)

## 1. Tarayıcı kontrolü

| Tarayıcı | Sürüm | Yöntem | Sonuç |
|---|---|---|---|
| Google Chrome (ana) | 157.0.8103.78 (Windows 11) | `npm run build` → `npm run preview` (yayınla aynı CSP), headless + DevTools protokolüyle **gerçek tuş vuruşları** | ✅ Tümü geçti (aşağıdaki liste); konsolda **0** hata / uyarı / CSP ihlali (sayfa + worker) |
| Microsoft Edge (Chromium) | 157.0.4341.46 (Windows 11) | Aynı betik | ✅ Chrome ile birebir aynı; konsol **0** kayıt |
| Mozilla Firefox | — | **Test edilmedi** (bu makinede kurulu değil) | ⬜ Ekip: elle kontrol (aşağıdaki riskler) |
| Apple Safari | — | **Test edilmedi** (Windows'ta yok) | ⬜ Ekip: bir Mac/iPad'de elle kontrol |

Chrome/Edge'de doğrulananlar:
- `?demo=1` → sunum modu: kök font 16 → 18 px, kenar çubuğu 192 → 72 px (yalnız ikon; ad `title` + ekran okuyucu metni olarak duruyor), `demo_main` seçili.
- Kısayollar: `?` yardım (9 kısayol listelenir, `Esc` kapatır) · `4` SPE bookmark + `Space` başlat → kritik **ACT NOW** bandı · `E` 3 dk → 14 dk (RT 43 dk) ve tam döngüde başa sarma · `R` D+000'a, duraklatılmış · `D` kapatır ve URL'den `?demo=1` kaldırır; kapalıyken `4` hiçbir şey yapmaz.
- Klavye: ilk `Tab` → "Skip to main content" bağlantısı görünür odak halkasıyla (2 px, camgöbeği).
- Boş durum: bilinmeyen rota (`/no-such-view`) → "View not found" + kokpite dönüş bağlantısı; `/alerts`, `/behavioral` açılır.
- Çevrimdışı (Faz 11 testi): SW önbellekten açılış, çevrimdışı yenileme, tüm rotalar, çevrimdışı SPE.

### Firefox / Safari için bilinen riskler (elle kontrol listesi)
| Konu | Durum / risk | Ne yapmalı |
|---|---|---|
| Modül Web Worker (`type: 'module'`) | Firefox ≥ 114, Safari ≥ 15 destekler | Eski sürümde kokpit "Initializing…" iskeletinde kalır → güncel tarayıcı kullan |
| IndexedDB (Dexie) | Gizli pencerede (özellikle Safari/Firefox) kota/erişim hatası olabilir | Uygulama otomatik bellek deposuna düşer (`StorageWarning`); demo etkilenmez, yalnız geçmiş kalıcı olmaz |
| Web Audio (kritik uyarı sesi) | Tüm tarayıcılarda kullanıcı etkileşimi olmadan çalmaz; Safari daha katı | Demo başında bir kez tıkla/tuşa bas ("Audio armed" rozeti) |
| `oklch()` renkleri | Firefox ≥ 113, Safari ≥ 15.4 | Eski sürümde renkler bozuk görünür |
| `:focus-visible` | Safari ≥ 15.4 | Eski Safari'de odak halkası görünmeyebilir |

## 2. Bilinen sorunlar (demo'yu bozmayan)

| # | Sorun | Etki | Geçici çözüm / sahip |
|---|---|---|---|
| 1 | Sayfa yenilenince simülasyon D+000'a döner (worker durumu kalıcı değil) | Sunumda yenileme yapılırsa akış başa döner | Demo sırasında **yenileme yapma**; gerekirse `4` ile SPE'ye atla |
| 2 | "Priority Decision Cards" paneli boş kalır: `DecisionStage` (Faz 7) motor hattına henüz bağlı değil (`src/core/pipeline/stages.ts` yer tutucu) | ACT_NOW sınıfı uyarılarda görünür, ama kart/plan farkı yok | Kişi B (pipeline bağlantısı) |
| 3 | "Neden?" cümlesinde durum kimliği ham görünür: "Composite **radiation_event** score reached 1" | Anlam doğru, metin teknik | Kişi A: uyarı kartında `state` parametresini `state.*` etiketine çevir |
| 4 | Radyasyon doz hızındaki L3 trend ADVISORY'si "Solar Particle Event — …" başlığıyla gösterilir | SPE olmadığı hâlde başlık SPE der | Kişi A: başlık eşlemesini `kind`'a göre ayır |
| 5 | Ana paket 1,31 MB (gzip 378 kB): FAZ_11 hedefi (≤ 500 kB gzip) karşılanıyor, Vite yine "chunk > 500 kB" build uyarısı veriyor | Yok (tarayıcı konsoluna yansımaz) | İsteğe bağlı: Recharts'ı ayrı chunk'a böl |
| 6 | Sekme arka plana gidip dönünce zaman sıçraması (FAZ_12 §3.1) **test edilmedi** | Tarayıcı zamanlayıcıyı kısar; `advanceTo` toplu üretimle telafi etmeli | Elle: 1 dk arka planda bekle, dön, UI donmuyor mu bak |
| 7 | Gerçek uçak modu testi yapılmadı (yalnız DevTools Offline eşdeğeri) | — | Sunumdan önce bir kez uçak modunda aç |

## 3. Yedek plan
- Yerel `dist`: `npm run build`, ardından ayrı komutla `npm run preview` (ağ gerekmez; SW önbellekli).
- Önceden kaydedilmiş demo videosu (Kişi C, `docs/demo/submission-checklist.md`).
