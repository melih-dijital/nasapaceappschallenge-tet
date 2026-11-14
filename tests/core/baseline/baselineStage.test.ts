import { describe, expect, it } from 'vitest'
import { BaselineEngine } from '@/core/baseline'
import { registry } from '@/core/evidence/registry'
import { BaselineStage, createDefaultEngine } from '@/core/pipeline'
import { MemoryFrameStore } from '@/core/storage'
import type { IntervalScheduler } from '@/core/telemetry'
import type { VitalsFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from '@/core/units'
import { getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'
import { InProcessEngineClient, selectBaselineBand, selectLatestBaseline, useTelemetryStore } from '@/store'

class StepScheduler implements IntervalScheduler<number> {
  private cb: (() => void) | null = null
  setInterval(callback: () => void): number {
    this.cb = callback
    return 1
  }
  clearInterval(): void {
    this.cb = null
  }
  step(times = 1): void {
    for (let i = 0; i < times; i++) this.cb?.()
  }
}

describe('BaselineStage, store akışı ve nominal entegrasyon', () => {
  it('BaselineStage kendi kendine kıyas yapmaz: değeri güncellemeden önce zscore hesaplar', () => {
    const baselineEngine = new BaselineEngine({ registry })
    const stage = new BaselineStage({ baselineEngine })
    const engine = createDefaultEngine({ baselineEngine })

    // 14 gün normal HR=62
    const seedFrames: VitalsFrame[] = []
    for (let day = -14; day < 0; day++) {
      for (let i = 0; i < 4; i++) {
        seedFrames.push({
          kind: 'vitals',
          crewId: 'cdr',
          t: day * MS_PER_DAY + 13 * MS_PER_HOUR + i * MS_PER_MIN,
          hr: 62,
          spo2: 98,
          source: 'SYNTHETIC',
        })
      }
    }
    engine.ingest(seedFrames, 0)

    // Aniden 110 bpm gelince: z hesaplandığında 110 henüz baseline'a girmemiş olmalı
    const spikeOut = engine.ingest(
      [
        {
          kind: 'vitals',
          crewId: 'cdr',
          t: 13 * MS_PER_HOUR,
          hr: 110,
          spo2: 98,
          source: 'SYNTHETIC',
        },
      ],
      13 * MS_PER_HOUR,
    )

    const hrSnap = spikeOut.baselines?.find((b) => b.metric === 'hr')
    expect(hrSnap).toBeDefined()
    expect(hrSnap!.baselineMedian).toBe(62)
    expect(hrSnap!.baselineSigma).toBe(registry.getNumber('minScale.hr'))
    expect(hrSnap!.z).toBeCloseTo((110 - 62) / registry.getNumber('minScale.hr'), 6)
    expect(stage.runOnBackfill).toBe(true)
  })

  it('InProcessEngineClient üzerinden EngineOutput.baselines store lara akar ve band hesaplanır', () => {
    useTelemetryStore.getState().reset()
    const scheduler = new StepScheduler()
    const client = new InProcessEngineClient({ connectStores: true, scheduler })

    client.send({ type: 'INIT', scenarioId: 'nominal', seed: 1, speed: 50 })
    client.send({ type: 'START' })
    scheduler.step(4)

    const state = useTelemetryStore.getState()
    const latestHr = selectLatestBaseline(state, 'cdr', 'hr')
    const hrBand = selectBaselineBand(state, 'cdr', 'hr')

    expect(latestHr).toBeDefined()
    expect(latestHr!.baselineMedian).not.toBeNull()
    expect(latestHr!.baselineSigma).not.toBeNull()
    expect(hrBand.length).toBeGreaterThan(0)
    const lastBand = hrBand[hrBand.length - 1]!
    expect(lastBand.bandLow).toBeLessThan(lastBand.median)
    expect(lastBand.bandHigh).toBeGreaterThan(lastBand.median)

    client.dispose()
    useTelemetryStore.getState().reset()
  })

  it('nominal entegrasyon: 14 gün backfill sonrası ilk canlı günde |z| dağılımı N(0,1) civarı', async () => {
    const scenario = getScenario('nominal')
    const sim = new Simulator(scenario, { seed: 1 })
    const store = new MemoryFrameStore()
    const engine = createDefaultEngine({ persist: store })

    // 14 gün backfill
    const backfillFrames = sim.backfill()
    engine.ingest(backfillFrames, 0)

    // İlk canlı gün (t ∈ [0, MS_PER_DAY])
    const day1Frames = sim.advanceTo(MS_PER_DAY + MS_PER_MIN)
    const out = engine.ingest(day1Frames, MS_PER_DAY)

    const snapshots = out.baselines ?? []
    expect(snapshots.length).toBeGreaterThan(300)

    let sumAbsZ = 0
    let withinThreeCount = 0
    for (const s of snapshots) {
      expect(Number.isFinite(s.z)).toBe(true)
      expect(s.confidence).toBeCloseTo(1, 5)
      const absZ = Math.abs(s.z)
      sumAbsZ += absZ
      if (absZ < 3) withinThreeCount += 1
    }

    const meanAbsZ = sumAbsZ / snapshots.length
    const fracWithin3 = withinThreeCount / snapshots.length

    expect(meanAbsZ).toBeLessThan(1)
    expect(fracWithin3).toBeGreaterThanOrEqual(0.95)
    expect(await store.count()).toBe(backfillFrames.length + day1Frames.length)
  })
})
