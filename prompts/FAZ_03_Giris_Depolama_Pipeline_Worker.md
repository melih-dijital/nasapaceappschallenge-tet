# FAZ 3 — Giriş katmanı, depolama, Engine pipeline iskeleti, Web Worker ve store'lar
**Sorumlu:** Kişi B (store tarafında Kişi A ile koordinasyon) · **Süre hedefi:** 2 saat · **Önkoşul:** Faz 1 ☑, Faz 2 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §6, §10). Faz 1 tiplerini ve Faz 2 `TelemetrySource` arayüzünü incele.

## 1. Amaç
Çerçeveler → doğrulama/normalizasyon → depolama → `Engine` (şimdilik **boş aşamalı** boru hattı) → Web Worker üzerinden UI store'larına akış. Baseline/algılama sonraki fazlarda bu hatta takılacak; bu fazda **takılma noktalarını (hooks)** ve **mesaj protokolünü** doğru kurmak kritik.

## 2. Kapsam
**Dahil:** plausibility, normalize, `FrameStore` (bellek + Dexie), `Engine` iskeleti ve `EngineOutput`, worker protokolü, `EngineClient`, Zustand store'ları, decimation, testler.
**Hariç:** baseline matematiği (Faz 4), algılama (Faz 5), UI bileşenleri (Faz 9).

## 3. Görevler

### 3.1 Giriş (`src/core/ingest/`)
- `plausibility.ts`: `checkFrame(frame, ranges): {ok:boolean; issues:PlausibilityIssue[]}`. Aralıklar **calibration/Evidence'tan** (`plausibleMin/Max`); kod içinde sayı yok. Fiziksel olarak imkânsız (HR 400, SpO2 120, negatif doz) → çerçeve **reddedilir** ve `DataQualityEvent` üretilir (UI'da "sensör hatası" olarak gösterilebilsin). "Garip ama mümkün" (HR 190) kabul edilir — o algılamanın işi. **Giriş doğrulaması ile sağlık kuralları kesinlikle ayrı** (AstroHealth rakibinin iyi yaptığı ayrım).
- `normalize.ts`: Zod ile biçim doğrulama (`TelemetryFrameSchema`), `spo2` 0–100 normalize, saat damgası monotonluğu (geriye giden çerçeveyi yok say + olay üret), kopya (aynı `crewId+kind+t`) bastırma.
- `dataQuality.ts`: kişi/metrik başına "son görülme zamanı"; `stale` kontrolü (N kare gelmediyse "sensör kayıp" olayı).

### 3.2 Depolama
- `src/core/storage/frameStore.ts`: arayüz `FrameStore { append(frames): Promise<void>; query({crewId, kind?, fromT?, toT?, limit?}): Promise<TelemetryFrame[]>; clear(): Promise<void>; count(): Promise<number> }`.
- `MemoryFrameStore` (core, test ve ws sunucusu için; halka tamponu, kapasite sınırı).
- `src/store/dexieFrameStore.ts` (**core dışında**, tarayıcıya özel): Dexie şeması `frames` (`[crewId+kind+t]` bileşik indeks), toplu yazma (≥ 500 kayıt/yazma veya 1 sn), `bulkPut`. Worker içinde çalışabilir (IndexedDB worker'da kullanılabilir). Depolama hatası uygulamayı **çökertmemeli** (try/catch → `StorageWarning` durumu, bellek tamponuna düş).
- Oturum başlarken: kullanıcı "Resume" demedikçe veritabanı temizlenir (demo tekrarlanabilirliği); `session` meta tablosu (scenarioId, seed, startedAt).

### 3.3 Engine iskeleti (`src/core/pipeline/engine.ts`)
```ts
interface EngineOutput {
  t: SimTimeMs;
  acceptedFrames: TelemetryFrame[];
  dataQuality: DataQualityEvent[];
  baselines?: ZSnapshot[];         // Faz 4 doldurur
  states?: StateEstimate[];        // Faz 5
  alertEvents?: AlertEvent[];      // Faz 5 (tip Faz 1 alert.ts'de: OPENED|UPDATED|ACKED|RESOLVED, alert, t)
  moduleReports?: ModuleReport[];  // Faz 6
  decisions?: DecisionSnapshot[];  // Faz 7
}
interface EngineStage { name: string; process(ctx: EngineContext): void }
class Engine { constructor(opts:{stages:EngineStage[]; evidence: typeof registry}); ingest(frames: TelemetryFrame[], simT: SimTimeMs): EngineOutput; snapshot(): EngineSnapshot; reset(): void; }
```
- `EngineContext` taşır: kabul edilen çerçeveler, `simT`, zaman serisi tamponları (kişi×metrik son N), önceki çıktılar, `scratch` alanı. **Aşamalar sırayla** çalışır (`t<0` backfill çerçeveleri yalnızca Ingest→Buffer→Baseline→Persist'ten geçer; Modules/Detection/Decision/Earth Link/doz birikimi atlanır); aşama hatası yakalanır, `EngineFault` olayına dönüşür ve sonraki aşamalara geçilir (kokpit tek aşama yüzünden çökmez).
- Bu fazda aşamalar: `IngestStage` (plausibility+normalize), `BufferStage` (kişi×metrik halka tamponu: son `buffer.daily.days` gün günlük, son `buffer.vitals.hours` saat 15 dk — Evidence), `PersistStage` (core'da yalnızca **`PersistPort` arayüzü**; uygulama dışarıdan enjekte edilir: testte `MemoryFrameStore`, tarayıcıda `src/store/dexieFrameStore.ts`). Baseline/Detection/Modules/Decision aşamaları için **boş yer tutucu sınıflar** (no-op) ekle ve sırayı belgele: `Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist` (nihai sıra; Faz 6 modülleri L4'e aynı karede girdi verir).
- `snapshot()`: UI'ın ihtiyaç duyduğu özet (kişi başına son değerler, açık uyarılar, durumlar, kümülatif doz vs.). Şimdilik son değerler + veri kalitesi.

### 3.4 Worker protokolü (`src/workers/protocol.ts`)
Tipli mesajlar (ayrık birleşim, Zod ile worker girişinde doğrula):
- UI→Worker: `INIT {scenarioId, seed?, speed, source?:'local'|'ws', wsUrl?}`, `START`, `PAUSE`, `RESET`, `SET_SPEED {speedMultiplier}`, `SET_SCENARIO {id, seed?}`, `SEEK_BOOKMARK {index}`, `ACK_ALERT {alertId}`, `SUBMIT_CHECKIN {crewId, mood:{stress,mood,motivation}, journalText?:string}`, `SUBMIT_PVT {crewId, medianMs, lapses}`, `ACCEPT_ACTION {cardId}`, `DISMISS_ACTION {cardId}`, `COMPLETE_ACTION {cardId}`, `SET_EARTH_LINK {...}`, `SET_CONSENT {...}`, `GROUND_REPLY {...}` (Faz 7), `REQUEST_VALIDATION {...}`, `CANCEL_VALIDATION` (Faz 8). (`ACCEPT_PLAN_CHANGE` YOK; tek ad `ACCEPT_ACTION`.)
- Worker→UI: `READY`, `STATUS {SourceStatus}`, `FRAMES_BATCH {frames:ChartFrame[]}` (**yalnızca grafik için gereken indirgenmiş veri**), `ENGINE_OUTPUT {output: EngineOutputLite}`, `SNAPSHOT {snapshot}`, `VALIDATION_PROGRESS {done,total}`, `VALIDATION_RESULT {report}`, `ERROR {code, message}`.
- Toplu gönderim ≤ 10 Hz; `structuredClone` maliyetini azaltmak için çerçeveleri sütunlu diziler halinde (`Float64Array`) yollamak serbest ama YALNIZCA ölçülmüş bir sorun varsa.
- Worker (`sim.worker.ts`): `InProcessSimSource` + `Engine` + `DexieFrameStore` kurar; `InProcessSimSource.start()` ile (backfill `scenario.backfillDays` kadar, sabit 14 DEĞİL) başlar; mesajları işler. Worker içinde `Math.random`/`Date.now` yok (zamanlayıcı enjeksiyonu: gerçek `setInterval` yalnızca worker giriş dosyasında).
- `src/store/engineClient.ts`: worker'ı oluşturur (`new Worker(new URL('../workers/sim.worker.ts', import.meta.url), {type:'module'})`), tipli `send()` ve `subscribe()` sağlar; worker çökerse yeniden başlatır ve `ERROR` yayar. Worker desteklenmiyorsa (çok eski tarayıcı) `InProcess` yedeği (ana iş parçacığında aynı sınıflar) — sadece fallback, test et.

### 3.5 Zustand store'ları (`src/store/`)
- `sessionStore`: `scenarioId`, `speed`, `running`, `simT`, `day`, `selectedCrewId`, `language ('en'|'tr')`, `workerStatus`.
- `telemetryStore`: kişi×metrik **halka tamponları** (en çok 600 nokta — `decimate(points, max)` min-max/LTTB veya basit seyreltme; birim testle), `latestValues`, `dataQuality`.
- `alertStore`, `stateStore`, `decisionStore`, `earthLinkStore`: şimdilik **tipli boş iskelet** (Faz 5–7'de dolacak). Seçici (selector) fonksiyonlar: `selectActiveAlerts`, `selectLatest(crewId, metric)`.
- Sadece `engineClient` store'lara yazar; UI bileşenleri yalnızca okur ve eylem gönderir (`actions.ts`).
- **Mock motor** (`src/ui/mock/mockEngine.ts`, **Faz 1'in son görevi olarak zaten yazıldı** — bu fazda arayüzünü DEĞİŞTİRME, yalnızca gerçek protokolle uyumunu doğrula): Kişi A'nın Faz 1'den sonra UI geliştirebilmesi için aynı `EngineClient` arayüzünü uygulayan, `Simulator`'dan veri çekip (Faz 2 tamamsa) veya sabit rastgele-benzeri sahte veri yayan sınıf. Aynı mesaj protokolünü konuşsun → UI gerçek motora hiç değişiklik olmadan geçsin.

### 3.6 Testler (`tests/core/`, `tests/store/`)
- plausibility: imkânsız/makul/sınır değerler; reddedilen çerçeve olay üretir.
- normalize: kopya, geri giden zaman, NaN.
- Engine: stage sırası, hata yalıtımı (bir aşama atınca diğerleri çalışır), `reset`.
- MemoryFrameStore kapasite/sorgu; DexieFrameStore `fake-indexeddb` ile.
- Worker protokolü: Zod ile geçersiz mesaj reddi (worker mantığını `handleMessage(msg)` saf fonksiyonuna çıkarıp **Worker olmadan** test et).
- decimate: sınırlar, ilk/son nokta korunur, min/max korunur.
- Uçtan uca (Node): `InProcessSimSource` → `Engine` → `MemoryFrameStore`; 3 sim-günlük akışta sayımlar tutarlı.

## 4. Kabul kriterleri
- [ ] `npm run dev`te worker açılır, `demo_main` backfill + canlı akış çalışır; konsolda hata yok; UI'da en azından ham değerler (geçici debug sayfası) akar.
- [ ] 50× (en yüksek hız) ve 4 kişide UI donmaz (ana iş parçacığında uzun görev yok; kaba kontrol: batch ≤ 10 Hz).
- [ ] Hatalı çerçeve çökertmez, `dataQuality` olayı doğar.
- [ ] Dexie yazma hatası simülasyonunda uygulama devam eder.
- [ ] Aşama sırası belgelenmiş ve no-op yer tutucular hazır.
- [ ] Mock motor ve gerçek motor aynı arayüzü paylaşıyor; Kişi A için kısa kullanım notu devir notunda.

## 5. Yasaklar
core içinde Dexie/IndexedDB · UI'dan doğrudan worker mesajı (yalnızca `engineClient`) · tüm çerçeveyi her mesajda UI'ya yollamak · senkron ağır döngü.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu.
