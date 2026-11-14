---
id: calib-vitals-ranges                 # dosya adı: docs/calibration/<id>.md
title: Simülatör kalibrasyonu — vital aralıkları
sourceIds: [osdr-i4-trish-sensors, nasa-hrp-sleep]   # docs/sources içindeki id'ler (yoksa [] bırak)
owner: Kişi B
---

## Amaç
Simülatörün üreteceği "makul" değer aralıklarını gerekçelendirmek. Kaynak yoksa değeri "DEMO" olarak işaretle; uydurma değer kaynaklıymış gibi yazılmaz.

## Popülasyon aralıkları (kişiler arası fark için)
<!-- `evidenceId` sütunu docs/sources içindeki bir evidenceId'dir (front matter `sourceIds` ise dosya id'leridir). Sütun adları AYNEN kalmalı. betweenSd: kişiler arası SD; withinSd: kişi içi günlük SD. -->
| metric | unit | mean | betweenSd | withinSd | plausibleMin | plausibleMax | evidenceId | demo |
|---|---|---|---|---|---|---|---|---|
| hr | bpm | 62 | 6 | 3 | 30 | 220 | — | true |
| spo2 | % | 97.5 | 0.5 | 0.6 | 70 | 100 | — | true |
| sleep.durationH | h | 6.5 | 0.5 | 0.6 | 0 | 14 | — | true |
| hydrationL | L | 2.5 | 0.3 | 0.3 | 0 | 8 | — | true |
| rad.doseRateMsvDay | mSv/day | 0.35 | 0.05 | 0.03 | 0 | 50 | rad.iss.rate.msv_day | false |

## Ortam çarpanları (radyasyon ortamı)
| environment | doseRateMsvDay (mean) | evidenceId | demo |
|---|---|---|---|
| LEO | 0.35 | rad.iss.rate.msv_day | false |
| MARS_TRANSIT | 1.0 | — | true |

## Senaryo notları (opsiyonel)
- SPE sırasında doz hızı kaç kat artar? Kaynak / varsayım?
- Uyku borcu senaryosunda günlük uyku düşüşü?

## Sınırlamalar
- Bu değerler gerçek uçuş verisi değildir; sentetik üretim için "makul aralık" gerekçesidir.
