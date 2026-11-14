**Takım Adı:** TET
**Kullanılan AI Araçları:** Claude (Anthropic)

---

# NASA HRP Kaynakları — Detaylı Analiz

Bu dosya, NASA Space Apps Challenge 2026 "Create Health Monitoring Software for Astronauts on Space Missions" projesi için resmi challenge sayfasında belirtilen 3 NASA kaynağının ayrı ayrı, detaylı incelemesidir.

---

## 1. Kaynak: 5 Hazards of Human Spaceflight

**URL:** https://www.nasa.gov/hrp/hazards/

### İçerik Özeti

NASA'nın Human Research Program'ı (HRP), insanlı uzay görevlerinde astronotların karşılaştığı zorlukları **5 ana tehlike kategorisi** altında topluyor. Bu sınıflandırmanın amacı, Mars gibi uzun süreli derin uzay görevlerine hazırlanırken karşılaşılacak karmaşık sorunları organize bir şekilde ele almak.

### 5 Tehlike Kategorisi

1. **Uzay Radyasyonu (Space Radiation)** — Gözle görülmez olduğu için en tehlikeli ve anlaşılması en zor tehlikelerden biri olarak tanımlanıyor.

2. **İzolasyon ve Kapatılma (Isolation and Confinement)** — Dünya'dan uzakta, küçük bir alanda uzun süre izole kalan gruplarda davranışsal tepkiler ortaya çıkıyor.

3. **Dünya'dan Uzaklık (Distance from Earth)** — Astronotlar derin uzaya gittikçe, talimat, yeni malzeme ve tıbbi bakım almak giderek zorlaşıyor. **(Bu, bizim projemizin tam kalbi — "Dünya'dan bağımsız karar verme" ihtiyacının kaynağı bu tehlike kategorisi.)**

4. **Yerçekimi Alanları (Gravity Fields)** — Astronotların tüm vücudu (kaslar, kemikler, iç kulak, organlar) İstasyon'daki, Ay'daki, Mars'taki ve Dünya'ya dönüşteki farklı yerçekimi seviyelerine uyum sağlamak zorunda.

5. **Düşman/Kapalı Ortamlar (Hostile/Closed Environments)** — Bir uzay aracının içinde güvenli bir ekosistem sürdürmek; sıcaklık, basınç, aydınlatma, gürültü, mikrobiyal topluluklar ve bağışıklık tepkilerinin izlenmesi gibi benzersiz zorluklar içeriyor.

### Önemli Not

Sayfa, bu 5 tehlikenin **birbirinden bağımsız olmadığını**, birbirini besleyip insan vücudu üzerindeki etkileri şiddetlendirebildiğini vurguluyor. NASA bunları yer tabanlı analog görevler, laboratuvarlar ve Uluslararası Uzay İstasyonu (ISS) üzerinden test ediyor.

### Projemiz İçin Değerlendirme

- Bu sayfa **genel çerçeve** niteliğinde — her tehlike kategorisi için ayrı, daha detaylı alt sayfalara link veriyor (örn. `/hrp/hazard-space-radiation/`, `/hrp/hazard-gravity-fields/`)
- **Doğrudan kullanılabilir veri yok**, ama projenin "neden" sorusunu (misyon/problem tanımı) güçlendirmek için birebir kaynak gösterilebilir
- 5 kategoriden **3'ü doğrudan bizim panelimize denk düşüyor**: Radyasyon → radyasyon paneli, Yerçekimi → kemik yoğunluğu/kardiyovasküler panel, İzolasyon → psikolojik/davranışsal panel (eklerseniz farklılaşma sağlar)
- "Dünya'dan Uzaklık" kategorisi, projenin misyon cümlesindeki "Dünya'dan bağımsız karar" vurgusunu doğrudan destekliyor — sunumda bu sayfaya atıf yapılabilir

---

## 2. Kaynak: Risks of Human Spaceflight

**URL:** https://www.nasa.gov/hrp/risks/

### İçerik Özeti

Bu sayfa, yukarıdaki 5 tehlikeden kaynaklanan **spesifik sağlık risklerini** 3 ana grupta detaylandırıyor. Her risk için ayrı bir alt sayfa linki mevcut (en detaylı ve projemiz için en değerli kaynak bu).

### A) İnsan Fizyolojisi Riskleri (Human Physiology)

| Risk | Açıklama |
|---|---|
| Değişen Bağışıklık Tepkileri | Uzay stresi, vücuttaki pasif virüsleri uyandırabiliyor, döküntü ve diğer semptomlara yol açabiliyor |
| Değişen Sensorimotor/Vestibüler Fonksiyon | Hareket hastalığı, el-göz koordinasyonu sorunları, baş dönmesi |
| **Kardiyovasküler Adaptasyonlar** | Ağırlıksızlık kan dolaşımını, kalp ve damar fonksiyonunu değiştiriyor, kardiyovasküler olay riskini artırabiliyor |
| Dekompresyon Hastalığı | Basınçlı araçtan düşük basınçlı uzay kıyafetine geçişte azot kabarcıklanması |
| Konak-Mikroorganizma Etkileşimleri | Cilt ve bağırsak mikrobiyomu uzayda değişebiliyor |
| **Hipoksi Riski** | Uzay yürüyüşleri sırasında vücut dokularındaki oksijen seviyesinin normalin altına düşmesi |
| Yetersiz Beslenme | Uzun süreli görevler için dengeli beslenme kritik |
| Uzay Yürüyüşü (EVA) Yaralanma Riski | Bilişsel yorgunluk, dekompresyon hastalığı, düşük O2/yüksek CO2 seviyeleri |
| **Azalmış Kardiyorespiratuar ve Kas-İskelet Uygunluğu** | Kemik yoğunluğu, kas gücü, kalp-damar performansı kaybını önlemek için egzersiz şart |
| SANS (Spaceflight Associated Neuro-ocular Syndrome) | Göz ve beyin yapısının uzayda değişmesi — NASA'nın şu anki lider uzay sağlığı riski |
| **Uzay Görevi Kaynaklı Kemik Değişimleri** | Yerçekimi olmadan kemikler zayıflıyor, kırılma riski artıyor |

### B) Davranışsal Performans ve İnsan Faktörleri Riskleri

| Risk | Açıklama |
|---|---|
| Davranışsal Değişiklikler ve Psikiyatrik Bozukluklar | İzolasyon, radyasyon, Dünya'dan uzaklık zihinsel sağlığı etkileyebiliyor |
| Yetersiz Takım Çalışması | Uzun izolasyon ve kapatılmada ekip uyumu kritik |
| **Yetersiz Uyku ve Düzensiz Programlar** | Kronik uyku kaybı, sürekli iş talepleri, biyolojik saat düzensizlikleri |
| Yetersiz Sistem Operasyonları Desteği | Derin uzay görevlerinde beklenmedik yazılım/araç sorunlarıyla başa çıkabilme |
| Dinamik Yük Kaynaklı Yaralanma | İniş sırasında yaralanma riski |

### C) Uzay Radyasyonu Riskleri

| Risk | Açıklama |
|---|---|
| Radyasyon Kaynaklı Kanserler | Uzay radyasyonuna maruz kalan ekiplerde kanser riski artabiliyor |

### Projemiz İçin Değerlendirme — EN ÖNEMLİ KAYNAK

Bu sayfa, challenge'ın istediği **tam olarak 3 panelimize** (biyometri/telemetri, anomali tespiti, karar destek) karşılık geliyor:

- **Kardiyovasküler Adaptasyonlar + Azalmış Fitness riski** → Kalp atışı/SpO2 panelimizin bilimsel dayanağı
- **Uzay Görevi Kaynaklı Kemik Değişimleri** → Kemik yoğunluğu panelimizin dayanağı
- **Radyasyon Kaynaklı Kanserler** → Radyasyon panelimizin dayanağı
- **Yetersiz Uyku ve Düzensiz Programlar** → Uyku kalitesi panelimizin dayanağı
- **Davranışsal Değişiklikler ve Psikiyatrik Bozukluklar** → **Farklılaşma fırsatı!** Rakip takımların çoğu bunu atlıyor; sunumda "NASA'nın kendi risk listesinde psikolojik riskler ayrı bir kategori" diyerek bu paneli eklemenizi güçlü şekilde destekleyebilirsiniz
- **Hipoksi Riski** → SpO2/anomali motorunuzun "neden önemli" açıklamasını güçlendirir

**Aksiyon önerisi:** thresholds.ts dosyanızda her eşik değerinin yanına, hangi riski temsil ettiğini bu sayfadaki risk adıyla yorum satırı olarak ekleyin (örn. `// Risk of Spaceflight-Induced Bone Changes — nasa.gov/hrp/risks`).

---

## 3. Kaynak: Ongoing HRP Research in Space

**URL:** https://www.nasa.gov/hrp/ongoing-hrp-research/

### İçerik Özeti

Bu sayfa, yukarıdaki risklerle ilgili **şu anda devam eden veya yakın zamanda tamamlanmış gerçek NASA araştırmalarını** listeliyor. Üç kategoride gruplanmış: Artemis II görevi araştırmaları, Düşük Dünya Yörüngesi (ISS) araştırmaları, ve geçmiş araştırmalar.

### Artemis II Görevi Araştırmaları (İnsanlı Ay Görevi)

| Çalışma | Açıklama |
|---|---|
| **ARCHeR** | Astronotların bilek üzerine taktığı bir aktigrafi cihazıyla hareket, uyku paterni ve ışığa maruziyeti ölçüyor — **uyku kalitesi panelimiz için doğrudan ilham/referans** |
| **Immune Biomarkers** | Kan ve tükürük örnekleriyle derin uzayın bağışıklık sistemini nasıl değiştirdiği inceleniyor |
| **Artemis II Standard Measures** | Ekiplerin standart bir sağlık veri setini gelecekteki araştırmacılar için bir veri bankasına sağlaması |

### ISS'teki Devam Eden Araştırmalar

| Çalışma | Açıklama |
|---|---|
| B-Complex | Günlük B vitamini takviyesinin beyin/göz değişimlerini önleyip önleyemeyeceği |
| Brain Fluid Pressure | Kafatası içi sıvı basıncı ile göz/beyin değişimleri arasındaki ilişki |
| **CIPHER** | Uzayda insan vücudunun nasıl değiştiğine dair çoklu vücut sistemini inceleyen kapsamlı bir çalışma seti |
| Simulating Manual Piloting for Moon Landings | Yerçekimi geçişlerinin pilotluk becerilerine etkisi |
| Spacecraft Occupant Protection | Dünya'ya dönüşte ekip üyelerinin rahatsızlığını sensör verisiyle birleştirme |
| Spinal Fluid Biomarkers | Omurilik sıvısında uzay kaynaklı beyin/göz değişimleriyle ilişkili maddelerin tespiti |
| **Standard Measures** | Uzay uçuşunun vücut ve zihni nasıl etkilediğini anlamak için tutarlı fizyolojik/psikolojik ölçüm seti toplama — **"kişisel baseline" fikrimiz için doğrudan destek** |
| Thigh Cuff | Sıkı uyluk manşetlerinin vücut sıvılarını bacaklarda tutup göz hastalıklarını önleyip önleyemeyeceği |
| Venous Haemostasis | Kan akışı ve pıhtılaşma farklılıklarının incelenmesi |
| **Zero T2** | Koşu bandı olmadan uzayda egzersizin insan sağlığı ve performansına etkisi — **egzersiz/karar destek panelimiz için doğrudan referans** |

### Geçmiş Araştırmalar (Tamamlanmış)

- **Altered Immunity** — Bağışıklık sistemi değişimi (kan/tükürük/idrar örnekleri)
- **Food Acceptability / Food Physiology** — Uzun süreli uçuşun yemek beğenisine etkisi, gelişmiş diyetin adaptasyona etkisi
- **Omics Archive** — Astronotların kan, idrar, tükürük, dışkı ve hücre örneklerini moleküler düzeyde belgelemesi
- **Space Gardening** — Uzayda taze sebze yetiştirmenin izolasyon/kapatılma hissini hafifletip hafifletmediği
- **Spinal Health** — Omurga taramalarının kemik/kas kaybına karşı strateji geliştirmede kullanılması
- **Tempus Pro** — Uzaktan, gerçek zamanlıya yakın teşhis sağlayabilecek ticari bir telemedicine cihazının test edilmesi — **"Dünya'dan bağımsız sağlık kokpiti" fikrimizle doğrudan örtüşüyor, sunumda referans gösterilebilir**

### Projemiz İçin Değerlendirme

Bu sayfa, projenizin **"gerçek NASA'dan ilham aldık" iddiasını somutlaştıran en güçlü kaynak**:

1. **ARCHeR** ve **Standard Measures** çalışmaları, tam olarak önerdiğimiz "kişisel baseline" ve "tutarlı ölçüm seti" yaklaşımının NASA tarafından gerçekten kullanıldığını gösteriyor — sunumda "NASA'nın ARCHeR çalışmasından ilham aldık" demek büyük güvenilirlik katar
2. **Tempus Pro**, projenizin temel önermesiyle (Dünya'dan bağımsız, gerçek zamanlı sağlık değerlendirmesi) neredeyse birebir örtüşüyor — bunu misyon cümlenizde referans gösterebilirsiniz
3. **CIPHER**, çoklu vücut sistemini bir arada inceleyen yaklaşımıyla, projenizin "tek ekranda birleştirme" konseptine paralel

---

## 4. Üç Kaynağın Birlikte Değerlendirmesi

| Kaynak | Rolü | Projede Kullanım Alanı |
|---|---|---|
| **5 Hazards** | Problem/misyon çerçevesi | Sunumun "neden" kısmı, problem tanımı |
| **Risks** | Teknik/bilimsel dayanak | thresholds.ts eşik değerleri, panel gerekçelendirmesi |
| **Ongoing Research** | Güncellik ve ilham kaynağı | "NASA'nın X çalışmasından ilham aldık" cümleleri, kişisel baseline konsepti |

### Önerilen Kullanım Sırası (Sunumda)

1. **Problem:** 5 Hazards sayfasındaki "Distance from Earth" tehlikesiyle açılış yapın
2. **Çözüm gerekçesi:** Risks sayfasındaki ilgili risk kategorilerini (kardiyovasküler, kemik, radyasyon, uyku, davranışsal) panellerinizle eşleştirin
3. **Güncellik/özgünlük:** Ongoing Research'teki ARCHeR, Standard Measures ve Tempus Pro çalışmalarına atıfla "bu güncel NASA araştırmalarından ilham aldık" deyin — bu, jüriye rastgele bir proje değil, gerçek NASA çalışmasını takip eden bir ekip izlenimi verir

---

## Kaynakça

1. NASA. "5 Hazards of Human Spaceflight." https://www.nasa.gov/hrp/hazards/ (Son güncelleme: 12 Haziran 2026)
2. NASA. "Risks of Human Spaceflight." https://www.nasa.gov/hrp/risks/ (Son güncelleme: 21 Temmuz 2026)
3. NASA. "Ongoing HRP Research." https://www.nasa.gov/hrp/ongoing-hrp-research/ (Son güncelleme: 18 Ağustos 2026)
