// FAZ_11 §3.1: bağlantı rozeti (navigator.onLine) ve güncelleme istemi; `?demo=1` ile istem bastırılır.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PwaStatus } from '@/pwa/PwaStatus'
import { initPwa, isDemoMode, usePwaStore, type RegisterSW } from '@/pwa/pwaStore'

function fakeEnv(initialOnline: boolean) {
  let online = initialOnline
  const target = new EventTarget()
  let needRefresh: (() => void) | undefined
  const updateSW = vi.fn(() => Promise.resolve())
  const registerSW: RegisterSW = (opts) => {
    needRefresh = opts.onNeedRefresh
    return updateSW
  }
  return {
    events: target,
    isOnline: () => online,
    registerSW,
    updateSW,
    goOffline: () => {
      online = false
      target.dispatchEvent(new Event('offline'))
    },
    goOnline: () => {
      online = true
      target.dispatchEvent(new Event('online'))
    },
    fireNeedRefresh: () => needRefresh?.(),
  }
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  usePwaStore.setState({
    online: true,
    demo: false,
    needRefresh: false,
    offlineReady: false,
    applyUpdate: () => undefined,
  })
})

describe('PWA durumu', () => {
  it('isDemoMode: ?demo=1 ve demo=true', () => {
    expect(isDemoMode('?demo=1')).toBe(true)
    expect(isDemoMode('?scenario=x&demo=true')).toBe(true)
    expect(isDemoMode('?demo=0')).toBe(false)
    expect(isDemoMode('')).toBe(false)
  })

  it('store navigator.onLine değişimini izler (rozet AppShell üst çubuğunda; burada yalnızca istem)', () => {
    const env = fakeEnv(true)
    cleanup = initPwa({ search: '', ...env })
    const { container } = render(<PwaStatus />)
    expect(container).toBeEmptyDOMElement()
    expect(usePwaStore.getState().online).toBe(true)
    act(() => env.goOffline())
    expect(usePwaStore.getState().online).toBe(false)
    act(() => env.goOnline())
    expect(usePwaStore.getState().online).toBe(true)
  })

  it('normal mod: yeni sürümde istem çıkar; Reload → updateSW(true); Later → kapanır', () => {
    const env = fakeEnv(true)
    cleanup = initPwa({ search: '', ...env })
    render(<PwaStatus />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    act(() => env.fireNeedRefresh())
    expect(
      screen.getByRole('alertdialog', { name: 'A new version is available.' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(env.updateSW).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => env.fireNeedRefresh())
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('demo modu (?demo=1): güncelleme istemi HİÇ çıkmaz, SW yine kaydedilir', () => {
    const env = fakeEnv(true)
    const spy = vi.fn(env.registerSW)
    cleanup = initPwa({ search: '?demo=1', ...env, registerSW: spy })
    render(<PwaStatus />)
    expect(spy).toHaveBeenCalledTimes(1)
    act(() => env.fireNeedRefresh())
    expect(usePwaStore.getState().needRefresh).toBe(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
