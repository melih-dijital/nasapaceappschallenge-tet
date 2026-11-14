// Tarayıcı girişi: servis çalışanı kaydı (vite-plugin-pwa `virtual:pwa-register`, prompt modu) + bağlantı rozeti.
import { registerSW } from 'virtual:pwa-register'
import { initPwa } from './pwaStore'

export function registerPwa(): () => void {
  return initPwa({
    search: window.location.search,
    isOnline: () => navigator.onLine,
    events: window,
    ...('serviceWorker' in navigator ? { registerSW } : {}),
  })
}
