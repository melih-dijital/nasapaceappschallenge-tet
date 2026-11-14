import { describe, expect, it } from 'vitest'
import { InProcessSimSource, type IntervalScheduler } from '@/core/telemetry/inProcessSource'
import type { SimTimeMs, SourceStatus, TelemetryFrame } from '@/core/types'
import { MS_PER_DAY } from '@/core/units'

class FakeScheduler implements IntervalScheduler<number> {
  private nextId = 1
  private tasks = new Map<number, { intervalMs: number; callback: () => void }>()
  lastRequestedIntervalMs: number | null = null

  setInterval(callback: () => void, intervalMs: number): number {
    const id = this.nextId++
    this.lastRequestedIntervalMs = intervalMs
    this.tasks.set(id, { intervalMs, callback })
    return id
  }

  clearInterval(handle: number): void {
    this.tasks.delete(handle)
  }

  activeCount(): number {
    return this.tasks.size
  }

  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      for (const task of [...this.tasks.values()]) {
        task.callback()
      }
    }
  }
}

describe('InProcessSimSource', () => {
  it('backfill yalnızca ilk start/reset sonrası tek onFrames çağrısıyla verilir (pause→resume tekrar yaymaz)', () => {
    const scheduler = new FakeScheduler()
    const source = new InProcessSimSource({
      scheduler,
      scenarioId: 'demo_main',
      tickMs: 10, // ≤10 Hz kuralıyla 100 ms'ye zorlanmalı
    })

    const batches: { frames: TelemetryFrame[]; simT: SimTimeMs }[] = []
    const statuses: SourceStatus[] = []
    source.onFrames((frames, simT) => batches.push({ frames, simT }))
    source.onStatus((s) => statuses.push(s))

    source.start()
    expect(scheduler.lastRequestedIntervalMs).toBe(100)
    expect(scheduler.activeCount()).toBe(1)

    // İlk batch tek çağrıda backfill (t < 0)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.simT).toBe(0)
    expect(batches[0]!.frames.length).toBeGreaterThan(0)
    expect(batches[0]!.frames.every((f) => f.t < 0)).toBe(true)

    // Pause → resume backfill tekrar YAYMAZ
    source.pause()
    expect(scheduler.activeCount()).toBe(0)
    expect(statuses.at(-1)?.running).toBe(false)

    source.start()
    expect(batches).toHaveLength(1)

    // Tick atınca yeni çerçeveler t >= 0 ile gelir
    scheduler.step(1)
    expect(batches.length).toBe(2)
    expect(batches[1]!.frames.every((f) => f.t >= 0)).toBe(true)

    // Reset sonrası start tekrar backfill yayar
    source.reset()
    expect(source.getStatus().simT).toBe(0)
    source.start()
    expect(batches.at(-1)?.simT).toBe(0)
    expect(batches.at(-1)?.frames.every((f) => f.t < 0)).toBe(true)
  })

  it('setSpeed, setScenario ve seekToBookmark beklenen şekilde çalışır', () => {
    const scheduler = new FakeScheduler()
    const source = new InProcessSimSource({ scheduler, scenarioId: 'demo_main' })

    const batches: { frames: TelemetryFrame[]; simT: SimTimeMs }[] = []
    source.onFrames((frames, simT) => batches.push({ frames, simT }))

    source.setSpeed(50)
    expect(source.getStatus().speed).toBe(50)

    source.start()
    const afterStart = batches.length
    scheduler.step(1)
    expect(batches.length).toBeGreaterThan(afterStart)
    // 50× hızda 100 ms tick = 21,600,000 sim-ms = 6 sim-saat
    expect(source.getStatus().simT).toBeCloseTo(21_600_000, 1)

    // Bookmark 3 = SPE başlangıcı (3.5 gün)
    source.seekToBookmark(3)
    expect(source.getStatus().simT).toBe(3.5 * MS_PER_DAY)

    // Senaryo değiştirme sıfırlar ve durdurur
    source.setScenario('nominal', 777)
    expect(source.getStatus().running).toBe(false)
    expect(source.getStatus().scenarioId).toBe('nominal')
    expect(source.getStatus().simT).toBe(0)
  })
})
