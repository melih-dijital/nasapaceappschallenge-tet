// Tarayıcı/Worker için Dexie FrameStore (FAZ_03 §3.2).
// Toplu yazma (>= 500 kayıt veya 1 sn), bulkPut, hata durumunda StorageWarning + MemoryFrameStore yedeği.
import Dexie, { type Table } from 'dexie'
import type { FrameQuery, FrameStore, StorageWarning } from '../core/storage/frameStore'
import { MemoryFrameStore } from '../core/storage/memoryFrameStore'
import type { ScenarioId, TelemetryFrame } from '../core/types'

export interface SessionMetaRecord {
  id: 'current'
  scenarioId: ScenarioId
  seed?: number
  startedAt: number
}

export interface DexieFrameStoreOptions {
  dbName?: string
  batchSize?: number
  flushIntervalMs?: number
  fallbackCapacity?: number
  onWarning?: (warning: StorageWarning) => void
  indexedDB?: IDBFactory
  IDBKeyRange?: typeof IDBKeyRange
}

const DEFAULT_DB_NAME = 'astro-health-cockpit'
const DEFAULT_BATCH_SIZE = 500
const DEFAULT_FLUSH_INTERVAL_MS = 1000

class CockpitDexieDb extends Dexie {
  frames!: Table<TelemetryFrame, [string, string, number]>
  session!: Table<SessionMetaRecord, string>

  constructor(dbName: string, indexedDB?: IDBFactory, idbKeyRange?: typeof IDBKeyRange) {
    super(
      dbName,
      indexedDB
        ? {
            indexedDB,
            ...(idbKeyRange ? { IDBKeyRange: idbKeyRange } : {}),
          }
        : undefined,
    )
    this.version(1).stores({
      frames: '[crewId+kind+t], crewId, t, [crewId+t]',
      session: 'id',
    })
  }
}

export class DexieFrameStore implements FrameStore {
  private readonly db: CockpitDexieDb
  private readonly batchSize: number
  private readonly flushIntervalMs: number
  private readonly fallback: MemoryFrameStore
  private readonly onWarning?: (warning: StorageWarning) => void

  private pending: TelemetryFrame[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private degraded = false
  private lastWarning: StorageWarning | null = null

  constructor(options: DexieFrameStoreOptions = {}) {
    this.db = new CockpitDexieDb(
      options.dbName ?? DEFAULT_DB_NAME,
      options.indexedDB,
      options.IDBKeyRange,
    )
    this.batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE)
    this.flushIntervalMs = Math.max(50, options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS)
    this.fallback = new MemoryFrameStore(options.fallbackCapacity)
    if (options.onWarning) {
      this.onWarning = options.onWarning
    }
  }

  isDegraded(): boolean {
    return this.degraded
  }

  getLastWarning(): StorageWarning | null {
    return this.lastWarning
  }

  /** Test/hata enjeksiyonu için iç tabloya erişim. */
  getDb(): CockpitDexieDb {
    return this.db
  }

  async initSession(opts: {
    scenarioId: ScenarioId
    seed?: number
    resume?: boolean
    startedAt?: number
  }): Promise<{ degraded: boolean; warning: StorageWarning | null }> {
    if (!opts.resume) {
      await this.clear()
    }
    if (!this.degraded) {
      try {
        await this.db.session.put({
          id: 'current',
          scenarioId: opts.scenarioId,
          ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
          startedAt: opts.startedAt ?? 0,
        })
      } catch (err) {
        await this.enterDegradedMode(err)
      }
    }
    return { degraded: this.degraded, warning: this.lastWarning }
  }

  async getSessionMeta(): Promise<SessionMetaRecord | undefined> {
    if (this.degraded) return undefined
    try {
      return await this.db.session.get('current')
    } catch (err) {
      await this.enterDegradedMode(err)
      return undefined
    }
  }

  async append(frames: readonly TelemetryFrame[]): Promise<void> {
    if (frames.length === 0) return

    if (this.degraded) {
      await this.fallback.append(frames)
      return
    }

    this.pending.push(...frames)
    if (this.pending.length >= this.batchSize) {
      await this.flush()
      return
    }

    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        void this.flush()
      }, this.flushIntervalMs)
    }
  }

  async flush(): Promise<void> {
    this.clearFlushTimer()
    if (this.pending.length === 0) return

    const batch = this.pending
    this.pending = []

    if (this.degraded) {
      await this.fallback.append(batch)
      return
    }

    try {
      await this.db.frames.bulkPut(batch)
    } catch (err) {
      await this.enterDegradedMode(err)
      await this.fallback.append(batch)
    }
  }

  async query(params: FrameQuery): Promise<TelemetryFrame[]> {
    await this.flush()
    if (this.degraded) {
      return this.fallback.query(params)
    }

    try {
      const rows = await this.db.frames.where('crewId').equals(params.crewId).toArray()
      const filtered = rows.filter((frame) => {
        if (params.kind !== undefined && frame.kind !== params.kind) return false
        if (params.fromT !== undefined && frame.t < params.fromT) return false
        if (params.toT !== undefined && frame.t > params.toT) return false
        return true
      })
      filtered.sort((a, b) => a.t - b.t)
      if (params.limit !== undefined && params.limit >= 0) {
        return filtered.slice(0, params.limit)
      }
      return filtered
    } catch (err) {
      await this.enterDegradedMode(err)
      return this.fallback.query(params)
    }
  }

  async clear(): Promise<void> {
    this.clearFlushTimer()
    this.pending = []
    await this.fallback.clear()
    if (this.degraded) return
    try {
      await this.db.frames.clear()
      await this.db.session.clear()
    } catch (err) {
      await this.enterDegradedMode(err)
    }
  }

  async count(): Promise<number> {
    await this.flush()
    if (this.degraded) {
      return this.fallback.count()
    }
    try {
      return await this.db.frames.count()
    } catch (err) {
      await this.enterDegradedMode(err)
      return this.fallback.count()
    }
  }

  async close(): Promise<void> {
    this.clearFlushTimer()
    await this.flush()
    this.db.close()
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private async enterDegradedMode(err: unknown): Promise<void> {
    if (!this.degraded) {
      this.degraded = true
      const message = err instanceof Error ? err.message : String(err)
      this.lastWarning = {
        code: 'DEXIE_ERROR',
        message: `IndexedDB/Dexie yazma hatası, bellek tamponuna geçildi: ${message}`,
      }
      this.onWarning?.(this.lastWarning)
    }
  }
}
