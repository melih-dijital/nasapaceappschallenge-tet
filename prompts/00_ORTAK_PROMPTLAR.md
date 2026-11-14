# 00 — ORTAK PROMPTLAR (her fazda yeniden kullanılır)

Aşağıdaki bloklardan ihtiyacın olanı kopyalayıp kodlama yapay zekâsına yapıştır.

---

## A) OTURUM BAŞLATMA (her yeni sohbetin ilk mesajı)
```
Bu depo "Astronot Sağlık Kokpiti" (NASA Space Apps 2026). Önce kök dizindeki PROJECT_MEMORY.md dosyasını TAMAMEN oku.
Sonra: (1) §12 Durum tablosunu özetle, (2) son 5 commit'e ve `git status`'a bak, (3) docs/sources ve docs/calibration altında hangi .md dosyalarının olduğunu listele.
Henüz kod yazma. Bana şunu yaz: "Şu an neredeyiz, hangi faz sırada, hangi önkoşullar eksik?" (en fazla 10 satır).
Ben onaylayınca fazın prompt'unu vereceğim.
```

## B) FAZ BİTİRME / DEVİR (her fazın sonunda)
```
Faz bitti sayılmadan önce şunları yap ve sonuçları raporla:
1. `npm run check` çalıştır (typecheck + lint + test + build tek komut); hata varsa düzelt (testleri silerek/gevşeterek DEĞİL).
2. Faz prompt'undaki "Kabul kriterleri" listesini madde madde ✅/❌ ile işaretle; ❌ olanı gerekçelendir.
3. PROJECT_MEMORY.md'yi güncelle: §12 (durum), §13 (verdiğin kararlar), §14 (açık sorular/sorunlar), §15 (değişiklik günlüğü: tarih, faz, dosyalar).
4. Küçük commit(ler) at: `faz-N: ...`.
5. Son olarak "SONRAKİ FAZ İÇİN DEVİR NOTU" yaz (5 madde: neyi hazırladın, hangi API'yi sunuyorsun, bilinen eksikler, dikkat edilecekler, önerdiğin ilk adım).
Uydurma yapma: yapmadığın şeyi yaptım deme.
```

## C) HATA DÜZELTME
```
Şu hatayı düzelt: <hata mesajı / davranış>.
Kurallar: (1) önce hatayı yeniden üreten bir test yaz (başarısız olsun), (2) kök nedeni bul ve 3 cümlede açıkla, (3) en küçük düzeltmeyi yap, (4) testin geçtiğini ve diğer testlerin bozulmadığını göster, (5) PROJECT_MEMORY.md §15'e tek satır ekle. Kapsam dışı refactor YAPMA.
```

## D) KOD İNCELEME (faz bitince, bir başka sohbette)
```
PROJECT_MEMORY.md'yi oku. Son faz değişikliklerini incele (git diff <önceki-commit>..HEAD). Şunları ara ve bulguları ciddiyet sırasıyla listele (dosya:satır ile):
- Mimari ilke ihlali (§3): core/sim içinde DOM, Math.random, harici ağ çağrısı, sihirli sayı (EvidenceRegistry dışı eşik)
- `any`, kontrolsüz tip dönüşümü, yakalanmamış istisna
- Determinizm sorunları (aynı seed → farklı sonuç)
- Yanlış istatistik (MAD ölçeği, sıfıra bölme, NaN yayılımı)
- Testsiz kritik mantık
- Kaynağı olmayan değerin "verified:true" olması
Kod DEĞİŞTİRME; yalnızca rapor ver.
```

## E) KAYNAK .MD İÇERİĞİNİ SİSTEME ALMA (takım yeni md ekleyince)
```
docs/sources/ ve docs/calibration/ altına yeni .md dosyaları eklendi. Şunları yap:
1. `npm run evidence:build` çalıştır; doğrulama hatalarını (şablona uymayan başlık/sütun, tekrar eden evidenceId, bilinmeyen sourceType, sayı olmayan value) tek tek raporla.
2. Biçim uymuyorsa md'yi KENDİN yeniden yazma; hangi satırda neyin yanlış olduğunu bana söyle (şablon: templates/SOURCE_TEMPLATE.md).
3. Başarılıysa: kaç kayıt eklendi/değişti? Hangi evidenceId'ler kod tarafından kullanılıyor, hangileri kullanılmıyor? Kod tarafından kullanılıp md'de olmayan id var mı?
4. Değeri değişen eşiklerin etkilediği testleri çalıştır; kırılanları listele.
Değer uydurma. md'de olmayan bir değer gerekiyorsa DEMO_PARAMETER ekle ve §14'e yaz.
```

## F) BELİRSİZLİK PROTOKOLÜ
```
Belirsiz bir şeyle karşılaşırsan: (1) makul varsayımı seç, (2) kodda `// ASSUMPTION:` yorumu bırak, (3) PROJECT_MEMORY.md §14'e ekle, (4) devam et. Yalnızca ilerlemeyi tamamen engelliyorsa bana soru sor ve sorunu tek cümlede, 2-3 seçenekle sun.
```

## G) PARALEL ÇALIŞMA KURALLARI (3 kişi, 3 yapay zekâ oturumu)
| Kişi | Sahip olduğu klasörler | Fazlar |
|---|---|---|
| A (UI) | `src/ui/**`, `src/store/**` (UI tarafı), `public/` | 9, 10 (Faz 1 biter bitmez mock ile başlar) |
| B (Veri/Motor) | `src/core/**`, `src/sim/**`, `src/workers/**`, `scripts/**`, `tests/**` | 0–6, 8, 11 |
| C (Karar/Sunum) | `src/core/decision/**`, `src/core/earthlink/**`, `docs/**` | 7, 12 + kaynak/kalibrasyon md'leri |

- Başkasının klasörüne dokunman gerekiyorsa değişikliği minimal tut ve PR/commit mesajına `[cross-owner]` yaz.
- Branch: `main` yalnızca çalışan durumda. Her kişi `faz-N-isim` branch'inde çalışır, bitince küçük PR/merge.
- `PROJECT_MEMORY.md` çakışması: yalnızca kendi satırlarını ekle; başkasının satırını silme. §12 tablosunda yalnızca kendi fazının satırını değiştir.
- Ortak tipler (`src/core/types/**`) Faz 1'den sonra DONDURULUR; değişiklik gerekiyorsa §13'e karar kaydı ve tüm ekibe haber.

## H) "DEMO YANGINI" ACİL PROMPT'U (son saatlerde)
```
Yeni özellik ekleme. Yalnızca: (1) demo-main senaryosunun baştan sona hatasız çalıştığını doğrula, (2) konsol hatalarını sıfırla, (3) çevrimdışı modda (ağ kapalı) aç-kapat testi yap, (4) `npm run build` ve ardından (ayrı komut) `npm run preview` ile üretim sürümünü dene, (5) bulduklarını önem sırasıyla listele ve yalnızca "demo'yu bozan" olanları düzelt.
```
