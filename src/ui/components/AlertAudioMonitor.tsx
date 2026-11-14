// FAZ 10 §3.1 — Web Audio API ile sentezlenmiş sesli uyarı (dosya yok, CDN yok).
// CRITICAL: 2 kısa bip · WARNING: 1 bip · Aynı uyarı için tekrar çalmaz · Sessize alma localStorage'da kalıcı.
import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/ui/i18n'
import { useAlertStore } from '@/ui/store'

const MUTE_STORAGE_KEY = 'astro_cockpit_audio_muted'

function readMutedPreference(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMutedPreference(muted: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Sessize alma tercihi depolanamasa da uygulama sürer
  }
}

function playSynthesizedBeep(severity: 'CRITICAL' | 'WARNING'): void {
  if (typeof window === 'undefined') return
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const now = ctx.currentTime
    const beeps = severity === 'CRITICAL' ? [0, 0.18] : [0]
    const freq = severity === 'CRITICAL' ? 880 : 620

    for (const offset of beeps) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + offset)
      gain.gain.setValueAtTime(0.08, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.13)
    }
  } catch {
    // Tarayıcı ses politikası engellerse sessizce geç
  }
}

export function AlertAudioToggle() {
  const { t } = useT()
  const alerts = useAlertStore((s) => s.alerts)
  const [muted, setMuted] = useState<boolean>(() => readMutedPreference())
  const [userInteracted, setUserInteracted] = useState(false)
  const playedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const unlock = () => setUserInteracted(true)
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (muted || !userInteracted) return
    for (const alert of alerts) {
      if (alert.status !== 'ACTIVE') continue
      if (alert.severity !== 'CRITICAL' && alert.severity !== 'WARNING') continue
      if (playedIdsRef.current.has(alert.id)) continue
      playedIdsRef.current.add(alert.id)
      playSynthesizedBeep(alert.severity)
    }
  }, [alerts, muted, userInteracted])

  const handleToggle = () => {
    setUserInteracted(true)
    const next = !muted
    setMuted(next)
    writeMutedPreference(next)
  }

  return (
    <Button
      type="button"
      size="xs"
      variant={muted ? 'ghost' : 'outline'}
      onClick={handleToggle}
      aria-pressed={muted}
      aria-label={muted ? t('alerts.audioUnmute') : t('alerts.audioMute')}
      data-testid="audio-mute-toggle"
      className="gap-1.5 font-mono text-[11px]"
    >
      {muted ? (
        <VolumeX aria-hidden="true" className="size-3.5 text-muted-foreground" />
      ) : (
        <Volume2 aria-hidden="true" className="size-3.5 text-primary" />
      )}
      <span className="hidden xl:inline">
        {muted ? t('alerts.audioMuted') : t('alerts.audioActive')}
      </span>
    </Button>
  )
}
