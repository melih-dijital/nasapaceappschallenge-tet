# PROJECT_MEMORY.md — Astronot Sağlık Kokpiti (Takım TET)

> **BU DOSYA YAPAY ZEKÂNIN KALICI HAFIZASIDIR.** Yapay zekâ oturumlar arasında hiçbir şey hatırlamaz; bu dosya hatırlar.
> **Kural 1:** Her oturumun başında bu dosyayı TAMAMEN oku. **Kural 2:** Her görevin sonunda §12 (Durum), §13 (Karar günlüğü), §14 (Açık sorular/Sorunlar) ve §15 (Değişiklik günlüğü) bölümlerini güncelle. **Kural 3:** Bu dosyayla çelişen bir şey yapman istenirse DUR, çelişkiyi bildir.

---

## 1. Proje özeti
- Yarışma: NASA Space Apps Challenge 2026 — "Create Health Monitoring Software for Astronauts on Space Missions" (Mars/derin uzay odağı).
- Hackathon: 14–15 Kasım 2026. Teslim: 15 Kasım 2026 23:59. Takım: TET (3 kişi). Son 2 saat: **yeni kod yok**, yalnızca demo/video/teslim.
- Ürün: Astronotun, Dünya ile iletişim gecikmesi altında (Mars için tek yön ≈ 3–22 dk, gidiş-dönüş ≈ 6–44 dk; Ay için tek yön ≈ 1,3 sn) **kendi kendine** sağlık durumunu izleyip erken müdahale kararı alabildiği, **tarayıcıda çalışan, çevrimdışı çalışabilen** bir "sağlık kokpiti".
- Değerlendirme: Impact, Creativity, Validity, Relevance, Presentation (30 sn'de anlaşılmalı).
- **Bu bir tıbbi cihaz/tanı aracı DEĞİLDİR.** Karar desteğidir. Tüm veri **sentetiktir** (veya kaynağı etiketli replay). Arayüzde sürekli görünen bir uyarı bandı olmalı.

## 2. Hedefler ve farklılaştırıcılar
Hedefler: (1) Erken tespit (2) Otonomi (3) Kişiselleştirme (kişinin kendi baseline'ı).
Rakipler (AURORA, Crew-Health-Monitor, AstroHealth, VITALS…) kişisel baseline ve kaynak etiketi yapıyor; bunlar **tek başına fark yaratmaz**. Bizim ayrıştırıcılarımız:
1. **Gecikme-bilinçli triyaj:** her olay için "Dünya'yı beklemek güvenli mi?" → `ACT_NOW | ACT_THEN_REPORT | CAN_WAIT_FOR_EARTH`.
2. **Durum çıkarımı + baseline güveni:** tek vital değil; yorgunluk, stres, uyku borcu vb. bileşik durumlar, katkı çubuklarıyla açıklanır.
3. **Ölçülebilir doğrulama:** senaryo başına hassasiyet/özgüllük/yanlış alarm oranı gösteren sayfa + her eşik için görünür kanıt kaydı.
4. **Davranışsal sağlık:** günlük check-in + kısa reaksiyon testi + pasif proxy'ler.

## 3. Mimari ilkeler (DEĞİŞTİRME)
1. **Onboard-first / çevrimdışı:** tüm algılama ve karar mantığı tarayıcıda. Bulut backend ZORUNLU DEĞİL. İnternet kesilince uygulama çalışmaya devam eder.
2. **Açıklanabilirlik:** her uyarı `whyKeys[]`, `evidenceIds[]`, `suggestedActionIds[]` taşır. Kara kutu/ML modeli yok.
3. **Kişisel baseline + güven skoru.**
4. **Katmanlı algılama:** L1 mutlak limit → L2 kişisel sapma → L3 trend → L4 durum çıkarımı.
5. **Çekirdek saf TypeScript:** `src/core` ve `src/sim` içinde **DOM, React, window, localStorage, IndexedDB/Dexie yok**. (Node'da da çalışmalı: test + opsiyonel ws sunucusu.) Depolama `core` içinde yalnızca **`PersistPort`/`FrameStore` arayüzü** ve bellek uygulamasıdır; Dexie uygulaması `src/store/` altında, dışarıdan enjekte edilir.
6. **Deterministik simülasyon:** tohumlu RNG (mulberry32). Aynı seed → aynı sonuç. Demo ve testler buna dayanır.
7. **Dürüstlük:** Kaynağı olmayan her eşik `DEMO_PARAMETER`. Değer UYDURMA; bilmiyorsan `DEMO_PARAMETER` + `UNVERIFIED`.

## 4. Teknoloji yığını (sabit)
| Katman | Seçim |
|---|---|
| Dil | TypeScript (strict, `noUncheckedIndexedAccess`), `any` yasak |
| Build | Vite, Node 20+, paket yöneticisi: npm |
| UI | React 18+, Tailwind, shadcn/ui, Recharts, lucide-react |
| Durum | Zustand |
| Doğrulama | Zod |
| Depolama | IndexedDB (Dexie) — geçmiş zaman serileri; küçük tercihler için localStorage serbest (yalnızca UI katmanında) |
| Arka plan | Web Worker (simülatör + motor), tipli `postMessage` protokolü (Comlink KULLANMA) |
| Çevrimdışı | vite-plugin-pwa |
| Test | Vitest |
| Opsiyonel sunucu | Node + `ws` (aynı `TelemetryFrame` şeması), tsx ile çalışır |
| Yayın | Vercel (statik) |
| Diller | UI dili: `en` (varsayılan) ve `tr`; sözlük dosyaları `src/ui/i18n/{en,tr}.ts` |

**Yeni bağımlılık eklemeden önce** bu dosyanın §13'üne gerekçeyle yaz. Gereksiz paket ekleme.

## 5. Klasör yapısı
```
/
├─ PROJECT_MEMORY.md        ← bu dosya
├─ CLAUDE.md                ← (AGENTS.md olarak da kopyalanır) hafızayı okutma işaretçisi
├─ prompts/                 ← faz prompt'ları (FAZ_00…FAZ_12, 00_ORTAK_PROMPTLAR.md)
├─ templates/               ← SOURCE_TEMPLATE.md, CALIBRATION_TEMPLATE.md
├─ docs/
│  ├─ sources/              ← takım arkadaşlarının hazırladığı KAYNAK .md dosyaları (kanıt)
│  ├─ calibration/          ← simülatör KALİBRASYON .md dosyaları
│  └─ demo/                 ← demo senaryosu, sunum notları
├─ scripts/                 ← build-evidence.ts, vb.
├─ src/
│  ├─ core/                 ← SAF TS (DOM yok)
│  │  ├─ types/             ← frame, metric, baseline, alert, state, action, evidence tipleri
│  │  ├─ schema/            ← Zod şemaları
│  │  ├─ evidence/          ← registry.ts, evidence.generated.json
│  │  ├─ telemetry/         ← TelemetrySource arayüzü + kaynaklar
│  │  ├─ ingest/            ← plausibility, normalize
│  │  ├─ baseline/
│  │  ├─ detection/         ← l1Limits, l2Deviation, l3Trend, l4States, alertManager
│  │  ├─ modules/           ← radiation, sleep, cardio, behavioral
│  │  ├─ decision/          ← actions, planner
│  │  ├─ earthlink/
│  │  ├─ storage/           ← FrameStore/PersistPort arayüzü + MemoryFrameStore (Dexie burada DEĞİL)
│  │  ├─ validation/        ← runScenario, suite, metrics, sensitivity (saf TS)
│  │  ├─ units.ts           ← zaman/birim dönüşümleri + MS_PER_* sabitleri (TEK yer)
│  │  └─ pipeline/          ← Engine: Ingest → Buffer → Baseline → Modules → Detection(+alertManager, sonda) → Decision → Persist (PersistPort enjekte edilir)
│  ├─ sim/                  ← crew profilleri, senaryolar, üretici, rng
│  ├─ workers/              ← sim.worker.ts, protokol tipleri
│  ├─ store/                ← Zustand store'ları
│  ├─ ui/                   ← components, pages, i18n, theme
│  └─ main.tsx
├─ server/                  ← opsiyonel ws "yer istasyonu"
└─ tests/                   ← core/ sim/ store/ validation/ (node ortamı) · ui/ (jsdom)
```

## 6. Çekirdek sözleşmeler (özet — ayrıntı Faz 1'de `src/core/types` içinde)
```ts
type CrewId = string;               // değerler role'den sabit: 'cdr'|'md'|'eng'|'sci' (seed'den TÜRETİLMEZ)
type SimTimeMs = number;            // görev başlangıcından (T0) beri geçen simüle ms
type FrameSource = 'SYNTHETIC' | 'REPLAY' | 'DEVICE';

type MetricId =
 | 'hr' | 'spo2' | 'hrv'
 | 'sleep.durationH' | 'sleep.efficiency' | 'sleep.midpointShiftMin'
 | 'activity.exerciseMin' | 'activity.resistiveMin'
 | 'hydrationL' | 'cabinCo2ppm'
 | 'mood.stress' | 'mood.mood' | 'mood.motivation'
 | 'pvt.medianMs' | 'pvt.lapses'
 | 'rad.doseRateMsvDay';

interface VitalsFrame   { kind:'vitals';    t:SimTimeMs; crewId:CrewId; hr:number; spo2:number; hrv?:number; source:FrameSource }
interface DailyFrame    { kind:'daily';     t:SimTimeMs; crewId:CrewId; day:number;
  sleep:{ durationH:number; efficiency:number /*0-1*/; midpointShiftMin:number };
  activity:{ exerciseMin:number; resistiveMin:number }; hydrationL:number;
  cabinCo2ppm?:number; mood?:{ stress:number; mood:number; motivation:number /*1-10*/ };
  pvt?:{ medianMs:number; lapses:number }; userSubmitted?:boolean; source:FrameSource }
interface RadiationFrame{ kind:'radiation'; t:SimTimeMs; crewId:CrewId; doseRateMsvDay:number; protonFluxPfu?:number;
  environment:'LEO'|'MARS_TRANSIT'|'LUNAR_ORBIT'|'LUNAR_SURFACE'|'MARS_SURFACE'; source:FrameSource }
type TelemetryFrame = VitalsFrame | DailyFrame | RadiationFrame;

type Severity = 'INFO'|'ADVISORY'|'WARNING'|'CRITICAL';
type StateId  = 'fatigue'|'stress'|'dehydration'|'sleep_debt'|'radiation_event'|'cardio_strain'|'mood_decline';
type EarthDelayClass = 'ACT_NOW'|'ACT_THEN_REPORT'|'CAN_WAIT_FOR_EARTH';
```
Zaman ölçeği: vitals çerçevesi her **15 simüle dakikada** bir; radyasyon çerçevesi her 15 sim-dk; daily çerçevesi sim-günde bir. **Hız birimi:** `speedMultiplier`; **1× = 1 sim-gün ≈ 20 gerçek saniye** (`sim.secondsPerSimDay`, Evidence). Aralık **0.25× … 50×** (50× ≈ 0,4 sn/sim-gün). Baseline başlangıcı için **14 günlük geçmiş anında üretilir (backfill)**; backfill çerçeveleri `t < 0` (gün −14…−1), görev T0=0'da başlar. Ayrıca `new_crew_member` senaryosu yalnızca 3 günlük geçmişle başlar (düşük baseline güveni davranışı görünsün).

**Birimler:** zaman ms (`SimTimeMs`), gecikme parametreleri saniye (`...Sec`), zarar süresi dakika (`...Min`) — parametre adı birimi taşır. Dönüşümleri ve `MS_PER_*` sabitlerini yalnızca tek yerde (`src/core/units.ts`) tanımla. **Ad kuralı:** dakika `...Min`, saniye `...Sec`; `.min`/`.max` son eki yalnızca alt/üst sınır demektir (`sim.speed.min`).

**Ek tipler (Faz 1):** `CrewProfile {…, priorCareerDoseMsv}`; `JournalEntry {id, crewId, t, text}` — **TelemetryFrame dışında, yalnızca cihazda**, asla Earth Link paketine girmez; `RadiationReport`, `CardioReport {…, boneEstimate:{estimatedMonthlyLossPct, estimatedCumulativeLossPct, isEstimate:true}}` (Faz 6). Proton akısı (`protonFluxPfu`) ve kümülatif doz `MetricId` değildir; radyasyon modülü çerçeveden okur. Pasif davranış proxy'leri (uyku düzenlilik indeksi, egzersiz atlama sayısı, check-in uyumu) `BehavioralReport` alanlarıdır, `MetricId` değildir.

**Faz 1 uygulaması (`src/core/types/`, DONDURULDU — tek doğruluk kaynağı):** birleşim tipleri `as const` dizilerden türetilir (`METRIC_IDS`, `STATE_IDS`, `SEVERITIES`, `SOURCE_TYPES`, `ENVIRONMENTS`, …; Zod şemaları aynı dizileri kullanır). Özetten farklar: `CrewProfile.sleepWindow {startMin, durationMin}`; `Message.sendT/arriveT` opsiyonel (QUEUED iken yok); `ScheduleEffect` süre/sayıyı sayı değil Evidence id'siyle taşır (`…ParamId`); `ActionCard` `types/action.ts`'de, `SourceStatus` `types/source.ts`'de; `ExpectedDetection.crewId: CrewId | 'ALL'`. Zaman sabitleri yalnızca `src/core/units.ts`.

## 7. Kanıt (Evidence) politikası
- Her eşik/parametre bir `EvidenceEntry`'dir: `{id, value: number | [min,max], unit, sourceType, sourceTitle, sourceUrl, note, verificationStatus, verified}`; `verificationStatus ∈ VERIFIED | PARTIAL | CONFLICTING | UNVERIFIED` (md tablosunda **satır başına** `status` sütunu), `verified = (status === 'VERIFIED')` derlemede türetilir. `DEMO_PARAMETER` ⇒ `UNVERIFIED`.
- `sourceType`: `NASA_STD | NASA_HRP | PEER_REVIEWED | CLINICAL_CONVENTION | DEMO_PARAMETER`.
- Kodda sihirli sayı yasak: eşikler yalnızca registry API'siyle okunur: `getEvidence(id)`, `getNumber(id)` (aralıkta hata), `getRange(id)`, `getMid(id)`, `has`, `all`, `byType`, `unverified` (`src/core/evidence/registry.ts`).
- Kaynaklar `docs/sources/*.md` dosyalarından (şablon: `templates/SOURCE_TEMPLATE.md`) `scripts/build-evidence.ts` ile üretilir. Ekip arkadaşları bu md'leri doldurur; yapay zekâ **md'de olmayan değeri uydurmaz**.

**Doğrulanmış başlangıç değerleri (ekibin araştırmasından):**
| id | değer | tür | status |
|---|---|---|---|
| `rad.career.limit.msv` | 600 mSv | NASA_STD (NASA-STD-3001 Vol.1) | VERIFIED |
| `rad.spe.limit.msv` | 250 mSv (etkin doz; tasarım referansı SPE: Ekim 1989 olaylarının toplamı) | NASA_STD | PARTIAL (mürettebat koruma hedefi; kişisel olay-başı limit DEĞİL; 30 günlük kan yapıcı organ mGy-Eq limiti ayrı gereksinim, doğrulanmadı; UI etiketi "design reference SPE protection target") |
| `rad.iss.rate.msv_day` | 0.2–0.5 mSv/gün (ISS) | PEER_REVIEWED (NTRS) | VERIFIED |
| `bone.loss.pct_month` | 1–1.5 %/ay | NASA_HRP | VERIFIED |
| `rad.gcr.design.free_space` | 1.3 mSv/gün | NASA_STD (tasarım referansı) | PARTIAL (bireysel limit değil) |
| `rad.gcr.design.surface` | 0.8–0.9 mSv/gün | NASA_STD (tasarım referansı) | CONFLICTING (0.8 vs 0.9) |
| `spo2.critical` | 90 % | CLINICAL_CONVENTION | PARTIAL (genel klinik uygulama; uzay kaynağı değil) |
| `noaa.s1.proton_flux.pfu` | 10 pfu (≥10 MeV) | DEMO_PARAMETER (NOAA S1 ölçeğine dayandığı düşünülüyor) | UNVERIFIED (ekip NOAA SWPC kaynağını bulup md'ye eklemeli) |
| `hct.flight.rise.pct` | +10–12 % | PEER_REVIEWED (ikincil) | UNVERIFIED (birincil kaynak bulunmadan kullanma) |
| diğer tüm (uyku, HR sapması, z eşikleri, CUSUM, ağırlıklar) | — | DEMO_PARAMETER | UNVERIFIED |

NASA HRP risk sayfaları nitelikseldir; HR/SpO2/uyku için sayısal eşik **vermez**. Bunları NASA'dan alınmış gibi sunma.

## 8. Algılama tasarımı (özet)
- **L1 Mutlak limitler:** Evidence'tan (SpO2 < eşik, kümülatif doz yaklaşımı, SPE).
- **L2 Kişisel sapma:** robust z = (x − medyan) / max(1.4826·MAD, minScale[metric]). Saat bloklu baseline (HR için 4×6 saat).
- **L3 Trend:** çok günlü (art arda N gün) + CUSUM (k, h parametreleri DEMO_PARAMETER) + Theil-Sen eğimi (doz hızı, istirahat HR, egzersiz).
- **L4 Durum çıkarımı:** durum başına katkı listesi `{metric, weight, z}`; skor = sigmoid(Σ w·f(z)); çıktı `{state, score, confidence, contributors[]}`.
- **Histerezis/soğuma:** aynı uyarı tekrar tekrar basılmaz; severity yükselirse yeni olay, düşerse çözülür.
- **Baseline yöntemi (tek yöntem):** son 14 günün **kayan pencere medyan/MAD**'ı. EWMA kullanılmaz.
- **Drift koruması:** kişide son `baseline.guard.hours` (48 sa) içinde WARNING+ uyarı varsa yeni örnekler pencereye **alınmaz (baseline donar)**; böylece kademeli kötüleşme "yeni normal" olmaz. Baseline, **bir önceki karenin** uyarı durumunu kullanır (Baseline, Detection'dan önce çalışır). L1 limitleri baseline'dan bağımsızdır.
- **Baseline güveni:** `min(1, nGün / 14)`; güven < 0.5 iken L2/L4 uyarıları `confidence` düşük işaretlenir ve severity en fazla ADVISORY olur.

## 9. Gecikme-bilinçli triyaj (Earth Link)
- Tek yön gecikme ön ayarları: `Moon ≈ 1.3 s`, `Mars min ≈ 3 dk`, `Mars max ≈ 22 dk` (genel bilgi; evidence'ta `UNVERIFIED`), kaydırıcıyla özel.
- Gidiş-dönüş (dk) = `2 × oneWayDelaySec / 60 + earth.groundProcessingMin` (yer ekibi işlem süresi dahil; DEMO 15 dk). Mars min'de ≈ 21 dk, Mars max'ta ≈ 59 dk. Her uyarı türü için `timeToHarmMin` (DEMO_PARAMETER).
- Sınıf: `timeToHarm ≤ roundTrip` ve severity ≥ WARNING → `ACT_NOW`; severity ≥ WARNING ama zaman var → `ACT_THEN_REPORT`; aksi → `CAN_WAIT_FOR_EARTH`.
- Giden kutu: store-and-forward; paketler öncelik sırasıyla; yalnızca onaylı kategoriler.

## 10. Kodlama standartları
- `strict` TS, `any` yok, `unknown` + Zod ile daralt. Saf fonksiyon tercih et. Yan etkiler yalnızca `pipeline`, `store`, `workers`, `ui`.
- Her modül için birim test (Vitest). Motor kodu %80+ satır kapsamı hedefi (zorlama yok, ama test yaz).
- İsimler İngilizce; yorumlar ve kullanıcıya dönük metinler i18n sözlüğünde.
- Küçük, anlamlı commit'ler: `faz-N: kısa açıklama`.
- **Git ve paralel çalışma kuralı (KESİN):** GitHub'a commit atarken kodlar diğer ekip üyelerinin attığı kod ile `main` üzerinde güvenle birleştirilir (merge). Başka birinin çalıştığı/sahip olduğu dosyalara ASLA dokunulmaz, üzerine yazılmaz veya silinmez. Çakışma durumunda diğer ekip üyesinin kodu korunur.
- **Windows uyumu:** bash'e özgü komut yok; betikler `tsx`/Node ile. Tek komut: `npm run check` (= typecheck + lint + test + build). PowerShell'de `&&` zinciri yazma, `npm run check` kullan.
- Rastgelelik yalnızca `sim/rng.ts` üzerinden. `Math.random()` yasak; **istisnalar yalnızca UI'da**: süs animasyonları ve PVT uyaran aralığı (yorumla işaretle).
- Performans: grafikte en fazla ~600 nokta (decimate). Worker→UI mesajlarını toplu (batch) gönder (≤ 10 Hz).
- Erişilebilirlik: renk tek başına anlam taşımaz (ikon + metin), kontrast AA, klavye ile gezinme.
- Güvenlik: sır/anahtar yok; harici ağ çağrısı yok (çevrimdışı çalışmalı). Fontlar/ikonlar yerel paketlenir (CDN yok).

## 11. Kaynak md'lerin kullanım protokolü
- `docs/sources/*.md` → Evidence (şablon: `templates/SOURCE_TEMPLATE.md`).
- `docs/calibration/*.md` → Simülatör kalibrasyonu (şablon: `templates/CALIBRATION_TEMPLATE.md`).
- Dosya biçimi şablona uymuyorsa: **yeniden biçimlendirme önerisi yaz, değer uydurma**, §14'e ekle.
- Sihirli sayı yasağının **tek istisnası**: Evidence dosyaları yoksa registry'nin ve `src/sim/defaults.ts`'nin içindeki geri dönüş değerleri; bunlar `// DEMO_PARAMETER` yorumlu ve `UNVERIFIED` işaretlidir. Başka yerde değer gömmek yasaktır. **İkinci istisna:** `src/sim/scenarios/**` içindeki senaryo ground-truth tanımları (olay büyüklükleri: ×8, 200 pfu, −1.8 h vb.) — bunlar "gerçek" eşik değil, simülatörün enjekte ettiği olaylardır; yine de kaynaklıymış gibi etiketlenmez.
- Kesin dosya adları: `docs/sources/seed-verified-values.md` (§7 tablosu) ve `docs/sources/demo-parameters.md` (tüm DEMO parametreler); `_` ile başlayan dosyalar atlanır.

---

## 12. DURUM (her görevin sonunda güncelle)
| Faz | Başlık | Durum | Not |
|---|---|---|---|
| 0 | Proje iskeleti + hafıza | ☑ | Vite 8 + React 19 + TS 6.0; `npm run check` yeşil (2 test dosyası, 7 test); 4 rota + DisclaimerBar |
| 1 | Sözleşmeler, şemalar, kanıt kayıt defteri | ☑ | 130 evidence kaydı (SPE düzeltmesi sonrası: 3 VERIFIED, 3 PARTIAL, 1 CONFLICTING, 123 UNVERIFIED); tipler donduruldu; protocol + EngineClient + mockEngine hazır; 10 test dosyası / 78 test |
| 2 | Simülatör ve senaryolar | ☑ | Tohumlu RNG (`mulberry32` + FNV-1a `fork`), `SimClock`, kalibrasyon okuyucu (`calibration:build`, 16 DEMO varsayılanı + `getCalibrationProvenance`), `generateCrew`, 3 saf üretici (`vitals`/`daily`/`radiation`), 8 senaryo, `Simulator`, `TelemetrySource` + `InProcessSimSource`; `npm run check` yeşil (16 test dosyası, 103 test) |
| 3 | Giriş, depolama, pipeline, worker | ☑ | `ingest` (Zod + SpO₂ normalize + yinelenen/monotonluk + aralık/bayat sensör `DataQualityTracker`), `storage` (`FrameStore` + `MemoryFrameStore` + `DexieFrameStore` toplu yazım & fallback), `pipeline` (`EngineBuffers` + 7 aşamalı `Engine`, backfill filtreleme & aşama hata izolasyonu), `workers` (`protocolSchema` + `createWorkerHandler` + `sim.worker.ts`), `store` (6 Zustand store + `decimate` + `WorkerEngineClient`/`InProcessEngineClient` + `actions`); `npm run check` yeşil (22 test dosyası, 118 test); `src/ui/**` ve `src/core/types/**` kurala uygun olarak dokunulmadı |
| 4 | Baseline motoru | ☑ | `robustStats` (medyan, MAD, `robustSigma = 1.4826·MAD`, `quantile`, `theilSen`, `winsorize`), `bins` (negatif backfill zamanı için Öklid modlu saat bloğu, `spo2=all`, `day`, `rad env:*`), `BaselineEngine` (sıralı değer + `dayCounts` artımlı kayan pencere, drift guard `setGuard`, `restingHr`, `backfill`), `BaselineStage` (kendi kendine kıyas yok: önce `zscore`, sonra `update`) + `EngineOutputLite.baselines` → `useTelemetryStore` (`latestBaselines`/`baselineBands`); `npm run check` yeşil (25 test dosyası, 132 test); `src/ui/**` ve `src/core/types/**` kurala uygun olarak dokunulmadı |
| 5 | Algılama motoru L1–L4 | ☑ | `core/detection`: L1 (SpO₂, CO₂ + doz kancası), L2 (kalıcılık + güven kapısı), L3 (art arda gün, günlük CUSUM, Theil-Sen), L4 (normalize ağırlık + `explainState`), `AlertManager` (birleştirme/histerezis/soğuma/ACK/guard), `DetectionStage`; nominal WARNING+ = 3 (hedef ≤ 12), 4 senaryo beklenen pencerede, SPE testi `skip` (Faz 6/7); `npm run check` yeşil (28 dosya, 163 test + 1 skip). Debug sayfası (`src/ui`, Kişi A) ve `docs/i18n-keys.md` (Kişi C) sahiplik kuralı nedeniyle yapılmadı (§14) |
| 6 | Alan modülleri (radyasyon, uyku, kardiyo/kemik, davranış) | ☐ | |
| 7 | Karar destek, planlayıcı, Earth Link | ◐ | §3.1–§3.4 tamamlandı (eylem kataloğu, kural tabanlı planlayıcı, gecikme-bilinçli triyaj, EarthLink + paketler/cevaplar; `docs/i18n-keys.md`; 5 yeni birim test dosyası); §3.5 DecisionStage + uçtan uca senaryo testi Faz 5 sonrasına ertelendi |
| 8 | Doğrulama koşucusu | ☐ | |
| 9 | UI-1: Kabuk + Kokpit | ☐ | |
| 10 | UI-2: Uyarılar, karar kartları, davranış, kanıt/doğrulama sayfaları | ☐ | |
| 11 | PWA, çevrimdışı, opsiyonel ws sunucusu, yayın | ☐ | |
| 12 | Cilalama, demo, teslim | ☐ | |

Durum işaretleri: ☐ başlamadı · ◐ sürüyor · ☑ bitti.

**Süre ve sahipler:** Faz 0 (B, 0,5 sa) · 1 (B, 1–1,5) · 2 (B, 2–3) · 3 (B, 2) · 4 (B, 1,5–2) · 5 (B, 3) · 6 (B+C, 3) · 7 (C, 3) · 8 (C+B, 2) · 9 (A, 3–4; mock ile Faz 1'den sonra başlar) · 10 (A+C, 4) · 11 (B+A, 2) · 12 (C+herkes, 6; son 2 sa kodsuz).
**MVP kesme çizgisi** (zaman daralırsa, bu sırayla yeter): Faz 0–3 + en sade Faz 9 kokpiti (biyometri grafikleri, canlı akış) → Faz 4–5 (baseline + L1/L2) → Faz 6 radyasyon/SPE → Faz 7 triyaj + Earth Link sayacı → **Faz 11 PWA + Vercel (ws sunucusu hariç) + Faz 8 `npm run validate` raporu** → Faz 12 demo. Kesme sırası ayrıntısı: `00_BASLA_BURADAN.md §5`. Takım notlarındaki "önce biyometri paneli" önceliği korunur: Kişi A mock veriyle kokpiti en başta görünür kılar.

## 13. KARAR GÜNLÜĞÜ
| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-11-14 | Backend yok; simülatör+motor tarayıcıda Web Worker'da | "Dünya'dan bağımsız" hikâyesiyle tutarlılık; demo riski düşük |
| 2026-11-14 | `TelemetryFrame` ayrık birleşim (vitals/daily/radiation) | Farklı kadanslar; tip güvenliği |
| 2026-11-14 | Kemik yoğunluğu canlı metrik değil, egzersiz uyumundan **tahmin** | NASA: kemik taraması uçuş öncesi/sonrası; Validity |
| 2026-11-14 | UI varsayılan dili `en` (+ `tr`) | Uluslararası jüri |
| 2026-11-14 | ML modeli yok; açıklanabilir kural+istatistik | Gerçek uçuş verisi halka açık değil; denetlenebilirlik |
| 2026-11-14 | Pipeline sırası: `Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist` | Modüller L4/L1'e aynı karede girdi verir; döngüsel bağımlılık yok |
| 2026-11-14 | Tüm eşik/parametreler `docs/sources/*.md` (seed + demo-parameters) → `evidence.generated.json`; kodda sihirli sayı yok | Şeffaflık, Validity puanı, takım md'leriyle birleşme |
| 2026-11-14 | Doğrulama: ayar seed'leri 1–5, rapor seed'leri 100–119; rapora daima "limitations" gömülür | Overfitting'e karşı dürüstlük |
| 2026-11-14 | Journal metni cihazdan çıkmaz, Earth Link paketine girmez | Gizlilik ilkesi |
| 2026-11-14 | İnceleme turu 2 (41 bulgu) düzeltildi: backfillDays, EARTH_DELAY, sleepWindow, AlertEvent/ScheduleDiffItem Faz 1'de, mock motor Faz 1 sonu, persist/cooldown/groundProcessing yeniden adlandırma, baseline min 3 gün, demo_main olayları gün 0–3, Windows komutları | Faz 0/1'i kıran ve tipleri donduran çelişkiler |
| 2026-11-14 | Faz 0 sürümleri: create-vite 9.3.4 → Vite 8.3.8, React 19.3.1, `@vitejs/plugin-react` 6.3.0; **TypeScript 6.0.3** (şablon ~7.0 getiriyor; typescript-eslint 8.72 yalnızca <6.1 destekliyor); Vitest 5.1.0 (+coverage-v8 5.1.0, jsdom 31); ESLint 10.15 + typescript-eslint 8.72.2 + react-hooks 7.1.1; Prettier 3.10.1; **Tailwind 4.3.5** (`@tailwindcss/vite`); **shadcn 4.23.0** (`init -t vite -b radix -p nova --no-monorepo` → style `radix-nova`); react-router-dom 7.18, zustand 5.1, zod 4.6, dexie 4.4, recharts 3.10, lucide-react 1.73 | FAZ_00 madde 2–3; uyumlu en güncel sürümler |
| 2026-11-14 | Alias `@/* → src/*`: `tsconfig.json` + `tsconfig.app.json` `paths` (`baseUrl` yok, TS 6'da kullanımdan kalktı), `vite.config.ts` `resolve.alias`; Vitest `test.projects` (`node`: tests/core, sim, store, validation · `jsdom`: tests/ui) `extends: true` ile aynı alias'ı alır. `tests/` tip denetimine dahil (`tsconfig.app.json` include) | shadcn ve testler aynı yolu çözsün |
| 2026-11-14 | Lint: oxlint kaldırıldı, ESLint flat config. `src/core/**` + `src/sim/**`: `no-restricted-globals` (window, document, localStorage, sessionStorage, indexedDB), `no-restricted-imports` (react, react-dom, dexie + alt yolları), `no-restricted-properties` (Math.random); tüm TS'de `@typescript-eslint/no-explicit-any: error` | §3.5, §10; ihlal kanıtlandı (geçici dosyada 5 hata) |
| 2026-11-14 | Listede olmayan ama gerekli bağımlılıklar: `@testing-library/dom` (RTL 16 zorunlu peer), `@eslint/js` + `globals` (ESLint flat config), `tailwindcss` + `@tailwindcss/vite` (shadcn Vite yönergesi), shadcn init'in eklediği `radix-ui` (bileşen temeli), `tw-animate-css` (bileşen animasyonları), `shadcn` (devDep; `shadcn/tailwind.css` import'u), `cn` (shadcn 4 bileşenleri doğrudan `from "cn"` içe aktarıyor; shadcn-ui deposunun paketi). Kaldırılan: `@fontsource-variable/geist` (§10 sistem fontu kuralı), `oxlint` | Gereksiz paket yok; her biri bir aracın zorunlu parçası |
| 2026-11-14 | UI yerleşimi: shadcn bileşenleri `src/components/ui/` + `src/lib/utils.ts` (components.json varsayılanı, Faz 9–10'da `shadcn add` aynı yere yazar); proje UI kodu `src/ui/` (components, pages). Tema yalnızca koyu (`<html class="dark">`); durum token'ları `--status-info/advisory/warning/critical` (Tailwind: `text-status-*`, `bg-status-*`); sistem font yığını | §4, §5, §10 |
| 2026-11-14 | Git: `main` dalı; `astro-cockpit-kit.zip` `.gitignore`'da (içeriği zaten prompts/ + templates/); boş `astro-cockpit-kit/` klasörü silindi; `validate` yer tutucusu "Faz 8'de eklenecek" der (script Faz 8'e ait) | FAZ_00 madde 7, 11 |
| 2026-11-14 | **Tipler donduruldu** (Faz 1 sonu): `src/core/types/**`. Değişiklik gerekirse bu tabloya karar kaydı + tüm ekibe haber (ortak prompt G). Ayrıntı ve özetten farklar §6 sonunda | Kişi A mock ile Faz 9'a başlayabilsin; sözleşme kaymasın |
| 2026-11-14 | Evidence derleyici: saf ayrıştırıcı `src/core/evidence/markdown.ts` + `sourceMd.ts` (metin girer, kayıt/hata çıkar; testler fixture string'lerle); `scripts/build-evidence.ts` yalnızca dosya okur/yazar. Harici paket yok (`gray-matter` eklenmedi). Kurallar: front matter `id` = dosya adı; front matter'da `verified` yasak; satır düzeyinde isteğe bağlı `sourceType/sourceTitle/sourceUrl`; `-` → `—`; boş tablo hata; hatalar dosya+satır sırasıyla; hata varsa hiçbir çıktı yazılmaz; çıktı yalnızca içerik değiştiyse yazılır | Test edilebilirlik, deterministik çıktı, takım md'lerinde okunur hata |
| 2026-11-14 | Registry: JSON yüklemede Zod ile doğrulanır ve `EVIDENCE_IDS` ile eşleşmezse açık hata verir. `getNumber` aralıkta, `getRange` tek sayıda `EvidenceError` fırlatır; `getMid` ikisinde de çalışır. Enjeksiyon için `registry` nesnesi + `EvidenceRegistry` tipi | Yanlış okuma sessiz kalmasın |
| 2026-11-14 | `evidence:build` kancaları: `predev`, `prebuild`, `pretest` (FAZ_01) + **`pretypecheck`** (ek: `npm run check` typecheck'le başlıyor, `EvidenceId` güncel olmalı). Üretilen `evidence.generated.json` ve `evidenceIds.generated.ts` git'e dahil, `.prettierignore`'da | Taze klonda ve check'te tutarlılık |
| 2026-11-14 | `tsconfig.node.json`: `module: esnext` + `moduleResolution: bundler` + `resolveJsonModule` (betikler tsx ile çalışır ve `src/core`'u import eder). `src/core`, `src/sim`, `src/workers`, `src/store` göreli import kullanır (`@/` yok), böylece Node betikleri ve Faz 11 sunucusu çalıştırabilir; `@/` alias yalnızca UI ve testlerde | nodenext uzantısız import'u reddediyordu |
| 2026-11-14 | Zod 4: `z.number()` NaN ve ±Infinity'yi zaten reddediyor (`.finite()` artık no-op); şemalar `finite()` yardımcısını kullanır. Şemada aralık kontrolü yok (Faz 3 plausibility). Tip eşitliği `tests/core/types.test.ts`'de `Expect<Equal<z.infer, T>>` (8 şema) | FAZ_01 §3.2 |
| 2026-11-14 | Seed md front matter `sourceType: DEMO_PARAMETER`: her satır kendi kaynağını taşır. Kaynak sütunu unutulursa satır VERIFIED etiketini sessizce miras alamaz, derleme hata verir | Dürüstlük §3.7 |
| 2026-11-14 | `calibration:check` doğrulayıcısı `src/sim/calibrationMd.ts`'de (Faz 2 `calibration:build` bunu genişletir): şablondaki iki tablonun sütunları birebir, `evidenceId` sütunu, front matter'da `verified` yasak, en az bir tablo zorunlu | FAZ_01 §3.3.4 |
| 2026-11-14 | Protokol (`src/workers/protocol.ts`): FAZ_01 §3.5 asgari tipleri; FAZ_03'te `{...}` bırakılan payload'lar tanımlandı: `SET_EARTH_LINK {config: Partial<EarthLinkConfig>}`, `SET_CONSENT {categories: ConsentCategory[]}` (`VITALS_SUMMARY/ALERTS/RADIATION/BEHAVIOR_SUMMARY`), `GROUND_REPLY {templateId, relatedAlertId?}`, `REQUEST_VALIDATION {scenarios?, seeds?, quick?}`; ayrımcı alan `type`; `latestKey(crewId, metric)` = `"crewId\|metric"` | Faz 7/8 alan ekleyebilir, mevcut alanı değiştiremez |
| 2026-11-14 | Mock motor (`src/ui/mock/mockEngine.ts`): `Math.random` yok, oransız sinüslerin toplamıyla deterministik gürültü; zamanlayıcı `MockScheduler.every()` ile enjekte; hız ve sim zamanı Evidence'tan (`sim.speed.*`, `sim.secondsPerSimDay`); sahte uyarılar: gün 1'de CDR `sleep_debt` ADVISORY, gün 2'de SCI `radiation_event` CRITICAL/ACT_NOW ve kartları. Sahte değerler yalnızca gösterim, eşik değil | §10 rastgelelik kuralı; Kişi A için tekrarlanabilir akış |
| 2026-11-14 | Commit mesajı yalnızca `faz-N: kısa açıklama`; yapay zekâ imzası veya `Co-Authored-By` satırı eklenmez | Kullanıcı kararı (Faz 1) |
| 2026-11-14 | `rad.spe.limit.msv` kapsamı düzeltildi: VERIFIED → **PARTIAL**. Değer, tasarım referansı SPE (Ekim 1989 olaylarının toplamı) için mürettebat koruma hedefi (etkin doz, mSv); kişisel olay-başı limit değil. Radyasyon uyarı ve UI metinlerinde etiket **"design reference SPE protection target"** olur. FAZ_06 `speFractionOfLimit`, FAZ_09 "olay dozu / 250 mSv çubuğu", FAZ_10 "250 mSv (SPE)" kartı bu etiketle gösterilir, "limit" denmez. Evidence id'si (`rad.spe.limit.msv`) bağımlılıklar kırılmasın diye değişmedi | Dürüstlük §3.7, §7: kaynağı olmayan kesinlik iddia edilmez |
| 2026-11-14 | Kalibrasyon derleyici ayrımı: saf `calibrationBuilder.ts` (JSON ithali yok) + çalışma zamanı okuyucu `calibration.ts` (`calibration.generated.json` ithali); `scripts/generate.ts` `predev/prebuild/pretest/pretypecheck` içinde hem `evidence:build` hem `calibration:build` çalıştırır; `.prettierignore`'a `src/sim/*.generated.*` eklendi | `calibration:build` taze klonda `calibration.generated.json` henüz yokken çalışabilsin; Windows'ta `&&` olmadan ön-üretim |
| 2026-11-14 | Günlük çerçeve zaman damgası `dailyFrameTimeForDay(day) = (day + 1) * MS_PER_DAY - MS_PER_MIN` (23:59); `advanceTo(t)` `< t` aralığını üretir | Backfill gün `-days..-1` her zaman `t ∈ [-days*MS_PER_DAY, 0)` içinde kalır, `dayOf(t) === day`, gün sonu vitals (`23:45`) sonrası sıralı düşer ve 30 gün tam `30*96` vitals/rad + `30` daily üretir |
| 2026-11-14 | `MOOD_DECLINE` olayına isteğe bağlı `ramp?: boolean` eklendi; `isolation_low_mood` `durationDays: 22` (gün 8'den 14 gün); `daily.ts`/`vitals.ts` uyku borcu→PVT/verim/motivasyon, dehidrasyon→HR, HR→HRV fizyolojik eşleştirmesi (`SIM_DEMO_DEFAULTS`) | Kademeli moral düşüşü senaryo sonunda sıfırlanmasın; bileşik durumlar (`fatigue`, `dehydration`, `cardio_strain`) gerçekçi çoklu metrik sinyali üretsin |
| 2026-11-14 | `InProcessSimSource<THandle>` zamanlayıcıyı `IntervalScheduler` olarak enjekte alır (global `setInterval` yok), `tickMs >= 100` (≤ 10 Hz) zorlar; backfill yalnızca ilk `start()` / `reset()` / `setScenario()` sonrasında tek `onFrames` çağrısıyla yayılır | FAZ_02 §3.9, §10; `src/core` içinde zamanlayıcı/DOM bağımlılığı yok |
| 2026-11-14 | `EngineOutputLite` (`src/workers/protocol.ts`) içine isteğe bağlı `dataQuality?: DataQualityEvent[]`, `faults?: EngineFault[]`, `storageWarning?: StorageWarning` eklendi; worker girişi `UiToWorkerMessageSchema` (Zod `discriminatedUnion`) ile doğrulandı | Mevcut kontratı kırmadan veri kalitesi, aşama hatası ve depolama uyarısını UI store'larına taşımak; worker giriş sınırında sıkı doğrulama |
| 2026-11-14 | `DexieFrameStore` (`src/store/dexieFrameStore.ts`) tamponlanmış toplu yazım (≥ 500 çerçeve veya 1 sn flush, `bulkPut`) kullanır ve IndexedDB/kota hatalarında otomatik `MemoryFrameStore`'a düşer + `StorageWarning` bildirir | FAZ_03 §3.2 yazım patlamalarını önlemek ve private/kota hatasında çökmeden devam etmek |
| 2026-11-14 | `Engine` aşama sırası: `IngestStage → BufferStage → BaselineStage → ModulesStage → DetectionStage → DecisionStage → PersistStage`; `IngestStage` `isBackfillOnly` işaretler, `runOnBackfill === false` aşamalar backfill'de atlanır; aşama hataları yakalanıp `faults` ile döner | FAZ_03 §3.3 gereği backfill sırasında geçmiş uyarı/karar kartı üretilmesin ve tek aşama hatası pipeline'ı durdurmasın |
| 2026-11-14 | `decimate` min-max kova seyreltmesi (ilk/son + kova min/max noktaları, 600 nokta sınırı) eklendi; UI yazımları yalnızca `applyWorkerMessageToStores` ve `actions.ts` üzerinden yapılır | FAZ_03 §3.5 grafik serilerinin sivri uçları kaybetmeden UI donmasını önlemesi |
| 2026-11-14 | `BaselineEngine` penceresi her `update`/`evict` adımında sıralı değer dizisi (`sortedValues`), `dayCounts` haritası ve iki-işaretçili sıfır-ayırmalı `madFromSorted` ile güncellenir; budama `sample.t <= newestT - windowMs` ve kapasite ile sınırlandırılır; `setGuard(crewId, active, t)` açıldığında pencere tamamen donar ve eski örnekler zamanaşımıyla atılmaz | Backfill (`10.808` çerçeve) + canlı akışta `O(N log N)` sıralama darboğazını kaldırıp (~20× hızlanma) `workerProtocol`/`engine` testlerini ~250 ms altında tutmak ve guard aktifken 10+ günde baseline'ın silinmesini önlemek |
| 2026-11-14 | Faz 5 algılama `src/core/detection/` altında; `pipeline/stages.ts` yalnızca `DetectionStage`'i yeniden dışa açar. Tüm eşikler `params.ts` üzerinden Evidence'tan; **metrik → durum eşlemesi L4 ağırlıklarından türetilir** (her metrik en yüksek ağırlıklı duruma: hydrationL→dehydration, sleep.durationH→sleep_debt, hr/hrv/spo2→cardio_strain, pvt.*→fatigue, mood.mood/motivation→mood_decline …; eşitlikte `STATE_IDS` sırası); ağırlığı olmayan `cabinCo2ppm` metrik anahtarlı uyarı olur | Yeni sayı icat etmeden FAZ_05 "aynı kişi+durum tek uyarı" birleştirmesi |
| 2026-11-14 | `DetectionStage` batch'i **kare zamanına göre adım adım** işler (her 15 dk / günlük kare için L1–L4 + AlertManager). Sonuç batch boyutundan bağımsız (15 dk ve 6 sa batch'te `sleep_debt` uyarı dizisi birebir; test). Tek istisna: drift guard bir sonraki batch'te baseline'a yansır ("önceki karenin uyarı durumu") → 24 sa batch'te küçük fark; Faz 8 sabit batch boyu kullanmalı | Faz 8 başsız koşularında tekrarlanabilirlik |
| 2026-11-14 | L2: kalıcı seviye = son `det.persist.minFrames.*` karenin hepsinin ulaştığı en yüksek z düzeyi; baseline yoksa (soğuk başlangıç) seri sıfırlanır. L3 CUSUM **yalnızca günlük metriklerde** (vitals'ta k=0.5/h=4 ile günde 96 örnekte yanlış alarm aralığı birkaç güne iner; vitals kalıcılığı L2'nin işi). Theil-Sen: doz hızı gün medyanı + istirahat HR (gece bloğu medyanı); "anlamlı" = eğim>0, ardışık gün farklarında işaret tutarlılığı (`aynı işaretli farklar + 1 ≥ det.theilSen.minSameSign`) ve pencere boyu artış ≥ `minScale[metrik]`. L3 isabetleri ADVISORY | FAZ_05 §3.2–3.3 tanımlarının uygulanabilir yorumu |
| 2026-11-14 | L4: eksik metrik = son 1 sim-günde güncellenmemiş z; vitals z'si son `det.persist.minFrames.vitals` karenin medyanı (anlık gürültü yerine). Katkı ağırlığı mevcut metriklere normalize; `contribution = w'·f`; `confidence = ort. baseline güveni × kapsama`. Faz 6 ek girdisi `extra` skoru max ile birleşir | FAZ_05 §3.4 |
| 2026-11-14 | AlertManager: kişi+durum (veya L1 kuralı / durumsuz metrik) anahtarı; severity max; tür en yüksek severity'li katmandan. **CRITICAL yalnızca L1 veya `radiation_event`** (diğerleri WARNING'e kırpılır). Artış → hemen UPDATED (ACKED → ACTIVE); azalış → hold süresi (vitals `minFrames.vitals×15 dk`, günlük `minFrames.daily×1 gün`) boyunca sürerse bir basamak; çözülme aynı hold süresi boyunca aday yoksa. Soğuma: `det.cooldownMin` içinde aynı/küçük severity yeniden OPENED olmaz, **daha yüksek severity açılır** (güvenlik). Uyarı id'si deterministik `kişi\|anahtar#sıra`. `earthDelayClass` varsayılan `CAN_WAIT_FOR_EARTH` + `timeToHarmMin` (`earth.timeToHarmMin.<durum>`; CO₂→co2_high, SpO₂→spo2_low) | FAZ_05 §3.5 |
| 2026-11-14 | Guard: WARNING+ açık uyarısı olan kişide `BaselineEngine.setGuard(true)`; son WARNING+ anından `baseline.guard.hours` sonra kapanır. `Engine.snapshot().activeAlerts` = açık + son `alert.recentResolvedHours` çözülmüşler (alan adı değişmedi; UI `selectActiveAlerts` RESOLVED'ı süzer). `Engine.ackAlert(id)` + worker `ACK_ALERT` → `ENGINE_OUTPUT {alertEvents:[ACKED]}`; `EngineStage`'e isteğe bağlı `listAlerts`/`ackAlert` | Protokol değiştirilmeden FAZ_05 snapshot ve ACK yaşam döngüsü |
| 2026-11-14 | `tests/store/decimateAndStores.test.ts` beklentisi güncellendi: `demo_main` artık gün 0 sonunda CDR `sleep_debt` uyarısı üretiyor (senaryonun tasarımı); test, olmayan id'ye ACK'in durumu değiştirmediğini kontrol eder | Faz 3 testi algılama no-op iken yazılmıştı |
| 2026-11-14 | `ZSnapshot` (`src/core/pipeline/stages.ts`) Faz 3 yer tutucusundan `{ crewId, metric, t, value, z, confidence, baselineMedian, baselineSigma }` şekline güncellendi; `EngineOutputLite.baselines` ve `useTelemetryStore.baselineBands` (`det.z.warning` ile `bandLow/bandHigh`, 600 nokta sınırı) eklendi | FAZ_04 §3.4 sözleşmesiyle birebir uyum ve UI'ın ekstra hesap yapmadan HR + baseline bandını çizebilmesi |
| 2026-11-14 | `sourceMd.ts` içinde niteliksel kaynaklar için boş `## Değerler` tablosuna izin verildi; `docs/sources/_nasa-hrp-kaynak-analizi.md` şablon biçiminde `docs/sources/nasa-hrp-kaynak-analizi.md` olarak sisteme alındı | HRP risk/tehlike sayfaları nitelikseldir, sayısal sensör eşikleri içermez (§7, §3.7). Değer uydurmamak ve derleyiciyi kırmamak için boş tablo kabul edilir, ilişkili eşikler doğrulanacak olarak listelenir |
| 2026-11-14 | **Paralel çalışma ve Git kuralı donduruldu:** GitHub'a commit atarken kodlar diğer ekip üyelerinin attığı kod ile `main` üzerinde güvenle birleştirilir; diğer kişilerin dosyalarına ASLA dokunulmaz, üzerine yazılmaz veya silinmez | Kullanıcı talimatı; ekip dosyalarının üzerine yazılmasını ve çakışma kayıplarını önleme |
| 2026-11-14 | Faz 7 (§3.1–§3.4) kararları: `ACTION_CATALOG` 13 eylemi ve prosedürel `ACTION_NOTES` notlarını taşır; planlayıcı saf fonksiyondur (`locked` blokları korur, uyku alt sınırı `plan.sleep.minFractionOfBaseline`, direnç tabanı, `hydration.max.L` tavanı ve baş/kuyruk çakışma budaması uygular); triyaj `earth.timeToHarmMin.*` + `earth.groundProcessingMin` parametrelerini Evidence'tan okur (`CRITICAL` radyasyon her zaman `ACT_NOW`); `EarthLink` sim-zamanlıdır (`64 kbps` paket serileştirme gecikmesi + tek yön gecikme; kullanıcı override'ı senaryoya üstündür; uçuştaki mesajın `arriveT`'si kilitlidir; teslim edilmeyen yer yanıtları `pending`'de bekleyip `arriveT`'de `inbox`'a düşer); `packets.ts` ve `EarthLink.send` gizlilik anahtarlarını (`journal`, `rawcheckin`, `diary`) reddeder/temizler; `DecisionStage` (§3.5) Faz 5 sonrasına ertelenmiştir | FAZ_07 §3.1–§3.4 ve §5 kuralları; diğer faz motorlarına bağımlı katmanı (L1–L4) bekletip çekirdek karar destek + EarthLink bileşenlerini bağımsız doğrulamak için |

## 14. AÇIK SORULAR / BİLİNEN SORUNLAR
- [ ] Resmi challenge "Resources" sekmesindeki ek kaynaklar okunamadı (ekip kontrol edecek).
- [ ] `hct.flight.rise.pct` birincil kaynağı bulunacak.
- [ ] GCR yüzey değeri 0.8 mi 0.9 mu — doğrulanacak.
- [ ] Teslim saatinin saat dilimi netleştirilecek.
- [ ] `Astronot_Saglik_Kokpiti_Dokumantasyon.pdf` ESKİ mimariyi anlatıyor (Node/Python ws backend, Railway/Render, /backend-/frontend) ve "NASA HRP eşik değerleriyle kalibre" diyor; teslim dokümanı olarak kullanılacaksa bu kit (§3, §7) ile uyumlu olacak şekilde yeniden yazılmalı (Faz 12).
- [x] **ÇÖZÜLDÜ (commit 349b071 & güncel):** `_nasa-hrp-kaynak-analizi.md` şablon biçiminde `docs/sources/nasa-hrp-kaynak-analizi.md` olarak yeniden yazıldı ve derleyiciye dahil edildi (boş `## Değerler` tablosu, uydurma değer yok, doğrulanacaklar listelendi). Geriye kalan `_csa-radiation-data.md` şablona çevrilene kadar derleyici tarafından atlanmaya devam ediyor.
- [ ] `clsx` ve `tailwind-merge` FAZ_00 listesi gereği kurulu, ama şu an kodda kullanılmıyor (shadcn 4 bileşenleri `cn` paketini kullanıyor). Kaldırma kararı ekipte.
- [ ] `cn@0.5.2` `engines.node >=22` bildiriyor; §4 "Node 20+" diyor. Paket tarayıcıya paketlendiği için çalışma zamanını etkilemez; Node 20'de npm yalnızca uyarı verir.
- [ ] npm 11 `allow-scripts`: esbuild'in postinstall betiği onaylanmadığı için çalışmadı; tsx/vite/vitest yine sorunsuz. Gerekirse `npm approve-scripts esbuild`.
- [ ] Faz 0'da `npm run dev` HTTP ile (4 rota 200) ve jsdom testleriyle doğrulandı; gerçek tarayıcıda göz kontrolü yapılmadı. Faz 9 başında bir kez açıp bakılmalı.
- [x] Git kimliği: depo kimliği kullanıcı tarafından `Melih Yeşilyurt <imyesilyurt1677@hotmail.com>` yapıldı (349b071 ve sonrası). Yalnızca Faz 0 commit'i (074ae91) eski `16tryesilyurt61` kimliğini ve bir `Co-Authored-By: Claude` satırını taşıyor.
- [ ] `README.md` hâlâ Vite şablon metni (Faz 12'de yeniden yazılacak).
- [ ] `rad.spe.limit.msv` (PARTIAL): birincil standart (NASA-STD-3001 Vol.1) açılıp 30 günlük limitle karşılaştırılacak.
- [ ] i18n anahtarları: `METRIC_META.labelKey` (`metric.*`) ve mock'taki `alert.*.title`, `why.*` henüz tam sözlükte yok; `docs/i18n-keys.md` Faz 7 anahtarlarıyla (`action.*`, `plan.diff.*`, `triage.reason.*`, `ground.reply.*`) başlatıldı. Faz 9 kalan anahtarları sözlüğe alırken mock anahtarlarının yer tutucu olduğunu bilmeli.
- [ ] Mock motorun sahte değerleri ve uyarıları yalnızca `src/ui/mock/` altında; Faz 3'te UI gerçek `engineClient`'a geçince kullanılmayacak.
- [ ] `docs/calibration/` altında henüz `.md` dosyası yok; bu nedenle `calibration.generated.json` içindeki tüm 16 metrik ve 5 ortam şu an `DEMO_PARAMETER` (`demo: true`) varsayılanlarıyla üretiliyor (takım `.md` ekleyince `calibration:build` otomatik üzerine yazar).
- [ ] Windows PowerShell yürütme ilkesi `npm.ps1`'i engelleyebiliyor; doğrudan PowerShell'de `npm.cmd run check` kullanılıyor (`scripts/check.ts` ve `scripts/generate.ts` içinde `shell: true` cmd üzerinden sorunsuz çalışıyor).
- [ ] Faz 3 kapsamı gereği `src/ui/**` (Kişi A alanı) değiştirilmedi; canlı Web Worker telemetrisini gösterecek debug/canlı bağlama (`createEngineClient` -> `applyWorkerMessageToStores`) henüz UI sayfalarına bağlanmadı (Kişi A'nın Faz 9 / canlı bağlantı adımı).
- [ ] Faz 4 kapsamı gereği `src/ui/**` (Kişi A alanı) değiştirilmedi; `useTelemetryStore.selectBaselineBand` / `selectLatestBaseline` hazır ancak UI debug/kokpit sayfasında HR + baseline bandı çizimi Faz 9'da Kişi A tarafından bağlanacak.
- [ ] **Faz 5 – debug sayfası yapılmadı** (FAZ_05 kabul 4): `src/ui/**` Kişi A'nın klasörü. Veri hazır: `useAlertStore` (`applyAlertEvents`, `selectActiveAlerts`) ve `useStateStore.states` (`StateEstimate.contributors` katkı çubukları için) worker akışından doluyor. Kişi A bağlamalı.
- [ ] **Faz 5 i18n anahtarları `docs/i18n-keys.md`'de yok** (FAZ_05 §6): dosya Faz 7'de Kişi C tarafından başlatıldı (merge sonrası mevcut) ama algılama anahtarları (`alert.*`, `why.l1/l2/l3/state.*`, `why.baseline.lowConfidence`, `metric.*`) eklenmedi; `docs/**` Kişi C'nin klasörü olduğu için Faz 5 dokunmadı. Liste + parametreler `src/core/detection/i18nKeys.ts` (`DETECTION_I18N_KEYS`); Kişi C aktarmalı (senaryo/bookmark anahtarları `scenario.*`, `bookmark.*` de).
- [ ] **ADVISORY gürültüsü** (parametre ayarı YAPILMADI): nominal 30 gün × 4 kişide WARNING+ = 3 (hedef ≤ 12, seed 1–5'te 1–7) ama ≈ 70 ADVISORY (≈ 0,6 / kişi-gün). Başlıca kaynaklar: tek metrikli `radiation_event` L4'ü (doz hızı gürültüsü, z≥2), az kapsamlı L4 durumları (ör. yalnız HR/HRV ile `fatigue`, güven ~0.1), sınırda dalgalanan durumların açılıp kapanması (ör. `comm_blackout`'ta ENG `cardio_strain` 1,1 günde 6 kez). Ayar `docs/sources/demo-parameters.md`'de (Kişi C) ve yalnız ayar seed'leriyle yapılmalı; öneri adayları: `det.state.sigmoid.bias` ↑, `det.cooldownMin` ↑, `det.z.advisory` ↑. Faz 8 ADVISORY'yi ayrı satırda raporlayacak.
- [ ] Bazı uyarılar olay başlangıcından önce gürültüyle açılıp pencereye taşınıyor (ör. `sleep_debt` senaryosunda ENG `fatigue` gün 4 sonunda). Faz 5 testi "pencerede etkin uyarı" ölçüsünü kullanır; Faz 8'in `firstSeenT ∈ [fromT,toT]` TP kuralı bunları FN sayabilir — Faz 8'de UPDATED olaylarının da sayılıp sayılmayacağı karara bağlanmalı.
- [ ] `solar_particle_event` entegrasyon testi `it.skip` (FAZ_05 §3.7): L4 `radiation_event` Faz 5'te de SPE başında 4 kişide CRITICAL açılıyor, ama SPE durum makinesi (Faz 6) ve `ACT_NOW` triyajı (Faz 7) yok. Faz 6'da etkinleştirilecek.
- [ ] Faz 7 §3.5 `DecisionStage` ve uçtan uca senaryo testi: **Faz 5 sonrası** (Faz 3 worker/pipeline ve Faz 5 L1–L4 algılama motoru tamamlanınca entegre edilecek).

## 15. DEĞİŞİKLİK GÜNLÜĞÜ
| Tarih/Saat | Faz | Yapan | Ne yapıldı | Dokunulan dosyalar |
|---|---|---|---|---|
| 2026-11-14 12:31 | 0 | Claude (Kişi B oturumu) | Vite+React+TS iskeleti (`_scaffold` üzerinden), TS 6.0 sabitleme, ESLint/Prettier/Vitest (node+jsdom projeleri), Tailwind 4 + shadcn (14 bileşen), §5 klasör ağacı + `.gitkeep`, npm script'leri + `scripts/check.ts`, koyu tema, 4 rota + DisclaimerBar, smoke/App testleri, `.gitignore` birleştirme | `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `components.json`, `index.html`, `public/favicon.svg`, `src/**`, `tests/**`, `scripts/**`, `server/.gitkeep`, `docs/calibration/.gitkeep`, `docs/demo/.gitkeep`, `PROJECT_MEMORY.md` §12–15 |
| 2026-11-14 13:00 | 1 | Claude (Kişi B oturumu) | 13 tip dosyası + `units.ts`, Zod şemaları (+ tip eşitliği), saf md ayrıştırıcı + `evidence:build` (130 kayıt), registry, seed ve demo-parameters md'leri, `calibration:check`, protokol + EngineClient + mock motor, 8 yeni test dosyası | `src/core/units.ts`, `src/core/types/*` (14), `src/core/schema/*` (6), `src/core/evidence/{markdown,sourceMd,registry}.ts` + `*.generated.*`, `src/sim/calibrationMd.ts`, `src/workers/protocol.ts`, `src/store/engineClient.ts`, `src/ui/mock/mockEngine.ts`, `scripts/{build-evidence,check-calibration,placeholder}.ts`, `docs/sources/{seed-verified-values,demo-parameters}.md`, `tests/core/*` (7 yeni), `tests/ui/mockEngine.test.ts`, `package.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.prettierignore`, `PROJECT_MEMORY.md` §6, §12–15 |
| 2026-11-14 | 1 (düzeltme) | Claude (kullanıcı isteği) | `rad.spe.limit.msv` VERIFIED → PARTIAL; scope/note: tasarım referansı SPE (Ekim 1989 toplamı) koruma hedefi, kişisel limit değil; UI etiketi "design reference SPE protection target"; registry testindeki §7 status'u güncellendi | `docs/sources/seed-verified-values.md`, `src/core/evidence/evidence.generated.json`, `tests/core/registry.test.ts`, `PROJECT_MEMORY.md` §7, §12–15 |
| 2026-11-14 | 1 (düzeltme) | Claude (kullanıcı isteği) | SPE etiketi şablon ve prompt'lara taşındı: şablon örnek satırı PARTIAL; FAZ_06/09/10'da 250 mSv için "design reference SPE protection target" (alan adları `speFractionOfLimit`/`fractionOfSpeLimit` ve evidence id `rad.spe.limit.msv` değişmedi) | `templates/SOURCE_TEMPLATE.md`, `prompts/FAZ_06_Alan_Modulleri.md`, `prompts/FAZ_09_UI1_Kabuk_ve_Kokpit.md`, `prompts/FAZ_10_UI2_Uyarilar_Karar_Davranis_Kanit.md`, `PROJECT_MEMORY.md` §15 |
| 2026-11-14 | 1 (düzeltme) | Melih Yeşilyurt (Claude ile) | FAZ_05 L17: SPE yaklaşımı "design reference SPE protection target" ifadesiyle (evidence id değişmedi) | `prompts/FAZ_05_Algilama_Motoru.md`, `PROJECT_MEMORY.md` §14–15 |
| 2026-11-14 13:33 | 2 | Kişi B oturumu | Tohumlu RNG + `SimClock`, DEMO varsayılanları + `calibrationBuilder`/`calibration:build` + `getCalibrationProvenance`, `generateCrew`, 3 saf üretici (`vitals`/`daily`/`radiation`), olay tipleri + SPE eğrisi + 8 senaryo, `Simulator`, `TelemetrySource` + `InProcessSimSource`, `scripts/generate.ts`, 6 yeni sim test dosyası (25 yeni test) | `src/sim/{rng,clock,defaults,calibrationBuilder,calibration,calibration.generated.json,crew,scenario,simulator,index}.ts`, `src/sim/generators/*` (5), `src/sim/scenarios/*` (9), `src/core/telemetry/{source,inProcessSource,index}.ts`, `scripts/{build-calibration,generate}.ts`, `tests/sim/*` (6), `package.json`, `.prettierignore`, `PROJECT_MEMORY.md` §12–15 |
| 2026-11-14 13:42 | 3 | Kişi B oturumu | `ingest` (plausibility, normalize, dataQuality), `storage` (`FrameStore`, `MemoryFrameStore`, `DexieFrameStore`), `pipeline` (`EngineBuffers`, 7 aşama, `Engine`), `workers` (`protocol`, `protocolSchema`, `workerHandler`, `sim.worker`), `store` (`decimate`, 6 Zustand store, `WorkerEngineClient`/`InProcessEngineClient`, `actions`), 6 yeni test dosyası (15 yeni test) | `src/core/ingest/*` (4), `src/core/storage/*` (3), `src/core/pipeline/*` (4), `src/workers/*` (4), `src/store/*` (11), `tests/core/{ingest,engine,frameStore}.test.ts`, `tests/store/{dexieFrameStore,workerProtocol,decimateAndStores}.test.ts`, `PROJECT_MEMORY.md` §12–15 |
| 2026-11-14 13:52 | 4 | Kişi B oturumu | `robustStats`, `bins`, `BaselineEngine` (artımlı sıralı pencere, drift guard, `restingHr`, `backfill`), `BaselineStage` + `ZSnapshot`, `EngineOutputLite.baselines` + `useTelemetryStore` bant seçicileri, 3 yeni baseline test dosyası (14 yeni test) | `src/core/baseline/{robustStats,bins,baselineEngine,index}.ts`, `src/core/pipeline/{stages,engine}.ts`, `src/workers/{protocol,workerHandler}.ts`, `src/store/{telemetryStore,index}.ts`, `tests/core/baseline/{robustStats,baselineEngine,baselineStage}.test.ts`, `PROJECT_MEMORY.md` §12–15 |
| 2026-11-14 14:25 | 5 | Kişi B oturumu (Claude ile) | L1–L4 algılama, `AlertManager`, `actionMap`, `DetectionStage` (kare zamanına göre adımlı), Engine `snapshot().activeAlerts` + `ackAlert`, worker `ACK_ALERT`, i18n anahtar listesi, 3 yeni test dosyası (32 test, 1 skip); Faz 3 store testinin beklentisi güncellendi | `src/core/detection/{params,l1Limits,l2Deviation,l3Trend,l4States,actionMap,alertManager,detectionStage,i18nKeys,index}.ts`, `src/core/pipeline/{stages,engine}.ts`, `src/workers/workerHandler.ts`, `tests/core/detection/{helpers,layers.test,alertManager.test,scenarios.test}.ts`, `tests/store/decimateAndStores.test.ts`, `PROJECT_MEMORY.md` §12–15 |
| 2026-11-14 | Kaynak entegrasyonu | Takım TET (Kişi C / Claude) | `_nasa-hrp-kaynak-analizi.md` şablon biçiminde `docs/sources/nasa-hrp-kaynak-analizi.md` olarak yeniden biçimlendirildi; HRP niteliksel olduğu için değer uydurulmadı, `sourceMd.ts`'de boş tablo desteği sağlandı, `npm run check` yeşil | `docs/sources/nasa-hrp-kaynak-analizi.md`, `src/core/evidence/sourceMd.ts`, `PROJECT_MEMORY.md` |
| 2026-11-14 | Kural güncellemesi | Melih Yeşilyurt (Claude ile) | Git ve paralel çalışma kuralı eklendi: commit atarken diğer ekip üyelerinin kodlarıyla main'de birleştir, başkalarının dosyalarına kesinlikle dokunma | `AGENTS.md`, `CLAUDE.md`, `PROJECT_MEMORY.md` §10, §13, §15, §16 |
| 2026-11-14 | 7 (§3.1–§3.4) | Melih Yeşilyurt | Eylem kataloğu (`actions.ts`), kural tabanlı planlayıcı (`planner.ts`), gecikme-bilinçli triyaj (`triage.ts`), Earth Link simülatörü + paketler + yer cevapları (`link.ts`, `packets.ts`, `groundReplies.ts`), `docs/i18n-keys.md` ve 5 birim test dosyası tamamlandı (§3.5 Faz 5 sonrasına bırakıldı); `npm run check` yeşil (15 dosya, 111 test) | `src/core/decision/{actions,planner,triage}.ts`, `src/core/earthlink/{packets,groundReplies,link}.ts`, `docs/i18n-keys.md`, `tests/core/decision/{actions,planner,triage}.test.ts`, `tests/core/earthlink/{packets,link}.test.ts`, `PROJECT_MEMORY.md` §12–15 |

---

## 16. Yapay zekâ çalışma protokolü (HER OTURUM)
**Başlarken:** (1) Bu dosyayı oku. (2) §12'den sıradaki fazı belirle. (3) İlgili `docs/sources` ve `docs/calibration` dosyalarına bak. (4) `git status` / son commit'leri oku. (5) Planını 5–10 maddede yaz, sonra kodla.
**Çalışırken:** Kapsam dışına çıkma. Belirsizlik varsa varsayım yap, §14'e yaz, devam et. Kullanıcıya kısa soru ancak ilerlemeyi gerçekten engelliyorsa.
**Bitirirken:** (1) `npm run check` çalıştır; sonuçları raporla. (2) §12, §13, §14, §15'i güncelle. (3) Commit. (4) Sonda "Sonraki faz için devir notu" yaz (5 madde).
**Yapma:** Değer uydurma · kaynağı olmayanı NASA diye etiketleme · mimari ilkeleri (§3) bozma · `core`/`sim` içine DOM sokma · yeni bağımlılığı sessizce ekleme · bu dosyayı silme/kısaltma (yalnızca güncelle) · **başkalarının dosyalarına dokunma/ezme/silme; GitHub commit'lerinde kodları main'de güvenle birleştir**.
