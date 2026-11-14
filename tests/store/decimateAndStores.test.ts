import { describe, expect, it } from 'vitest'
import type { IntervalScheduler } from '@/core/telemetry'
import type { WorkerToUiMessage } from '@/workers/protocol'
import {
  ackAlert,
  createEngineClient,
  decimate,
  initSimulation,
  pauseSimulation,
  resetSimulation,
  selectActiveAlerts,
  selectLatest,
  selectSeries,
  setEngineClient,
  startSimulation,
  useAlertStore,
  useSessionStore,
  useTelemetryStore,
  type Point,
  type WorkerLike,
} from '@/store'

class TestScheduler implements IntervalScheduler<number> {
  private cb: (() => void) | null = null
  setInterval(callback: () => void): number {
    this.cb = callback
    return 1
  }
  clearInterval(): void {
    this.cb = null
  }
  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) this.cb?.()
  }
}

describe('decimate ve store/EngineClient akışı', () => {
  it('decimate: sınırları, ilk/son noktayı ve min/max uç değerleri korur', () => {
    expect(decimate([], 10)).toEqual([])
    expect(decimate([{ t: 0, value: 1 }], 0)).toEqual([])

    const pts: Point[] = Array.from({ length: 1000 }, (_, i) => ({
      t: i * 100,
      value: i === 333 ? 999 : i === 777 ? -500 : Math.sin(i / 10),
    }))

    expect(decimate(pts, 1)).toEqual([pts[0]])
    expect(decimate(pts, 2)).toEqual([pts[0], pts[999]])

    const d3 = decimate(pts, 3)
    expect(d3).toHaveLength(3)
    expect(d3[0]).toEqual(pts[0])
    expect(d3[2]).toEqual(pts[999])

    const d100 = decimate(pts, 100)
    expect(d100.length).toBeLessThanOrEqual(100)
    expect(d100[0]).toEqual(pts[0])
    expect(d100.at(-1)).toEqual(pts[999])
    expect(d100.some((p) => p.value === 999)).toBe(true)
    expect(d100.some((p) => p.value === -500)).toBe(true)
    for (let i = 1; i < d100.length; i++) {
      expect(d100[i]!.t).toBeGreaterThanOrEqual(d100[i - 1]!.t)
    }
  })

  it('InProcessEngineClient + actions store’ları besler ve seriyi <= 600 noktada tutar', () => {
    useSessionStore.getState().reset()
    useTelemetryStore.getState().reset()
    useAlertStore.getState().reset()

    const scheduler = new TestScheduler()
    const client = createEngineClient({ forceInProcess: true, scheduler })
    setEngineClient(client)

    initSimulation({ scenarioId: 'demo_main', speed: 50 })
    expect(useSessionStore.getState().workerStatus).toBe('ready')

    startSimulation()
    scheduler.step(4)

    const tel = useTelemetryStore.getState()
    const cdrHr = selectLatest(tel, 'cdr', 'hr')
    const cdrSeries = selectSeries(tel, 'cdr', 'hr')
    expect(cdrHr).toBeTypeOf('number')
    expect(cdrSeries.length).toBeGreaterThan(0)
    expect(cdrSeries.length).toBeLessThanOrEqual(600)

    pauseSimulation()
    expect(useSessionStore.getState().running).toBe(false)

    ackAlert('non-existent')
    expect(selectActiveAlerts(useAlertStore.getState())).toEqual([])

    resetSimulation()
    setEngineClient(null)
  })

  it('WorkerEngineClient: worker çökerse yeniden başlatır ve ERROR yayar', () => {
    useSessionStore.getState().reset()
    const spawned: FakeWorker[] = []
    class FakeWorker implements WorkerLike {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null
      sent: unknown[] = []
      terminated = false
      postMessage(message: unknown): void {
        this.sent.push(message)
      }
      terminate(): void {
        this.terminated = true
      }
    }

    const client = createEngineClient({
      workerFactory: () => {
        const w = new FakeWorker()
        spawned.push(w)
        return w
      },
    })

    const received: WorkerToUiMessage[] = []
    client.subscribe((m) => received.push(m))

    client.send({ type: 'INIT', scenarioId: 'demo_main', speed: 1 })
    expect(spawned).toHaveLength(1)

    // Çökme simülasyonu
    spawned[0]!.onerror?.({ message: 'Out of memory' } as ErrorEvent)
    expect(spawned[0]!.terminated).toBe(true)
    expect(spawned).toHaveLength(2)
    expect(spawned[1]!.sent).toEqual([{ type: 'INIT', scenarioId: 'demo_main', speed: 1 }])
    expect(received.some((m) => m.type === 'ERROR' && m.code === 'WORKER_CRASHED')).toBe(true)

    client.dispose()
  })
})
