# CLAUDE.md (AGENTS.md / .cursorrules olarak da kopyala)

**ZORUNLU:** Bu depoda herhangi bir iş yapmadan önce kök dizindeki `PROJECT_MEMORY.md` dosyasını baştan sona oku. O dosya projenin kalıcı hafızasıdır; kararlar, mimari ilkeler, tipler, kanıt politikası ve faz durumu orada.

Her görevin sonunda `PROJECT_MEMORY.md` içindeki §12 (Durum), §13 (Karar günlüğü), §14 (Açık sorular), §15 (Değişiklik günlüğü) bölümlerini güncelle ve commit'e dahil et.

Kısa kurallar: TypeScript strict, `any` yok · `src/core` ve `src/sim` içinde DOM yok · değer uydurma, kaynağı olmayan eşik `DEMO_PARAMETER` · çevrimdışı çalışmalı, harici ağ çağrısı yok · yeni bağımlılığı gerekçesiyle `PROJECT_MEMORY.md §13`'e yaz.
