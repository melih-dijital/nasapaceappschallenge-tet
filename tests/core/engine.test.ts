import { describe, expect, it } from 'vitest'
import {
  createDefaultEngine,
  Engine,
  type EngineContext,
  type EngineStage,
} from '@/core/pipeline'
import { MemoryFrameStore } from '@/core/storage'
import { InProcessSimSource, type IntervalScheduler } from '@/core/telemetry'
import type { VitalsFrame } from '@/core/types'
import { MS_PER_DAY } from '@/core/units'
import { speedToSimMsPerRealMs } from '@/sim/clock'

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

describe('Engine boru hattı', () => {
  it('aşama sırasını korur, backfill (t < 0) için Modules/Detection/Decision atlar ve reset çalışır', () => {
    const trace: string[] = []
    const spyStage = (name: string, runOnBackfill: boolean): EngineStage => ({
      name,
      runOnBackfill,
      process: () => trace.push(name),
    })

    const engine = new Engine({
      stages: [
        spyStage('Ingest', true),
        spyStage('Buffer', true),
        spyStage('Baseline', true),
        spyStage('Modules', false),
        spyStage('Detection', false),
        spyStage('Decision', false),
        spyStage('Persist', true),
      ],
    })

    // Yalnızca gerçek IngestStage olmadan isBackfillOnly ctx testi için varsayılan + spy kullanalım
    const frameBackfill: VitalsFrame = {
      kind: 'vitals',
      t: -60000,
      crewId: 'cdr',
      hr: 62,
      spo2: 98,
      source: 'SYNTHETIC',
    }
    engine.ingest([frameBackfill], 0)
    expect(trace).toEqual(['Ingest', 'Buffer', 'Baseline', 'Modules', 'Detection', 'Decision', 'Persist'])

    // Gerçek IngestStage ile t < 0 testi
    const seenByModules: number[] = []
    const defaultWithSpy = new Engine({
      stages: [
        ...createDefaultEngine()['stages'],
        {
          name: 'ModulesSpy',
          runOnBackfill: false,
          process: (ctx: EngineContext) => seenByModules.push(ctx.simT),
        },
      ],
    })
    defaultWithSpy.ingest([frameBackfill], 0)
    expect(seenByModules).toEqual([]) // backfill'de atlandı

    defaultWithSpy.ingest([{ ...frameBackfill, t: 0 }], 0)
    expect(seenByModules).toEqual([0]) // canlı karede çalıştı

    defaultWithSpy.reset()
    expect(defaultWithSpy.snapshot().latest).toEqual({})
  })

  it('hata yalıtımı: bir aşama hata fırlatırsa EngineFault üretir ve sonraki aşamalar çalışır', () => {
    const afterRan: number[] = []
    const engine = new Engine({
      stages: [
        {
          name: 'BrokenStage',
          process: () => {
            throw new Error('simulated stage boom')
          },
        },
        {
          name: 'HealthyStage',
          process: (ctx) => {
            afterRan.push(ctx.simT)
          },
        },
      ],
    })

    const out = engine.ingest([], 1234)
    expect(out.faults).toEqual([{ stage: 'BrokenStage', message: 'simulated stage boom', t: 1234 }])
    expect(out.dataQuality.some((d) => d.kind === 'ENGINE_FAULT')).toBe(true)
    expect(afterRan).toEqual([1234])
  })

  it('uçtan uca (Node): InProcessSimSource -> Engine -> MemoryFrameStore 3 sim-günlük akış tutarlıdır', async () => {
    const scheduler = new StepScheduler()
    const store = new MemoryFrameStore()
    const engine = createDefaultEngine({ persist: store })
    const source = new InProcessSimSource({
      scheduler,
      scenarioId: 'nominal',
      speed: 50,
      tickMs: 100,
    })

    source.onFrames((frames, simT) => {
      engine.ingest(frames, simT)
    })

    source.start()
    // 50× hızda 1 tick (100 ms) = 21,600,000 sim-ms = 0.25 sim-gün → 12 tick = 3 sim-gün
    const msPerTick = 100 * speedToSimMsPerRealMs(50)
    const ticksFor3Days = Math.round((3 * MS_PER_DAY) / msPerTick)
    scheduler.step(ticksFor3Days)

    // Backfill (14 gün) + 3 sim-gün = 17 gün × 4 kişi × (96 vitals + 96 rad + 1 daily = 193) = 13124
    const totalStored = await store.count()
    expect(totalStored).toBe(17 * 4 * (96 + 96 + 1))

    const snap = engine.snapshot()
    expect(snap.t).toBe(3 * MS_PER_DAY)
    expect(snap.dataQualityCount).toBe(0)
    expect(snap.latest['cdr|hr']).toBeTypeOf('number')
    expect(snap.latest['sci|rad.doseRateMsvDay']).toBeTypeOf('number')
  })
})
