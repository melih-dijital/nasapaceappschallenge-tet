// `npm run server` — opsiyonel ws yer istasyonu (FAZ_11 §3.4). Ayrı terminalde `npm run dev` ile birlikte çalıştırın.
// Ortam değişkenleri: PORT (varsayılan 8787), HOST, SCENARIO (varsayılan demo_main), ALLOWED_ORIGINS (virgülle; localhost
// her zaman izinli). Kimlik doğrulama/veritabanı YOK: yalnızca yerel demo.
import { startGroundStation } from './groundStation'

const DEFAULT_PORT = 8787

const port = Number(process.env.PORT ?? DEFAULT_PORT)
if (!Number.isInteger(port) || port < 0) {
  console.error(`server: geçersiz PORT "${process.env.PORT ?? ''}"`)
  process.exit(1)
}

const station = await startGroundStation({
  port,
  ...(process.env.HOST ? { host: process.env.HOST } : {}),
  scenarioId: process.env.SCENARIO ?? 'demo_main',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  log: (m) => console.log(`[ground] ${m}`),
})

console.log(`[ground] ws://localhost:${station.port} hazır (senaryo ${station.getStatus().scenarioId}). Durdurmak için Ctrl+C.`)

const shutdown = (): void => {
  void station.close().then(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
