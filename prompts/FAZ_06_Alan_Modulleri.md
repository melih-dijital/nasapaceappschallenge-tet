# FAZ 6 — Alan modülleri: Radyasyon, Uyku/Sirkadiyen, Kardiyo/Egzersiz/Kemik tahmini, Davranışsal Sağlık
**Sorumlu:** Kişi B (davranışsal bölüm: Kişi C ile birlikte) · **Süre hedefi:** 3 saat · **Önkoşul:** Faz 5 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §7, §8). Evidence'ta `rad.*`, `bone.*` ve ilgili kayıtları kontrol et. Kaynağı doğrulanmamış (`verified:false`) değerlerin UI'da "doğrulanmadı" etiketi taşıyacağını unutma.

## 1. Amaç
Her sağlık alanı için özel mantık: radyasyon dozu ve güneş partikül olayı (SPE) yönetimi, uyku borcu/sirkadiyen kayma, kardiyovasküler gerilme + egzersiz uyumu + kemik kaybı **tahmini**, davranışsal sağlık (check-in, kısa reaksiyon testi, pasif proxy'ler). Modüller L1/L4'e ek girdi sağlar ve UI için `ModuleReport` üretir.

## 2. Kapsam
**Dahil:** 4 modül, `ModulesStage`, L4/L1 ile bağlantı, `ModuleReport` tipleri, testler.
**Hariç:** UI (Faz 9–10), karar kartları (Faz 7).

## 3. Ortak sözleşme
```ts
interface ModuleReport { module:'radiation'|'sleep'|'cardio'|'behavioral'; crewId:CrewId; t:SimTimeMs; payload:RadiationReport|SleepReport|CardioReport|BehavioralReport; provenance:{evidenceIds:string[]; anyUnverified:boolean} }
interface EngineModule { name:string; process(ctx:EngineContext): ModuleReport[] ; extraStateInputs?(crewId): Partial<Record<StateId, ...>> ; extraL1Hits?(crewId): L1Hit[] }
```
`ModulesStage` sırası **kesin:** `Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist`. Modüller L4'e/L1'e **aynı karede** girdi verir (döngüsel bağımlılık yok: modüller yalnızca baseline/z ve ham çerçeve okur; algılama modül çıktısını okur). Faz 3'te yer tutucu bu sıraya göre kurulmuştur; farklıysa düzelt ve §13'e yaz.

## 4. Görevler

### 4.1 Radyasyon (`modules/radiation.ts`)
- **Doz biriktirme:** `RadiationFrame` geldikçe kişi başına `cumulativeMissionMsv += doseRateMsvDay × dtDay` (dt gerçek kare aralığından: 15 sim-dk). `careerMsv = priorCareerDoseMsv + cumulativeMissionMsv`. Entegrasyon testi: sabit hızda analitik toplamla eşleşir.
- **Yüzdeler:** `careerFraction = careerMsv / getNumber('rad.career.limit.msv')`. `RadiationReport {cumulativeMissionMsv; careerMsv; careerFraction; currentRateMsvDay; baselineRate; rateRatio; projectedMissionEndMsv; projectedCareerFractionAtEnd; speState; speDoseMsv; speFractionOfLimit; environment}`.
- **Projeksiyon:** son `rad.projection.windowDays` gün doz hızı medyanı (robust) ile görev bitişine kadar doğrusal; ayrıca Theil-Sen eğimi pozitifse "artan hız" notu. Görev süresi senaryodan (`durationDays`); yoksa `rad.projection.defaultMissionDays` ve `projectedIsAssumption:true`.
- **SPE durum makinesi:** `IDLE → SUSPECTED → CONFIRMED → DECAYING → IDLE`.
  - `SUSPECTED`: `rateRatio ≥ rad.spe.detect.ratio` **veya** `protonFluxPfu ≥ noaa.s1.proton_flux.pfu` (Evidence; doğrulanmamışsa UI etiketi) en az 1 kare.
  - `CONFIRMED`: koşul `rad.spe.detect.minFrames` ardışık kare sürdü.
  - `DECAYING`: oran `< rad.spe.decay.ratio × baselineRate` olana kadar; `speDoseMsv` olay süresince integre; `IDLE`'e dönüşte olay özeti üret (`SpeSummary {startT,endT,peakRatio,doseMsv,fractionOfSpeLimit}`).
  - `speFractionOfLimit = speDoseMsv / rad.spe.limit.msv` → ≥ 0.5 WARNING, ≥ 0.8 CRITICAL (bu iki oran Faz 1'de DEMO parametre olarak eklendi: `rad.spe.warn.fraction`, `rad.spe.critical.fraction`).
- **L1/L4 bağlantısı:** `CONFIRMED` iken `radiation_event` durumu `score=1`, severity `CRITICAL` (tek istisna: durum çıkarımı CRITICAL üretebilen yol), `timeToHarmMin = earth.timeToHarmMin.radiation_event`; `SUSPECTED` iken ADVISORY/WARNING. Kariyer doz yaklaşımı L1 kancasından (`rad.career.warn/critical.fraction`).
- **Ortam farkı:** beklenen hız ortam başına (Evidence/kalibrasyon); ortam değişince uyarı üretmez, baseline bin'i değişir (Faz 4).
- **Dürüstlük:** `provenance.anyUnverified` — GCR tasarım referansı gibi doğrulanmamış değer kullanılırsa true.
- **Önemli ifade:** UI için `adviceKey`: "Shelter in the most shielded area" tarzı **öneri** — tıbbi talimat değil; eylem Faz 7.

### 4.2 Uyku / Sirkadiyen (`modules/sleep.ts`)
- **Uyku borcu:** `sleepNeedH` = kişinin kendi baseline medyan uyku süresi (hedef değil, kişisel; Evidence'ta insan genel hedefi yoksa kullanılmaz). `debtH(day) = max(0, debtH(day−1)·λ + (baselineMedian − duration))` λ = 0.9 (DEMO: `sleep.debt.decay`). `SleepReport {durationH; efficiency; midpointShiftMin; debtH; regularityIndex; consecutiveShortNights}`.
- **Düzenlilik indeksi:** son `sleep.regularity.windowDays` gün yatış/uyanış orta noktasının MAD'ı (dk) → `sleep.regularity.scaleMin`'e bölünüp 0–1'e kırpılır (Evidence).
- **L4 girdisi:** `sleep_debt` durumu için `extraStateInputs`: `debtH / sleep.debt.criticalH` (DEMO) → 0–1 ve `midpointShift` katkısı.
- Eylem ipuçları: ışık kontrolü (ISS'te günde 16 gündoğumu notu `provenance`'a: NASA HRP uyku sayfası).

### 4.3 Kardiyo / Egzersiz / Kemik tahmini (`modules/cardio.ts`)
- **İstirahat HR:** `BaselineEngine.restingHr` (Faz 4). `CardioReport {restingHr; restingHrDeltaVsBaseline; hrvDelta; spo2Min24h; exerciseAdherence7d; resistiveAdherence7d; boneEstimate}`.
- **Egzersiz uyumu:** son `behavior.windowDays` gün `resistiveMin` toplamı / kişinin baseline haftalık toplamı (0–1+). Düşük uyum uyarısı `det.trend.exercise.*` ile L3'te zaten var; burada yalnızca rapor.
- **Kemik TAHMİNİ (canlı ölçüm DEĞİL):** `estimatedMonthlyLossPct = mid(bone.loss.pct_month) × (1 − bone.estimate.efficacy × resistiveAdherence7dClamped)`; `estimatedCumulativeLossPct` görev gününe göre integre. UI etiketi **zorunlu**: "Indicative estimate — bone density is measured by scans before/after flight" (i18n `bone.estimate.disclaimer`). `provenance`: `bone.loss.pct_month` (NASA HRP, verified) + `bone.estimate.efficacy` (DEMO).
- **Ortostatik/iniş hazırlığı kancası:** görev sonu yaklaşırken (senaryoda `landingDay` varsa) `ACT_PRELANDING_FLUIDS` önerisi için bayrak; yoksa devre dışı (kapsam azaltma kararı: §13'e yaz).
- **L4 girdisi:** `cardio_strain` zaten L2 metriklerinden; modül ek olarak `restingHrDelta` z'sini sağlar.

### 4.4 Davranışsal sağlık (`modules/behavioral.ts`)
- **Günlük check-in (30 sn):** `mood.stress`, `mood.mood`, `mood.motivation` (1–10), isteğe bağlı `journalEntry` (serbest metin — **yalnızca yerel**, NLP yok; `journalCountLast7d` proxy olarak sayılır; metin worker'dan UI dışına çıkmaz, Earth Link paketine **girmez** — gizlilik ilkesi; `PROJECT_MEMORY.md §13`'e ekle).
- **Kısa reaksiyon testi (PVT-benzeri, 60 sn):** UI Faz 10'da; bu fazda **skorlayıcı**: `scorePvt(reactionTimesMs[]): {medianMs; lapses (≥500 ms olanlar); falseStarts; meanInverseRt}`. Adlandırma: "PVT-benzeri kısa test" — resmi PVT-B olmadığını `note`'a yaz (kaynak doğrulaması yok). Eşikler (lapse sınırı 500 ms) DEMO parametre: `pvt.lapse.thresholdMs`.
- **Pasif proxy'ler:** `sleep.regularityIndex`, egzersiz atlama sayısı, check-in atlama sayısı, görev/blok tamamlanma oranı (Faz 7'den), iletişim sıklığı proxy (senaryo olayı; yoksa yok). `BehavioralReport {checkinAdherence7d; moodTrendSlope (Theil-Sen, `behavior.windowDays`); stressTrendSlope; pvtMedianDelta; pvtLapsesDelta; passiveProxyScore; flags:string[]}`.
- **Girdi alma:** worker protokolündeki `SUBMIT_CHECKIN` ve `SUBMIT_PVT` mesajları `DailyFrame` güncellemesine dönüşür (aynı gün çerçevesine birleştir; `userSubmitted:true` işaretlenir — alan Faz 1'de tanımlıdır). Simülatör de her gün otomatik check-in üretir (Faz 2); kullanıcı girişi yalnızca **geçersiz kılar/ekler**.
- **L4 girdisi:** `mood_decline` ve `stress` durumları için `moodTrendSlope` negatifliği ek katkı (DEMO ağırlıklar: `state.mood_decline.w.trendSlope` ve `state.stress.w.trendSlope`).
- **Dil/uyarı:** Çıktılar **tanı değildir**; metinlerde "may indicate", "consider" kalıpları (i18n Faz 9'da). `flags` içinde klinik terim (depresyon vb.) **kullanma**; "mood decline pattern" gibi nötr ifadeler.

### 4.5 `ModulesStage` ve snapshot
`Engine.snapshot().modules[crewId]` kişi başına son `ModuleReport`'lar. Modül hatası yalıtılır.

### 4.6 Testler (`tests/core/modules/`)
- Radyasyon: doz entegrasyonu analitik; SPE durum makinesi tüm geçişler; `solar_particle_event` senaryosunda `CONFIRMED` ≤ +60 sim-dk; kariyer oranı eşikleri; ortam değişimi yanlış alarm üretmez; projeksiyon.
- Uyku: borç birikimi/azalması; düzenlilik; `sleep_debt` senaryosu.
- Kardiyo: kemik tahmini formülü (uyum 0 → tam oran, uyum 1 → (1−efficacy)); etiket `provenance` bayrakları.
- Davranış: `scorePvt` (lapse sayımı, false start), check-in birleştirme, `isolation_low_mood` senaryosunda eğim negatif.
- Faz 5'te `skip` edilen SPE entegrasyon testini **etkinleştir** ve geçir.
- `ModulesStage` sırası: `Baseline → Modules → Detection` entegrasyon testi.

## 5. Kabul kriterleri
- [ ] 4 modül raporu `snapshot()`'ta; SPE senaryosu uçtan uca CRITICAL + doğru süre içinde.
- [ ] Kemik tahmini her yerde "tahmin" etiketli (`provenance` ile).
- [ ] Günlük metni core dışına/Earth Link'e sızmıyor (test: `EarthLink` paket üreticisi journal alanı içermiyor — Faz 7'de kontrol edilecek not).
- [ ] `verified:false` değer kullanan her rapor `anyUnverified:true`.
- [ ] Faz 5 `skip` testi artık yeşil.
- [ ] `npm run typecheck/test/build` temiz.

## 6. Yasaklar
Kemik yoğunluğunu "ölçülen/canlı" göstermek · klinik tanı terimleri · journal metnini loglamak/aktarmak · modül başına ayrı eşik sayıları (Evidence dışı) · NLP.

## 7. Bitirirken
Bu fazda eklediğin tüm i18n anahtarlarını `docs/i18n-keys.md`'ye EKLE (dosya yoksa oluştur); Faz 9 hepsini sözlüğe alacak.
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notu: rapor tipleri, `Baseline → Modules → Detection` sırası, tip eklemeleri (`Alert.timeToHarmMin`, `DailyFrame.userSubmitted`), UI'nin göstermesi gereken `provenance` etiketleri.
