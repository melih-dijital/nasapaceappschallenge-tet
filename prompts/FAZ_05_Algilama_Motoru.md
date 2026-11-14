# FAZ 5 — Algılama Motoru (L1 Limitler, L2 Sapma, L3 Trend, L4 Durum) ve Uyarı Yönetimi
**Sorumlu:** Kişi B · **Süre hedefi:** 3 saat · **Önkoşul:** Faz 4 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §7, §8, §9). Evidence'taki `det.*`, `state.*`, `rad.*` parametrelerini listele. Bu motorun **tek bir çıktı sözleşmesi** vardır: `Alert` ve `StateEstimate` (Faz 1 tipleri).

## 1. Amaç
Dört katmanlı, açıklanabilir, histerezisli algılama: ham limitlerden kişisel sapmaya, çok günlü trende ve bileşik **durum çıkarımına**. Her uyarı "ne, neden, hangi kanıt, ne yapmalı, Dünya'yı beklemek güvenli mi" bilgisini taşır.

## 2. Kapsam
**Dahil:** 4 algılama katmanı, Alert yöneticisi (açma/güncelleme/çözme, histerezis, soğuma, dedup), `DetectionStage`, `suggestedActionIds` eşlemesi (ID düzeyinde; içerik Faz 7), `earthDelayClass` **ön sınıflaması** için `timeToHarmMin` ekleme (nihai triyaj Faz 7), testler.
**Hariç:** radyasyon/uyku/kardiyo/davranış alan modülleri (Faz 6 — bu modüller L1–L4'e **ek girdi** sağlar; bu fazda L4'ü onlar olmadan çalıştır, arayüzü hazırla), karar planlayıcı (Faz 7).

## 3. Görevler

### 3.1 L1 — Mutlak limitler (`detection/l1Limits.ts`)
- `evaluateL1(frame, ctx): L1Hit[]`. Kurallar Evidence'tan: `spo2.critical` (SpO2 < eşik → CRITICAL, `timeToHarm = earth.timeToHarmMin.spo2_low`), kümülatif doz yaklaşımı (Faz 6 sağlar; burada kanca): `rad.career.warn.fraction` ve `rad.career.critical.fraction` × `rad.career.limit.msv`, SPE başına `rad.spe.limit.msv` yaklaşımı, kabin CO2 yüksek (`limit.cabinCo2ppm.warning`; Faz 1'de **DEMO_PARAMETER** olarak eklendi, `verified:false`; bu değer NASA limiti gibi sunulmaz — takım birincil kaynağı bulursa md güncellenir).
- L1, baseline'dan **bağımsızdır** ve `confidence = 1` (kaynak doğrulamasına bağlı olarak `evidence.verified` değerini uyarıya taşı: `L1Hit.evidenceVerified`).

### 3.2 L2 — Kişisel sapma (`detection/l2Deviation.ts`)
- Girdi: `ZSnapshot` (Faz 4). Metrik yönüne (`METRIC_META.direction`) göre işaretli sapma: yalnızca "kötü" yöndeki z kullanılır (higher_worse → +z; lower_worse → −z; both → |z|).
- Eşikler: `det.z.advisory/warning/critical`. **Kalıcılık:** tek kare yeterli değil; ardışık kare şartı: `vitals` için `det.persist.minFrames.vitals` (4 kare = 1 saat), günlük metrikler için `det.persist.minFrames.daily` (1 gün). Kalıcılık sayaçları kişi×metrik.
- **Güven kapısı:** baseline güveni < `det.confidence.cap.threshold` ise severity en fazla `ADVISORY`, uyarıya `lowBaselineConfidence` işareti.
- Çıktı: `L2Hit {crewId, metric, severity, z, persistFrames, baselineConfidence}`.

### 3.3 L3 — Trend (`detection/l3Trend.ts`)
- **Art arda gün kuralları:** uyku `sleep.durationH < det.trend.sleep.hoursBelow` art arda `det.trend.sleep.minDays` gün; egzersiz `< det.trend.exercise.minutesBelow` art arda `det.trend.exercise.minDays` gün. (Kaynakları DEMO; AstroHealth'in "3 gün <6 sa uyku" fikrinden esinli olduğunu `note` alanına yaz.)
- **CUSUM** (tek yönlü, her metrik için z üzerinde): `S_t = max(0, S_{t−1} + z_t − k)`; `S_t > h` ise tetik; sıfırlama kuralı (alarmdan sonra S=0 ve soğuma). `det.cusum.k`, `det.cusum.h`.
- **Theil-Sen eğimi** (son `det.theilSen.windowDays` gün): doz hızı ve HR istirahat trendi için pozitif anlamlı eğim → `TREND` uyarısı (eğimin güven aralığını basit bootstrap'sız, işaret tutarlılığıyla ölçerek: eğim işareti, `det.theilSen.minSameSign` noktada aynı yönde).
- Çıktı: `L3Hit {crewId, metric, rule:'CONSECUTIVE'|'CUSUM'|'THEIL_SEN', severity, detail}`.

### 3.4 L4 — Durum çıkarımı (`detection/l4States.ts`)
- 7 durum (`StateId`). Ağırlıklar `state.<state>.w.<metric>` (Evidence; toplam 1).
- Her katkı: `f(z) = clamp(zBad / det.z.critical, 0, 1)` (zBad: kötü yöndeki z). `raw = Σ w·f`. `score = sigmoid(det.state.sigmoid.k × (raw − det.state.sigmoid.bias))`.
- Eksik metrik (o gün veri yok) → ağırlık **yeniden normalize edilir** ve `confidence` düşer (`confidence = baselineConfidenceOrtalaması × kapsanmaOranı`).
- Durum seviyeleri: `score ≥ det.state.score.advisory/warning/critical` → ADVISORY/WARNING/CRITICAL; ama `CRITICAL` yalnızca **L1 doğrulaması veya `radiation_event`** ile (durum çıkarımı tek başına CRITICAL üretmez; üst sınır WARNING — gerekçe: tıbbi aciliyeti statistik skor tek başına ilan etmesin).
- Katkı listesi (`contributors[]`) `contribution = w·f` ile sıralı; UI "katkı çubuğu" bunu çizer.
- `sleep_debt` ve `radiation_event` durumları Faz 6 modüllerinden geçecek ek girdi alır: `StateInputs.extra?: Partial<Record<StateId, {score:number; confidence:number; contributors:...}>>`. Bu fazda arayüz var, değer yok (no-op).
- **Açıklama zorunlu:** `explainState(estimate): ExplanationItem[]` (i18n anahtarı + parametre).

### 3.5 Uyarı yöneticisi (`detection/alertManager.ts`)
- Girdi: L1–L4 sonuçları → `Alert` (Faz 1 şeması).
- **Birleştirme:** aynı kişi+durum için L2/L3/L4 isabetleri tek uyarıda toplanır (`whyKeys` listesine eklenir); en yüksek severity esas.
- **Yaşam döngüsü:** `ACTIVE → ACKED` (kullanıcı) / `RESOLVED` (koşul `det.persist.minFrames.vitals` kare / `.daily` gün boyunca ortadan kalktığında). Severity **artarsa** yeni bir `UPDATED` olayı ve (ACKED ise) tekrar ACTIVE; **azalırsa** uyarı kademeli düşer. Aynı uyarı `det.cooldownMin` içinde tekrar `OPENED` olmaz.
- `AlertEvent` tipi Faz 1 `alert.ts`'de tanımlıdır (`{type; alert; t}`); burada yeniden tanımlama.
- `suggestedActionIds`: durum→eylem eşleme tablosu (`detection/actionMap.ts`): fatigue→`ACT_REST_BLOCK`,`ACT_REDUCE_WORKLOAD`; stress→`ACT_BREATHING`,`ACT_COMMS_FAMILY`; dehydration→`ACT_HYDRATE`; sleep_debt→`ACT_SLEEP_SHIFT`,`ACT_LIGHT_CONTROL`; radiation_event→`ACT_SHELTER`,`ACT_DOSE_CHECK`; cardio_strain→`ACT_REST_BLOCK`,`ACT_CARDIO_CHECK`; mood_decline→`ACT_JOURNAL`,`ACT_COMMS_FAMILY`,`ACT_PSYCH_CHECKIN`. Eylem kataloğu Faz 7'de; burada yalnızca ID sözleşmesi.
- `earthDelayClass` bu fazda varsayılan `CAN_WAIT_FOR_EARTH` + `timeToHarmMin` alanı eklenir (`Alert.timeToHarmMin?:number`); Faz 7 `triage()` sonucu ile nihai sınıfı yazar. (`Alert.timeToHarmMin?` alanı Faz 1 tiplerinde zaten tanımlıdır; yoksa ekle ve §13'e kaydet.)
- **Guard bağlantısı:** WARNING+ aktif uyarı olan kişi için `baseline.setGuard(crew, true, t)`; çözülünce `baseline.guard.hours` sonra false.
- Çıktı: `EngineOutput.states`, `EngineOutput.alertEvents`; `snapshot().alerts` (aktif ve son `alert.recentResolvedHours` sim-saat çözülmüşler).

### 3.6 `DetectionStage`
Sıra: `… Baseline → Modules → Detection → …` (Modules bu fazda no-op; Faz 6 doldurur). Aşama hatası yalıtılır. Performans: 4 kişi × 15 dk kare başına < 2 ms (Node ölçümü, esnek eşik).

### 3.7 Testler (`tests/core/detection/`)
- L1: SpO2 89 → CRITICAL; 90 → CRITICAL değil (sınır testi **Evidence değerine göre**: eşik 90 ise `< 90`).
- L2: kalıcılık (tek kare sıçrama alarm üretmez); düşük güvende severity ≤ ADVISORY; yön duyarlılığı (HR düşük sapma alarm üretmez; SpO2 yüksek üretmez).
- L3: 3 gün <6 sa uyku; CUSUM küçük kalıcı kaymayı yakalar, tek sıçramayı yakalamaz; Theil-Sen.
- L4: ağırlık normalize, eksik veri güveni düşürür, tek başına CRITICAL üretmez.
- Alert yöneticisi: birleştirme, histerezis, cooldown, severity artış/azalış, ack yaşam döngüsü.
- **Senaryo entegrasyonu** (Faz 2 senaryolarıyla, kod `tests/validation/` değil burada hızlı sürüm): `nominal` 30 gün × 4 kişi → WARNING+ uyarı sayısı ≤ hedef (hedef: WARNING+ sayısı ≤ `val.target.nominalFpPerCrewDay` × kişi-gün — Faz 8 ile aynı Evidence id; aşılırsa **parametreleri `demo-parameters.md`'de** ayarla, senaryoyu değil); `sleep_debt` → `sleep_debt`/`fatigue` uyarısı beklenen pencerede; `isolation_low_mood` → `mood_decline`; `dehydration_co2` → `dehydration`; `comm_blackout` → `cardio_strain`. `solar_particle_event` radyasyon modülü (Faz 6) sonrası tamamlanır — bu fazda test `skip` (nedenini yaz).

## 4. Kabul kriterleri
- [ ] 4 katman + uyarı yönetimi çalışır; senaryo testleri (SPE hariç) geçer.
- [ ] Her `Alert` `whyKeys`, `evidenceIds`, `suggestedActionIds`, `confidence` içerir.
- [ ] `nominal`'de yanlış alarm hedef içinde; ayar yalnızca parametrelerle yapıldı (md farkı commit'te görünür).
- [ ] Debug sayfasında aktif uyarılar ve durum skorları + katkılar görülebiliyor.
- [ ] Sihirli sayı yok; `CRITICAL` yalnızca L1/radiasyon yoluyla.

## 5. Yasaklar
ML/Isolation Forest · senaryoya özel koşul · parametre ayarı için senaryo olaylarını kolaylaştırmak (overfitting; ayar seed'leri 1–5 ile, rapor seed'leri 100+ ile — Faz 8) · baseline güveni göz ardı.

## 6. Bitirirken
Bu fazda eklediğin tüm i18n anahtarlarını `docs/i18n-keys.md`'ye EKLE (dosya yoksa oluştur); Faz 9 hepsini sözlüğe alacak.
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notu: `Alert` alanları, `actionMap`, `timeToHarmMin`, hangi test `skip` ve neden.
