// FAZ 12 §3.2 — Presenter Mode: ?demo=1 / D, bookmark kısayolları (1–4), Space, R, E döngüsü, ? yardım.
// Kısayollar (D hariç) yalnızca sunum modunda; yazı alanında ve modifier tuşlarla devre dışı.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getNumber } from '@/core/evidence/registry'
import { getScenario } from '@/sim/scenarios'
import type { EngineClient } from '@/store/engineClient'
import { AppShell } from '@/ui/components/AppShell'
import {
  actions,
  bindEngineClient,
  DEMO_MAIN_BOOKMARKS,
  earthDelayCycleSec,
  nextEarthDelaySec,
  resolvePresenterKey,
  useEarthLinkStore,
  usePresenterUiStore,
  useSessionStore,
} from '@/ui/store'
import type { UiToWorkerMessage, WorkerToUiMessage } from '@/workers/protocol'

function spyClient() {
  const sent: UiToWorkerMessage[] = []
  const client: EngineClient = {
    send: (m) => {
      sent.push(m)
    },
    subscribe: (cb: (m: WorkerToUiMessage) => void) => {
      void cb
      return () => undefined
    },
    dispose: () => undefined,
  }
  return { client, sent }
}

const press = (key: string, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, { key })
  })

let spy: ReturnType<typeof spyClient>
beforeEach(() => {
  actions.setLanguage('en')
  spy = spyClient()
  bindEngineClient(spy.client, { scenarioId: 'demo_main', speed: 1 })
  useSessionStore.setState({ demoMode: false, scenarioId: 'demo_main', running: false })
  usePresenterUiStore.setState({ helpOpen: false, drawerOpen: false })
  spy.sent.length = 0
})
afterEach(() => {
  useSessionStore.setState({ demoMode: false })
  document.documentElement.classList.remove('presenter')
})

describe('resolvePresenterKey (saf)', () => {
  it('D her zaman açar/kapatır; diğer tuşlar yalnızca sunum modunda', () => {
    expect(resolvePresenterKey({ key: 'd' }, false)).toEqual({ type: 'TOGGLE' })
    expect(resolvePresenterKey({ key: 'D' }, true)).toEqual({ type: 'TOGGLE' })
    for (const key of ['1', ' ', 'r', 'e', '?'])
      expect(resolvePresenterKey({ key }, false)).toBeNull()
    expect(resolvePresenterKey({ key: '1' }, true)).toEqual({ type: 'BOOKMARK', index: 0 })
    expect(resolvePresenterKey({ key: '4' }, true)).toEqual({ type: 'BOOKMARK', index: 3 })
    expect(resolvePresenterKey({ key: String(DEMO_MAIN_BOOKMARKS.length + 1) }, true)).toBeNull()
    expect(resolvePresenterKey({ key: ' ' }, true)).toEqual({ type: 'PLAY_PAUSE' })
    expect(resolvePresenterKey({ key: 'R' }, true)).toEqual({ type: 'RESET' })
    expect(resolvePresenterKey({ key: 'e' }, true)).toEqual({ type: 'EARTH_DELAY' })
    expect(resolvePresenterKey({ key: '?' }, true)).toEqual({ type: 'HELP' })
  })

  it('yazı alanında, modifier tuşla veya tuş tekrarında yok; odak düğmedeyken Space düğmenin işi', () => {
    expect(resolvePresenterKey({ key: '1', inEditable: true }, true)).toBeNull()
    expect(resolvePresenterKey({ key: 'd', inEditable: true }, false)).toBeNull()
    expect(resolvePresenterKey({ key: 'r', ctrlKey: true }, true)).toBeNull()
    expect(resolvePresenterKey({ key: 'd', metaKey: true }, false)).toBeNull()
    expect(resolvePresenterKey({ key: 'e', repeat: true }, true)).toBeNull()
    expect(resolvePresenterKey({ key: ' ', onInteractive: true }, true)).toBeNull()
    expect(resolvePresenterKey({ key: '2', onInteractive: true }, true)).toEqual({
      type: 'BOOKMARK',
      index: 1,
    })
  })

  it('E döngüsü Evidence + demo_main senaryosundan: Ay → Mars min → SPE gecikmesi → Mars max, sonra başa', () => {
    const speDelay = getScenario('demo_main').events.flatMap((e) =>
      e.kind === 'EARTH_DELAY' ? [e.oneWayDelaySec] : [],
    )
    const expected = [
      getNumber('earth.oneWayDelaySec.moon'),
      getNumber('earth.oneWayDelaySec.mars_min'),
      ...speDelay,
      getNumber('earth.oneWayDelaySec.mars_max'),
    ].sort((a, b) => a - b)
    const cycle = earthDelayCycleSec()
    expect(cycle).toEqual(expected)
    expect(cycle).toHaveLength(4)
    expect(nextEarthDelaySec(cycle[0]!, cycle)).toBe(cycle[1])
    expect(nextEarthDelaySec(cycle[3]!, cycle)).toBe(cycle[0])
    // Döngü dışı (özel kaydırıcı) değer → bir sonraki büyük ön ayar
    expect(nextEarthDelaySec((cycle[1]! + cycle[2]!) / 2, cycle)).toBe(cycle[2])
  })
})

describe('Presenter Mode (AppShell)', () => {
  const renderShell = (entry = '/') =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

  it('D ile açılır: rozet, daralan kenar çubuğu, büyük font; kapalıyken kısayollar çalışmaz', () => {
    const { container } = renderShell()
    const root = container.querySelector('[data-presenter]')!
    press('4')
    expect(spy.sent).toEqual([])
    expect(root).toHaveAttribute('data-presenter', 'false')

    press('d')
    expect(root).toHaveAttribute('data-presenter', 'true')
    expect(screen.getByTestId('demo-mode-badge')).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('presenter')
    expect(screen.getByTestId('presenter-announcer')).toHaveTextContent('Presenter mode on')

    press('d')
    expect(root).toHaveAttribute('data-presenter', 'false')
    expect(document.documentElement).not.toHaveClass('presenter')
  })

  it('?demo=1: 1–4 bookmark, Space oynat/duraklat, R tam sıfırlama, E Earth gecikmesi döngüsü', () => {
    useSessionStore.setState({ demoMode: true })
    renderShell('/?demo=1')

    press('1')
    press('4')
    expect(spy.sent).toEqual([
      { type: 'SEEK_BOOKMARK', index: 0 },
      { type: 'SEEK_BOOKMARK', index: 3 },
    ])
    expect(screen.getByTestId('presenter-announcer')).toHaveTextContent(
      /D\+003 Solar Particle Event/,
    )

    spy.sent.length = 0
    press(' ')
    expect(spy.sent).toEqual([{ type: 'START' }])
    act(() => useSessionStore.setState({ running: true }))
    press(' ')
    expect(spy.sent.at(-1)).toEqual({ type: 'PAUSE' })

    press('r')
    expect(spy.sent.at(-1)).toEqual({ type: 'RESET' })

    const cycle = earthDelayCycleSec()
    const start = useEarthLinkStore.getState().config.oneWayDelaySec
    press('e')
    const after = useEarthLinkStore.getState().config.oneWayDelaySec
    expect(after).toBe(nextEarthDelaySec(start, cycle))
    expect(spy.sent.at(-1)).toMatchObject({
      type: 'SET_EARTH_LINK',
      config: { oneWayDelaySec: after },
    })
    expect(screen.getByTestId('presenter-announcer')).toHaveTextContent(/Earth one-way delay/)
  })

  it('? yardım penceresi tüm kısayolları listeler; düğmeyle de açılır', async () => {
    useSessionStore.setState({ demoMode: true })
    renderShell('/?demo=1')
    press('?')
    const dialog = await screen.findByRole('dialog', { name: 'Presenter shortcuts' })
    for (const key of ['D', '1', '2', '3', '4', 'Space', 'R', 'E', '?', 'Shift+P']) {
      expect(dialog.querySelectorAll('kbd')).toSatisfy((kbds: NodeListOf<Element>) =>
        [...kbds].some((k) => k.textContent === key),
      )
    }
    act(() => usePresenterUiStore.setState({ helpOpen: false }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Yardım düğmesi sunum kontrolleri çekmecesinde (üst çubuktaki düğmeyle açılır)
    fireEvent.click(screen.getByTestId('presenter-controls-btn'))
    fireEvent.click(await screen.findByTestId('presenter-help-btn'))
    expect(await screen.findByRole('dialog', { name: 'Presenter shortcuts' })).toBeInTheDocument()
  })

  it('yazı alanında kısayol yok; sunum modu açılınca demo_main seçilir', () => {
    useSessionStore.setState({ scenarioId: 'nominal' })
    renderShell()
    press('d')
    expect(spy.sent).toContainEqual({ type: 'SET_SCENARIO', id: 'demo_main' })
    spy.sent.length = 0

    const input = document.createElement('input')
    document.body.appendChild(input)
    press('2', input)
    press('r', input)
    expect(spy.sent).toEqual([])
    input.remove()
  })
})

describe('Sunum kontrolleri çekmecesi (Shift+P)', () => {
  const renderShell = (entry = '/') =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

  it('çözümleyici Shift+P → DRAWER; düz P ve Ctrl+Shift+P yok sayılır', () => {
    expect(resolvePresenterKey({ key: 'P', shiftKey: true }, false)).toEqual({ type: 'DRAWER' })
    expect(resolvePresenterKey({ key: 'p', shiftKey: true }, true)).toEqual({ type: 'DRAWER' })
    expect(resolvePresenterKey({ key: 'p' }, true)).toBeNull()
    expect(resolvePresenterKey({ key: 'P', shiftKey: true, ctrlKey: true }, true)).toBeNull()
  })

  it('ana ekranda oynatma kontrolü yok; Shift+P çekmeceyi açar ve kapatır', async () => {
    renderShell('/')
    expect(screen.queryByTestId('sim-play-btn')).toBeNull()
    expect(screen.queryByTestId('presenter-controls-btn')).toBeNull()
    act(() => {
      fireEvent.keyDown(window, { key: 'P', shiftKey: true })
    })
    expect(await screen.findByTestId('presenter-controls')).toBeInTheDocument()
    expect(screen.getByTestId('sim-play-btn')).toBeInTheDocument()
    expect(screen.getByTestId('speed-preset-50')).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(window, { key: 'P', shiftKey: true })
    })
    expect(usePresenterUiStore.getState().drawerOpen).toBe(false)
  })
})
