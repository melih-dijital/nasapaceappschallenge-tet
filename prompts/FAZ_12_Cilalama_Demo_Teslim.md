# FAZ 12 — Cilalama, demo senaryosu, dokümantasyon ve teslim
**Sorumlu:** Kişi C (liderlik) + herkes · **Süre hedefi:** son 6 saat (**son 2 saatte YENİ KOD YOK**) · **Önkoşul:** Faz 9–11 büyük ölçüde ☑

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§1, §2, §12–§15). `docs/demo/` içeriğini, `validation-report.md`'yi, ekran görüntülerini incele. Önce `00_ORTAK_PROMPTLAR.md` → **H) DEMO YANGINI** bloğunu çalıştır ve bulguları raporla.

## 1. Amaç
Jüri kriterlerine (Impact, Creativity, Validity, Relevance, Presentation) göre son cila; tekrar edilebilir demo; teslim paketi: repo, README, kısa sunum, 2–3 dk video, proje özeti.

## 2. Kapsam
**Dahil:** hata avı, `demo_main` provası ve kürasyonu, sunucu/sunum modu, README, dokümantasyon, ekran görüntüleri, sunum ve video senaryosu, teslim kontrol listesi.
**Hariç:** yeni özellik. (Zaman 'donma' çizgisi: son 2 saat.)

## 3. Görevler

### 3.1 Hata avı ve sertleştirme
- 10 dakikalık "monkey" koşusu (elle): tüm sayfalar, hız değişimi, senaryo değişimi, reset, dil değişimi, gecikme kaydırma, check-in/PVT, ack/accept, çevrimdışı. Konsol hataları ve `ErrorBoundary` tetiklenmeleri listelenir; **demo'yu bozan** olanlar düzeltilir.
- 1 saatlik uzun koşu (0.25×→50× arası): bellek/yavaşlama kontrolü.
- Edge: tarayıcı sekmesi arka plana gidip dönünce zaman sıçraması (zamanlayıcı kısıtlaması) — `advanceTo` toplu üretim ile **telafi** eder; UI donmaz. Test.
- Tarayıcılar: Chrome (ana), Firefox, Safari (mümkünse): worker/IndexedDB/WebAudio farkları; sorun varsa `docs/demo/known-issues.md`.

### 3.2 Sunucu/demo modu
- **Presenter Mode:** `?demo=1` veya `D` kısayolu: kenar çubuğu daralır, fontlar büyür, `demo_main` otomatik seçili, **bookmark kısayolları** (`1` = Gün 0 CDR uyku açığı, `2` = Gün 1 SCI moral, `3` = Gün 3 sabah SPE öncesi, `4` = SPE; `demo_main` `bookmarks` ile birebir), `Space` duraklat/oynat, `R` sıfırla, `E` Earth gecikmesi döngüsü (1.3 s → 3 dk → 14 dk → 22 dk), `?` kısayol yardımı. Kısayollar yalnızca sunum modunda.
- Tek tuşla **tam sıfırlama** (DB temiz, seed sabit): her prova aynı sonuç.
- Hata durumunda **yedek**: yerel `dist` + önceden kaydedilmiş video.

### 3.3 `demo_main` kürasyonu
- Zaman çizelgesini (sim günü/saati → gerçek saniye) çıkar; toplam canlı kısım **60–90 sn**'ye sığmalı (hız ayarı/bookmark ile). Olay sırası (öneri): ① baseline öğrenilmiş sakin kokpit (5 sn) → ② CDR'de uyku borcu: "Why?" aç, kişisel baseline'ı göster (10 sn) → ③ SCI'de moral düşüşü: davranışsal çip + öneri (10 sn) → ④ **SPE**: CRITICAL bant + ses + ACT_NOW + plan farkı (egzersiz iptal) (20 sn) → ⑤ Earth Link: "mesaj gönderildi, cevap 14 dk sonra — ama kokpit şimdi karar verdi" (15 sn) → ⑥ Kanıt + Doğrulama sayfalarına hızlı geçiş (15 sn).
- Her adım için **beklenen ekran** ve **söylenecek tek cümle** (`docs/demo/demo-script.md`).
- Tutarlılık testi: aynı seed → aynı olay zamanları (tarayıcıda 3 kez üst üste çalıştır, ekran görüntüsü karşılaştır).

### 3.4 Sunum ve video (`docs/demo/pitch.md`)
Yapı (2–3 dk): **Problem (10 sn)** → **Çözüm (20 sn)** → **Canlı demo (60–90 sn)** → **Etki/vizyon (20 sn)**.
- Problem: derin uzayda iletişim gecikmesi + astronot kendi kendine karar vermeli (Mars'ta gidiş-dönüş çok dakika; CSA'nın "iletişim gecikmesi" riski + NASA HRP "Dünya'dan uzaklık" tehlikesi).
- Çözüm: tek ekranda biyometri + radyasyon + davranış; kişisel baseline; gecikme-bilinçli triyaj.
- Demo: yukarıdaki akış.
- Etki/vizyon: açıklanabilir, çevrimdışı, kaynaklı; ölçülebilir doğrulama; sınırlamalar dürüstçe (sentetik veri, tıbbi cihaz değil); sonraki adım: gerçek wearable/OSDR verisi, uçuş cerrahı geri bildirimi.
- **Rakip farkı cümlesi** (varsa): "Most tools alert on a number. We tell the crew whether they can wait for Earth."
- Slayt (maks. 6): Problem, Çözüm, Mimari (tek şema), Kanıt/Doğrulama, Demo ekran görüntüleri, Vizyon + sınırlamalar. Metin az, ekran görüntüsü çok.
- Video: ekran kaydı + ses; yedek canlı demo olarak da kullanılır; altyazı (en). Süre ≤ sınır (resmi sınırı kontrol et).
- **Atıf:** kullanılan NASA/CSA kaynaklarının listesi slaytta ve README'de; "AI tools used: Claude (Anthropic)" beyanı (Space Apps AI kullanımı beyan kuralı için resmi gereksinimi kontrol et; dokümanlarda takım "Kullanılan AI Araçları: Claude (Anthropic)" yazıyor).

### 3.5 README ve dokümantasyon
- `README.md` (EN): sorun, çözüm, özellikler, **mimari şema** (ASCII/mermaid + PNG), nasıl çalıştırılır (iki ayrı satır: `npm i`, ardından `npm run dev`), çevrimdışı kullanım, test/doğrulama komutları, **veri ve kaynaklar** (Evidence politikası, doğrulanmış/doğrulanmamış), **sınırlamalar** (sentetik veri, tıbbi cihaz değil, kemik tahmini, baseline öğrenme), AI kullanımı beyanı, lisans (OSS lisansı seç; takım karar verir — varsayılan MIT), teşekkür/kaynaklar, ekip.
- `docs/ARCHITECTURE.md`: katmanlar, pipeline sırası (`Ingest → Buffer → Baseline → Modules → Detection → Decision → Persist`), veri sözleşmeleri, karar günlüğünün özeti.
- `docs/EVIDENCE.md`: her eşik, kaynağı ve durumu (otomatik üretim: `scripts/build-evidence-doc.ts` → `npm run docs:evidence`).
- `docs/LIMITATIONS.md`: dürüst sınırlamalar (limitations metnini tek kaynaktan al).
- Kod içi: genel API'lerde kısa JSDoc; karmaşık istatistikte formül yorumları.

### 3.6 Teslim kontrol listesi (`docs/demo/submission-checklist.md`) — tek tek ✅
- [ ] Resmi teslim formu alanları (proje adı, özet, repo/demo/video bağlantıları, challenge seçimi, takım) hazır; **resmi gereksinimleri spaceappschallenge.org üzerinde son kez kontrol et**
- [ ] Repo herkese açık (lisans dosyası var), sır yok (PowerShell: `git log -p | Select-String -Pattern key`; bash: `git log -p | grep -i key`; `.env` yok)
- [ ] Canlı demo URL çalışıyor (gizli pencerede dene) ve çevrimdışı çalışıyor
- [ ] Video yüklendi/erişilebilir (herkese açık veya liste dışı); süre/format uygun
- [ ] Sunum dosyası (PDF)
- [ ] README'de kaynaklar ve AI beyanı
- [ ] `validate` raporu güncel (`docs/demo/validation-report.md`)
- [ ] Teslim **23:59'dan (resmi saat dilimi!) en az 2 saat önce** yapıldı; teyit e-postası/ekranı kaydedildi
- [ ] Yedekler: `dist` zip, video, PDF yerel + bulut

### 3.7 Son hafıza güncellemesi
`PROJECT_MEMORY.md`: §12 tüm fazlar durumu; §14 kalan sorunlar ("gelecek çalışma" listesi); §15 son değişiklikler. Gelecek çalışma önerileri: gerçek wearable/OSDR I4 entegrasyonu, uçuş cerrahı geri bildirimiyle eşik doğrulama, çok-ajanslı veri, yer istasyonu gerçek uç nokta.

## 4. Kabul kriterleri
- [ ] Demo üç ardışık provada aynı sonuç ve 90 sn altında.
- [ ] Çevrimdışı demo çalışıyor; yedek video hazır.
- [ ] README/ARCHITECTURE/EVIDENCE/LIMITATIONS tamam; kaynaklar ve AI beyanı mevcut.
- [ ] Teslim kontrol listesi ✅ (tamamlanamayanlar gerekçeyle).
- [ ] Son 2 saatte kod değişikliği yok (commit geçmişiyle doğrula) — yalnızca demo/teslim.
- [ ] `PROJECT_MEMORY.md` güncel.

## 5. Yasaklar
Son 2 saatte yeni özellik/refactor · sınırlamaları gizlemek · doğrulanmamış değeri NASA'ya atfetmek · gerçek kişi/marka logosu · tıbbi cihaz/tanı iddiası · "AI ile %X doğruluk" gibi doğrulanamaz sayılar.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Son mesajda: teslim durumunun kısa özeti + bilinen sorunlar (dürüst).
