// FAZ_11 §3.5 CSP: `script-src 'self'` ('unsafe-eval' YOK). Zod 4 hızlı yol için `new Function` dener; yakalansa bile
// sıkı CSP bunu `securitypolicyviolation` olarak konsola raporlar. Tarayıcı girişleri (main.tsx, sim.worker.ts) bu modülü
// İLK import olarak yükler: evidence registry import anında Zod ile doğruladığı için ayar her şeyden önce gelmeli.
import { z } from 'zod'

z.config({ jitless: true })
