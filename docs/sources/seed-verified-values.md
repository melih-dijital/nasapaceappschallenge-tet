---
id: seed-verified-values
title: Ekip araştırması — doğrulanmış başlangıç değerleri (PROJECT_MEMORY §7)
url: —
sourceType: DEMO_PARAMETER              # yalnızca yedek; her satır kendi sourceType/sourceTitle/sourceUrl sütununu taşır
accessedAt: 2026-11-14
owner: Ekip (PROJECT_MEMORY §7 tablosu)
---

## Özet
PROJECT_MEMORY.md §7'deki "doğrulanmış başlangıç değerleri" tablosunun şablon biçimindeki karşılığı. Değerler ve doğrulama durumları ekibin araştırmasından alındı; bu dosyaya yeni değer eklenmedi. Takım arkadaşları aynı id için ayrı bir kaynak md'si yazarsa buradaki satır silinir ve o md tek kaynak olur.

## Değerler
<!-- Satır düzeyinde kaynak: tek dosyada 5 sourceType ve 3 farklı URL var. VERIFIED satırlarda gerçek URL; URL'si bilinmeyen satırlarda '—' (uydurma URL yok). -->
| evidenceId | metric | value | unit | status | scope | note | sourceType | sourceTitle | sourceUrl |
|---|---|---|---|---|---|---|---|---|---|
| rad.career.limit.msv | career_effective_dose | 600 | mSv | VERIFIED | kariyer boyu, astronot başına | kariyer boyu etkin doz üst sınırı | NASA_STD | NASA-STD-3001 Vol.1 — radyasyon koruma teknik özeti (OCHMO) | https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf |
| rad.spe.limit.msv | spe_effective_dose | 250 | mSv | VERIFIED | güneş partikül olayı (SPE) başına | | NASA_STD | NASA-STD-3001 Vol.1 — radyasyon koruma teknik özeti (OCHMO) | https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf |
| rad.iss.rate.msv_day | iss_dose_rate | 0.2–0.5 | mSv/gün | VERIFIED | ISS (LEO) | | PEER_REVIEWED | NTRS — ASCEND (Simonsen, taslak) | https://ntrs.nasa.gov/api/citations/20250006168/downloads/ASCEND%20Simonsen%20draft%201.pdf |
| bone.loss.pct_month | bone_loss_rate | 1–1.5 | %/ay | VERIFIED | uzay uçuşu | | NASA_HRP | NASA HRP — Risk of Spaceflight-Induced Bone Changes | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ |
| rad.gcr.design.free_space | gcr_dose_rate | 1.3 | mSv/gün | PARTIAL | serbest uzay | tasarım referansı; bireysel limit değil | NASA_STD | NASA-STD-3001 (tasarım referansı) | — |
| rad.gcr.design.surface | gcr_dose_rate | 0.8–0.9 | mSv/gün | CONFLICTING | gezegen yüzeyi | tasarım referansı; kaynaklar 0.8 ve 0.9 diyor (çelişkili) | NASA_STD | NASA-STD-3001 (tasarım referansı) | — |
| spo2.critical | spo2 | 90 | % | PARTIAL | genel | genel klinik uygulama; uzay kaynağı değil | CLINICAL_CONVENTION | Genel klinik uygulama (uzay kaynağı değil) | — |
| noaa.s1.proton_flux.pfu | proton_flux | 10 | pfu | UNVERIFIED | ≥10 MeV proton akısı | NOAA S1 ölçeğine dayandığı düşünülüyor; ekip NOAA SWPC kaynağını bulup md'ye eklemeli | DEMO_PARAMETER | NOAA SWPC S1 ölçeği (kaynak doğrulanmadı) | — |
| hct.flight.rise.pct | hematocrit_change | +10–12 | % | UNVERIFIED | uçuş sırası | ikincil kaynak; birincil kaynak bulunmadan kullanma | PEER_REVIEWED | İkincil kaynak (birincil kaynak bulunacak) | — |

## Sınırlamalar / dikkat
- GCR değerleri tasarım referansıdır, bireysel limit değildir; yüzey değeri çelişkilidir (PROJECT_MEMORY §14).
- `spo2.critical` uzay kaynağı değil, genel klinik uygulamadır.
- NASA HRP risk sayfaları nitelikseldir; HR/SpO2/uyku için sayısal eşik vermez.

## Kodda nerede kullanılacak (opsiyonel)
- Faz 5 L1 limitleri, Faz 6 radyasyon ve kemik tahmini modülleri, Faz 10 Kanıt sayfası.
