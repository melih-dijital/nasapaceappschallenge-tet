# FAZ 1 — Çekirdek sözleşmeler, Zod şemaları ve Kanıt Kayıt Defteri (Evidence)
**Sorumlu:** Kişi B (kaynak md'ler: Kişi C ve diğerleri) · **Süre hedefi:** 1–1,5 saat · **Önkoşul:** Faz 0 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi tamamen oku (özellikle §6 tipler, §7 kanıt politikası, §11 md protokolü). `docs/sources/` ve `docs/calibration/` içindeki mevcut .md dosyalarını listele ve oku.

## 1. Amaç
Tüm sistemin dayanacağı **tipleri**, **Zod şemalarını** ve **EvidenceRegistry**'yi kur. Bu faz biter bitmez `src/core/types/**` DONDURULUR; UI (Kişi A) mock ile çalışmaya başlayabilir.

## 2. Kapsam
**Dahil:** tipler, şemalar, evidence derleyici betiği, registry, seed/demo parametre md'leri, testler.
**Hariç:** simülatör, baseline, algılama.

## 3. Görevler

### 3.1 Tipler (`src/core/types/`)
Aşağıdaki dosyaları oluştur; hepsini `index.ts`'den dışa aç. Tipler `PROJECT_MEMORY.md §6` ile **birebir** uyumlu olmalı, ek alanlar yalnızca burada belirtilenler:
- `metric.ts`: `MetricId` birleşimi (§6) + `METRIC_META: Record<MetricId, {unit:string; labelKey:string; direction:'higher_worse'|'lower_worse'|'both'; frameKind:'vitals'|'daily'|'radiation'}>`. Yönler: hr higher_worse, spo2 lower_worse, hrv lower_worse, sleep.durationH lower_worse, sleep.efficiency lower_worse, sleep.midpointShiftMin both, activity.* lower_worse, hydrationL lower_worse, cabinCo2ppm higher_worse, mood.stress higher_worse, mood.mood lower_worse, mood.motivation lower_worse, pvt.medianMs higher_worse, pvt.lapses higher_worse, rad.doseRateMsvDay higher_worse.
- `frame.ts`: `VitalsFrame`, `DailyFrame` (**ek opsiyonel alan: `userSubmitted?: boolean`** — Faz 6 kullanıcı check-in/PVT girişleri için), `RadiationFrame`, `TelemetryFrame`, `FrameSource`, `CrewId`, `SimTimeMs`; **`CrewId` değerleri role'den sabittir** (`'cdr'|'md'|'eng'|'sci'`; seed'den TÜRETİLMEZ). Zaman sabitleri (`MS_PER_MIN`, `MS_PER_DAY`, `VITALS_INTERVAL_MIN = 15`) burada DEĞİL, yalnızca `src/core/units.ts`'de.
- `crew.ts`: `CrewProfile {id, displayName, role:'CDR'|'MD'|'ENG'|'SCI', ageBand:'30-39'|'40-49'|'50+', priorCareerDoseMsv:number, baselines: Partial<Record<MetricId,{mean:number; withinSd:number}>>, circadianAmplitudeHr:number, sleepWindow:{startMin:number /*günün dakikası 0-1439*/; durationMin:number}}`.
- `baseline.ts`: `BaselineStat {crewId, metric, bin:string, median, mad, n, updatedT, confidence}` ve `ZResult {z:number; baseline:BaselineStat|null; confidence:number}`.
- `state.ts`: `StateId`, `StateEstimate {crewId, t, state, score:number /*0-1*/, confidence:number, contributors:{metric:MetricId; weight:number; z:number; contribution:number}[]}`.
- `alert.ts`: `Severity`, `AlertKind = 'LIMIT'|'DEVIATION'|'TREND'|'STATE'|'RADIATION'`, `EarthDelayClass`, `AlertStatus = 'ACTIVE'|'ACKED'|'RESOLVED'`, `AlertEvent {type:'OPENED'|'UPDATED'|'ACKED'|'RESOLVED'; alert:Alert; t:SimTimeMs}`, `Alert {id; crewId; kind; severity; state?:StateId; metric?:MetricId; titleKey:string; whyKeys:{key:string; params:Record<string,string|number>}[]; evidenceIds:string[]; suggestedActionIds:string[]; earthDelayClass:EarthDelayClass; timeToHarmMin?:number; confidence:number; status:AlertStatus; firstSeenT:SimTimeMs; lastSeenT:SimTimeMs; ackT?:SimTimeMs; resolvedT?:SimTimeMs}`.
- `action.ts`: `ActionId = string`, `ActionDef {id; titleKey; stepKeys:string[]; appliesToStates:StateId[]; kind:'REST'|'HYDRATE'|'EXERCISE'|'SHELTER'|'CHECK'|'COMMS'|'ENVIRONMENT'; scheduleEffects:ScheduleEffect[]; evidenceIds:string[]}`.
- `schedule.ts`: `ScheduleBlockType = 'SLEEP'|'WORK'|'EVA'|'EXERCISE_AERO'|'EXERCISE_RESISTIVE'|'MEAL'|'HYDRATION'|'REST'|'PSYCH_CHECKIN'|'COMMS'|'SHELTER'`, `ScheduleBlock {id; type; startMin:number /*günün dakikası 0-1439*/; durationMin:number; intensity?:'LOW'|'MED'|'HIGH'; locked?:boolean; reasonKey?:string}`, `DaySchedule {day:number; crewId; blocks:ScheduleBlock[]}`, `ScheduleEffect` (ayrık birleşim: `{op:'SHIFT'|'EXTEND'|'SHORTEN'|'ADD'|'REMOVE'|'SET_INTENSITY'; ...}`), `ScheduleDiffItem {blockId:string; change:'ADDED'|'MOVED'|'SHORTENED'|'EXTENDED'|'INTENSITY'|'REMOVED'|'CONFLICT'; reasonKey:string; byAlertId?:string}`.
- `earthlink.ts`: `EarthLinkConfig {oneWayDelaySec:number; preset:'MOON'|'MARS_MIN'|'MARS_MAX'|'CUSTOM'; blackout:boolean}`, `Message {id; direction:'UP'|'DOWN'; priority:0|1|2|3; category:string; createdT; sendT; arriveT; payload:unknown; status:'QUEUED'|'IN_FLIGHT'|'DELIVERED'}`.
- `evidence.ts`: `SourceType`, `EvidenceEntry {id; value:number|[number,number]; unit:string; sourceType; sourceTitle; sourceUrl:string; note?:string; verificationStatus:'VERIFIED'|'PARTIAL'|'CONFLICTING'|'UNVERIFIED'; verified:boolean /*türetilmiş: status==='VERIFIED'*/; owner?:string; scope?:string}`. Ayrıca `JournalEntry {id; crewId; t; text}` (`journal.ts`) — TelemetryFrame/Engine çıktısı/Earth Link tiplerinden **bağımsız**, yalnızca cihazda kalır; `src/core/units.ts` (ms/sn/dk dönüşümleri ve `MS_PER_*`/`VITALS_INTERVAL_MIN` sabitleri — TEK yer; başka dosyada tanımlama).
- `source.ts`: `SourceStatus {running:boolean; simT:SimTimeMs; day:number; speed:number; scenarioId:string; connected?:boolean}`.
- `scenario.ts` (yalnızca şu iki tip): `ScenarioEvent`, `Scenario` ve olay tipleri burada YOKTUR — Faz 2'de `src/sim/scenario.ts`'de tanımlanır. Burada yalnızca `ScenarioId = string` ve `ExpectedDetection {id; crewId:CrewId|'ALL'; state?:StateId; alertKind?:AlertKind; metric?:MetricId; fromT:SimTimeMs; toT:SimTimeMs; minSeverity:Severity; mustBeEarthClass?:EarthDelayClass}` tanımla.

### 3.2 Zod şemaları (`src/core/schema/`)
Her ayrık birleşim ve veri sözleşmesi için şema: `frame.schema.ts` (`TelemetryFrameSchema` = `z.discriminatedUnion('kind', ...)`), `crew.schema.ts`, `evidence.schema.ts`, `earthlink.schema.ts`. Şema tipleri ile TS tiplerinin uyumunu `z.infer` + tip-eşitlik testi (derleme zamanı `Expect<Equal<...>>`) ile garanti et. Aralık kontrolü şemada YOK (o Faz 3 plausibility'nin işi); şema yalnızca biçim/tip/NaN-Infinity reddi (`z.number().finite()`).

### 3.3 Kanıt kayıt defteri
1. **Md ayrıştırıcı** `scripts/build-evidence.ts` (tsx ile çalışır; `npm run evidence:build`):
   - `docs/sources/*.md` dosyalarını okur; `_` ile başlayan dosyaları ATLAR.
   - YAML front matter'ı (basit ayrıştırıcı yaz; harici paket gerekmiyorsa ekleme, gerekirse `gray-matter` ekleyip §13'e yaz) ve `## Değerler` altındaki ilk markdown tabloyu okur. Sütun adları `templates/SOURCE_TEMPLATE.md` ile aynı; tablo sonunda **isteğe bağlı** `sourceType | sourceTitle | sourceUrl` sütunları olabilir (başlıkta varsa ve hücre doluysa satır düzeyinde, yoksa front matter'daki `sourceType/title/url` kullanılır). `metric` sütunu serbest metindir, doğrulanmaz ve EvidenceEntry'ye taşınmaz (en fazla `note`'a eklenir). Başlık/satır uyumsuzluğunda **dosya adı + satır no ile hata** verir ve süreç `exit 1` ile biter.
   - Doğrulamalar: `evidenceId` tüm dosyalarda benzersiz; `value` sayı veya aralık (`min-max`, `min–max` en-dash; baştaki `+` işareti atılır, normalize edilir); `sourceType` listeden; `status` ∈ {VERIFIED, PARTIAL, CONFLICTING, UNVERIFIED} (**satır başına** sütun; `verified` türetilir); `sourceUrl`: `status ≠ VERIFIED` olan her satır için `—` kabul, `VERIFIED` satırda `http(s)://` ZORUNLU (URL'de boşluk olmamalı, `%20` ile kodlu); `DEMO_PARAMETER` ise `status=UNVERIFIED` zorunlu. Front matter'da `verified` alanı YOKTUR.
   - Çıktı: `src/core/evidence/evidence.generated.json` (sıralı, deterministik, git'e dahil) ve `src/core/evidence/evidenceIds.generated.ts` (tüm id'lerin `as const` listesi + `EvidenceId` birleşim tipi).
   - `predev`, `prebuild`, `pretest` script'lerinden otomatik çağrılır.
2. **Registry** `src/core/evidence/registry.ts`: `getEvidence(id: EvidenceId): EvidenceEntry`, `getNumber(id): number` (aralık ise **hata fırlatır**), `getRange(id): [number, number]`, `getMid(id): number`, `has(id)`, `all()`, `byType(t)`, `unverified()`. Bilinmeyen id → açık hata mesajı (`EvidenceError`). JSON'u statik import eder (DOM yok).
3. **Seed md'ler** (takım md'leri yetişmediyse sistem yine çalışsın):
   - `docs/sources/seed-verified-values.md`: `PROJECT_MEMORY.md §7` tablosundaki değerleri şablon biçiminde yaz (id'ler aynen §7'deki gibi; her satırın `status` değeri §7 tablosundaki `status` sütununa göre; sourceType/sourceTitle/sourceUrl'yi **satır düzeyindeki isteğe bağlı sütunlara** yaz (tek dosyada 5 sourceType, 3 farklı URL var). VERIFIED satırlarda gerçek URL; URL'si bilinmeyen PARTIAL/UNVERIFIED satırlarda `—` (uydurma URL yazma): NASA-STD-3001 teknik özeti `https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf`, kemik riski `https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/`, NTRS `https://ntrs.nasa.gov/api/citations/20250006168/downloads/ASCEND%20Simonsen%20draft%201.pdf`).
   - `docs/sources/demo-parameters.md`: **tüm** algılama/baseline/earthlink parametreleri `DEMO_PARAMETER`, her satır `status=UNVERIFIED`. **Dosya biçimi:** şablonun 7 sütunu (`evidenceId | metric | value | unit | status | scope | note`); aşağıdaki `id` → `evidenceId`, `metric` = `demo`, `status` = `UNVERIFIED`; front matter `sourceType: DEMO_PARAMETER`, `url: —`. **Adlandırma kuralı:** dakika için `...Min` (ör. `det.cooldownMin`), saniye için `...Sec`; `.min`/`.max` son eki yalnızca "alt/üst sınır" demektir. Aşağıdaki id ve başlangıç değerleri:
     | id | value | unit |
     |---|---|---|
     | det.z.advisory | 2.0 | z |
     | det.z.warning | 3.0 | z |
     | det.z.critical | 4.0 | z |
     | det.persist.minFrames.vitals | 4 | frame (vitals 15 sim-dk → 1 saat) |
     | det.persist.minFrames.daily | 1 | gün (günlük metrikler) |
     | det.cusum.k | 0.5 | z |
     | det.cusum.h | 4.0 | z |
     | det.trend.sleep.minDays | 3 | gün |
     | det.trend.sleep.hoursBelow | 6.0 | h |
     | det.trend.exercise.minDays | 2 | gün |
     | det.trend.exercise.minutesBelow | 30 | dk |
     | det.state.sigmoid.k | 6 | — |
     | det.state.sigmoid.bias | 0.5 | — |
     | det.state.score.advisory | 0.5 | — |
     | det.state.score.warning | 0.7 | — |
     | det.state.score.critical | 0.9 | — |
     | det.confidence.cap.threshold | 0.5 | — |
     | det.cooldownMin | 120 | sim-dk |
     | det.theilSen.windowDays | 7 | gün |
     | det.theilSen.minSameSign | 5 | nokta (7'de) |
     | baseline.window.days.target | 14 | gün |
     | baseline.window.days.min | 3 | gün (altında baseline=null; 3–6 gün: var ama güven<0.5) |
     | baseline.sparseBin.minSamples | 8 | örnek |
     | baseline.sparseBin.confidenceFactor | 0.5 | çarpan |
     | buffer.daily.days | 7 | gün |
     | buffer.vitals.hours | 48 | saat |
     | sim.secondsPerSimDay | 20 | s (1× hızda 1 sim-gün kaç gerçek saniye) |
     | sim.speed.min | 0.25 | × |
     | sim.speed.max | 50 | × |
     | baseline.guard.hours | 48 | saat |
     | baseline.hrBlockHours | 6 | saat |
     | minScale.hr | 3 | bpm |
     | minScale.spo2 | 0.5 | % |
     | minScale.hrv | 5 | ms |
     | minScale.sleep.durationH | 0.5 | h |
     | minScale.sleep.efficiency | 0.04 | oran |
     | minScale.sleep.midpointShiftMin | 20 | dk |
     | minScale.activity.exerciseMin | 10 | dk |
     | minScale.activity.resistiveMin | 8 | dk |
     | minScale.hydrationL | 0.25 | L |
     | minScale.cabinCo2ppm | 100 | ppm |
     | minScale.mood.stress | 0.8 | puan |
     | minScale.mood.mood | 0.8 | puan |
     | minScale.mood.motivation | 0.8 | puan |
     | minScale.pvt.medianMs | 15 | ms |
     | minScale.pvt.lapses | 1 | adet |
     | minScale.rad.doseRateMsvDay | 0.03 | mSv/gün |
     | rad.spe.detect.ratio | 3.0 | oran (baseline'a göre) |
     | rad.spe.detect.minFrames | 2 | frame |
     | rad.spe.decay.ratio | 1.5 | oran |
     | rad.career.warn.fraction | 0.5 | oran |
     | rad.career.critical.fraction | 0.8 | oran |
     | bone.estimate.efficacy | 0.5 | oran |
     | earth.timeToHarmMin.radiation_event | 30 | dk |
     | earth.timeToHarmMin.spo2_low | 10 | dk |
     | earth.timeToHarmMin.cardio_strain | 60 | dk |
     | earth.timeToHarmMin.fatigue | 720 | dk |
     | earth.timeToHarmMin.stress | 1440 | dk |
     | earth.timeToHarmMin.dehydration | 480 | dk |
     | earth.timeToHarmMin.sleep_debt | 4320 | dk |
     | earth.timeToHarmMin.mood_decline | 10080 | dk |
     | earth.oneWayDelaySec.moon | 1.3 | s |
     | earth.oneWayDelaySec.mars_min | 180 | s |
     | earth.oneWayDelaySec.mars_max | 1320 | s |
     | earth.groundProcessingMin | 15 | dk |
     | earth.timeToHarmMin.co2_high | 120 | dk |
     | earth.timeToHarmMin.career_dose | 10080 | dk |
     | earth.uplink.kbps | 64 | kbps |
     | earth.outbox.capacity | 200 | mesaj |
     | limit.cabinCo2ppm.warning | 4000 | ppm |
     | rad.spe.warn.fraction | 0.5 | oran |
     | rad.spe.critical.fraction | 0.8 | oran |
     | sleep.debt.decay | 0.9 | /gün |
     | sleep.debt.criticalH | 8 | h |
     | pvt.lapse.thresholdMs | 500 | ms |
     | behavior.windowDays | 7 | gün |
     | alert.recentResolvedHours | 24 | sim-saat |
     | plan.hydrate.extraBlocks | 2 | blok |
     | val.quickSeeds | 3 | seed |
     | rad.projection.windowDays | 7 | gün |
     | rad.projection.defaultMissionDays | 30 | gün |
     | sleep.regularity.windowDays | 7 | gün |
     | sleep.regularity.scaleMin | 60 | dk (MAD→0-1 ölçek) |
     | plan.sleep.durationH | 8 | h |
     | plan.rest.durationMin | 45 | dk |
     | plan.sleepShiftMin | 30 | dk |
     | plan.sleep.minFractionOfBaseline | 0.9 | oran |
     | val.overfit.recallGap | 0.15 | oran |
     | val.target.nominalFpPerCrewDay | 0.1 | alarm/kişi-gün (WARNING+) |
     | val.target.strongRecall | 0.9 | oran |
     | val.target.speDetectP90Min | 60 | sim-dk |
     | val.sensitivity.pct | 20 | % |
     | hydration.max.L | 4.0 | L |
     | state.stress.w.trendSlope | 0.10 | ek katkı ağırlığı (stress; toplam-1 testine DAHİL DEĞİL) |
     | state.mood_decline.w.trendSlope | 0.10 | ek katkı ağırlığı ("ağırlık toplamı 1" testine DAHİL EDİLMEZ; Faz 6'da L4'e eklenir ve toplam yeniden normalize edilir) |
     Ayrıca durum ağırlıkları: `state.<state>.w.<metric>` biçiminde (DEMO) — aşağıdaki başlangıç tablosuyla:
     - fatigue: sleep.durationH 0.30, sleep.efficiency 0.10, pvt.medianMs 0.20, pvt.lapses 0.20, hr 0.05, hrv 0.05, mood.motivation 0.10
     - stress: mood.stress 0.40, hrv 0.20, hr 0.15, sleep.efficiency 0.10, pvt.lapses 0.15
     - dehydration: hydrationL 0.55, hr 0.25, hrv 0.20
     - sleep_debt: sleep.durationH 0.60, sleep.midpointShiftMin 0.40
     - radiation_event: rad.doseRateMsvDay 1.0
     - cardio_strain: hr 0.40, hrv 0.30, spo2 0.20, activity.resistiveMin 0.10
     - mood_decline: mood.mood 0.40, mood.motivation 0.25, mood.stress 0.20, activity.exerciseMin 0.15
     (her durumda `<metric>` ağırlıkları toplamı 1.0 olmalı; `trendSlope` anahtarı bu testten hariç → test yaz).
   - Takım arkadaşlarının eklediği md'ler seed ile **çakışırsa** (aynı id) derleme hata verir; çözüm: seed dosyasındaki ilgili satırı sil, md'yi tek kaynak yap (bunu hata mesajında açıkça söyle).
4. `docs/calibration/` md'leri bu fazda **sadece okunup doğrulanır** (`npm run calibration:check` betiği: başlık/sütun doğrulaması; sütun adı `evidenceId`, front matter'da `verified` alanı YOK); kullanım Faz 2'de.

### 3.4 Testler (`tests/core/`)
- Şema testleri: geçerli/geçersiz her çerçeve türü (NaN, Infinity, eksik alan, yanlış `kind`).
- Evidence derleyici testleri (geçici fixture md'lerle): geçerli, tekrar eden id, hatalı sütun, sayı olmayan value, `DEMO_PARAMETER` + `status≠UNVERIFIED` reddi.
- Registry testleri: seed id'leri var mı, `getNumber` aralıkta hata verir, `byType`, `unverified`.
- Durum ağırlığı toplamı testi.
- Tip-eşitlik testleri.

### 3.5 UI için sözleşme + mock motor (BU FAZIN SON GÖREVİ — Kişi A buna dayanarak Faz 9'a başlar)
- `src/workers/protocol.ts`: UI→Worker ve Worker→UI **mesaj tipleri** (Faz 3 §3.4 listesiyle birebir, `VALIDATION_PROGRESS {done,total}` ve `VALIDATION_RESULT {report:unknown}` dahil; çalışan worker YOK). **Asgari tip şekilleri (Faz 3/7 alan EKLEYEBİLİR, mevcut alanı değiştiremez):** `ChartFrame {t; crewId; metric:MetricId; value:number}`; `EngineOutputLite {t; alertEvents?:AlertEvent[]; states?:StateEstimate[]; cards?:ActionCard[]; dataQualityCount:number}`; `EngineSnapshot {t; latest:Record<string,number> /*"crewId|metric"*/; activeAlerts:Alert[]; states:StateEstimate[]; cards:ActionCard[]; dataQualityCount:number}`; `ActionCard {id; actionId; crewId; priority:number; earthDelayClass:EarthDelayClass; titleKey; stepKeys:string[]; whyKeys:{key:string; params:Record<string,string|number>}[]; sourceAlertIds:string[]; evidenceIds:string[]; state:'SUGGESTED'|'ACCEPTED'|'DISMISSED'|'DONE'}` (`ActionCard` `types/action.ts`'de).
- `src/store/engineClient.ts`: yalnızca **`EngineClient` arayüzü** (`send(msg)`, `subscribe(cb)`, `dispose()`); gerçek uygulama Faz 3'te.
- `src/ui/mock/mockEngine.ts`: aynı arayüzü uygulayan, sabit/seed'li sahte veri üreten sınıf (Faz 2 öncesi basit sinüs+gürültü; sahte uyarı ve karar kartı örnekleri dahil). Faz 3 gerçek motor aynı mesaj protokolünü konuşacak.

## 4. Kabul kriterleri
- [ ] `npm run evidence:build` seed + demo-parameters ile hatasız çalışır; JSON deterministik (iki kez çalıştır, fark yok).
- [ ] Şablona uymayan md'de hata mesajı dosya+satır içerir ve build durur.
- [ ] `src/core/types/**` `PROJECT_MEMORY.md §6` ile birebir; `src/core` içinde DOM yok (lint temiz).
- [ ] Kodda hiçbir eşik sayı olarak yazılmadı.
- [ ] Testler geçiyor.
- [ ] `PROJECT_MEMORY.md §6` ile tip dosyaları arasında fark çıktıysa **hafıza dosyasını** (§6) güncelle ve §13'e yaz.
- [ ] Tipler donduruldu notu §13'te.
- [ ] `protocol.ts`, `EngineClient` arayüzü ve `mockEngine.ts` var; mock ile bir tipli akış testi geçiyor.

## 5. Yasaklar
Seed'de olmayan değeri `VERIFIED` yapma · NASA kaynağı olmayanı `NASA_*` etiketleme · harici ağ çağrısı · şemada aralık (plausibility) kuralı.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notunda UI için `types` ve registry API'sini kısaca belgele.
