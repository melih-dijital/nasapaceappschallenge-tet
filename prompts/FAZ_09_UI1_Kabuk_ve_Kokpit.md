# FAZ 9 — UI-1: Uygulama kabuğu, tasarım sistemi, i18n ve Kokpit (telemetri paneli)
**Sorumlu:** Kişi A · **Süre hedefi:** 3–4 saat · **Önkoşul:** Faz 1 ☑ (mock motor ve `EngineClient` arayüzü Faz 1'in son görevidir; mock ile başlanabilir); Faz 3–7 bittikçe gerçek motora geçilir

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§1–§3, §10). `src/core/types/**`, `src/store/**`, `src/ui/mock/mockEngine.ts` ve `docs/i18n-keys.md` dosyalarını incele. UI **yalnızca store'lardan okur ve `actions` ile komut yollar**; `core`'u doğrudan çağırmaz (istisna: saf tip ve `METRIC_META`, `getEvidence`).

## 1. Amaç
Jüriye 30 saniyede anlaşılan, ciddi ve etkileyici bir "görev kontrol" estetiğinde kokpit: canlı grafikler, kişi bazlı baseline bandı, durum çipleri, radyasyon göstergesi, Earth Link gecikme sayacı, senaryo/hız kontrolleri. Faz 10'daki uyarı/karar/davranış/kanıt/doğrulama sayfalarının iskeleti de burada hazırlanır.

## 2. Kapsam
**Dahil:** tema/tasarım jetonları, düzen (layout), i18n altyapısı + `en`/`tr` sözlükleri, üst çubuk, kişi seçici, telemetri grafikleri, durum çipleri, radyasyon paneli, Earth Link rozeti, sim kontrolleri, `DisclaimerBar` i18n bağlama, boş-durum ve yükleniyor durumları, erişilebilirlik, bileşen testleri.
**Hariç:** uyarı listesi/karar kartları/check-in/PVT/kanıt/doğrulama/ground sayfalarının içeriği (Faz 10).

## 3. Görevler

### 3.1 Tasarım sistemi
- Koyu tema; arka plan çok koyu lacivert; yüzeyler hafif yükseltilmiş; vurgu camgöbeği; **durum renkleri + ikon + metin** (info=mavi/`Info`, advisory=sarı/`AlertCircle`, warning=turuncu/`AlertTriangle`, critical=kırmızı/`OctagonAlert` ve hafif nabız animasyonu; `prefers-reduced-motion`a saygı).
- Tipografi: sistem sans + sayılar için `tabular-nums` / mono. Boyut ölçeği ve boşluk ölçeği tanımla (`src/ui/theme/tokens.css`).
- Duyarlılık: ≥ 1280 px masaüstü öncelik (sunum ekranı); 1024 px'e kadar bozulmadan; mobil tek sütun sade düzen.
- Ortak bileşenler (`src/ui/components/`): `StatusBadge`, `SeverityIcon`, `MetricTile` (değer, birim, z, mini sparkline), `Gauge`, `SectionCard`, `EmptyState`, `Skeleton`, `ProvenanceTag` (kaynak etiketi: `NASA_STD/NASA_HRP/PEER/CLINICAL/DEMO` renk+metin + `verified` ✓/⚠; tıklayınca Evidence sayfasına/`Sheet`'e), `InfoTooltip`.

### 3.2 i18n (`src/ui/i18n/`)
- Basit sözlük sistemi: `t(key, params?)`, `useT()`; `en.ts` (varsayılan, tam) ve `tr.ts`; eksik anahtar → İngilizce yedek + konsol uyarısı (geliştirmede). Dil değiştirici üst çubukta. `docs/i18n-keys.md` içindeki **tüm** anahtarları ekle (Faz 5–7 çıktıları dahil).
- Sayı/tarih biçimleri: `Intl.NumberFormat`; **mission clock** biçimi `MET D+012 14:32` (sim zamanı).
- Test: `en` ve `tr` sözlüklerinin anahtar kümeleri eşit (CI testi); kullanılmayan anahtar uyarısı.

### 3.3 Düzen ve üst çubuk (`AppShell`)
- Sol ince navigasyon (Cockpit, Alerts & Actions, Behavioral, Evidence, Validation, Ground) — Faz 10 sayfaları şimdilik "yakında" yer tutucu ama rota hazır.
- Üst çubuk: **Mission Clock (MET + Gün)**, senaryo seçici (`Select`; senaryo listesi store'dan), hız kontrolü (0.5×, 1×, 5×, 20×, 50× ön ayar + `Slider`; 1× = 20 sn/sim-gün), Play/Pause/Reset, bookmark atla menüsü (`demo_main` için), dil, Earth Link rozeti (gecikme, bağlantı durumu, bekleyen cevap sayacı), `DisclaimerBar`.
- Kişi seçici (4 astronot): ad, rol, **genel durum halkası** (en yüksek aktif severity), aktif uyarı sayısı. Seçim `sessionStore.selectedCrewId`.

### 3.4 Kokpit sayfası (`/`)
Üç sütun (≥1280 px):
- **Sol (kişi özeti):** durum çipleri (7 durum; skor 0–1 halka + etiket + güven göstergesi), "baseline güveni" çubuğu (`<0.5` ise "Learning baseline…" etiketi), son değer karoları (HR, SpO2, HRV, uyku, su, ruh hali).
- **Orta (telemetri):**
  - **HR grafiği:** son 24 sim-saat; çizgi + **baseline bandı** (median ± `det.z.warning × sigma` gölge alan, `EngineOutput.baselines`'tan) + uyarı işaretçileri (dikey çizgiler/ikonlar) + gece/gündüz bloğu arka planı (hafif şeritler).
  - **SpO2 grafiği:** kritik eşik çizgisi (Evidence: `spo2.critical`, `ProvenanceTag` ile).
  - **Uyku ve aktivite:** son 14 gün sütunlar (uyku süresi + baseline medyan çizgisi + uyku borcu alan).
  - **Radyasyon paneli:** (a) kümülatif **kariyer doz göstergesi** (`Gauge`: careerFraction, 600 mSv sınırı ve %50/%80 eşik işaretleri, etiket "NASA-STD-3001 career limit (verified)" `ProvenanceTag`), (b) doz hızı grafiği (SPE aralıkları gölgeli, beklenen aralık bandı), (c) SPE durum rozeti (IDLE/SUSPECTED/CONFIRMED/DECAYING) + olay dozu / 250 mSv çubuğu.
  - **Kemik tahmini kartı:** aylık tahmini kayıp ve kümülatif; **"Indicative estimate" etiketi zorunlu**, `ProvenanceTag`.
- **Sağ (özet akış):** son 5 uyarı (kompakt; ayrıntılı liste Faz 10), en öncelikli 2 eylem kartı özeti (ayrıntılı Faz 10), Earth Link sayacı mini kartı.
- **Grafik teknik şartları:** Recharts; her grafikte ≤ 600 nokta; animasyonlar kapalı (`isAnimationActive={false}`); güncellemeler ≤ 10 Hz; `ResponsiveContainer`; eksenlerde birim; ayrıntı için `Tooltip` (değer, z, baseline); renk-körü dostu (çizgi stili + ikon farkı); klavye ile odaklanılabilir özet metni `aria-label`.
- **Veri akışı:** `telemetryStore` seçicileri (`selectSeries(crewId, metric, windowMs)`), `React.memo` + selector ile gereksiz yeniden çizim yok. Bir kişi için tüm panel render'ı < 16 ms hedefi (React Profiler ile kaba kontrol).

### 3.5 Kontrol ve durum kenar durumları
- Worker `ERROR` → ekranda `Alert`/toast + "Restart engine" düğmesi.
- Baseline öğrenirken: grafiklerde bant yerine "Learning baseline (day X/14)" etiketi.
- Veri kalitesi: `dataQuality` olayı → ilgili karoda ⚠ "sensor fault/stale".
- Hız ≥ 20× iken grafik başlığında "time compressed" rozeti.

### 3.6 Testler (`tests/ui/`)
- `t()` ve sözlük eşitliği; `ProvenanceTag` varyantları; `MetricTile` değerleri; `Gauge` oran → açı; kokpit sayfası mock motorla render (smoke); dil değiştirme; baseline öğrenirken etiket; kritik durumda `aria-live="assertive"` bölgesi.
- Erişilebilirlik: `axe` benzeri basit kontrol (eklenti eklemeden: el yazması kontrol listesi testi: tüm düğmelerde erişilebilir ad, renk dışı ikon/metin).

## 4. Kabul kriterleri
- [ ] Mock motorla ve (hazırsa) gerçek motorla kokpit canlı akıyor; 50×'te takılma yok.
- [ ] HR grafiğinde baseline bandı ve uyarı işaretçileri görünüyor; radyasyon göstergesi 600 mSv'ye göre doğru.
- [ ] Kemik kartında "Indicative estimate" etiketi; her eşikte `ProvenanceTag`.
- [ ] `en`/`tr` geçişi sorunsuz; eksik anahtar yok.
- [ ] Disclaimer bandı her sayfada.
- [ ] `npm run typecheck/lint/test/build` temiz; konsol hatası yok.

## 5. Yasaklar
UI'dan doğrudan worker mesajı · `Math.random` ile veri · CDN font/ikon · renkle tek başına anlam · tüm geçmişi grafiğe basmak · kemik değerini "ölçüm" diye göstermek · tıbbi tanı dili.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir: bileşen listesi, kullanılan store seçicileri, Faz 10'a bırakılan yer tutucular, ekran görüntüleri (`docs/demo/screens/`).
