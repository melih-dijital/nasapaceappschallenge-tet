import './core/schema/jitless'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerPwa } from './pwa/register'

// FAZ_11: servis çalışanı (prompt modu; `?demo=1`'de güncelleme istemi kapalı) + bağlantı rozeti.
registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
