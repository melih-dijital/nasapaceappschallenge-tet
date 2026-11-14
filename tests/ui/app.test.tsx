import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '@/App'

const DISCLAIMER = 'Decision support prototype · synthetic data · not a medical device'

describe('App (jsdom ortamı)', () => {
  it('render olur; disclaimer bandı ve 4 nav bağlantısı görünür', () => {
    render(<App />)
    expect(screen.getByRole('note')).toHaveTextContent(DISCLAIMER)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.querySelectorAll('a')).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 1, name: 'Cockpit' })).toBeInTheDocument()
  })

  it.each(['Evidence', 'Validation', 'Ground', 'Cockpit'])(
    '%s rotası gezilebilir (lazy sayfalar dahil) ve bant her sayfada kalır',
    async (label) => {
      render(<App />)
      fireEvent.click(screen.getByRole('link', { name: label }))
      expect(
        await screen.findByRole('heading', { level: 1, name: new RegExp(label, 'i') }),
      ).toBeInTheDocument()
      expect(screen.getAllByRole('note').some((el) => el.textContent?.includes(DISCLAIMER))).toBe(
        true,
      )
    },
  )

  it('bağlantı rozeti tekil ve her sayfada görünür (FAZ 12: sağ alt kopya kaldırıldı)', () => {
    render(<App />)
    const badges = screen.getAllByTestId('network-connection-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent(/no network dependency|fully operational/)
  })

  it('bilinmeyen rota: boş durum + kokpite dönüş bağlantısı', async () => {
    window.history.pushState({}, '', '/no-such-view')
    render(<App />)
    expect(await screen.findByTestId('not-found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cockpit' })).toHaveAttribute('href', '/')
    window.history.pushState({}, '', '/')
  })

  it('erişilebilirlik: içeriğe atla bağlantısı ana içeriğe gider', () => {
    render(<App />)
    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1')
  })
})
