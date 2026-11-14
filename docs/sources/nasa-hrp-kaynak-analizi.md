---
id: nasa-hrp-kaynak-analizi
title: NASA Human Research Program — Hazards, Risks ve Devam Eden Araştırmalar
url: https://www.nasa.gov/hrp/risks/
sourceType: NASA_HRP
accessedAt: 2026-11-14
owner: Takım TET (Kişi C)
---

## Özet
NASA Human Research Program (HRP), insanlı uzay görevlerindeki sağlık ve performans tehditlerini 5 temel tehlike ("hazards") ve bunlara bağlı insan fizyolojisi, davranışsal sağlık ve radyasyon riskleri altında tanımlar. Derin uzay yolculuklarında Dünya'dan uzaklık arttıkça tele-tıp imkanlarının kısıtlanacağını ve mürettebatın otonom karar alma gereksinimini vurgular. Artemis II ve ISS'te yürütülen ARCHeR, Standard Measures ve CIPHER gibi araştırmalarla koruyucu tedbirler geliştirilmektedir; kaynak niteliksel bir çerçevedir, biyometrik sensörler için sayısal sınır değerleri içermez.

## Değerler
<!-- TEK tablo. Sütun adları AYNEN kalmalıdır. Bu kaynak niteliksel çerçeve sunduğundan ve notta sayısal eşik yer almadığından değer uydurulmamıştır (§3.7). Niteliksel eşlemeler aşağıda listelenmiştir. -->
| evidenceId | metric | value | unit | status | scope | note |
|---|---|---|---|---|---|---|

## Sınırlamalar / dikkat
- NASA HRP sayfaları niteliksel/kavramsal risk ve tehlike tanımları sunar; kalp atım hızı (HR), kandaki oksijen doygunluğu (SpO2) veya uyku süreleri için doğrudan sayısal alarm eşiği vermez. Bu değerler NASA standardı gibi sunulamaz.
- "Dünya'dan Uzaklık" (Distance from Earth) tehlikesi, gecikme-bilinçli triyaj mimarimizin (ACT_NOW / ACT_THEN_REPORT / CAN_WAIT_FOR_EARTH) ve bağımsız sağlık kokpiti konseptinin temel bilimsel gerekçesidir.
- "Uzay Görevi Kaynaklı Kemik Değişimleri" riski niteliksel olarak kemik kaybı ve kırık riskini açıklar; aylık kayıp oranı sayısal değeri (%1–1.5/ay) için birincil teknik kaynaklar (`seed-verified-values.md` içindeki HRP sayfası) temel alınmalıdır.
- Artemis II ve ISS'teki "Standard Measures" ve "ARCHeR" çalışmaları, projedeki "kişisel baseline" ve aktigrafi temelli uyku izleme yaklaşımımızın resmi NASA referanslarıdır.

## Doğrulanacaklar (Sayısal eşik gerektiren ilişkili metrikler)
- `spo2.critical`: Hipoksi riski için klinik kritik sınır (%90) klinik konvansiyondan doğrulanacak (HRP sayı vermez).
- `hr.resting.baseline`: Kardiyovasküler adaptasyon ve z-skoru sapma eşikleri kişisel baseline modelinden türetilecek.
- `sleep.duration.min`: Yetersiz uyku ve düzensiz programlar riski için eşikler uyku tıbbı literatüründen doğrulanacak.
- `bone.loss.pct_month`: Aylık kemik kaybı oranı (1–1.5 %/ay) birincil teknik rapordan teyit edilecek.

## Kodda nerede kullanılacak (opsiyonel)
- Faz 5 Algılama Motoru: L4 durum çıkarımı (yorgunluk, stres, kardiyovasküler zorlanma) gerekçelendirmesi
- Faz 6 Alan Modülleri: Radyasyon, uyku, kardiyo/kemik ve davranışsal sağlık modüllerinin bilimsel referansları
- Faz 7 Karar Destek & Earth Link: "Distance from Earth" kaynaklı triyaj protokolü
- Faz 10 Kanıt Sayfası: Niteliksel kaynak referansı ve atıf kartları
