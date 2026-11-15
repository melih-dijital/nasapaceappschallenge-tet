// FAZ 9 §3.4, §3.5 & §3.6 — Kokpit sayfası entegrasyon, kenar durum ve erişilebilirlik testleri.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import type { EngineClient } from '@/store/engineClient'
import { MockEngine, type MockScheduler } from '@/ui/mock/mockEngine'
import {
  actions,
  bindEngineClient,
  createDefaultEngineClient,
  isMockEngineRequested,
  registerRealEngineClientFactory,
  usePresenterUiStore,
  useSessionStore,
  useTelemetryStore,
} from '@/ui/store'

function createFakeScheduler() {
  let cb: (() => void) | null = null
  const scheduler: MockScheduler = {
    every(_ms, callback) {
      cb = callback
      return () => {
        cb = null
      }
    },
  }
  return {
    scheduler,
    tick(n = 1) {
      for (let i = 0; i < n; i++) cb?.()
    },
  }
}

beforeEach(() => {
  actions.setLanguage('en')
  bindEngineClient(new MockEngine(), { scenarioId: 'demo_main', speed: 1 })
})

afterEach(() => {
  actions.setLanguage('en')
  useSessionStore.setState({ demoMode: false })
  usePresenterUiStore.setState({ helpOpen: false, drawerOpen: false })
  document.documentElement.classList.remove('presenter')
})

describe('CockpitPage & AppShell (FAZ 9 §3.3–§3.6)', () => {
  it('mock motorla render olur; 7 durum çipi, 6 metrik karosu, 600 mSv kariyer dozu, 250 mSv SPE hedefi ve kemik tahmini etiketi görünür', () => {
    render(<App />)

    expect(screen.getByTestId('cockpit-page')).toBeInTheDocument()
    expect(screen.getByTestId('mission-clock')).toHaveTextContent('MET D+000 00:00')

    // 7 durum çipi
    for (const stateId of [
      'fatigue',
      'stress',
      'dehydration',
      'sleep_debt',
      'radiation_event',
      'cardio_strain',
      'mood_decline',
    ]) {
      expect(screen.getByTestId(`state-chip-${stateId}`)).toBeInTheDocument()
    }

    // 6 son değer karosu
    for (const metricId of ['hr', 'spo2', 'hrv', 'sleep.durationH', 'hydrationL', 'mood.mood']) {
      expect(screen.getByTestId(`metric-tile-${metricId}`)).toBeInTheDocument()
    }

    // HR baseline bandı efsanesi
    expect(screen.getByTestId('hr-baseline-band-legend')).toBeInTheDocument()

    // Radyasyon 600 mSv kariyer limiti + 250 mSv "design reference SPE protection target"
    expect(
      screen.getByRole('meter', { name: 'NASA-STD-3001 career limit (verified)' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('spe-protection-target-box')).toHaveTextContent(
      'design reference SPE protection target',
    )

    // Kemik kartında zorunlu "Indicative estimate" etiketi
    expect(screen.getByTestId('bone-indicative-estimate-badge')).toHaveTextContent(
      'Indicative estimate',
    )
    // Açıklama artık bilgi ipucunda (erişilebilir adla duyurulur)
    expect(
      screen.getByRole('button', {
        name: /Indicative estimate — bone density is measured by scans before\/after flight/,
      }),
    ).toBeInTheDocument()
  })

  it('50× hızda canlı akış çalışır; time compressed rozeti, uyarılar, karar kartları ve aria-live="assertive" kritik bölgesi güncellenir', () => {
    const clock = createFakeScheduler()
    bindEngineClient(new MockEngine({ scheduler: clock.scheduler }), {
      scenarioId: 'demo_main',
      speed: 1,
    })

    render(<App />)

    // Sunum kontrolleri ana ekranda yok: sunum modu (D) + çekmece (Shift+P)
    expect(screen.queryByTestId('speed-preset-50')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'd' })
    fireEvent.keyDown(window, { key: 'P', shiftKey: true })
    expect(screen.getByTestId('presenter-controls')).toBeInTheDocument()

    // 50× hız seç
    fireEvent.click(screen.getByTestId('speed-preset-50'))
    expect(screen.getAllByTestId('time-compressed-badge').length).toBeGreaterThan(0)

    // Başlat ve 12 tick ilerlet (3 sim-gün → gün 1 uyku borcu + gün 2 SPE CRITICAL/ACT_NOW)
    fireEvent.click(screen.getByTestId('sim-play-btn'))
    act(() => {
      clock.tick(12)
    })

    // Kritik durum aria-live="assertive" bölgesi aktif ve dolu
    const liveRegion = screen.getByTestId('critical-live-region')
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive')
    expect(liveRegion).toHaveTextContent(/Solar Particle Event/i)
    expect(liveRegion).toHaveTextContent(/Act now/i)

    // Sağ sütunda uyarılar ve eylem kartları görünür
    expect(screen.getByTestId('recent-alerts-list')).toBeInTheDocument()
    expect(screen.getByTestId('priority-cards-list')).toBeInTheDocument()

    // Kişi seçicide SCI durum halkası CRITICAL olur
    expect(screen.getByTestId('crew-ring-sci')).toHaveAttribute('data-severity', 'CRITICAL')
  })

  it('dil değiştirici (EN ↔ TR) üst çubuğu, başlıkları ve DisclaimerBar metnini günceller', () => {
    render(<App />)

    expect(screen.getByRole('note')).toHaveTextContent(
      'Synthetic telemetry · Decision-support prototype, not a medical device · Thresholds labelled by evidence status',
    )
    expect(screen.getByTestId('mission-environment')).toHaveTextContent('Mars transit')

    fireEvent.click(screen.getByTestId('lang-btn-tr'))
    expect(screen.getByRole('note')).toHaveTextContent(
      'Sentetik telemetri · Karar destek prototipi, tıbbi cihaz değildir · Eşikler kanıt durumuna göre etiketlidir',
    )
    expect(screen.getByTestId('mission-environment')).toHaveTextContent('Mars transferi')
    expect(screen.getByRole('heading', { level: 1, name: 'Kokpit' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('lang-btn-en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Cockpit' })).toBeInTheDocument()
  })

  it('baseline öğrenirken (new_crew_member, güven < 0.5) "Learning baseline (day 3/14)" etiketini gösterir', () => {
    render(<App />)

    act(() => {
      actions.setScenario('new_crew_member')
    })

    expect(screen.getByTestId('learning-baseline-label')).toHaveTextContent(
      'Learning baseline (day 3/14)',
    )
    expect(screen.getAllByTestId('chart-learning-baseline-badge')[0]).toHaveTextContent(
      'Learning baseline (day 3/14)',
    )
  })

  it('Worker ERROR kenar durumunda hata uyarısı ve "Restart engine" düğmesiyle kurtarma çalışır', () => {
    render(<App />)

    act(() => {
      actions.triggerWorkerError('WORKER_CRASH', 'Simulated worker disconnect')
    })

    const alertBox = screen.getByTestId('worker-error-alert')
    expect(alertBox).toHaveTextContent('WORKER_CRASH')

    const restartBtn = screen.getByTestId('restart-engine-btn')
    expect(restartBtn).toHaveTextContent('Restart engine')

    fireEvent.click(restartBtn)
    expect(screen.queryByTestId('worker-error-alert')).not.toBeInTheDocument()
  })

  it('erişilebilirlik kontrol listesi: tüm düğmelerin erişilebilir adı ve tüm grafiklerin aria-label özeti vardır', () => {
    // Uyku grafiği yalnızca motorun günlük verisi gelince çizilir; burada bir günlük kayıt veriliyor.
    useTelemetryStore.setState((s) => ({
      ...s,
      sleepHistory: {
        ...s.sleepHistory,
        cdr: [
          {
            day: 0,
            label: 'D+00',
            durationH: 6.5,
            baselineH: 7,
            debtH: 0.5,
            exerciseMin: 60,
            resistiveMin: 40,
          },
        ],
      },
    }))
    const { container } = render(<App />)

    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of buttons) {
      const accessibleName =
        (btn.getAttribute('aria-label') ?? '').trim() ||
        (btn.textContent ?? '').trim() ||
        (btn.getAttribute('title') ?? '').trim()
      expect(
        accessibleName.length,
        `Erişilebilir adı olmayan düğme: ${btn.outerHTML}`,
      ).toBeGreaterThan(0)
    }

    const charts = [
      screen.getByTestId('hr-chart-container'),
      screen.getByTestId('spo2-chart-container'),
      screen.getByTestId('sleep-chart-container'),
      screen.getByTestId('radiation-rate-chart'),
    ]
    for (const chart of charts) {
      expect(chart).toHaveAttribute('tabindex', '0')
      expect((chart.getAttribute('aria-label') ?? '').length).toBeGreaterThan(10)
    }
  })

  it('?mock=1 sorgu parametresi verildiğinde MockEngine seçer; verilmediğinde gerçek EngineClient fabrikasını kullanır', () => {
    expect(isMockEngineRequested('?mock=1')).toBe(true)
    expect(isMockEngineRequested('?scenario=demo_main&mock=1')).toBe(true)
    expect(isMockEngineRequested('?mock=0')).toBe(false)
    expect(isMockEngineRequested('')).toBe(false)

    const fakeRealClient: EngineClient = {
      send() {},
      subscribe() {
        return () => {}
      },
      dispose() {},
    }

    registerRealEngineClientFactory(() => fakeRealClient)
    try {
      expect(createDefaultEngineClient('')).toBe(fakeRealClient)
      expect(createDefaultEngineClient('?mock=1')).toBeInstanceOf(MockEngine)
    } finally {
      registerRealEngineClientFactory(null)
    }
  })
})
