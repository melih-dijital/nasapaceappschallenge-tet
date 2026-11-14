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
    '%s rotası gezilebilir ve bant her sayfada kalır',
    (label) => {
      render(<App />)
      fireEvent.click(screen.getByRole('link', { name: label }))
      expect(screen.getByRole('heading', { level: 1, name: label })).toBeInTheDocument()
      expect(screen.getByRole('note')).toHaveTextContent(DISCLAIMER)
    },
  )
})
