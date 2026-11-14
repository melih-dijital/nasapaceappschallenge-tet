# FAZ 8 — Doğrulama koşucusu (hassasiyet, özgüllük, yanlış alarm, gecikme)
**Sorumlu:** Kişi C (motor entegrasyonu: Kişi B) · **Süre hedefi:** 2 saat · **Önkoşul:** Faz 5, 6, 7 ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§2 ayrıştırıcı #3, §8). Senaryo `expected` listelerini ve `getGroundTruth()` API'sini incele.

## 1. Amaç
"Validity" puanımızın omurgası: sistemin algılama performansını **ölçülebilir** ve **dürüst** biçimde raporlayan, hem CLI'dan hem UI sayfasından (Faz 10) çağrılabilen bir koşucu. Bu bir *yazılımın tutarlılık/algılama ölçümüdür* — gerçek tıbbi tahmin performansı **değildir**; raporda bu açıkça yazılır.

## 2. Kapsam
**Dahil:** koşucu, metrikler, çoklu seed, eğitim/rapor seed ayrımı, JSON/Markdown rapor, CLI, worker mesajı, testler.
**Hariç:** UI sayfası (Faz 10).

## 3. Görevler

### 3.1 Koşucu (`src/core/validation/runScenario.ts`) — saf, DOM'suz
`runScenario(scenarioId, seed, opts): ScenarioRun` — `Simulator` + `Engine` (tüm aşamalar) başsız (headless) çalıştırır; hızlandırılmış (gerçek zamansız); tüm `AlertEvent`'leri toplar. `opts: {parameterOverrides?}` (Evidence üzerine geçici üstüne yazma — duyarlılık analizi için; **kalıcı değil**).

### 3.2 Eşleştirme ve metrikler (`score.ts`)
- **Beklenen olay eşleştirme:** `ExpectedDetection` (crew, state/kind/metric, pencere `[fromT,toT]`, `minSeverity`, opsiyonel `mustBeEarthClass`). Bir uyarı **TP** sayılır: kişi/durum uyuyor, `firstSeenT ∈ [fromT, toT]`, severity ≥ min.
- **FN:** pencerede eşleşen uyarı yok. **FP:** `expected` hiçbir kaydıyla eşleşmeyen WARNING+ uyarı (ADVISORY ayrı sayılır: "bilgi uyarısı" olarak raporla ama FP'ye katma; **ikisini de ayrı satırda göster**).
- **Algılama gecikmesi:** `firstSeenT − eventStartT` (sim-dk veya gün) medyan/p90.
- **Yanlış alarm oranı:** `FP / (crewCount × days)` (kişi-gün başına); `nominal`'de ayrıca "uyarısız gün yüzdesi".
- **Triyaj doğruluğu:** `mustBeEarthClass` olanlar için doğru sınıf oranı.
- **Hassasiyet (recall) = TP/(TP+FN)**, **Özgüllük** tanımı: olaysız kişi-günlerin (`nominal` + diğer senaryolardaki olaysız kişi-gün) uyarısız kalma oranı; **Precision = TP/(TP+FP)**.
- Kişi bazlı ve olay tipi bazlı kırılım (`byState`).

### 3.3 Çoklu seed ve dürüstlük (`suite.ts`)
- **Ayar seed'leri:** 1–5 (parametre ayarı yapılırsa YALNIZCA bunlarla). **Rapor seed'leri:** 100–119 (20 seed) — tuning sırasında **dokunulmaz**. Rapor her iki kümeyi de gösterir; rapor kümesinde belirgin düşüş varsa "overfitting riski" uyarısı üretir (recall farkı > `val.overfit.recallGap`).
- `runSuite({scenarios, seeds}): ValidationReport`. `ValidationReport {generatedAtSim?: never; params: {evidenceFingerprint: string; paramsVersion}; scenarios: ScenarioScore[]; aggregate: {...}; limitations: string[]; assumptions: string[]}`.
- **evidenceFingerprint:** tüm `DEMO_PARAMETER` değerlerinin **FNV-1a özeti** (saf JS; core'da `crypto` YOK; basit, deterministik).
- **Sınırlamalar bölümü (zorunlu, rapora gömülür):** "Veriler sentetik; olaylar simülatörün enjekte ettiği örüntülerdir; algılayıcı ve simülatör aynı takım tarafından yazılmıştır (döngüsellik riski); gerçek astronot verisiyle doğrulanmamıştır; tıbbi performans iddiası yoktur."
- **Hedefler (başlangıç, DEMO):** nominal FP ≤ `val.target.nominalFpPerCrewDay` /kişi-gün (WARNING+); güçlü olay recall ≥ `val.target.strongRecall`; ılımlı olay recall raporlanır (hedef yok); SPE gecikme p90 ≤ `val.target.speDetectP90Min` sim-dk (hepsi Evidence). Hedefler tutmazsa **rapor dürüstçe gösterir**; parametreler `demo-parameters.md`'de ayarlanır (ayar seed'leriyle), senaryolar kolaylaştırılmaz.
- **Duyarlılık analizi (basit):** `det.z.warning` ve `det.persist.minFrames.vitals` için ±`val.sensitivity.pct`% oynayınca recall/FP değişimi tablosu (`sensitivity.ts`).

### 3.4 CLI ve dosya raporu
- `npm run validate` → `tsx scripts/validate.ts`: tüm senaryolar × rapor seed'leri; konsola özet tablo; `docs/demo/validation-report.json` ve `docs/demo/validation-report.md` (insan okunur: tablo + sınırlamalar + parametre parmak izi). `npm run validate:quick` (`val.quickSeeds` seed).
- Çıktılar deterministik (aynı kod+parametre → aynı rapor); dosyaya zaman damgası **yazma** (veya yalnızca sim bağımsız bir sürüm etiketi).
- Raporun md çıktısı sunumda ekran görüntüsü olarak kullanılabilecek biçimde (tablo başlıkları İngilizce — jüri).

### 3.5 Worker mesajı
`REQUEST_VALIDATION {scenarios?, seeds?, quick?}` → worker `runSuite`'i çalıştırır, ilerleme `VALIDATION_PROGRESS {done,total}` ve sonuç `VALIDATION_RESULT {report}` gönderir. Uzun işlem ana canlı simülasyonu **durdurmadan** ayrı bir worker örneğinde (`validation.worker.ts`) çalışır. `quick` modu < 10 sn (tarayıcıda); iptal mesajı `CANCEL_VALIDATION`.
- Önbellek: aynı `evidenceFingerprint` + seed + senaryo için sonuç `memo`lanır (bellek).

### 3.6 Testler (`tests/validation/`)
- `score.ts` birim testleri: sentetik uyarı/beklenen listeleriyle TP/FP/FN, pencere sınırları, gecikme medyanı, ADVISORY vs WARNING ayrımı.
- `runScenario` determinizmi (aynı seed → aynı uyarılar).
- `suite` küçük kümeyle (2 senaryo × 2 seed) çalışır; rapor şeması Zod ile doğrulanır; `limitations` boş olamaz (test).
- Overfitting uyarısı mantığı (sentetik sayılarla).
- CLI duman testi (`validate:quick` çıkış kodu 0, dosya oluşur).

## 4. Kabul kriterleri
- [ ] `npm run validate` çalışır, `docs/demo/validation-report.md` üretilir ve **hedeflere göre durum** (✅/⚠️) gösterir; tutmayan hedefler gizlenmez.
- [ ] Ayar ve rapor seed ayrımı kodda sabit ve raporda görünür.
- [ ] `limitations` raporda her zaman var.
- [ ] Tarayıcıdan `REQUEST_VALIDATION` canlı simülasyonu bozmadan sonuç döner (manuel kontrol).
- [ ] Parametre değişikliği → farklı `evidenceFingerprint`.

## 5. Yasaklar
Rapor seed'lerine bakarak parametre ayarı · hedefleri tutturmak için senaryoyu kolaylaştırmak · tıbbi doğruluk/"AI accuracy" iddiası · limitations'ı kısaltmak · gerçek saat.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir notu: rapor şeması (UI Faz 10 için), tipik koşu süresi, mevcut sonuçların özeti (hedef tutan/tutmayan) — §14'e ekle.
