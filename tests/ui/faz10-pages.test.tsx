// FAZ 10 — Uyarılar, Karar/Takvim Farkı, Davranışsal Sağlık, Kanıt, Doğrulama ve Yer Görünümü testleri.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { en } from '@/ui/i18n/en'
import { tr } from '@/ui/i18n/tr'
import { MockEngine, type MockScheduler } from '@/ui/mock/mockEngine'
import { actions, bindEngineClient } from '@/ui/store'

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

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
}

beforeEach(() => {
  localStorage.clear()
  actions.setLanguage('en')
  navigateTo('/')
  bindEngineClient(new MockEngine(), { scenarioId: 'demo_main', speed: 1 })
})

afterEach(() => {
  vi.useRealTimers()
  actions.setLanguage('en')
  navigateTo('/')
})

describe('FAZ 10 i18n parity', () => {
  it('en ve tr sözlükleri birebir aynı anahtarlara sahiptir', () => {
    const enKeys = Object.keys(en).sort()
    const trKeys = Object.keys(tr).sort()
    expect(enKeys).toEqual(trKeys)
  })
})

describe('FAZ 10 /alerts sayfası, Neden çekmecesi, Takvim farkı ve Kritik şerit', () => {
  it('uyarıları önem/triage sırasına göre listeler, ACK ve "Why?" çekmecesini çalıştırır, gecikme önayarında yeniden sınıflandırır', () => {
    const clock = createFakeScheduler()
    bindEngineClient(new MockEngine({ scheduler: clock.scheduler }), {
      scenarioId: 'demo_main',
      speed: 1,
    })

    navigateTo('/alerts')
    render(<App />)

    expect(screen.getByTestId('alerts-page')).toBeInTheDocument()
    expect(screen.getByTestId('mission-schedule-timeline')).toBeInTheDocument()

    act(() => {
      actions.start()
      clock.tick(12)
    })

    // Kritik ACT_NOW uyarısı kalıcı üst şeridi tetikler
    expect(screen.getByTestId('critical-act-now-banner')).toBeInTheDocument()

    // Sıralı uyarı listesi ve en az bir uyarı kartı
    const list = screen.getByTestId('alerts-sorted-list')
    expect(list).toBeInTheDocument()
    const whyButtons = screen.getAllByTestId(/^why-btn-/)
    expect(whyButtons.length).toBeGreaterThan(0)

    // "Why?" çekmecesini aç
    fireEvent.click(whyButtons[0])
    expect(screen.getByTestId('why-drawer')).toBeInTheDocument()
    expect(screen.getByTestId('why-drivers-list')).toBeInTheDocument()
    expect(screen.getByTestId('why-earth-rationale')).toBeInTheDocument()

    // ACK işlemi
    const ackButtons = screen.getAllByTestId(/^ack-btn-/)
    expect(ackButtons.length).toBeGreaterThan(0)
    fireEvent.click(ackButtons[0])

    // Dünya gecikme önayarını MARS_MAX yap (750s)
    fireEvent.click(screen.getByTestId('earth-preset-MARS_MAX'))
    expect(screen.getByTestId('why-earth-rationale')).toHaveTextContent('750s')
  })

  it('karar kartı kabul edilince 24 saatlik takvim farkını günceller', () => {
    const clock = createFakeScheduler()
    bindEngineClient(new MockEngine({ scheduler: clock.scheduler }), {
      scenarioId: 'demo_main',
      speed: 1,
    })

    navigateTo('/alerts')
    render(<App />)

    act(() => {
      actions.start()
      clock.tick(12)
    })

    const acceptButtons = screen.getAllByTestId(/^alerts-accept-/)
    expect(acceptButtons.length).toBeGreaterThan(0)
    fireEvent.click(acceptButtons[0])

    expect(screen.getByTestId('schedule-tab-accepted')).toBeInTheDocument()
    expect(screen.getByTestId('schedule-diff-list')).toBeInTheDocument()
  })
})

describe('FAZ 10 /behavioral sayfası (Check-in, Yerel Günlük, 60s PVT)', () => {
  it('check-in ve yalnızca yerel günlüğü kaydeder', () => {
    navigateTo('/behavioral')
    render(<App />)

    expect(screen.getByTestId('behavioral-page')).toBeInTheDocument()
    expect(screen.getByTestId('passive-proxy-score')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('checkin-stress-slider'), { target: { value: '7' } })
    fireEvent.change(screen.getByTestId('checkin-mood-slider'), { target: { value: '6' } })
    fireEvent.change(screen.getByTestId('checkin-motivation-slider'), { target: { value: '8' } })
    fireEvent.change(screen.getByTestId('checkin-journal-input'), {
      target: { value: 'Private crew reflection note' },
    })

    fireEvent.click(screen.getByTestId('checkin-submit-btn'))
    expect(screen.getByTestId('checkin-saved-badge')).toBeInTheDocument()
  })

  it('PVT testinde erken basışı (false start) yakalar ve test bitiminde özet üretir', () => {
    vi.useFakeTimers()
    navigateTo('/behavioral')
    render(<App />)

    fireEvent.click(screen.getByTestId('pvt-start-btn'))

    // Uyaran gelmeden basınca false start sayılmalı
    fireEvent.click(screen.getByTestId('pvt-stimulus-area'))
    expect(screen.getByTestId('pvt-false-start-msg')).toBeInTheDocument()

    // Testi durdur ve özetin göründüğünü doğrula
    fireEvent.click(screen.getByTestId('pvt-stop-btn'))
    expect(screen.getByTestId('pvt-summary-text')).toBeInTheDocument()
  })
})

describe('FAZ 10 /evidence ve /validation sayfaları', () => {
  it('/evidence sayfasında doğruluk uyarısı, arama ve doğrulanmamış filtresi çalışır', () => {
    navigateTo('/evidence')
    render(<App />)

    expect(screen.getByTestId('evidence-page')).toBeInTheDocument()
    expect(screen.getByTestId('evidence-honesty-banner')).toBeInTheDocument()
    expect(screen.getByTestId('evidence-summary-counts')).toBeInTheDocument()
    expect(screen.getByTestId('evidence-table')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('evidence-filter-unverified'))
    fireEvent.change(screen.getByTestId('evidence-search-input'), { target: { value: 'bone' } })
    expect(screen.getByTestId('evidence-table')).toBeInTheDocument()
  })

  it('/validation sayfasında sınırlılık kutusu her zaman görünür ve hızlı doğrulama sonuç tablosu üretir', () => {
    navigateTo('/validation')
    render(<App />)

    expect(screen.getByTestId('validation-page')).toBeInTheDocument()
    expect(screen.getByTestId('validation-limitations-box')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('validation-run-quick-btn'))

    expect(screen.getByTestId('validation-results-table')).toBeInTheDocument()
    expect(screen.getByTestId('validation-download-json')).toBeInTheDocument()
    expect(screen.getByTestId('validation-download-md')).toBeInTheDocument()
    expect(screen.getByTestId('replay-scenario-demo_main')).toBeInTheDocument()
  })
})

describe('FAZ 10 /ground sayfası (Gecikmeli ve Rıza Kısıtlı Yer Görünümü)', () => {
  it('özel günlük metnini sızdırmaz, blackout anahtarını ve yer yanıt kuyruğunu çalıştırır', () => {
    // Önce yerel özel günlük kaydet
    navigateTo('/behavioral')
    const { unmount } = render(<App />)
    fireEvent.change(screen.getByTestId('checkin-journal-input'), {
      target: { value: 'SECRET_LOCAL_JOURNAL_TEXT' },
    })
    fireEvent.click(screen.getByTestId('checkin-submit-btn'))
    unmount()

    // Şimdi /ground sayfasına geç
    navigateTo('/ground')
    render(<App />)

    expect(screen.getByTestId('ground-page')).toBeInTheDocument()
    expect(screen.getByTestId('ground-contrast-banner')).toBeInTheDocument()
    expect(screen.getByTestId('ground-data-age-badge')).toBeInTheDocument()

    // Özel günlük metni /ground DOM'unda veya paket önizlemesinde asla olmamalı
    expect(screen.queryByText(/SECRET_LOCAL_JOURNAL_TEXT/)).not.toBeInTheDocument()
    expect(screen.getByTestId('earth-packet-preview')).toBeInTheDocument()

    // Blackout anahtarını aç
    fireEvent.click(screen.getByTestId('earth-blackout-switch'))
    expect(screen.getByTestId('earth-link-down-badge')).toBeInTheDocument()

    // Yer yanıtı gönder -> outbox'a eklenmeli
    fireEvent.click(screen.getByTestId('ground-reply-send-btn'))
    expect(screen.getByTestId('ground-reply-sent-note')).toBeInTheDocument()
    expect(screen.getByTestId('earth-outbox-list')).toBeInTheDocument()
  })
})
