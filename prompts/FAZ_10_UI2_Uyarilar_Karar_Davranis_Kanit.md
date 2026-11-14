# FAZ 10 — UI-2: Uyarılar, karar kartları, davranışsal sağlık, Kanıt, Doğrulama ve Yer İstasyonu sayfaları
**Sorumlu:** Kişi A (Kişi C ile içerik/metin koordinasyonu) · **Süre hedefi:** 4 saat · **Önkoşul:** Faz 9 ☑; Faz 5–8 çıktıları (hazır değilse mock)

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku. Faz 9 devir notunu, `docs/i18n-keys.md`'yi, `DecisionSnapshot`, `Alert`, `ModuleReport`, `ValidationReport` şemalarını incele. Kopyalanacak kalıp metin YOK: tüm yeni metin `en.ts` + `tr.ts`'ye eklenir.

## 1. Amaç
Gecikme-bilinçli triyajı, açıklanabilir uyarıları, eylem kartlarını, görev takvimi farkını, davranışsal sağlık girişini, kaynak şeffaflığını ve doğrulama sonuçlarını **görünür ve anlaşılır** kılmak. Jürinin "bunu diğerlerinden ayıran ne?" sorusuna cevap veren ekranlar bunlardır.

## 2. Kapsam
**Dahil:** 5 sayfa/panel, uyarı sesi, "Why?" çekmecesi, check-in ve PVT-benzeri test arayüzleri, Earth Link paneli, Kanıt kayıt sayfası, Doğrulama sayfası, Ground View, testler.
**Hariç:** PWA/dağıtım (Faz 11).

## 3. Görevler

### 3.1 Uyarılar ve Eylemler sayfası (`/alerts`)
- **Uyarı listesi:** aktif + son 24 sim-saat çözülmüş; sıralama severity → `earthDelayClass` (ACT_NOW önce) → zaman. Kart: `SeverityIcon`, başlık, kişi, durum/metrik, **`EarthDelayClass` rozeti** (ACT_NOW kırmızı "Act now", ACT_THEN_REPORT turuncu "Act, then report", CAN_WAIT mavi "Can wait for Earth"), güven göstergesi, zaman, `Acknowledge` düğmesi (`ACK_ALERT`).
- **"Why?" çekmecesi (`Sheet`):** `whyKeys` madde madde (örn. "Sleep 4.6 h vs your baseline 6.8 h (z = −3.4)"), **katkı çubukları** (L4 contributors), baseline güveni ve öğrenme günü, ilgili grafiğe mini görünüm, `evidenceIds` → `ProvenanceTag` listesi (tıkla → Evidence sayfası), "Why this Earth class?" (triyaj gerekçesi: gidiş-dönüş X dk vs zarar süresi Y dk).
- **Eylem kartları:** `DecisionSnapshot.cards`; adımlar (`stepKeys`), kaynak uyarı bağlantısı, **Accept / Dismiss / Done** (`ACCEPT_ACTION`, `DISMISS_ACTION`, `COMPLETE_ACTION`; hepsi `{cardId}`), kabul edilince plan farkına atlama.
- **Görev takvimi:** 24 saatlik yatay zaman çizelgesi (bloklar tip renkli + ikon); **değişen bloklar vurgulu**; "Neden değişti?" listesi (`ScheduleDiffItem`, kaynak uyarıya bağlantı); öneri/kabul edilmiş plan arasında geçiş (`Tabs`); çakışma işaretleri.
- **Sesli uyarı:** Web Audio ile kısa ton (CRITICAL: iki kısa bip; WARNING: tek bip); kullanıcı etkileşiminden sonra etkinleşir (tarayıcı politikası); sessize al düğmesi (kalıcı: localStorage — yalnızca UI tercih); ses dosyası kullanma, sentezle. Aynı uyarı için tekrar çalma yok; `prefers-reduced-motion` yalnızca animasyonu etkiler, ses ayrı ayar.
- **Canlı bölge:** CRITICAL açıldığında `aria-live="assertive"` ile ekran okuyucu duyurusu.
- **Toast/Banner:** ACT_NOW + CRITICAL için tepede kalıcı kırmızı bant (kapatılamaz, ack ile iner): "Radiation event confirmed — act now" gibi (i18n).

### 3.2 Earth Link paneli (kokpit sağ sütunu + `/ground` ile paylaşılan bileşen)
- **Gecikme kontrolü:** ön ayarlar (Moon, Mars min, Mars max) + özel kaydırıcı (1 sn – 30 dk); değişince `SET_EARTH_LINK`; aktif uyarıların sınıfları **canlı yeniden hesaplanır** (kartlarda rozet geçişi animasyonsuz ama vurgulu).
- **Dünya cevabı bekleniyor sayacı** (hero öğesi): "Message sent to Earth… reply expected in **13:42**" geri sayım (sim zamanı), yanında "Meanwhile, cockpit advises: …" (`localAdviceActionIds` kartları). Cevap gelince gelen kutusuna düşer, "Ground reply received" bildirimi.
- **Giden kutu / Gelen kutu** listeleri (öncelik, durum QUEUED/IN_FLIGHT/DELIVERED, tahmini varış); kesinti (`blackout`) "LINK DOWN" göstergesi ve kuyruk sayacı; **onay (consent) kategorileri** anahtarları (`SET_CONSENT`); "Privacy: journal entries never leave the vehicle" etiketi.
- **Paket önizleme:** gönderilecek paketin içeriği (JSON özeti) — gizlilik şeffaflığı.

### 3.3 Davranışsal sağlık sayfası (`/behavioral`)
- **Günlük check-in (≤ 30 sn):** 3 kaydırıcı/skala (stress, mood, motivation 1–10), isteğe bağlı kısa günlük notu (yerel; "stays on this device" etiketi); `SUBMIT_CHECKIN`. Bugün gönderildiyse düzenlenebilir.
- **Reaksiyon testi (60 sn, PVT-benzeri):** tam ekran odaklı bileşen: rastgele aralıklı (2–10 sn) uyaran; tıklama/boşluk tuşu; ms sayacı; erken tıklama = false start; 500 ms üstü lapse (Evidence `pvt.lapse.thresholdMs`); bitince özet + `SUBMIT_PVT`. **Zamanlama:** `performance.now()` + `requestAnimationFrame`, uyaran aralığı için seed'li RNG yok → UI'da `Math.random` serbest (yalnızca bu bileşende; yorumla). "Not a clinical instrument" etiketi.
- **Trendler:** son 14 gün mood/stress/motivation çizgileri + eğim göstergesi (`BehavioralReport.moodTrendSlope`), PVT medyan/lapse trendi, uyku düzenlilik indeksi, check-in uyumu; **pasif proxy skoru** açıklamasıyla.
- **Durum çipleri:** `mood_decline`, `stress`, `fatigue` skorları + katkılar; öneri kartları (journal, aile ile iletişim, psikolojik check-in).
- **Dil:** tanı koyucu ifadeler yok; "may indicate", "consider".

### 3.4 Kanıt sayfası (`/evidence`) — şeffaflık hero'su
- Tüm `EvidenceEntry` tablosu: id, değer+birim, tür (`ProvenanceTag`), kaynak başlığı/URL (yeni sekmede, `rel="noopener noreferrer"`), `verified` ✓/⚠, not; filtre (tür, doğrulanmamış), arama, sıralama. "Where used" sütunu: bu id'yi kullanan bileşen/modül listesi (`scripts/build-evidence.ts` ile `usedBy` çıkarmak için kod taraması **istemiyoruz**; bunun yerine Faz 1 registry'ye `registerUsage(id, 'moduleName')` çağrılarıyla çalışma zamanında toplama eklenmiş olabilir — yoksa bu sütunu **atla** ve §14'e yaz).
- Üstte özet kartlar: "N thresholds · X NASA standard · Y NASA HRP · Z peer-reviewed · W demo parameters (unverified)". **Dürüstlük metni:** "Parameters labeled DEMO are illustrative; they are not NASA medical limits."
- Radyasyon limitleri ve hedefleri için ayrıntı kartı: 600 mSv (kariyer), 250 mSv ("design reference SPE protection target"; kişisel olay-başı limit değil), ISS 0.2–0.5 mSv/gün; kaynak bağlantıları.
- Kalibrasyon provenance: simülatör kalibrasyon md'lerinden gelen metrikler listesi (`getCalibrationProvenance`).

### 3.5 Doğrulama sayfası (`/validation`)
- "Run validation" (`REQUEST_VALIDATION`; `quick` ve `full` seçeneği), ilerleme çubuğu, iptal.
- Sonuç: senaryo × metrik tablosu (Recall, Precision, FP/kişi-gün, medyan/p90 gecikme, triyaj doğruluğu); **hedef durumu** ✅/⚠ (hedefler Faz 8'deki); ayar vs rapor seed kıyası; **overfitting uyarısı** varsa gösterilir.
- **Limitations kutusu** (rapor `limitations[]`): her zaman görünür, daraltılamaz.
- Duyarlılık analizi tablosu (varsa); `evidenceFingerprint` etiketi ("parameters v…").
- "Download report (JSON/MD)" düğmeleri (Blob URL).
- Bir senaryoyu "Replay in cockpit" (senaryoyu seçip kokpite geç).

### 3.6 Yer İstasyonu görünümü (`/ground`)
- Yalnızca **Earth Link'ten ulaşan** (gecikmeli) veriyi gösterir: son gelen durum paketleri, uyarı paketleri, gecikme etiketi ("data is 14 min old"), onaylı kategorilere göre kısıtlı veri. Amaç: "Dünya tarafı bilgisi gecikmeli ve kısıtlı; kokpit anlıktır" karşıtlığını göstermek.
- Yer tarafı yanıt gönderme formu (şablon seçimi: "Acknowledge", "Continue protocol", "Request more data") → `GROUND_REPLY` (demo için) — cevaplar yine gecikmeyle astronota döner.
- Opsiyonel ikinci pencere modu: `window.open('/ground')` ile aynı tarayıcıda `BroadcastChannel` üzerinden bağlanma (Faz 11'de WebSocket'e alternatif). Bu fazda **yalnızca aynı sekmede** çalıştır; BroadcastChannel desteği zaman kalırsa.

### 3.7 Genel
- Boş durum metinleri, yükleniyor iskeletleri, hata sınırları (`ErrorBoundary`) — sayfa çökmesi uygulamayı düşürmez.
- Rota geçişlerinde simülasyon çalışmaya devam eder (state worker'da).
- Tüm yeni metinler `en`+`tr`; i18n eşitlik testi geçmeli.

### 3.8 Testler
- Uyarı kartı render/sıralama; ack akışı; "Why?" içeriği; EarthClass rozetleri; gecikme değiştirince rozet geçişi (mock ile).
- Plan diff vurgusu; kabul/yoksayma mesajları.
- Check-in formu doğrulama ve gönderim; PVT bileşeni (sahte zamanlayıcıyla: lapse/false start hesabı).
- Kanıt tablosu filtre/arama; doğrulanmamış rozetler.
- Doğrulama sayfası: ilerleme, sonuç render, limitations görünür.
- Ground görünümü yalnızca gecikmeli veriyi gösterir (anlık değer sızmaz — test).

## 4. Kabul kriterleri
- [ ] `demo_main` ile: SPE → CRITICAL bant + sesli uyarı + **ACT_NOW** + sayaç + plan farkı + Earth gönderimi görünür; gecikme kaydırınca sınıf değişir.
- [ ] "Why?" çekmecesi her uyarıda gerekçe, güven, kaynak etiketi ve Earth sınıfı gerekçesini gösteriyor.
- [ ] Check-in ve PVT-benzeri test çalışıyor, skorlar `BehavioralReport`'a yansıyor.
- [ ] Kanıt sayfası doğrulanmamış değerleri açıkça işaretliyor.
- [ ] Doğrulama sayfası limitations'ı her zaman gösteriyor.
- [ ] Ground görünümü gecikmeli/kısıtlı; journal içermiyor.
- [ ] i18n eşit; erişilebilirlik kontrol listesi geçti; typecheck/lint/test/build temiz.

## 5. Yasaklar
Tanı/ilaç dili · limitations'ı gizlenebilir yapmak · sesi dosyayla/CDN'den çekmek · ground görünümünde anlık veri · journal metnini loglama/gönderme · grafikleri animasyonlu yeniden çizmek.

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir: sayfa/bileşen listesi, ekran görüntüleri (`docs/demo/screens/*.png`: kokpit, uyarı+why, plan farkı, kanıt, doğrulama, ground), bilinen eksikler.
