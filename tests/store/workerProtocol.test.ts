import { describe, expect, it } from 'vitest'
import type { IntervalScheduler } from '@/core/telemetry'
import { MS_PER_DAY } from '@/core/units'
import type { WorkerToUiMessage } from '@/workers/protocol'
import { createWorkerHandler } from '@/workers/workerHandler'

class FakeWorkerScheduler implements IntervalScheduler<number> {
  private nextId = 1
  private callbacks = new Map<number, () => void>()

  setInterval(callback: () => void): number {
    const id = this.nextId++
    this.callbacks.set(id, callback)
    return id
  }

  clearInterval(handle: number): void {
    this.callbacks.delete(handle)
  }

  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      for (const cb of [...this.callbacks.values()]) cb()
    }
  }
}

describe('Worker protokolü ve handleMessage (Worker olmadan)', () => {
  it('geçersiz mesajları Zod ile reddeder ve ERROR döner', () => {
    const out: WorkerToUiMessage[] = []
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler: new FakeWorkerScheduler(),
    })

    handler.handleMessage({})
    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', speed: 'fast' })
    handler.handleMessage({ type: 'UNKNOWN_CMD' })

    expect(out).toHaveLength(3)
    expect(out.every((m) => m.type === 'ERROR' && m.code === 'INVALID_MESSAGE')).toBe(true)
    handler.dispose()
  })

  it('INIT -> START -> PAUSE -> SEEK_BOOKMARK -> RESET -> SET_SCENARIO yaşam döngüsü', () => {
    const out: WorkerToUiMessage[] = []
    const scheduler = new FakeWorkerScheduler()
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler,
    })

    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', speed: 50 })
    expect(out.some((m) => m.type === 'READY')).toBe(true)
    expect(out.some((m) => m.type === 'SNAPSHOT')).toBe(true)

    out.length = 0
    handler.handleMessage({ type: 'START' })
    // İlk START backfill yayar (FRAMES_BATCH + ENGINE_OUTPUT + STATUS)
    const firstBatch = out.find((m) => m.type === 'FRAMES_BATCH')
    expect(firstBatch?.type).toBe('FRAMES_BATCH')
    if (firstBatch?.type === 'FRAMES_BATCH') {
      expect(firstBatch.frames.every((f) => f.t < 0)).toBe(true)
    }

    // Canlı tick'ler t >= 0 ile gelir
    out.length = 0
    scheduler.step(2)
    const liveBatches = out.filter((m) => m.type === 'FRAMES_BATCH')
    expect(liveBatches.length).toBeGreaterThan(0)

    handler.handleMessage({ type: 'SET_SPEED', speedMultiplier: 10 })
    handler.handleMessage({ type: 'SEEK_BOOKMARK', index: 3 })
    const lastSnap = [...out].reverse().find((m) => m.type === 'SNAPSHOT')
    if (lastSnap?.type === 'SNAPSHOT') {
      expect(lastSnap.snapshot.t).toBe(3.5 * MS_PER_DAY)
    }

    handler.handleMessage({ type: 'PAUSE' })
    handler.handleMessage({ type: 'RESET' })
    handler.handleMessage({ type: 'SET_SCENARIO', id: 'nominal' })
    const statusAfterScenario = [...out].reverse().find((m) => m.type === 'STATUS')
    if (statusAfterScenario?.type === 'STATUS') {
      expect(statusAfterScenario.status.scenarioId).toBe('nominal')
      expect(statusAfterScenario.status.running).toBe(false)
    }

    handler.dispose()
  })
})
