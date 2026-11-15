// Konsol tasarımı: Earth link özeti, gecikmeli Dünya aynası (veri yoksa gizli), ana ekranda simülatör izi yok.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import { EarthLinkSummary } from '@/ui/components/EarthLinkSummary'
import { GroundMirrorView } from '@/ui/components/GroundMirrorView'
import { MockEngine } from '@/ui/mock/mockEngine'
import { GroundPage } from '@/ui/pages/GroundPage'
import {
  actions,
  bindEngineClient,
  readGroundMirror,
  useEarthLinkStore,
  useSessionStore,
} from '@/ui/store'

beforeEach(() => {
  actions.setLanguage('en')
  bindEngineClient(new MockEngine(), { scenarioId: 'demo_main', speed: 1 })
  useSessionStore.setState({ demoMode: false })
})
afterEach(() => {
  useEarthLinkStore.setState({ groundMirror: null })
})

describe('Konsol tasarımı', () => {
  it('Earth link özeti gecikmeyi, Dünya’nın gördüğü anı ve araç içi karar cümlesini gösterir', () => {
    render(
      <MemoryRouter>
        <EarthLinkSummary />
      </MemoryRouter>,
    )
    const summary = screen.getByTestId('earth-link-summary')
    expect(summary).toHaveTextContent('One-way delay')
    expect(summary).toHaveTextContent('Round trip + ground')
    expect(summary).toHaveTextContent('In flight')
    expect(summary).toHaveTextContent('Delivered')
    expect(screen.getByTestId('earth-sees-row')).toHaveTextContent(/data from .+ ago/)
    expect(
      screen.getByText(
        'Decisions are made on board. Earth monitors with a delay; no action waits for a reply.',
      ),
    ).toBeInTheDocument()
  })

  it('groundMirror yoksa ayna çizilmez ve UI veri üretmez', () => {
    const { container } = render(
      <MemoryRouter>
        <GroundMirrorView mirror={null} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(readGroundMirror({})).toBeNull()

    render(
      <MemoryRouter>
        <GroundPage />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('ground-mirror-view')).toBeNull()
    expect(screen.getByTestId('ground-mirror-empty')).toBeInTheDocument()
    expect(screen.getByTestId('ground-contrast-banner')).toHaveTextContent(
      /Mission Control view.*behind the spacecraft/,
    )
  })

  it('ana ekranda "Simulation", oynatma kontrolleri ve DEMO/UNVERIFIED/FAULT rozetleri yok', () => {
    const { container } = render(<App />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/simulation/i)
    expect(text).not.toMatch(/\bUNVERIFIED\b|\bDEMO\b|\bFAULT\b|\bCLINICAL\b/)
    expect(screen.queryByTestId('sim-play-btn')).toBeNull()
    expect(screen.getByTestId('mission-environment')).toHaveTextContent('Mars transit')
    expect(screen.getByTestId('earth-link-badge')).toHaveTextContent(
      /Earth link: nominal · one-way/,
    )
  })
})
