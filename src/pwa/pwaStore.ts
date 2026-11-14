// PWA durumu (FAZ_11 §3.1): bağlantı rozeti (`navigator.onLine`, yalnızca bilgi) ve SW güncelleme istemi.
// `prompt` modu: yeni sürüm kullanıcı onaylayana kadar bekler. `?demo=1` (Faz 12 sunum moduyla aynı parametre):
// güncelleme istemi HİÇ gösterilmez; çevrimdışı önbellek yine kurulur. Bağımlılıklar enjekte → jsdom'da test edilebilir.
import { create } from 'zustand'

export type RegisterSW = (options: {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onRegisterError?: (error: unknown) => void
}) => (reloadPage?: boolean) => Promise<void>

export interface PwaState {
  online: boolean
  demo: boolean
  needRefresh: boolean
  offlineReady: boolean
  registerError: string | null
  applyUpdate: () => void
  dismissUpdate: () => void
}

export const usePwaStore = create<PwaState>((set) => ({
  online: true,
  demo: false,
  needRefresh: false,
  offlineReady: false,
  registerError: null,
  applyUpdate: () => undefined,
  dismissUpdate: () => set({ needRefresh: false }),
}))

/** `?demo=1` (ya da `demo=true`) → sunum modu. */
export function isDemoMode(search: string): boolean {
  const v = new URLSearchParams(search).get('demo')
  return v === '1' || v === 'true'
}

export interface OnlineEventTarget {
  addEventListener(type: 'online' | 'offline', listener: () => void): void
  removeEventListener(type: 'online' | 'offline', listener: () => void): void
}

export interface InitPwaDeps {
  search: string
  isOnline: () => boolean
  events: OnlineEventTarget
  /** Yoksa (test, SW desteklemeyen tarayıcı) yalnızca bağlantı rozeti çalışır. */
  registerSW?: RegisterSW
}

/** Rozet dinleyicilerini ve SW kaydını kurar; geri dönen fonksiyon dinleyicileri kaldırır. */
export function initPwa(deps: InitPwaDeps): () => void {
  const demo = isDemoMode(deps.search)
  const sync = (): void => usePwaStore.setState({ online: deps.isOnline() })
  usePwaStore.setState({ demo, online: deps.isOnline() })
  deps.events.addEventListener('online', sync)
  deps.events.addEventListener('offline', sync)

  if (deps.registerSW) {
    const updateSW = deps.registerSW({
      immediate: true,
      onNeedRefresh: () => {
        // Demo sırasında sürpriz yok: istem bastırılır, yeni SW bekler (sonraki normal açılışta sorulur).
        if (!demo) usePwaStore.setState({ needRefresh: true })
      },
      onOfflineReady: () => usePwaStore.setState({ offlineReady: true }),
      onRegisterError: (error) =>
        usePwaStore.setState({ registerError: error instanceof Error ? error.message : String(error) }),
    })
    usePwaStore.setState({
      applyUpdate: () => {
        usePwaStore.setState({ needRefresh: false })
        void updateSW(true)
      },
    })
  }

  return () => {
    deps.events.removeEventListener('online', sync)
    deps.events.removeEventListener('offline', sync)
  }
}
