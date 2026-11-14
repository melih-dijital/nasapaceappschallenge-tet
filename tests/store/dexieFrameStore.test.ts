import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import type { StorageWarning } from '@/core/storage'
import type { VitalsFrame } from '@/core/types'
import { DexieFrameStore } from '@/store/dexieFrameStore'

const makeVitals = (crewId: string, t: number, hr = 64): VitalsFrame => ({
  kind: 'vitals',
  t,
  crewId,
  hr,
  spo2: 98,
  source: 'SYNTHETIC',
})

function newFakeStore(opts: { batchSize?: number; onWarning?: (w: StorageWarning) => void } = {}) {
  return new DexieFrameStore({
    dbName: `test-db-${Math.random().toString(36).slice(2)}`,
    indexedDB: new IDBFactory(),
    IDBKeyRange,
    batchSize: opts.batchSize ?? 5,
    flushIntervalMs: 1000,
    ...(opts.onWarning ? { onWarning: opts.onWarning } : {}),
  })
}

describe('DexieFrameStore (fake-indexeddb)', () => {
  it('oturum başlarken resume yoksa temizler, resume=true ise korur ve toplu yazar', async () => {
    const store = newFakeStore({ batchSize: 3 })
    await store.initSession({ scenarioId: 'demo_main', seed: 42, resume: false, startedAt: 1000 })
    const meta = await store.getSessionMeta()
    expect(meta?.scenarioId).toBe('demo_main')
    expect(meta?.seed).toBe(42)

    await store.append([makeVitals('cdr', 1), makeVitals('cdr', 2), makeVitals('cdr', 3)])
    expect(await store.count()).toBe(3)

    // resume=true veriyi korur
    await store.initSession({ scenarioId: 'demo_main', seed: 42, resume: true, startedAt: 2000 })
    expect(await store.count()).toBe(3)

    // resume=false temizler
    await store.initSession({ scenarioId: 'nominal', seed: 101, resume: false, startedAt: 3000 })
    expect(await store.count()).toBe(0)

    await store.close()
  })

  it('Dexie yazma hatasında çökmez, StorageWarning yayar ve MemoryFrameStore yedeğine düşer', async () => {
    const warnings: StorageWarning[] = []
    const store = newFakeStore({ batchSize: 2, onWarning: (w) => warnings.push(w) })
    await store.initSession({ scenarioId: 'demo_main', seed: 42, resume: false })

    // bulkPut hatası simüle et
    vi.spyOn(store.getDb().frames, 'bulkPut').mockRejectedValueOnce(new Error('QuotaExceededError'))

    await store.append([makeVitals('cdr', 10), makeVitals('cdr', 20)])
    expect(store.isDegraded()).toBe(true)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.code).toBe('DEXIE_ERROR')

    // Yedek bellek deposundan okunmaya devam eder
    expect(await store.count()).toBe(2)
    await store.append([makeVitals('cdr', 30)])
    const queried = await store.query({ crewId: 'cdr' })
    expect(queried.map((f) => f.t)).toEqual([10, 20, 30])

    await store.close()
  })
})
