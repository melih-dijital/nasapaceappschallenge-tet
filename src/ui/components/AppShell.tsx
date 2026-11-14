import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { DisclaimerBar } from './DisclaimerBar'

const NAV_ITEMS = [
  { to: '/', label: 'Cockpit' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/validation', label: 'Validation' },
  { to: '/ground', label: 'Ground' },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <DisclaimerBar />
      <header className="border-b border-border bg-card">
        <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2">
          <span className="mr-4 font-mono text-sm font-semibold tracking-wide text-primary">
            ASTRO HEALTH COCKPIT
          </span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
