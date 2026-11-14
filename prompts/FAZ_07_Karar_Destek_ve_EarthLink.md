# FAZ 7 — Karar Destek, Görev Planlayıcı ve Earth Link (gecikme-bilinçli triyaj)
**Sorumlu:** Kişi C · **Süre hedefi:** 3 saat · **Önkoşul:** Faz 5 ☑ (Faz 6 ile paralel yürütülebilir; Radyasyon eylemleri Faz 6 çıktısına bağlıdır)

## 0. Başlamadan (zorunlu)
`PROJECT_MEMORY.md`'yi oku (§3, §8, §9). `Alert`, `ActionDef`, `DaySchedule`, `EarthLinkConfig`, `Message` tiplerini ve `actionMap`'i incele. Evidence'taki `earth.*` parametrelerini listele.

## 1. Amaç
Bizim ana ayrıştırıcımız: **"Dünya'yı beklemek güvenli mi?"** sınıflaması + otomatik görev takvimi revizyonu + tüm bunların gerekçeli, kaynaklı gösterimi. Astronotun gördüğü "Eylem kartları" ve "Dünya ile iletişim" mantığı burada.

## 2. Kapsam
**Dahil:** eylem kataloğu, planlayıcı (kural tabanlı, çakışma çözümü, fark çıktısı), triyaj, Earth Link simülatörü (gecikme, giden/gelen kutu, kesinti), yer cevabı şablonları, `DecisionStage`, testler.
**Hariç:** UI (Faz 9–10).

## 3. Görevler

### 3.1 Eylem kataloğu (`src/core/decision/actions.ts`)
`ACTION_CATALOG: Record<ActionId, ActionDef>`. Aşağıdaki **tüm** ID'ler için: `titleKey`, 2–5 `stepKeys` (i18n anahtarları; metinler Faz 9'da `en/tr` sözlüğüne eklenecek — bu fazda anahtar listesini `docs/i18n-keys.md`'ye yaz), `appliesToStates`, `kind`, `scheduleEffects`, `evidenceIds` (ilgili NASA risk sayfası/HRP kaynağı md'de varsa, yoksa `[]` + `note`). `docs/i18n-keys.md` Faz 5/6'da başlamış olabilir: dosya varsa **EKLE**, yoksa oluştur.
`ACT_REST_BLOCK`, `ACT_REDUCE_WORKLOAD`, `ACT_BREATHING`, `ACT_COMMS_FAMILY`, `ACT_HYDRATE`, `ACT_SLEEP_SHIFT`, `ACT_LIGHT_CONTROL`, `ACT_SHELTER`, `ACT_DOSE_CHECK`, `ACT_CARDIO_CHECK`, `ACT_JOURNAL`, `ACT_PSYCH_CHECKIN`, `ACT_PRELANDING_FLUIDS` (kancası kapalıysa katalogda dursun).
Metin ilkesi: **öneri dili**; tıbbi tanı/ilaç/doz içermez; "consider / may help / follow your mission protocol". Acil radyasyon eylemi: "Move to the most shielded area of the vehicle per mission protocol" — **tıbbi talimat değil, prosedüre atıf**.

### 3.2 Planlayıcı (`src/core/decision/planner.ts`)
- **Baz plan:** `buildBaseSchedule(crew, day): DaySchedule` — 24 saatlik tipik gün (uyku `plan.sleep.durationH`, iş blokları, aero + resistif egzersiz, öğünler, hidrasyon hatırlatmaları, psikolojik check-in, iletişim penceresi). Kişiye göre uyku penceresi (`CrewProfile.sleepWindow`).
- **Efektler:** `ScheduleEffect` işlemleri `SHIFT/EXTEND/SHORTEN/ADD/REMOVE/SET_INTENSITY`. Örnekler: `ACT_REST_BLOCK` → `plan.rest.durationMin` dinlenme ekle; `ACT_SLEEP_SHIFT` → yatışı `plan.sleepShiftMin` erkene çek, uykuyu uzat; `ACT_HYDRATE` → +`plan.hydrate.extraBlocks` hidrasyon bloğu ve hedef artışı; fatigue → resistif yoğunluğu `LOW`'a düşür **(kemik riski için tamamen kaldırma; en az düşük yoğunluk bırak)**; `ACT_SHELTER` → tüm egzersiz/EVA bloklarını iptal, planlı iş `locked` olmayanları askıya al.
- **Çakışma çözümü:** kilitli (`locked`) bloklar dokunulmaz (ör. kritik görev). Çakışırsa öncelik: `SHELTER > SLEEP > HYDRATION > REST > MEAL > PSYCH_CHECKIN > EVA > EXERCISE_AERO > EXERCISE_RESISTIVE > COMMS > WORK`. Çözülemeyen çakışma → `ScheduleDiffItem.change:'CONFLICT'` ile gösterilir.
- **Çıktı:** `applyAdjustments(base, activeActions, ctx): {schedule: DaySchedule; diff: ScheduleDiffItem[]}`; `diff` her madde için `{blockId, change:'ADDED'|'MOVED'|'SHORTENED'|'EXTENDED'|'INTENSITY'|'REMOVED'|'CONFLICT', reasonKey, byAlertId}` ("**neden değişti**" şeffaflığı).
- **Güvenlik sınırları:** planlayıcı; günlük toplam uyku ≥ kişi baseline'ının `plan.sleep.minFractionOfBaseline` oranı, haftalık direnç egzersizi sıfıra inemez, su hedefi üst sınır (DEMO `hydration.max.L`) aşılamaz — sınırlar Evidence DEMO parametre.
- **Otomatik uygulama yok:** planlayıcı **öneri planı** üretir; kullanıcı `Accept/Dismiss` eder (`ACCEPT_ACTION {cardId}` mesajı; `ACCEPT_PLAN_CHANGE` YOK). Kabul edilen değişiklikler günlüğe yazılır (denetim izi).

### 3.3 Triyaj (`src/core/decision/triage.ts`)
```ts
classify(alert: Alert, link: EarthLinkConfig): { cls: EarthDelayClass; roundTripMin: number; timeToHarmMin: number; reasonKeys: ... }
```
- `roundTripMin = 2 × oneWayDelaySec / 60 + earth.groundProcessingMin` (Evidence, DEMO 15 dk; PROJECT_MEMORY §9 ile aynı formül); `blackout` ise `roundTripMin = Infinity`.
- Kural: severity ≥ WARNING **ve** `timeToHarmMin ≤ roundTripMin` → `ACT_NOW`; severity ≥ WARNING ve `timeToHarmMin > roundTripMin` → `ACT_THEN_REPORT`; severity < WARNING → `CAN_WAIT_FOR_EARTH` (rapora ekle ama acil değil). **Kesintide** (`blackout`) WARNING+ → daima `ACT_NOW` (Dünya'dan cevap beklenemez).
- Önemli: severity ≥ `CRITICAL` ve `radiation_event` → daima `ACT_NOW`.
- Sonuç `Alert.earthDelayClass`'a yazılır; gerekçe (`reasonKeys`) UI'da "Why this class?" olarak gösterilir.
- Gecikme değiştiğinde (kaydırıcı) **mevcut aktif uyarılar yeniden sınıflandırılır** (test: gecikmeyi artırınca `ACT_THEN_REPORT → ACT_NOW`'a geçiş).

### 3.4 Earth Link (`src/core/earthlink/link.ts`)
- `EarthLink` sınıfı: `config: EarthLinkConfig`; ön ayarlar Evidence'tan (`earth.oneWayDelaySec.moon/mars_min/mars_max`) + `CUSTOM`. **Zaman sim zamanıdır** (gerçek saat yok); `tick(simT)`.
- **Giden kutu (UP):** `send(message)` → `status:'QUEUED'`; link açıkken `sendT=now`, `arriveT=now+oneWay`; **kesintide** kuyrukta kalır ve bağlantı dönünce **öncelik sırasıyla** (priority 3>2>1>0), sonra eski→yeni gönderilir; kuyruk kapasitesi sınırlı (DEMO) ve bant genişliği modeli: paket başına bayt tahmini + `uplinkKbps` DEMO — ağır olanlar gecikebilir (basit; fazla karmaşıklaştırma).
- **Paket oluşturucu** (`packets.ts`): `buildStatusPacket(snapshot)`, `buildAlertPacket(alert)`, `buildDailySummary(crewId, day)`. **Gizlilik ilkesi:** yalnızca onaylı kategoriler (`consentCategories` kullanıcı ayarı: vitals özeti, uyarılar, radyasyon, davranış özeti); **journal metni ve ham check-in notları asla paket içinde olmaz** (test ile kanıtla: paket nesnesinde `journal` alanı yok, derin tarama).
- **Gelen kutu (DOWN):** Dünya cevapları `GroundReplyTemplate`'ten üretilir (`groundReplies.ts`): her uyarı türü için gerçekçi ama jenerik cevap (ör. "Ground acknowledges SPE report; continue shelter per protocol; will update in 30 min"). Cevap `arriveT = alertSendArrive + groundProcessing + oneWay`. Cevaplar **uydurma tıbbi talimat içermez**; şablon metinleri i18n anahtarı.
- **"Dünya cevabı bekleniyor" sayacı:** `getPendingReplies()` her mesaj için `etaT` ve geri sayım; UI "Message sent… reply in 14:00 — but the cockpit already advises: …" göstersin diye `PendingReply {messageId; etaT; relatedAlertId; localAdviceActionIds}`.
- **Otomatik gönderim politikası:** WARNING+ uyarı açıldığında `buildAlertPacket` otomatik kuyruğa (kullanıcı ayarlanabilir: `autoReport: true`), düşük severity günlük özete.
- **Gecikme önceliği:** senaryonun `earthLinkPreset`'i başlangıç değerini, `EARTH_DELAY` olayı olay süresince geçici değeri belirler; kullanıcı `SET_EARTH_LINK` / `E` tuşuyla değiştirirse **kullanıcı seçimi önceliklidir** ve senaryo onu geri almaz.
- **Kesinti senaryosu:** `COMM_BLACKOUT` olayı (Faz 2) ile `blackout=true`; sayaç "link down" gösterir; kuyruk büyür.
- Durum: `EarthLinkState {config; connected; outbox; inbox; pending; stats{sent, delivered, avgLatencyMin}}`.

### 3.5 `DecisionStage`
Sıra: `… Detection → Decision → Persist`. Her kare: aktif uyarılar → triyaj → eylem önerileri (önceliklendirilmiş, tekilleştirilmiş: aynı eylem birden çok uyarıdan gelirse tek kart, `sourceAlertIds[]`) → planlayıcı → Earth Link. Çıktı: `DecisionSnapshot {cards: ActionCard[]; schedule: DaySchedule; diff: ScheduleDiffItem[]; earth: EarthLinkState}`.
`ActionCard {id; actionId; crewId; priority:number; earthDelayClass; titleKey; stepKeys; whyKeys; sourceAlertIds; evidenceIds; state:'SUGGESTED'|'ACCEPTED'|'DISMISSED'|'DONE'}`.
- Kart önceliği: `ACT_NOW`+CRITICAL en üstte; sonra severity, sonra `timeToHarmMin`.
- Kabul/yoksayma kullanıcı eylemleri worker'a mesajla gelir (`ACCEPT_ACTION {cardId}`, `DISMISS_ACTION {cardId}`, `COMPLETE_ACTION {cardId}`, `SET_EARTH_LINK`, `SET_CONSENT`, `GROUND_REPLY`).

### 3.6 Testler (`tests/core/decision/`, `tests/core/earthlink/`)
- Triyaj tablo testi: severity × timeToHarm × gecikme × blackout kombinasyonları; yeniden sınıflandırma.
- Planlayıcı: her efekt; çakışma önceliği; güvenlik sınırları (uyku altına inemez, direnç egzersizi sıfırlanamaz); diff içeriği.
- Earth Link: gecikmeli teslim zamanları, kesintide kuyruk/öncelik, kuyruk kapasitesi, `pending` ETA; paket gizlilik taraması (journal yok); gecikme değişiminde kuyruktaki mesajların `arriveT` davranışı (kural: uçuştaki mesaj eski gecikmeyle gelir, yenileri yeni gecikmeyle).
- Uçtan uca: `solar_particle_event` → CRITICAL uyarı → `ACT_NOW` → `ACT_SHELTER` kartı → plan diff'inde egzersiz iptal → paket kuyrukta → yer cevabı gecikme sonrası gelir.
- `demo_main` senaryosu: SPE anında 14 dk tek yön gecikmeyle (`EARTH_DELAY {oneWayDelaySec:840}` olayı → gidiş-dönüş 28+15=43 dk; `radiation_event` zarar süresi 30 dk → `ACT_NOW`) sayaç + yerel öneri aynı anda var.

## 4. Kabul kriterleri
- [ ] Triyaj sınıfları ve gerekçeleri tablo testlerinde doğru.
- [ ] Plan diff'i her değişikliğin nedenini ve kaynak uyarıyı gösteriyor.
- [ ] Earth Link kesinti/gecikme/öncelik testleri geçiyor; gizlilik testi geçiyor.
- [ ] Debug sayfasında bir uyarı → kart → plan farkı → mesaj kuyruğu zinciri izlenebiliyor.
- [ ] `docs/i18n-keys.md` tüm yeni anahtarları listeliyor (Kişi A için).

## 5. Yasaklar
İlaç/doz/tanı içeren metin · gerçek tıbbi talimat ifadesi · journal'ı pakete koymak · gerçek saat/`Date.now` · planlayıcıyı kullanıcı onayı olmadan otomatik uygulamak · triyajı uyarı türüne `if` ile gömmek (parametreler Evidence'tan).

## 6. Bitirirken
`00_ORTAK_PROMPTLAR.md` → **B)** bloğu. Devir: `DecisionSnapshot` şeması, mesaj protokolüne eklenen yeni komutlar, i18n anahtarı listesi.
