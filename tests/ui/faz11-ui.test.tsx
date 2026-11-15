// FAZ 11 §3.1 & §3.4 — PWA UI bileşenleri: navigator.onLine bağlantı rozeti,
// ?demo=1 güncelleme istemi bastırma göstergesi ve "Ground station (optional)" açılır paneli.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EngineClient } from '@/store/engineClient'
import { AppShell } from '@/ui/components/AppShell'
import { GroundStationPanel } from '@/ui/components/GroundStationPanel'
import { en, tr } from '@/ui/i18n'
import { MockEngine } from '@/ui/mock/mockEngine'

const dictionaries = { en, tr }
import { GroundPage } from '@/ui/pages/GroundPage'
import { actions, bindEngineClient, isDemoModeQuery, useSessionStore } from '@/ui/store'
import type { WorkerToUiMessage, UiToWorkerMessage } from '@/workers/protocol'

function createSpyClient() {
  const sent: UiToWorkerMessage[] = []
  let listener: ((msg: WorkerToUiMessage) => void) | null = null
  const client: EngineClient = {
    send(msg) {
      sent.push(msg)
    },
    subscribe(cb) {
      listener = cb
      return () => {
        listener = null
      }
    },
    dispose() {
      listener = null
    },
  }
  return {
    client,
    sent,
    emit(msg: WorkerToUiMessage) {
      listener?.(msg)
    },
  }
}

beforeEach(() => {
  actions.setLanguage('en')
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  bindEngineClient(new MockEngine(), { scenarioId: 'demo_main', speed: 1 })
})

afterEach(() => {
  actions.setLanguage('en')
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
})

describe('FAZ 11 UI — Bağlantı Rozeti, ?demo=1 & Ground Station (optional)', () => {
  it('navigator.onLine durumunu ve online/offline olaylarını bilgi rozeti olarak yansıtır', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

    const badge = screen.getByTestId('network-connection-badge')
    expect(badge).toHaveAttribute('data-online', 'false')
    expect(badge).toHaveTextContent(dictionaries.en['network.badge.offline'])

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: true,
      })
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.getByTestId('network-connection-badge')).toHaveAttribute('data-online', 'true')
    expect(screen.getByTestId('network-connection-badge')).toHaveTextContent(
      dictionaries.en['network.badge.online'],
    )

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByTestId('network-connection-badge')).toHaveAttribute('data-online', 'false')
  })

  it('?demo=1 veya ?demo=true olduğunda güncelleme istemi bastırıldı rozetini gösterir', () => {
    expect(isDemoModeQuery('')).toBe(false)
    expect(isDemoModeQuery('?demo=0')).toBe(false)
    expect(isDemoModeQuery('?demo=1')).toBe(true)
    expect(isDemoModeQuery('?mock=1&demo=true')).toBe(true)

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('demo-mode-badge')).not.toBeInTheDocument()
    unmount()

    render(
      <MemoryRouter initialEntries={['/?demo=1']}>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('demo-mode-badge')).toHaveTextContent(
      dictionaries.en['demo.modeBadge'],
    )
  })

  it('"Ground station (optional)" varsayılan kapalıdır; açılıp geçersiz URL engellenir ve geçerli URL ile WS INIT + disconnect gönderir', () => {
    const spy = createSpyClient()
    bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
    // İlk bind INIT mesajını temizle
    spy.sent.length = 0

    render(<GroundStationPanel compact />)

    const toggle = screen.getByTestId('ground-station-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent(dictionaries.en['groundStation.toggleTitle'])
    expect(screen.getByTestId('ground-station-status')).toHaveTextContent(
      dictionaries.en['groundStation.status.local'],
    )
    expect(screen.queryByTestId('ground-station-ws-input')).not.toBeInTheDocument()

    // Aç
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const input = screen.getByTestId('ground-station-ws-input') as HTMLInputElement
    expect(input.value).toBe('ws://localhost:8787')

    // Geçersiz URL hata verir ve worker'a INIT göndermez
    fireEvent.change(input, { target: { value: 'http://invalid-url' } })
    fireEvent.click(screen.getByTestId('ground-station-connect-btn'))
    expect(screen.getByTestId('ground-station-error')).toBeInTheDocument()
    expect(spy.sent).toHaveLength(0)

    // Geçerli WS URL ile bağlan
    fireEvent.change(input, { target: { value: 'ws://localhost:8787' } })
    fireEvent.click(screen.getByTestId('ground-station-connect-btn'))

    expect(spy.sent).toEqual([
      {
        type: 'INIT',
        scenarioId: 'demo_main',
        speed: 1,
        source: 'ws',
        wsUrl: 'ws://localhost:8787',
      },
    ])
    expect(useSessionStore.getState().telemetrySource).toBe('ws')
    expect(screen.getByTestId('ground-station-status')).toHaveTextContent(
      dictionaries.en['groundStation.status.connecting'],
    )

    // Worker STATUS { connected: true } geldiğinde Connected görünür
    act(() => {
      spy.emit({
        type: 'STATUS',
        status: {
          running: true,
          simT: 0,
          day: 0,
          speed: 1,
          scenarioId: 'demo_main',
          connected: true,
        },
      })
    })
    expect(screen.getByTestId('ground-station-status')).toHaveTextContent(
      dictionaries.en['groundStation.status.connected'],
    )

    // Yerel motora dön
    fireEvent.click(screen.getByTestId('ground-station-disconnect-btn'))
    expect(spy.sent[1]).toEqual({
      type: 'INIT',
      scenarioId: 'demo_main',
      speed: 1,
      source: 'local',
    })
    expect(useSessionStore.getState().telemetrySource).toBe('local')
    expect(screen.getByTestId('ground-station-status')).toHaveTextContent(
      dictionaries.en['groundStation.status.local'],
    )
  })

  it('GroundPage içinde "Ground station (optional)" paneli varsayılan kapalı olarak render edilir', () => {
    render(
      <MemoryRouter>
        <GroundPage />
      </MemoryRouter>,
    )
    const toggle = screen.getByTestId('ground-station-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('ground-station-ws-input')).not.toBeInTheDocument()
  })

  it('en ve tr sözlükleri FAZ 11 PWA/ağ/yer istasyonu anahtarlarında tam eşleşir', () => {
    const enKeys = Object.keys(dictionaries.en).sort()
    const trKeys = Object.keys(dictionaries.tr).sort()
    expect(enKeys).toEqual(trKeys)
    expect(dictionaries.en['pwa.online']).toBeDefined()
    expect(dictionaries.en['pwa.offline']).toBeDefined()
    expect(dictionaries.en['groundStation.toggleTitle']).toBe('Ground station (optional)')
    vi.restoreAllMocks()
  })
})
