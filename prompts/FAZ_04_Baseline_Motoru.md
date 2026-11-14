# FAZ 4 — Kişisel Baseline Motoru
**Sorumlu:** Kişi B · **Süre hedefi:** 1,5–2 saat · **Önkoşul:** Faz 3 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §8). Evidence'taki `baseline.*` ve `minScale.*` parametrelerini listele. Bu fazın matematiği testle kanıtlanmalıdır; "çalışıyor gibi" kabul edilmez.

## 1. Amaç
Her astronot × her metrik için kendi normal aralığını (medyan ve MAD) öğrenen, saat-bloklu (HR için), güven skoru üreten, **drift-korumalı** baseline motoru. Çıktı: her yeni değer için robust z ve güven.

## 2. Kapsam
**Dahil:** robust istatistik yardımcıları, ikili/saat-blok yapısı, öğrenme penceresi, güven, kayan pencere + drift koruması (baseline donması), backfill, `BaselineStage`, testler.
**Hariç:** eşik kararları ve uyarılar (Faz 5).

## 3. Görevler

### 3.1 İstatistik (`src/core/baseline/robustStats.ts`) — saf fonksiyonlar
- `median(xs)`, `mad(xs)` (medyandan mutlak sapmaların medyanı), `robustSigma(xs) = 1.4826·MAD`, `quantile(xs, q)`, `theilSen(points): {slope, intercept}` (O(n²), n ≤ 60 için), `winsorize(xs, k)`.
- Kenar durumlar: boş dizi → `NaN` DEĞİL, açık `undefined`/`Result` (tip güvenli); n=1; tüm değerler aynı (MAD = 0); NaN/Infinity girdileri filtrele.
- **Ölçek tabanı:** `scale = max(robustSigma, minScale[metric])` — `minScale.*` Evidence'tan. Sıfıra bölme olmamalı.

### 3.2 Kutu (bin) yapısı (`bins.ts`)
- `hr`, `hrv`: `hourBlock = floor(hourOfDay / baseline.hrBlockHours)` → 4 blok (Evidence: 6 saat). Anahtar: `"hr|blk2"`.
- Diğer tüm metrikler (günlük): tek bin `"day"`.
- `rad.doseRateMsvDay`: ortam başına bin (`"env:LEO"`) — ortam değişince baseline sıfırdan değil, **yeni bin** öğrenir.
- `spo2`: tek bin `"all"`.

### 3.3 Baseline motoru (`baselineEngine.ts`)
```ts
class BaselineEngine {
  constructor(opts: {registry; nowGetter?: never})   // zaman dışarıdan, global zaman yok
  update(frame: TelemetryFrame): void                // örnekleri pencereye ekler
  zscore(crewId, metric, value, t, env?): ZResult    // z, baseline, confidence
  getBaseline(crewId, metric, t, env?): BaselineStat | null
  confidence(crewId, metric, t): number
  setGuard(crewId, active: boolean, t): void         // drift koruması (Faz 5 çağırır)
  backfill(frames: TelemetryFrame[]): void           // tek geçişte öğren
  snapshot(): BaselineSnapshot ; reset(): void
}
```
Kurallar:
- **Öğrenme penceresi:** her bin için son `baseline.window.days.target` gün (14) örnek; **minimum** `baseline.window.days.min` (3) günlük veri olmadan `baseline` = `null`; 3–6 gün arasında baseline VAR ama `confidence` < 0.5 (7. günde 0.5). Güven: `min(1, nEffDays / baseline.window.days.target)`; bin'deki örnek sayısı `baseline.sparseBin.minSamples`'tan azsa güven × `baseline.sparseBin.confidenceFactor` (hepsi Evidence).
- **Yöntem (tek):** her bin için son `baseline.window.days.target` günün örneklerinden **kayan pencere medyan/MAD**. EWMA YOK.
- **Drift koruması (donma):** `setGuard(crew, true)` iken yeni örnekler pencereye **eklenmez** (z yine hesaplanır, baseline değişmez). Guard, **bir önceki karenin** uyarı durumuna göre ayarlanır (Baseline→Detection sırası nedeniyle); Detection, `baseline.guard.hours` boyunca WARNING+ uyarı varsa guard'ı açık tutar. Test: 10 gün yavaş yavaş artan HR'de guard açıkken baseline kaymaz; guard hiç açılmazsa pencere zamanla kayar (beklenen davranış).
- **Backfill:** `InProcessSimSource.start()`'ın tek çağrıda verdiği backfill çerçeveleri (`scenario.backfillDays`) öğretilir; 14 günde güven ≈ 1.0, `new_crew_member` (3 gün) için < 0.5.
- **Soğuk başlangıç (ilk `baseline.window.days.min` gün):** `zscore` döner `{z: NaN değil → 0, baseline:null, confidence:<0.5}`; bu durumda tüketiciler `z`'yi kullanmamalı (belgele).
- Bellek: kişi×metrik×bin için sınırlı halka (günlük bin: 14–21 değer; HR bin: 14 gün × 24 kare/blok ≈ 336 değer).
- **Sirkadiyen düzeltme:** yalnızca HR/HRV bloklarıyla; ek model yok.
- **Uyku/yatış HR'ı:** gece bloğu HR'ı "istirahat HR proxy'si" olarak ayrıca `restingHr(crewId, t)` ile sağlanır (gece bloğu medyanı) — Faz 6 kardiyo modülü kullanır.

### 3.4 `BaselineStage` (Engine'e takılır)
Sıra: `Ingest → Buffer → **Baseline** → …`. Her kabul edilmiş çerçeve için ilgili metriklerde `zscore` hesaplar **önce** (değer baseline'a girmeden — "kendi kendine kıyas" olmasın), sonra `update` eder. `EngineOutput.baselines: ZSnapshot[]` = `{crewId, metric, t, value, z, confidence, baselineMedian, baselineSigma}`. UI'nin "baseline bandı" için `bandLow/High = median ± det.z.warning×sigma` türetilebilsin diye median ve sigma'yı çıkar.

### 3.5 Testler (`tests/core/baseline/`)
- İstatistik: bilinen veri kümeleriyle medyan/MAD/Theil-Sen; aykırı değer direnci (tek uç değer medyanı oynatmaz, ortalamayı oynatır — kıyas testi).
- MAD=0 durumunda `minScale` devreye girer; z sonlu.
- Pencere: 2 gün → baseline null; 3–6 gün → var, güven < 0.5; 14 gün → güven 1.
- Drift koruması (yukarıdaki iki test).
- Saat bloğu: gece HR'ı gündüz bloğuna sızmaz; blok sınırları doğru.
- Kişiler arası: A'nın baseline'ı B'ninkinden bağımsız; aynı ham HR (80) kişi A için normal, B için yüksek z.
- Determinizm: aynı çerçeve sırası → aynı sonuç.
- Backfill ≡ tek tek update sonuçları (tolerans içinde).
- Bir **`nominal`** entegrasyon testi (`demo_main` DEĞİL: orada gün 0'da olay var): backfill sonrası ilk canlı gün çerçevelerinin |z| dağılımı ≈ N(0,1) civarı (ortalama |z| < 1, %95'i |z|<3).

## 4. Kabul kriterleri
- [ ] Yukarıdaki testler geçer; NaN yayılımı yok (özellikle MAD=0 ve n<min).
- [ ] `EngineOutput.baselines` akıyor; UI debug sayfasında bir kişinin HR'ı ve baseline bandı görülebiliyor.
- [ ] Hiçbir sihirli sayı yok (tüm parametreler Evidence'tan).
- [ ] Bellek büyümesi sınırlı (30 sim-gün koşusunda yığın sabit — kaba ölçüm).

## 5. Yasaklar
Ortalama/standart sapma ile baseline (robust olmak ZORUNLU) · `Math.random` · global zaman · baseline'a girmeden önce z hesaplamadan güncelleme.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notuna: `zscore` sözleşmesi (soğuk başlangıç davranışı), `restingHr` API'si.
