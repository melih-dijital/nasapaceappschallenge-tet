import { describe, expect, it } from 'vitest'
import { MemoryFrameStore } from '@/core/storage'
import type { VitalsFrame } from '@/core/types'

const vitals = (crewId: string, t: number, hr = 65): VitalsFrame => ({
  kind: 'vitals',
  t,
  crewId,
  hr,
  spo2: 98,
  source: 'SYNTHETIC',
})

describe('MemoryFrameStore', () => {
  it('append, query (crewId/kind/fromT/toT/limit), clear ve count doğru çalışır', async () => {
    const store = new MemoryFrameStore(10)
    await store.append([
      vitals('cdr', 100, 61),
      vitals('cdr', 200, 62),
      vitals('cdr', 300, 63),
      vitals('md', 150, 70),
    ])

    expect(await store.count()).toBe(4)

    const cdrRange = await store.query({ crewId: 'cdr', kind: 'vitals', fromT: 150, toT: 300 })
    expect(cdrRange.map((f) => f.t)).toEqual([200, 300])

    const cdrLimited = await store.query({ crewId: 'cdr', limit: 2 })
    expect(cdrLimited).toHaveLength(2)

    await store.clear()
    expect(await store.count()).toBe(0)
  })

  it('kapasite sınırını aşmaz ve aynı [crewId+kind+t] anahtarını günceller', async () => {
    const store = new MemoryFrameStore(3)
    await store.append([vitals('cdr', 1), vitals('cdr', 2), vitals('cdr', 3), vitals('cdr', 4)])
    expect(await store.count()).toBe(3)
    const rows = await store.query({ crewId: 'cdr' })
    expect(rows.map((r) => r.t)).toEqual([2, 3, 4])

    await store.append([vitals('cdr', 3, 99)])
    expect(await store.count()).toBe(3)
    const updated = await store.query({ crewId: 'cdr', fromT: 3, toT: 3 })
    expect((updated[0] as VitalsFrame).hr).toBe(99)
  })
})
