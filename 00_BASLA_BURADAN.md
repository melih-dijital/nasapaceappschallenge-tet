# 00 — BAŞLA BURADAN: Kodlama Yapay Zekâsı Kullanım Kılavuzu

Bu paket, **Astronot Sağlık Kokpiti**'ni faz faz kodlatmak için hazırlandı. İçerik:

```
astro-cockpit-kit/
├─ 00_BASLA_BURADAN.md          ← bu dosya
├─ PROJECT_MEMORY.md            ← YAPAY ZEKÂNIN KALICI HAFIZASI (repo köküne koy)
├─ CLAUDE.md                    ← hafızayı okutma işaretçisi (repo köküne koy; AGENTS.md olarak da kopyala)
├─ templates/
│  ├─ SOURCE_TEMPLATE.md        ← ekip arkadaşlarının kaynak (kanıt) md'leri için şablon
│  └─ CALIBRATION_TEMPLATE.md   ← simülatör kalibrasyon md'leri için şablon
└─ prompts/
   ├─ 00_ORTAK_PROMPTLAR.md     ← oturum başlatma, faz bitirme, hata düzeltme, kod inceleme, md ekleme, paralel çalışma
   ├─ FAZ_00 … FAZ_12           ← her faz için ayrı, eksiksiz prompt
```

## 1. Kurulum (5 dakika)
1. Boş bir git deposu aç (GitHub'da herkese açık, lisanslı olacaksa şimdiden `LICENSE` ekle).
2. Şunları **depo köküne** kopyala: `PROJECT_MEMORY.md`, `CLAUDE.md` (+ aynısını `AGENTS.md` adıyla), `templates/` klasörü.
3. `docs/sources/` ve `docs/calibration/` klasörlerini oluştur (boş olabilir). `prompts/` klasörünü de **depo köküne** kopyala (kök `prompts/`; `docs/prompts/` DEĞİL).
4. Tüm ekip aynı `main` üzerinden çalışacak; her kişi `faz-N-isim` dalı açar.

## 2. Her fazda nasıl çalışılır (3 adım)
1. **Yeni sohbet aç** → `00_ORTAK_PROMPTLAR.md` → **A) OTURUM BAŞLATMA** prompt'unu yapıştır. Yapay zekâ `PROJECT_MEMORY.md`'yi okuyup durumu özetler.
2. Özet doğruysa ilgili **`FAZ_NN_*.md` dosyasının tamamını** yapıştır.
3. Faz bitince yapay zekâ **B) FAZ BİTİRME/DEVİR** adımlarını uygular (test + hafıza güncelleme + commit + devir notu). Devir notunu bir sonraki fazın başlangıcına ekle.

> Yapay zekâ oturumlar arasında hiçbir şey hatırlamaz — **hafıza yalnızca `PROJECT_MEMORY.md`'dir**. Her faz sonunda güncellenmiş olduğunu `git diff PROJECT_MEMORY.md` ile kontrol et. Güncellenmediyse "Hafızayı güncelle" de.

## 3. Ekip arkadaşlarının hazırladığı .md dosyaları
- **Kaynak/kanıt md'leri:** `templates/SOURCE_TEMPLATE.md` biçiminde → `docs/sources/<id>.md`. Her NASA/CSA/literatür kaynağı için bir dosya; değerler tabloda, `status` sütunu satır başına dürüstçe doldurulur.
- **Kalibrasyon md'leri:** `templates/CALIBRATION_TEMPLATE.md` → `docs/calibration/<id>.md` (simülatörün makul aralıkları).
- **Yeni md eklenince:** `00_ORTAK_PROMPTLAR.md` → **E) KAYNAK .MD İÇERİĞİNİ SİSTEME ALMA** prompt'u.
- Kurallar: md'de olmayan değer uydurulmaz; kaynağı olmayan eşik `DEMO_PARAMETER` kalır. Uzun alıntı yok (kendi cümlelerinle özetle, en çok 15 kelimelik kısa alıntı).
- md'ler yetişmese bile sistem çalışır: Faz 1 `seed-verified-values.md` ve `demo-parameters.md` üretir.

## 4. Faz haritası, sahipler, bağımlılıklar
| Faz | Konu | Sahip | Önkoşul | Tahmini süre |
|---|---|---|---|---|
| 0 | İskelet + hafıza | B | — | 0,5 sa |
| 1 | Tipler, şemalar, Evidence | B | 0 | 1–1,5 sa |
| 2 | Simülatör + senaryolar | B | 1 | 2–3 sa |
| 3 | Giriş, depolama, pipeline, worker, store | B | 1, 2 | 2 sa |
| 4 | Baseline motoru | B | 3 | 1,5–2 sa |
| 5 | Algılama L1–L4 + uyarılar | B | 4 | 3 sa |
| 6 | Alan modülleri | B (+C) | 5 | 3 sa |
| 7 | Karar destek + Earth Link | C | 5 (6 ile paralel) | 3 sa |
| 8 | Doğrulama koşucusu | C (+B) | 5, 6, 7 | 2 sa |
| 9 | UI-1: Kabuk + Kokpit | A | 1 (mock) → gerçek motor | 3–4 sa |
| 10 | UI-2: Uyarılar/Karar/Davranış/Kanıt/Doğrulama/Ground | A (+C) | 9; 5–8 | 4 sa |
| 11 | PWA, çevrimdışı, ws, yayın | B (+A) | 9 | 2 sa |
| 12 | Cilalama, demo, teslim | C + herkes | 9–11 | 6 sa (son 2 sa kodsuz) |

**Paralel yürütme:** Kişi A, Faz 1 biter bitmez `mockEngine` ile Faz 9'a başlar (`EngineClient` arayüzü ve mock Faz 1'in son görevidir). Kişi C, Faz 5 tipleri hazır olunca Faz 7'ye başlar; kaynak/kalibrasyon md'lerini sürekli üretir. Kişi B kritik yolu (Faz 0→6) taşır.

## 5. Zaman baskısı için KESME PLANI (öncelik sırasıyla vazgeç)
Teslim: 15 Kasım 23:59 (resmi saat dilimini doğrula). Süre yetmezse **şu sırayla** kes:
1. Faz 11'deki `WebSocketSource`/`server/` (yalnızca PWA + Vercel kalsın).
2. Faz 10 `/ground` sayfası → Earth Link kokpit paneline indir.
3. Faz 8 duyarlılık analizi ve UI'daki "Run validation" → `npm run validate` raporu + statik sayfa.
4. Faz 6 kardiyo modülünün kemik tahmini kartı (en son kes; Validity için değerli).
5. Faz 2'de senaryo sayısı: `nominal`, `solar_particle_event`, `sleep_debt`, `isolation_low_mood`, `demo_main` yeter.
**Asla kesme:** Evidence/kaynak etiketleri, kişisel baseline, gecikme-bilinçli triyaj, SPE uçtan uca akışı, çevrimdışı çalışma, dürüst sınırlamalar, `PROJECT_MEMORY.md` güncellemeleri.

## 6. Sık hatalar
- Yapay zekâ "tamamlandı" der ama test/derleme koşturmamıştır → B) bloğu çıktısında komut sonuçlarını iste.
- Hafıza güncellenmez → her faz sonunda `git diff PROJECT_MEMORY.md`.
- Başka kişinin klasörüne dokunulur → `[cross-owner]` kuralı (ortak prompt G).
- Eşik "NASA'dan" diye uydurulur → Evidence `status` (VERIFIED/PARTIAL/CONFLICTING/UNVERIFIED) ve `sourceType` alanlarını kontrol et; HRP sayfaları sayısal eşik vermez.
- Son saatlerde yeni özellik eklenir → Faz 12 donma kuralı.

## 7. Bilinen açık noktalar (PROJECT_MEMORY.md §14'te de var)
- Resmi challenge "Resources" sekmesi okunamadı; ekip kontrol edip kaynak md'ye çevirmeli.
- Hematokrit +%10–12 ve GCR yüzey değerleri doğrulanmadı.
- NOAA S1 proton akısı eşiği (10 pfu) birincil kaynakla doğrulanmalı.
- Teslim saatinin saat dilimi netleştirilmeli.
- Space Apps'in yapay zekâ kullanımı beyanı ve teslim formu alanları için resmi kuralları son kez kontrol edin.
