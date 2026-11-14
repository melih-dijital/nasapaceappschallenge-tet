// FAZ 9 §3.2 — i18n sözlük sistemi, sayı biçimlendirici ve Mission Clock (MET D+012 14:32).
import { useCallback, useSyncExternalStore } from 'react'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { en, type I18nKey } from './en'
import { tr } from './tr'

export type Language = 'en' | 'tr'
export type { I18nKey } from './en'
export { en } from './en'
export { tr } from './tr'

const DICTIONARIES: Record<Language, Record<string, string>> = {
  en,
  tr,
}

const STORAGE_KEY = 'astro.cockpit.lang'

function readInitialLanguage(): Language {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'tr') return saved
    }
  } catch {
    // localStorage erişilemezse varsayılan 'en'
  }
  return 'en'
}

let currentLanguage: Language = readInitialLanguage()
const langListeners = new Set<() => void>()

export function getLanguage(): Language {
  return currentLanguage
}

export function setLanguage(lang: Language): void {
  if (currentLanguage === lang) return
  currentLanguage = lang
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang)
    }
  } catch {
    // localStorage hatası sessizce yoksayılır
  }
  for (const listener of langListeners) listener()
}

export function subscribeLanguage(listener: () => void): () => void {
  langListeners.add(listener)
  return () => {
    langListeners.delete(listener)
  }
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const val = params[token]
    return val !== undefined ? String(val) : `{${token}}`
  })
}

/**
 * Anahtarı aktif dilde (veya verilen dilde) çevirir.
 * Eksik anahtar → İngilizce yedek + konsol uyarısı.
 */
export function t(
  key: I18nKey | (string & {}),
  params?: Record<string, string | number>,
  lang: Language = currentLanguage,
): string {
  const dict = DICTIONARIES[lang]
  const entry = dict[key]
  if (entry !== undefined) {
    return interpolate(entry, params)
  }

  const fallback = DICTIONARIES.en[key]
  if (fallback !== undefined) {
    console.warn(`[i18n] Missing translation for key "${key}" in language "${lang}", falling back to "en".`)
    return interpolate(fallback, params)
  }

  console.warn(`[i18n] Missing translation key "${key}" in all dictionaries.`)
  return interpolate(key, params)
}

/** Intl.NumberFormat tabanlı sayı biçimlendirici. */
export function formatNumber(
  value: number,
  maximumFractionDigits = 1,
  lang: Language = currentLanguage,
  minimumFractionDigits = 0,
): string {
  if (!Number.isFinite(value)) return '—'
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

/**
 * Simüle görev saatini `MET D+012 14:32` biçiminde döndürür (FAZ 9 §3.2).
 */
export function formatMissionClock(simTimeMs: number): string {
  if (!Number.isFinite(simTimeMs)) return 'MET D+000 00:00'
  if (simTimeMs < 0) {
    const absMs = Math.abs(simTimeMs)
    const day = Math.ceil(absMs / MS_PER_DAY)
    const rem = (day * MS_PER_DAY - absMs) % MS_PER_DAY
    const hours = Math.floor(rem / MS_PER_HOUR)
    const mins = Math.floor((rem - hours * MS_PER_HOUR) / MS_PER_MIN)
    return `MET D-${String(day).padStart(3, '0')} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }
  const day = Math.floor(simTimeMs / MS_PER_DAY)
  const remAfterDay = simTimeMs - day * MS_PER_DAY
  const hours = Math.floor(remAfterDay / MS_PER_HOUR)
  const minutes = Math.floor((remAfterDay - hours * MS_PER_HOUR) / MS_PER_MIN)
  return `MET D+${String(day).padStart(3, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** React bileşenleri için i18n kancası. */
export function useT() {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage)

  const translate = useCallback(
    (key: I18nKey | (string & {}), params?: Record<string, string | number>) => t(key, params, lang),
    [lang],
  )

  const fmtNum = useCallback(
    (value: number, maximumFractionDigits = 1, minimumFractionDigits = 0) =>
      formatNumber(value, maximumFractionDigits, lang, minimumFractionDigits),
    [lang],
  )

  return {
    t: translate,
    lang,
    setLang: setLanguage,
    formatNumber: fmtNum,
    formatMissionClock,
  }
}
