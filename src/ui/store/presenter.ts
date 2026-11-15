// FAZ 12 §3.2 — Presenter Mode (sunum modu): `?demo=1` veya `D` kısayolu.
// Saf tuş çözümleyici + Earth gecikmesi döngüsü + store eylemleri. Kısayollar (D hariç) YALNIZCA sunum modunda.
import { create } from 'zustand'
import { getNumber } from '@/core/evidence/registry'
import type { EarthLinkPreset } from '@/core/types'
import { usePwaStore } from '@/pwa/pwaStore'
import { getScenario } from '@/sim/scenarios'
import { actions, useEarthLinkStore, useSessionStore } from './cockpitStore'
import { DEMO_MAIN_BOOKMARKS } from './crewProfiles'

export const PRESENTER_SCENARIO_ID = 'demo_main'

/** Kısayol yardım penceresinin açık/kapalı durumu (klavye `?` ve üst çubuk düğmesi paylaşır). */
// Kısayol yardımı ve "Presenter controls" çekmecesi (Shift+P veya ?demo=1 iken üst çubuk düğmesi).
export const usePresenterUiStore = create<{ helpOpen: boolean; drawerOpen: boolean }>(() => ({
  helpOpen: false,
  drawerOpen: false,
}))
export const setPresenterHelpOpen = (helpOpen: boolean): void =>
  usePresenterUiStore.setState({ helpOpen })
export const setPresenterDrawerOpen = (drawerOpen: boolean): void =>
  usePresenterUiStore.setState({ drawerOpen })

export type PresenterCommand =
  | { type: 'TOGGLE' }
  | { type: 'BOOKMARK'; index: number }
  | { type: 'PLAY_PAUSE' }
  | { type: 'RESET' }
  | { type: 'EARTH_DELAY' }
  | { type: 'HELP' }
  | { type: 'DRAWER' }

export interface PresenterKeyInput {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  /** Odak yazı alanında (input/textarea/select/contenteditable) mı. */
  inEditable?: boolean
  /** Odak etkileşimli bir öğede (button, link, slider…) mı — Space onun işidir. */
  onInteractive?: boolean
  repeat?: boolean
}

/** Tuşu sunum komutuna çevirir; komut değilse null (olay tarayıcıya/odaklı öğeye bırakılır). */
export function resolvePresenterKey(
  ev: PresenterKeyInput,
  presenterOn: boolean,
): PresenterCommand | null {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.inEditable || ev.repeat) return null
  const key = ev.key
  // Shift+P: sunum kontrolleri çekmecesi (sunum modundan bağımsız; çekmece başka yoldan açılmaz)
  if (ev.shiftKey && (key === 'P' || key === 'p')) return { type: 'DRAWER' }
  if (key === 'd' || key === 'D') return { type: 'TOGGLE' }
  if (!presenterOn) return null
  if (key === '?') return { type: 'HELP' }
  if (key === ' ' || key === 'Spacebar') return ev.onInteractive ? null : { type: 'PLAY_PAUSE' }
  if (key === 'r' || key === 'R') return { type: 'RESET' }
  if (key === 'e' || key === 'E') return { type: 'EARTH_DELAY' }
  const n = Number(key)
  if (Number.isInteger(n) && n >= 1 && n <= DEMO_MAIN_BOOKMARKS.length)
    return { type: 'BOOKMARK', index: n - 1 }
  return null
}

/**
 * `E` döngüsü (tek yön, sn): Ay → Mars min → demo_main SPE sırasındaki Earth gecikmesi (senaryo ground-truth) → Mars max.
 * Değerler Evidence + senaryodan okunur; sihirli sayı yok.
 */
export function earthDelayCycleSec(): number[] {
  const scenarioDelays = getScenario(PRESENTER_SCENARIO_ID).events.flatMap((e) =>
    e.kind === 'EARTH_DELAY' && Number.isFinite(e.oneWayDelaySec) ? [e.oneWayDelaySec] : [],
  )
  const values = [
    getNumber('earth.oneWayDelaySec.moon'),
    getNumber('earth.oneWayDelaySec.mars_min'),
    ...scenarioDelays,
    getNumber('earth.oneWayDelaySec.mars_max'),
  ]
  return [...new Set(values)].sort((a, b) => a - b)
}

/** Döngüde bir sonraki değer (mevcuttan büyük ilk değer; sonda başa sarar). */
export function nextEarthDelaySec(currentSec: number, cycle: readonly number[]): number {
  const next = cycle.find((v) => v > currentSec + 1e-9)
  return next ?? cycle[0] ?? currentSec
}

export function presetForDelay(sec: number): EarthLinkPreset {
  if (sec === getNumber('earth.oneWayDelaySec.moon')) return 'MOON'
  if (sec === getNumber('earth.oneWayDelaySec.mars_min')) return 'MARS_MIN'
  if (sec === getNumber('earth.oneWayDelaySec.mars_max')) return 'MARS_MAX'
  return 'CUSTOM'
}

export const presenterActions = {
  /** Sunum modunu aç/kapat. Açılınca `demo_main` seçilir; SW güncelleme istemi bastırılır. */
  setEnabled(on: boolean): void {
    useSessionStore.setState({ demoMode: on })
    usePwaStore.setState(on ? { demo: true, needRefresh: false } : { demo: false })
    if (on && useSessionStore.getState().scenarioId !== PRESENTER_SCENARIO_ID) {
      actions.setScenario(PRESENTER_SCENARIO_ID)
    }
  },

  togglePlay(): void {
    if (useSessionStore.getState().running) actions.pause()
    else actions.start()
  },

  /** Tam sıfırlama: worker RESET → simülatör aynı seed'le başa, FrameStore (IndexedDB) temizlenir. */
  reset(): void {
    actions.reset()
  },

  seekBookmark(index: number): void {
    if (useSessionStore.getState().scenarioId !== PRESENTER_SCENARIO_ID) return
    actions.seekBookmark(index)
  },

  /** Earth gecikmesini döngüde ilerletir; yeni tek yön gecikmeyi (sn) döndürür. */
  cycleEarthDelay(): number {
    const current = useEarthLinkStore.getState().config.oneWayDelaySec
    const next = nextEarthDelaySec(current, earthDelayCycleSec())
    const preset = presetForDelay(next)
    actions.setEarthLinkPreset(preset, preset === 'CUSTOM' ? next : undefined)
    return next
  },
}
