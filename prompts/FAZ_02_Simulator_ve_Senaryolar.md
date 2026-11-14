# FAZ 2 — Simülatör, mürettebat profilleri ve senaryolar
**Sorumlu:** Kişi B (kalibrasyon md'leri: Kişi C) · **Süre hedefi:** 2–3 saat · **Önkoşul:** Faz 1 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §6, §10). `docs/calibration/*.md` dosyalarını oku. `src/core/types/**` ve `EvidenceRegistry` API'sini incele. **Bu fazda `src/sim/**` ve `src/core/telemetry/**` içinde DOM, `Math.random`, `Date.now()` YASAK.**

## 1. Amaç
Tohumlu (deterministik), gerçekçi ve senaryo yönetimli bir telemetri üreticisi. Çıktısı yalnızca `TelemetryFrame` akışıdır. Bu üreticinin amacı demo ve **doğrulama** için kontrollü ground-truth sağlamaktır (hangi olay ne zaman enjekte edildi bilinir).

## 2. Kapsam
**Dahil:** RNG, saat, mürettebat profilleri, üreticiler (vitals/daily/radiation), senaryo motoru ve 8 senaryo, `TelemetrySource` arayüzü ve süreç-içi (`InProcessSimSource`) uygulaması, kalibrasyon md okuyucu, testler.
**Hariç:** Worker (Faz 3), WebSocket kaynağı (Faz 11), baseline/algılama.

## 3. Görevler

### 3.1 RNG (`src/sim/rng.ts`)
- `mulberry32(seed)`; `Rng` sınıfı: `next()`, `normal(mean, sd)` (Box–Muller; ikinci değeri önbelleğe al), `uniform(a,b)`, `int(a,b)`, `chance(p)`, `pick(arr)`, `fork(label: string): Rng` (etiketten türetilmiş alt-seed: `hash(seed + label)`, FNV-1a), `ar1(prev, mean, phi, sd)` yardımcı.
- Aynı seed + aynı çağrı sırası → aynı çıktı (test).

### 3.2 Saat (`src/sim/clock.ts`)
`SimClock`: `t` (SimTimeMs), `advance(dtMs)`, `dayOf(t)`, `minuteOfDay(t)`, `hourOfDay(t)`. Gerçek zaman bağımlılığı YOK; çağıran `advance` verir. `speedToSimMsPerRealMs(speedMultiplier)` yardımcı: **1× = `sim.secondsPerSimDay` (20 gerçek sn / sim-gün)**; formül `speedMultiplier × MS_PER_DAY / (sim.secondsPerSimDay × 1000)`; aralık `sim.speed.min..max` (0.25×–50×).

### 3.3 Kalibrasyon okuyucu (`scripts/build-calibration.ts` → `src/sim/calibration.generated.json`)
`docs/calibration/*.md` (şablon: `templates/CALIBRATION_TEMPLATE.md`) tablolarını okuyup JSON üret. `npm run calibration:build`. Dosya yoksa/eksikse `src/sim/defaults.ts` içindeki **DEMO varsayılanlarını** kullan ve her varsayılan için `demo:true` işaretle. Kalibrasyon kaynağı olan metrikleri UI'da göstermek için `getCalibrationProvenance(metric)` fonksiyonunu sağla. `evidence:build` ile birlikte `predev/prebuild/pretest`'te çalışsın.

### 3.4 Mürettebat (`src/sim/crew.ts`)
- `generateCrew(seed, n=4): CrewProfile[]` — kalibrasyondaki `betweenSd` ile **kişiler arası farklı** baseline'lar (örn. istirahat HR: 54, 61, 66, 70). Görev rolleri CDR, MD, ENG, SCI; görünen adlar kurgusal (örn. "Cmdr. A. Rivera", "Dr. M. Okafor", "Eng. L. Chen", "Sci. T. Yılmaz" — gerçek kişi adı yok).
- `priorCareerDoseMsv`: 0–150 arası kurgusal (kalibrasyon yoksa DEMO).
- Çift sabit: aynı seed → aynı mürettebat.

### 3.5 Üreticiler (`src/sim/generators/`)
Her üretici saf fonksiyon: `(state, t, crew, rng, activeEffects) => frame`.
- **vitals.ts** (15 sim-dk): `hr = baselineHr + circadian(t) + activityEffect + ar1 gürültü + efektler`; sirkadiyen sinüs (uyku bloğunda −8..−12 bpm; genlik `circadianAmplitudeHr`); `spo2 = baseline + N(0,withinSd)` üst sınır 100; `hrv` HR ile ters ilişkili (isteğe bağlı alan; üret). Gece/gündüz uyku modeli: uyku penceresi `CrewProfile.sleepWindow`'dan okunur (örn. 22:30–06:30 ± kişi farkı).
- **daily.ts** (her sim-günde 1; gün sonunda üretilir): uyku (`durationH`, `efficiency`, `midpointShiftMin`), `activity` (aero + resistif), `hydrationL`, `cabinCo2ppm` (kabin ortak ama kişiye küçük farklar), `mood` (1–10: stress/mood/motivation; AR(1)), `pvt` (medianMs ≈ 250±; `lapses` Poisson-benzeri). Günler arası **AR(1) kalıcılık** (ardışık günler bağımsız olmasın).
- **radiation.ts** (15 sim-dk): `doseRateMsvDay = environmentMean × N(1, withinSd/mean)`; `protonFluxPfu` normalde ~0.1–1 civarı arka plan; kişisel dozimetre farkı küçük.
- **Tüm değerler fiziksel olarak makul aralıkta kırpılır** (calibration `plausibleMin/Max`).

### 3.6 Olay tipleri ve senaryo (`src/sim/scenario.ts`)
CrewId'ler role'e sabittir (`cdr|md|eng|sci`), seed'den türemez; `expected.crewId` bir CrewId veya `'ALL'`. `ScenarioEvent` ve `Scenario` tipleri **yalnızca burada** tanımlanır (Faz 1'de yok).
`ScenarioEvent` ayrık birleşimi (hepsi `{id, crewIds:CrewId[]|'ALL', fromT, toT}` alır):
- `SLEEP_DEFICIT {deltaH:number}`, `SLEEP_SHIFT {shiftMin}`,
- `SPE {peakMultiplier:number; peakProtonPfu:number; riseMin; decayMin}` — **eğri (kodla birebir)**: yükseliş `m(t)=1+(peak−1)·(1−e^(−t/τr))`, `τr = riseMin/4`; sönüm `m(t)=1+(m(tSonu)−1)·e^(−(t−tSonu)/τd)` (`tSonu = fromT + riseMin`; sönüm yükselişin O ANKİ değerinden başlar → sıçrama yok), `τd = decayMin/4` (proton akısı aynı biçim). Böylece ×3 eşiği ≈ 20 sim-dk'da aşılır; `e^(t/…)` gibi yavaş eğri KULLANMA,
- `EARTH_DELAY {oneWayDelaySec:number}` (olay süresince Earth Link tek yön gecikmesini ayarlar; Faz 7 okur),
- `HR_ELEVATION {deltaBpm}`, `SPO2_DIP {delta}`,
- `HYDRATION_DROP {deltaL}`, `CO2_RISE {deltaPpm}`,
- `MOOD_DECLINE {stressDelta; moodDelta; motivationDelta}`, `EXERCISE_SKIP {pct}`,
- `COMM_BLACKOUT {}` (üretimi etkilemez; Earth Link'i etkiler — Faz 7 okuyacak).
`Scenario {id; titleKey; descriptionKey; seed:number; durationDays:number; backfillDays:number /*varsayılan 14*/; crewCount:number; environment; earthLinkPreset?:{preset:'MOON'|'MARS_MIN'|'MARS_MAX'|'CUSTOM'; oneWayDelaySec:number; blackout?:boolean}; events:ScenarioEvent[]; expected:ExpectedDetection[]; bookmarks?:{labelKey:string; t:SimTimeMs}[]}`.

### 3.7 Senaryolar (`src/sim/scenarios/`)
Hepsi (aksi belirtilmedikçe) `backfillDays = 14` **backfill geçmişi** (olaysız, normal) + ardından aktif dönem. `expected` listesi, her olayın **ground-truth** algılama penceresini içerir (algılamanın makul gecikmesini sonuna ekle).
1. `nominal` — olay yok, 30 gün, `expected: []` (yanlış alarm ölçümü için).
2. `solar_particle_event` — gün 3'te SPE: `riseMin=240` (yukarıdaki doyan üstel eğri; ×8 doz hızı, proton 200 pfu civarı), `decayMin=1080`; `EARTH_DELAY {oneWayDelaySec: 840}` (14 dk tek yön) ve `earthLinkPreset` aynı değer; tüm mürettebat. `expected`: `radiation_event` ≥ WARNING, EarthClass `ACT_NOW`, pencere olay başlangıcından +60 sim-dk içinde.
3. `sleep_debt` — CDR ve ENG için gün 5–10 arası −1.8 h uyku; `expected`: `sleep_debt` ≥ ADVISORY gün 8 sonuna kadar; `fatigue` ≥ ADVISORY gün 9 sonuna kadar.
4. `isolation_low_mood` — SCI için gün 8'den itibaren kademeli moral düşüşü (14 günde); `expected`: `mood_decline` ≥ ADVISORY.
5. `dehydration_co2` — MD için gün 6–8 su −0.9 L + CO2 +900 ppm (kabin geneli +500); `expected`: `dehydration` ≥ ADVISORY.
6. `comm_blackout` — gün 4'te 36 saatlik iletişim kesintisi + eş zamanlı hafif kardiyo stres (HR +10) ENG'de; `expected`: `cardio_strain` ≥ ADVISORY.
7. `demo_main` — 2–3 dakikalık canlı demo için **kürate** edilmiş tek senaryo: backfill (`t<0`, anında) → canlı akış **T0=0'dan**: CDR uyku açığı **gün 0**'dan başlar (−2.0 h; günlük L2 ile gün 0 sonunda yakalanır), SCI'nin morali **gün 0–2** arasında hızla düşer, **gün 3 öğleden sonra SPE** (≈ 70 sn; dramatik); SPE sırasında `EARTH_DELAY {oneWayDelaySec: 840}` (Faz 7). Neden erken: L3 uyku kuralı `minDays=3` ve daily çerçeve gün sonunda geldiği için olayları gün 15+'a koymak ≈300 sn sürer, SPE'den sonra alarm çıkar. Hız: 1 sim-gün ≈ 20 sn; `bookmarks`: `1`=gün 0 uyku açığı, `2`=gün 1 moral, `3`=gün 3 sabah (SPE öncesi), `4`=SPE. Olayların zamanları sabit ve `expected` eksiksiz.

8. `new_crew_member` — `backfillDays = 3`, **`durationDays = 3`** (güven 7. günde 0.5'e çıkar; senaryo bundan önce biter) ile başlayan yeni üye; baseline güveni < 0.5 olduğundan uyarılar `ADVISORY` ile sınırlı kalır ve "learning baseline" davranışı demoda görünür; `expected: []`, bu senaryoda WARNING+ uyarı olmamalı (test).

### 3.8 Simülatör sınıfı (`src/sim/simulator.ts`)
- `new Simulator(scenario, options?: {seed?:number})`.
- `backfill(days: number): TelemetryFrame[]` — olaysız geçmişi anında üretir. **Karar:** `t ∈ [−days·MS_PER_DAY, 0)`, `daily.day = −days … −1` (PROJECT_MEMORY §6). Çağıran `scenario.backfillDays` değerini verir.
- `advanceTo(t: SimTimeMs): TelemetryFrame[]` — son t'den bu yana düşen **tüm** çerçeveleri üretir (zaman sıralı, kararlı).
- `reset(seed?)`, `getCrew()`, `getActiveEvents(t)`, `getGroundTruth()` (doğrulama için olay listesi + expected).
- Olaylar efekt olarak üreticilere iletilir; üretici içinde `if (scenario.id === ...)` YASAK.
- Aynı seed → aynı çerçeve dizisi (hash testi).

### 3.9 Telemetri kaynağı arayüzü (`src/core/telemetry/source.ts`)
```ts
interface TelemetrySource {
  start(): void; pause(): void; reset(): void;
  setSpeed(speedMultiplier: number): void;
  setScenario(id: ScenarioId, seed?: number): void;
  seekToBookmark?(index: number): void;
  onFrames(cb: (frames: TelemetryFrame[], simT: SimTimeMs) => void): () => void;
  onStatus(cb: (s: SourceStatus) => void): () => void;
  readonly kind: 'IN_PROCESS' | 'WEBSOCKET';
}
```
`InProcessSimSource` (`src/core/telemetry/inProcessSource.ts`): `start()` önce `simulator.backfill(scenario.backfillDays)` çerçevelerini **tek** `onFrames` çağrısıyla verir (**yalnızca ilk start/reset'te**; pause→resume yeniden YAYMAZ). **Kural:** `t<0` çerçeveler yalnızca Ingest→Buffer→Baseline→Persist aşamalarından geçer; Modules/Detection/Decision/Earth Link/doz birikimi onları atlar (Faz 3 Engine uygular) (`TelemetrySource`'a ek metot YOK); sonra `Simulator` + zamanlayıcı enjeksiyonu (`scheduler: {setInterval, clearInterval}` parametre olarak alınır → testte sahte zamanlayıcı; core içinde `setInterval` global kullanılmaz, enjekte edilir). Çerçeveleri ≤ 10 Hz toplu ver. `SourceStatus` Faz 1'de `core/types/source.ts`'de tanımlıdır (`connected?` dahil); burada yeniden tanımlama.

### 3.10 Testler (`tests/sim/`)
- RNG determinizm, `fork` bağımsızlığı, normal dağılım ortalama/SD toleransı.
- Aynı seed → aynı frame dizisi (SHA hash veya derin eşitlik); farklı seed → farklı.
- `nominal` 30 gün: bütün değerler `plausible` aralıkta; NaN yok; çerçeve sayısı beklenenle birebir (15 dk × 96 × 30 × crew … hesapla).
- Kişiler arası fark: istirahat HR'lerin SD'si > 0.
- Her olay için etkisi gözlemlenebilir (örn. SPE'de doz hızı çarpanı pik civarında ≥ 5×).
- `advanceTo` birleşik çağrıları: `advanceTo(a)+advanceTo(b)` ≡ `advanceTo(b)`.
- `InProcessSimSource`: sahte zamanlayıcıyla hız, duraklatma, reset, batch sıklığı.

## 4. Kabul kriterleri
- [ ] 8 senaryo yüklenir; `demo_main` baştan sona NaN'sız üretilir.
- [ ] Determinizm testleri geçer.
- [ ] `src/sim` ve `src/core/telemetry` lint temiz (DOM/Math.random yok).
- [ ] Her senaryoda `expected` listesi ground-truth olarak erişilebilir.
- [ ] Kalibrasyon md yoksa DEMO varsayılanları devreye girer ve işaretlenir; varsa md'ler kullanılır (iki durumu da test et).
- [ ] 30 gün × 4 kişi üretimi < 2 sn (Node'da; performans testi, esnek eşik).

## 5. Yasaklar
`Math.random`, `Date.now`, `new Date()` (sim/core'da) · gerçek kişi adı · senaryoya özel `if` · değerleri koda gömmek (kalibrasyon/DEMO varsayılan dosyasına koy) · uydurma kaynak iddiası.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notuna ayrıca: senaryo listesi ve her senaryonun beklenen uyarıları, `TelemetrySource` kullanım örneği.
