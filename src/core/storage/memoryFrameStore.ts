// Bellek içi halka tamponlu FrameStore (FAZ_03 §3.2). Test, Node ve Dexie yedeği için.
import type { TelemetryFrame } from '../types'
import type { FrameQuery, FrameStore } from './frameStore'

const DEFAULT_CAPACITY = 100_000

function frameKey(frame: TelemetryFrame): string {
  if (frame.kind === 'daily') {
    return `${frame.crewId}|daily|day:${frame.day}`
  }
  return `${frame.crewId}|${frame.kind}|${frame.t}`
}

export class MemoryFrameStore implements FrameStore {
  private readonly capacity: number
  private frames: TelemetryFrame[] = []
  private indexByKey = new Map<string, number>()

  constructor(capacity = DEFAULT_CAPACITY) {
    if (capacity <= 0) {
      throw new Error(`MemoryFrameStore: capacity > 0 olmalı, alındı: ${capacity}`)
    }
    this.capacity = capacity
  }

  async append(frames: readonly TelemetryFrame[]): Promise<void> {
    if (frames.length === 0) return

    for (const frame of frames) {
      const key = frameKey(frame)
      const existingIdx = this.indexByKey.get(key)
      if (existingIdx !== undefined) {
        this.frames[existingIdx] = frame
      } else {
        this.indexByKey.set(key, this.frames.length)
        this.frames.push(frame)
      }
    }

    if (this.frames.length > this.capacity) {
      const drop = this.frames.length - this.capacity
      this.frames = this.frames.slice(drop)
      this.rebuildIndex()
    }
  }

  async query(params: FrameQuery): Promise<TelemetryFrame[]> {
    const filtered = this.frames.filter((frame) => {
      if (frame.crewId !== params.crewId) return false
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
  }

  async clear(): Promise<void> {
    this.frames = []
    this.indexByKey.clear()
  }

  async count(): Promise<number> {
    return this.frames.length
  }

  private rebuildIndex(): void {
    this.indexByKey.clear()
    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i]
      if (frame) {
        this.indexByKey.set(frameKey(frame), i)
      }
    }
  }
}
