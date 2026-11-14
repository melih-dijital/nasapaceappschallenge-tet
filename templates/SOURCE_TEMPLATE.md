---
id: nasa-std-3001-v1-radiation          # küçük harf, tire; dosya adı da bu: docs/sources/<id>.md
title: NASA-STD-3001 Vol.1 — Crew Health, radyasyon limitleri
url: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
sourceType: NASA_STD                    # NASA_STD | NASA_HRP | PEER_REVIEWED | CLINICAL_CONVENTION | DEMO_PARAMETER
accessedAt: 2026-11-14
owner: Kişi B                           # kim doğruladı
---

## Özet
2–4 cümle: bu kaynak ne söylüyor, kapsamı ne? (Kopyala-yapıştır uzun alıntı YOK; kendi cümlelerinle, en fazla 15 kelimelik kısa alıntı.)

## Değerler
<!-- TEK tablo. Sütun adları AYNEN böyle kalmalı. value: sayı veya "min-max" (en-dash "min–max" ve baştaki "+" da kabul). `metric` serbest metindir (doğrulanmaz). İSTEĞE BAĞLI ek sütunlar (tablonun SONUNA): sourceType | sourceTitle | sourceUrl — boşsa/yoksa dosyanın front matter'ı (sourceType/title/url) kullanılır. URL'de boşluk yok (%20). status ≠ VERIFIED satırda URL `—` olabilir.
     status (SATIR başına): VERIFIED (kaynağı açıp gözle doğruladın) | PARTIAL | CONFLICTING (kaynaklar çelişiyor) | UNVERIFIED. DEMO_PARAMETER her zaman UNVERIFIED. -->
| evidenceId | metric | value | unit | status | scope | note |
|---|---|---|---|---|---|---|
| rad.career.limit.msv | career_effective_dose | 600 | mSv | VERIFIED | tüm astronotlar, cinsiyet/yaş bağımsız | kariyer boyu etkin doz üst sınırı |
| rad.spe.limit.msv | spe_effective_dose | 250 | mSv | PARTIAL | tasarım referansı SPE (Ekim 1989 olaylarının toplamı) için mürettebat koruma hedefi; kişisel olay-başı limit değil | tasarım referansı SPE koruma hedefi, kişisel olay-başı limit değil; 30 günlük kan yapıcı organ limiti (mGy-Eq) doğrulanmadı |

## Sınırlamalar / dikkat
- Değer tasarım referansı mı, bireysel limit mi? Çelişen kaynak var mı?
- Hangi ortam/görev tipi için geçerli?

## Kodda nerede kullanılacak (opsiyonel)
- Faz 5 L1 limitleri, Faz 6 radyasyon modülü
