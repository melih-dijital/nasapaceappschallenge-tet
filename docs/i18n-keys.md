# i18n Anahtar Kataloğu (Faz 7: Karar Destek, Planlayıcı, Triyaj ve Earth Link)

Bu belge, Faz 7 (§3.1–§3.4) kapsamında `src/core/decision/` ve `src/core/earthlink/` modülleri tarafından üretilen tüm i18n anahtarlarını listeler. UI ekibi (Faz 9–10) çeviri dosyalarına bu anahtarları ve önerilen metinleri ekleyebilir.

> **Dil Kuralı:** Tüm metinler öneri ve görev prosedürü dilindedir; tıbbi tanı, ilaç adı veya dozaj talimatı içermez.

---

## 1. Eylem Kataloğu (`src/core/decision/actions.ts`)

| Anahtar | İngilizce (`en`) | Türkçe (`tr`) |
|---|---|---|
| `action.ACT_REST_BLOCK.title` | Schedule short rest block | Kısa dinlenme bloğu ekle |
| `action.ACT_REST_BLOCK.step1` | Pause non-critical tasks during the scheduled rest window. | Planlanan dinlenme aralığında kritik olmayan görevlere ara verin. |
| `action.ACT_REST_BLOCK.step2` | Assume a comfortable posture and minimize cognitive load. | Rahat bir pozisyon alın ve bilişsel yükü azaltın. |
| `action.ACT_REST_BLOCK.step3` | Log subjective fatigue status after the rest block. | Dinlenme bloğu sonrasında öznel yorgunluk durumunuzu kaydedin. |
| `action.ACT_REDUCE_WORKLOAD.title` | Reduce workload and step down intensity | İş yükünü ve egzersiz yoğunluğunu düşür |
| `action.ACT_REDUCE_WORKLOAD.step1` | Lower active work blocks to LOW intensity and trim flexible workload. | Aktif çalışma bloklarını DÜŞÜK yoğunluğa çekin ve esnek iş yükünü kısaltın. |
| `action.ACT_REDUCE_WORKLOAD.step2` | Step down resistive exercise to LOW instead of canceling completely. | Direnç egzersizini tamamen iptal etmek yerine DÜŞÜK yoğunluğa indirin. |
| `action.ACT_REDUCE_WORKLOAD.step3` | Prioritize essential operational tasks until fatigue recovers. | Yorgunluk toparlanana kadar yalnızca temel operasyonel görevlere odaklanın. |
| `action.ACT_BREATHING.title` | Paced breathing session | Kontrollü nefes egzersizi |
| `action.ACT_BREATHING.step1` | Sit upright in a quiet station area for 5 minutes. | İstasyonun sakin bir alanında 5 dakika boyunca dik oturun. |
| `action.ACT_BREATHING.step2` | Follow steady slow-paced inhalation and exhalation cycles. | Yavaş ve düzenli nefes alma-verme döngülerini takip edin. |
| `action.ACT_BREATHING.step3` | Resume scheduled duties when tension eases. | Gerginlik azaldığında planlı görevlerinize dönün. |
| `action.ACT_COMMS_FAMILY.title` | Personal communication window | Aile/yakınlar ile iletişim penceresi |
| `action.ACT_COMMS_FAMILY.step1` | Extend the next personal comms slot when link window permits. | Bağlantı penceresi uygun olduğunda kişisel iletişim bloğunu uzatın. |
| `action.ACT_COMMS_FAMILY.step2` | Send a voice or text update to ground support contacts. | Yer destek kişilerinize sesli veya yazılı durum mesajı iletin. |
| `action.ACT_HYDRATE.title` | Scheduled hydration blocks | Planlı sıvı alım blokları |
| `action.ACT_HYDRATE.step1` | Complete the added hydration reminder slots across the schedule. | Takvime eklenen sıvı alım hatırlatma bloklarını tamamlayın. |
| `action.ACT_HYDRATE.step2` | Distribute fluid intake evenly over waking hours within mission caps. | Sıvı alımını görev üst sınırları içinde uyanıklık saatlerine yayın. |
| `action.ACT_HYDRATE.step3` | Confirm intake completion in the daily telemetry log. | Günlük telemetri kaydında sıvı alımını onaylayın. |
| `action.ACT_SLEEP_SHIFT.title` | Shift and extend sleep window | Uyku penceresini kaydır ve uzat |
| `action.ACT_SLEEP_SHIFT.step1` | Adjust the upcoming sleep window per schedule recommendation. | Yaklaşan uyku penceresini plan önerisine göre güncelleyin. |
| `action.ACT_SLEEP_SHIFT.step2` | Wind down stimulating tasks 30 minutes prior to sleep onset. | Uyku başlangıcından 30 dakika önce uyarıcı görevleri sonlandırın. |
| `action.ACT_SLEEP_SHIFT.step3` | Protect minimum baseline sleep duration from lower-priority tasks. | Temel uyku süresini düşük öncelikli görevlere karşı koruyun. |
| `action.ACT_LIGHT_CONTROL.title` | Cabin lighting alignment | Kabin aydınlatması uyarlaması |
| `action.ACT_LIGHT_CONTROL.step1` | Dim blue-enriched cabin lighting prior to scheduled sleep. | Planlı uyku öncesinde mavi ağırlıklı kabin aydınlatmasını kısın. |
| `action.ACT_LIGHT_CONTROL.step2` | Increase bright lighting exposure during the active work start window. | Aktif çalışma başlangıç aralığında aydınlık maruziyetini artırın. |
| `action.ACT_LIGHT_CONTROL.step3` | Keep sleep compartment dark and shielded during rest hours. | Dinlenme saatlerinde uyku bölümünü karanlık ve korumalı tutun. |
| `action.ACT_SHELTER.title` | Solar event shelter protocol | Güneş olayı sığınma protokolü |
| `action.ACT_SHELTER.step1` | Suspend EVA and non-essential work/exercise immediately. | EVA ile zorunlu olmayan çalışma ve egzersiz bloklarını derhal durdurun. |
| `action.ACT_SHELTER.step2` | Relocate to the designated radiation shelter zone. | Belirlenen radyasyon sığınma bölgesine geçin. |
| `action.ACT_SHELTER.step3` | Monitor personal dosimeter readings until all-clear is issued. | Temiz sinyali verilene kadar kişisel dozimetre okumalarını izleyin. |
| `action.ACT_DOSE_CHECK.title` | Dosimetry log verification | Dozimetri kaydı doğrulaması |
| `action.ACT_DOSE_CHECK.step1` | Inspect cumulative and interval dose readings on the crew dosimeter. | Mürettebat dozimetresindeki kümülatif ve aralık bazlı doz okumalarını inceleyin. |
| `action.ACT_DOSE_CHECK.step2` | Transmit summary radiation telemetry to Mission Control. | Özet radyasyon telemetrisini Görev Kontrolüne iletin. |
| `action.ACT_CARDIO_CHECK.title` | Sensor and posture check | Sensör ve duruş kontrolü |
| `action.ACT_CARDIO_CHECK.step1` | Verify wearable strap placement and signal quality while resting. | Dinlenme halinde giyilebilir sensör yerleşimini ve sinyal kalitesini doğrulayın. |
| `action.ACT_CARDIO_CHECK.step2` | Avoid strenuous exertion while elevated strain warning remains active. | Yüksek zorlanma uyarısı sürerken yoğun efordan kaçının. |
| `action.ACT_CARDIO_CHECK.step3` | Report persistent warnings to Flight Control for protocol review. | Süregelen uyarıları protokol değerlendirmesi için Uçuş Kontrolüne bildirin. |
| `action.ACT_JOURNAL.title` | Private reflection log | Kişisel günlük kaydı |
| `action.ACT_JOURNAL.step1` | Open the local-only reflection log on your onboard device. | Cihazınızdaki yalnızca yerel çalışan kişisel günlük alanını açın. |
| `action.ACT_JOURNAL.step2` | Note thoughts privately; entries never leave this device. | Düşüncelerinizi gizlice kaydedin; kayıtlar cihaz dışına asla çıkmaz. |
| `action.ACT_PSYCH_CHECKIN.title` | Behavioral check-in survey | Davranışsal durum yoklaması |
| `action.ACT_PSYCH_CHECKIN.step1` | Complete the brief mood, stress, and motivation check-in scale. | Kısa duygu durum, stres ve motivasyon değerlendirme ölçeğini doldurun. |
| `action.ACT_PSYCH_CHECKIN.step2` | Share aggregated trend summary only if behavioral consent is enabled. | Yalnızca davranışsal onay açıksa toplu eğilim özetini paylaşın. |
| `action.ACT_PRELANDING_FLUIDS.title` | Pre-landing fluid protocol | İniş öncesi sıvı hazırlık protokolü |
| `action.ACT_PRELANDING_FLUIDS.step1` | Follow scheduled mission pre-entry hydration checkpoints when active. | Etkinleştirildiğinde görev öncesi planlı sıvı alım noktalarını izleyin. |
| `action.ACT_PRELANDING_FLUIDS.step2` | Confirm completion with the flight crew prior to entry window. | İniş penceresi öncesinde uçuş ekibiyle tamamlandığını teyit edin. |

---

## 2. Planlayıcı Fark Nedenleri (`src/core/decision/planner.ts`)

| Anahtar | Parametreler | İngilizce (`en`) | Türkçe (`tr`) |
|---|---|---|---|
| `plan.diff.conflictLocked` | `—` | Skipped because target block is locked | Hedef blok kilitli olduğu için değişiklik atlandı |
| `plan.diff.conflictOverlap` | `—` | Adjusted due to priority overlap with another block | Başka bir blokla öncelik çakışması nedeniyle uyarlandı |
| `plan.diff.sleepFloorProtected` | `—` | Protected minimum baseline sleep duration | Temel uyku süresi alt sınırı korundu |
| `plan.diff.resistiveFloorProtected` | `—` | Kept resistive exercise session to protect bone health | Kemik sağlığını korumak için direnç egzersizi korundu |
| `plan.diff.ACT_REST_BLOCK` | `—` | Added rest block to support recovery | Toparlanmayı desteklemek için dinlenme bloğu eklendi |
| `plan.diff.ACT_REDUCE_WORKLOAD` | `—` | Reduced work load and exercise intensity | İş yükü ve egzersiz yoğunluğu azaltıldı |
| `plan.diff.ACT_BREATHING` | `—` | Breathing advisory active (no schedule change) | Nefes egzersizi önerisi etkin (takvim değişmedi) |
| `plan.diff.ACT_COMMS_FAMILY` | `—` | Extended personal communications window | Kişisel iletişim penceresi uzatıldı |
| `plan.diff.ACT_HYDRATE` | `—` | Added hydration blocks to daily schedule | Günlük takvime sıvı alım blokları eklendi |
| `plan.diff.ACT_SLEEP_SHIFT` | `—` | Shifted and extended sleep window | Uyku penceresi kaydırıldı ve uzatıldı |
| `plan.diff.ACT_LIGHT_CONTROL` | `—` | Lighting guidance active (no schedule change) | Aydınlatma yönlendirmesi etkin (takvim değişmedi) |
| `plan.diff.ACT_SHELTER` | `—` | Activated solar shelter protocol in schedule | Takvimde güneş sığınma protokolü etkinleştirildi |
| `plan.diff.ACT_DOSE_CHECK` | `—` | Dosimetry verification active (no schedule change) | Dozimetri doğrulaması etkin (takvim değişmedi) |
| `plan.diff.ACT_CARDIO_CHECK` | `—` | Sensor check active (no schedule change) | Sensör kontrolü etkin (takvim değişmedi) |
| `plan.diff.ACT_JOURNAL` | `—` | Private journal prompt active (no schedule change) | Kişisel günlük önerisi etkin (takvim değişmedi) |
| `plan.diff.ACT_PSYCH_CHECKIN` | `—` | Behavioral check-in reminder active | Davranışsal yoklama hatırlatıcısı etkin |
| `plan.diff.ACT_PRELANDING_FLUIDS` | `—` | Pre-landing fluid protocol reminder active | İniş öncesi sıvı protokolü hatırlatıcısı etkin |

---

## 3. Gecikme-Bilinçli Triyaj Nedenleri (`src/core/decision/triage.ts`)

Tüm `triage.reason.*` anahtarları `{ severity, oneWayDelaySec, roundTripMin, timeToHarmMin }` parametrelerini alır.

| Anahtar | İngilizce (`en`) | Türkçe (`tr`) |
|---|---|---|
| `triage.reason.criticalRadiation` | Critical radiation event requires immediate onboard shelter action regardless of Earth delay (RTT {{roundTripMin}} min). | Kritik radyasyon olayı, Dünya gecikmesinden bağımsız olarak derhal araç içi sığınma aksiyonu gerektirir (Gidiş-dönüş {{roundTripMin}} dk). |
| `triage.reason.lowSeverity` | Informational alert ({{severity}}); safe to await Earth Flight Control review (RTT {{roundTripMin}} min). | Bilgi düzeyinde uyarı ({{severity}}); Dünya Uçuş Kontrolü yanıtını beklemek güvenlidir (Gidiş-dönüş {{roundTripMin}} dk). |
| `triage.reason.blackout` | Communications blackout active; act autonomously now and queue report for reconnection. | İletişim kesintisi (blackout) etkin; şimdi özerk aksiyon alın ve raporu bağlantı geri gelince gönderilmek üzere kuyruğa ekleyin. |
| `triage.reason.delayExceedsTimeToHarm` | Earth round-trip ({{roundTripMin}} min) meets or exceeds time-to-harm window ({{timeToHarmMin}} min); act immediately onboard. | Dünya gidiş-dönüş süresi ({{roundTripMin}} dk), müdahale penceresine ({{timeToHarmMin}} dk) eşit veya büyük; derhal araç içi aksiyon alın. |
| `triage.reason.withinSafeDelayWindow` | Intervention window ({{timeToHarmMin}} min) exceeds Earth round-trip ({{roundTripMin}} min); apply local precautions and await Earth reply. | Müdahale penceresi ({{timeToHarmMin}} dk), Dünya gidiş-dönüş süresinden ({{roundTripMin}} dk) uzun; yerel önlemi uygulayıp Dünya yanıtını bekleyin. |

---

## 4. Yer İstasyonu Yanıt Şablonları (`src/core/earthlink/groundReplies.ts`)

| Şablon ID | Anahtar | İngilizce (`en`) | Türkçe (`tr`) |
|---|---|---|---|
| `REPLY_SPE_ACK` | `ground.reply.REPLY_SPE_ACK.title` | Mission Control: Radiation Protocol Confirmed | Görev Kontrolü: Radyasyon Protokolü Onaylandı |
| `REPLY_SPE_ACK` | `ground.reply.REPLY_SPE_ACK.body` | Ground radiation ops received your SPE telemetry packet and logged current shelter posture. | Yer radyasyon ekibi SPE telemetri paketinizi aldı ve mevcut sığınma durumunu kaydetti. |
| `REPLY_SPE_ACK` | `ground.reply.REPLY_SPE_ACK.followUp` | Continue shelter protocol until solar particle flux drops and send next dosimetry summary. | Güneş parçacık akısı düşene kadar sığınma protokolünü sürdürün ve sonraki dozimetri özetini gönderin. |
| `REPLY_SPO2_ACK` | `ground.reply.REPLY_SPO2_ACK.title` | Flight Control: Cabin & Oximetry Packet Logged | Uçuş Kontrolü: Kabin ve Oksimetre Paketi Alındı |
| `REPLY_SPO2_ACK` | `ground.reply.REPLY_SPO2_ACK.body` | Telemetry summary has been reviewed by the life support console. | Yaşam destek konsolu telemetri özetini inceledi. |
| `REPLY_SPO2_ACK` | `ground.reply.REPLY_SPO2_ACK.followUp` | Verify sensor fit and environmental CO2/O2 readings on your next scheduled check. | Bir sonraki planlı kontrolde sensör yerleşimini ve kabin CO2/O2 okumalarını doğrulayın. |
| `REPLY_SLEEP_ACK` | `ground.reply.REPLY_SLEEP_ACK.title` | Flight Control: Sleep Adjustment Noted | Uçuş Kontrolü: Uyku Düzenlemesi Kaydedildi |
| `REPLY_SLEEP_ACK` | `ground.reply.REPLY_SLEEP_ACK.body` | Ground planning team acknowledged the crew sleep window adjustment request. | Yer planlama ekibi mürettebat uyku penceresi güncellemesini onayladı. |
| `REPLY_SLEEP_ACK` | `ground.reply.REPLY_SLEEP_ACK.followUp` | Protect core sleep hours; non-critical timeline tasks have been deprioritized on ground copy. | Temel uyku saatlerini koruyun; kritik olmayan görevlerin önceliği yer kopyasında düşürüldü. |
| `REPLY_FATIGUE_ACK` | `ground.reply.REPLY_FATIGUE_ACK.title` | Flight Control: Workload Step-Down Approved | Uçuş Kontrolü: İş Yükü Azaltımı Onaylandı |
| `REPLY_FATIGUE_ACK` | `ground.reply.REPLY_FATIGUE_ACK.body` | Ops console logged elevated fatigue state and supports the reduced workload schedule. | Operasyon konsolu artan yorgunluk durumunu kaydetti ve azaltılmış iş yükü planını onaylıyor. |
| `REPLY_FATIGUE_ACK` | `ground.reply.REPLY_FATIGUE_ACK.followUp` | Maintain scheduled rest blocks and report updated readiness after the sleep cycle. | Planlanan dinlenme bloklarını sürdürün ve uyku döngüsü sonrasında güncel hazırlık durumunu bildirin. |
| `REPLY_STRESS_ACK` | `ground.reply.REPLY_STRESS_ACK.title` | Ground Support: Stress Alert Received | Yer Desteği: Stres Uyarısı Alındı |
| `REPLY_STRESS_ACK` | `ground.reply.REPLY_STRESS_ACK.body` | Ground crew support received your alert summary without accessing private journal notes. | Yer destek ekibi, özel günlük notlarınıza erişmeden uyarı özetinizi teslim aldı. |
| `REPLY_STRESS_ACK` | `ground.reply.REPLY_STRESS_ACK.followUp` | Use scheduled recovery slots and request an extended personal comms pass if desired. | Planlı toparlanma bloklarını kullanın ve isterseniz uzatılmış kişisel iletişim penceresi talep edin. |
| `REPLY_DEHYDRATION_ACK` | `ground.reply.REPLY_DEHYDRATION_ACK.title` | Flight Control: Hydration Plan Confirmed | Uçuş Kontrolü: Sıvı Takviye Planı Onaylandı |
| `REPLY_DEHYDRATION_ACK` | `ground.reply.REPLY_DEHYDRATION_ACK.body` | Ground team logged the dehydration alert and increased scheduled hydration reminders. | Yer ekibi sıvı açığı uyarısını kaydetti ve planlı sıvı hatırlatıcılarının artışını onayladı. |
| `REPLY_DEHYDRATION_ACK` | `ground.reply.REPLY_DEHYDRATION_ACK.followUp` | Track daily intake totals in telemetry and confirm recovery on the next summary packet. | Günlük alım toplamlarını telemetriden izleyin ve sonraki özet pakette toparlanmayı teyit edin. |
| `REPLY_CARDIO_ACK` | `ground.reply.REPLY_CARDIO_ACK.title` | Flight Control: Strain Telemetry Logged | Uçuş Kontrolü: Zorlanma Telemetrisi Alındı |
| `REPLY_CARDIO_ACK` | `ground.reply.REPLY_CARDIO_ACK.body` | Telemetry trends have been archived for ground console review alongside mission activity logs. | Telemetri eğilimleri görev etkinlik kayıtlarıyla birlikte yer konsolu incelemesi için arşivlendi. |
| `REPLY_CARDIO_ACK` | `ground.reply.REPLY_CARDIO_ACK.followUp` | Keep exertion within low-strain limits and repeat sensor verification at rest. | Eforu düşük zorlanma sınırlarında tutun ve dinlenme halinde sensör doğrulamasını tekrarlayın. |
| `REPLY_MOOD_ACK` | `ground.reply.REPLY_MOOD_ACK.title` | Ground Support: Behavioral Summary Logged | Yer Desteği: Davranışsal Özet Alındı |
| `REPLY_MOOD_ACK` | `ground.reply.REPLY_MOOD_ACK.body` | Ground support noted the behavioral trend alert under your active sharing preferences. | Yer desteği, etkin paylaşım tercihleriniz çerçevesinde davranışsal eğilim uyarısını kaydetti. |
| `REPLY_MOOD_ACK` | `ground.reply.REPLY_MOOD_ACK.followUp` | Family comms pass remains prioritized in the upcoming uplink window. | Yaklaşan bağlantı penceresinde aile iletişim geçişi öncelikli olarak korunmaktadır. |
| `REPLY_GENERIC_ACK` | `ground.reply.REPLY_GENERIC_ACK.title` | Mission Control: Telemetry Packet Received | Görev Kontrolü: Telemetri Paketi Alındı |
| `REPLY_GENERIC_ACK` | `ground.reply.REPLY_GENERIC_ACK.body` | Ground console received your delayed downlink packet and updated mission status logs. | Yer konsolu gecikmeli iletim paketinizi aldı ve görev durum kayıtlarını güncelledi. |
| `REPLY_GENERIC_ACK` | `ground.reply.REPLY_GENERIC_ACK.followUp` | Continue following current onboard advisory procedures and monitor next comm pass. | Mevcut araç içi öneri prosedürlerini izlemeye devam edin ve sonraki iletişim geçişini takip edin. |

---

## 5. Algılama Motoru ve Metrik Anahtarları (Faz 5: `src/core/detection/i18nKeys.ts`)

Bu bölüm, `src/core/detection/i18nKeys.ts` içindeki `DETECTION_I18N_KEYS` listesinin tamamını (39 anahtar) içerir.

### 5.1 Durum ve Limit Uyarı Başlıkları

| Anahtar | Parametreler | İngilizce (`en`) | Türkçe (`tr`) | Not |
|---|---|---|---|---|
| `alert.fatigue.title` | `—` | Elevated fatigue pattern detected | Yüksek yorgunluk örüntüsü algılandı | `STATE_IDS` |
| `alert.stress.title` | `—` | Elevated stress indicators detected | Artan stres göstergeleri algılandı | `STATE_IDS` |
| `alert.dehydration.title` | `—` | Hydration deficit pattern detected | Sıvı açığı örüntüsü algılandı | `STATE_IDS` |
| `alert.sleep_debt.title` | `—` | Cumulative sleep debt detected | Birikimli uyku borcu algılandı | `STATE_IDS` |
| `alert.radiation_event.title` | `—` | Elevated radiation environment detected | Yüksek radyasyon ortamı algılandı | `STATE_IDS` |
| `alert.cardio_strain.title` | `—` | Cardiovascular strain trend detected | Kardiyovasküler zorlanma eğilimi algılandı | `STATE_IDS` |
| `alert.mood_decline.title` | `—` | Behavioral mood decline trend detected | Davranışsal duygu durum düşüşü algılandı | `STATE_IDS` |
| `alert.l1.SPO2_LOW.title` | `—` | Low SpO2 threshold crossed | Düşük SpO2 eşiği aşıldı | `L1_RULES` |
| `alert.l1.CO2_HIGH.title` | `—` | Elevated cabin CO2 threshold crossed | Yüksek kabin CO2 eşiği aşıldı | `L1_RULES` |
| `alert.l1.CAREER_DOSE.title` | `—` | Career radiation dose threshold approached | Kariyer radyasyon dozu eşiğine yaklaşıldı | `L1_RULES` |
| `alert.l1.SPE_DOSE.title` | `—` | Solar particle event protection target approached | Güneş parçacık olayı koruma hedefine yaklaşıldı | `L1_RULES` |
| `alert.metric.cabinCo2ppm.title` | `—` | Cabin CO2 deviation or trend detected | Kabin CO2 sapması veya eğilimi algılandı | durum eşlemesi olmayan metrik uyarısı (L2/L3) |

### 5.2 Açıklanabilirlik ("Why?") Gerekçe Anahtarları

> **Doğrulanmamış / SPE Notu:** `why.l1.*` anahtarlarında `verified=0` ise UI `"unverified / doğrulanmadı"` etiketini gösterir. `why.l1.SPE_DOSE` eşiği kişisel limit değil **"design reference SPE protection target"** olarak etiketlenir.

| Anahtar | Parametreler | İngilizce (`en`) | Türkçe (`tr`) | Not |
|---|---|---|---|---|
| `why.l1.SPO2_LOW` | `value`, `threshold`, `verified` | SpO2 reading ({{value}}%) fell below reference threshold ({{threshold}}%). | SpO2 ölçümü ({{value}}%) referans eşiğin ({{threshold}}%) altına indi. | `verified=0` ise doğrulanmadı etiketi |
| `why.l1.CO2_HIGH` | `value`, `threshold`, `verified` | Cabin CO2 ({{value}} ppm) reached advisory threshold ({{threshold}} ppm). | Kabin CO2 düzeyi ({{value}} ppm) uyarı eşiğine ({{threshold}} ppm) ulaştı. | `verified=0` ise doğrulanmadı etiketi (DEMO parametre) |
| `why.l1.CAREER_DOSE` | `value`, `threshold`, `verified` | Cumulative career dose ({{value}} mSv) reached threshold ({{threshold}} mSv). | Kümülatif kariyer dozu ({{value}} mSv) eşik değere ({{threshold}} mSv) ulaştı. | `verified=0` ise doğrulanmadı etiketi |
| `why.l1.SPE_DOSE` | `value`, `threshold`, `verified` | Event dose ({{value}} mSv) approached design reference SPE protection target ({{threshold}} mSv). | Olay dozu ({{value}} mSv) tasarım referansı SPE koruma hedefine ({{threshold}} mSv) yaklaştı. | limit değil, **design reference SPE protection target** |
| `why.l2.deviation` | `metric`, `z`, `persistFrames` | {{metric}} deviated from personal baseline (z={{z}}) across {{persistFrames}} consecutive frames. | {{metric}} kişisel referanstan {{persistFrames}} ardışık kare boyunca saptı (z={{z}}). | L2 kalıcılık gerekçesi |
| `why.l3.consecutive` | `metric`, `days`, `value`, `below` | {{metric}} stayed outside target for {{days}} consecutive days (latest {{value}}, threshold {{below}}). | {{metric}} {{days}} ardışık gün boyunca hedefin dışında kaldı (son {{value}}, eşik {{below}}). | L3 çok günlü kural |
| `why.l3.cusum` | `metric`, `s`, `h` | {{metric}} cumulative shift statistic (S={{s}}) exceeded threshold (h={{h}}). | {{metric}} birikimli kayma istatistiği (S={{s}}) eşiği (h={{h}}) aştı. | L3 günlük CUSUM |
| `why.l3.theil_sen` | `metric`, `slopePerDay`, `sameSign`, `windowDays`, `rise` | {{metric}} trend slope ({{slopePerDay}}/day, {{sameSign}} consistent days over {{windowDays}}d, rise {{rise}}). | {{metric}} eğim trendi ({{slopePerDay}}/gün, {{windowDays}} günde {{sameSign}} tutarlı gün, artış {{rise}}). | L3 Theil-Sen eğimi |
| `why.baseline.lowConfidence` | `confidence` | Personal baseline confidence is low ({{confidence}}); alert severity capped at ADVISORY. | Kişisel baseline güveni düşük ({{confidence}}); uyarı seviyesi en fazla ADVISORY olarak sınırlandı. | güven kapısı |
| `why.state.score` | `state`, `score`, `confidence` | Composite {{state}} score reached {{score}} (baseline confidence {{confidence}}). | Bileşik {{state}} skoru {{score}} değerine ulaştı (baseline güveni {{confidence}}). | L4 durum skoru |
| `why.state.contributor` | `metric`, `z`, `weightPct`, `contribution` | {{metric}} contributed {{contribution}} (z={{z}}, weight {{weightPct}}%). | {{metric}} metriği {{contribution}} katkı sağladı (z={{z}}, ağırlık %{{weightPct}}). | L4 katkı çubuğu |

### 5.3 Metrik Etiketleri (`METRIC_META.labelKey`)

| Anahtar | Parametreler | İngilizce (`en`) | Türkçe (`tr`) | Not |
|---|---|---|---|---|
| `metric.hr` | `—` | Heart Rate (bpm) | Kalp Atım Hızı (bpm) | `METRIC_META.labelKey` |
| `metric.spo2` | `—` | SpO2 (%) | SpO2 (%) | `METRIC_META.labelKey` |
| `metric.hrv` | `—` | Heart Rate Variability (ms) | Kalp Hızı Değişkenliği (ms) | `METRIC_META.labelKey` |
| `metric.sleep.durationH` | `—` | Sleep Duration (h) | Uyku Süresi (sa) | `METRIC_META.labelKey` |
| `metric.sleep.efficiency` | `—` | Sleep Efficiency | Uyku Verimliliği | `METRIC_META.labelKey` |
| `metric.sleep.midpointShiftMin` | `—` | Sleep Midpoint Shift (min) | Uyku Orta Nokta Kayması (dk) | `METRIC_META.labelKey` |
| `metric.activity.exerciseMin` | `—` | Aerobic Exercise (min) | Aerobik Egzersiz (dk) | `METRIC_META.labelKey` |
| `metric.activity.resistiveMin` | `—` | Resistive Exercise (min) | Direnç Egzersizi (dk) | `METRIC_META.labelKey` |
| `metric.hydrationL` | `—` | Hydration Intake (L) | Sıvı Alımı (L) | `METRIC_META.labelKey` |
| `metric.cabinCo2ppm` | `—` | Cabin CO2 (ppm) | Kabin CO2 (ppm) | `METRIC_META.labelKey` |
| `metric.mood.stress` | `—` | Perceived Stress (1–10) | Algılanan Stres (1–10) | `METRIC_META.labelKey` |
| `metric.mood.mood` | `—` | Mood Score (1–10) | Duygu Durum Skoru (1–10) | `METRIC_META.labelKey` |
| `metric.mood.motivation` | `—` | Motivation Score (1–10) | Motivasyon Skoru (1–10) | `METRIC_META.labelKey` |
| `metric.pvt.medianMs` | `—` | PVT Median Reaction Time (ms) | PVT Medyan Tepki Süresi (ms) | `METRIC_META.labelKey` |
| `metric.pvt.lapses` | `—` | PVT Lapses (count) | PVT Dikkat Boşluğu (adet) | `METRIC_META.labelKey` |
| `metric.rad.doseRateMsvDay` | `—` | Radiation Dose Rate (mSv/day) | Radyasyon Doz Hızı (mSv/gün) | `METRIC_META.labelKey` |
