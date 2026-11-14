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

  it('bağlantı rozeti her sayfada görünür', () => {
    render(<App />)
    expect(screen.getByText(/no network dependency|fully operational/)).toBeInTheDocument()
  })
})
