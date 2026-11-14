// Süreç-içi simülasyon telemetri kaynağı (FAZ_02 §3.9).
// Zamanlayıcı enjekte edilir (core içinde global setInterval kullanılmaz); çerçeveler <= 10 Hz toplu verilir.
import { clampSpeed, dayOf, speedToSimMsPerRealMs } from '../../sim/clock'
import { getScenario } from '../../sim/scenarios'
import { Simulator } from '../../sim/simulator'
import type { ScenarioId, SimTimeMs, SourceStatus, TelemetryFrame } from '../types'
import type { TelemetrySource } from './source'

export interface IntervalScheduler<THandle = unknown> {
  setInterval(callback: () => void, intervalMs: number): THandle
  clearInterval(handle: THandle): void
}

export interface InProcessSimSourceOptions<THandle = unknown> {
  scheduler: IntervalScheduler<THandle>
  scenarioId?: ScenarioId
  seed?: number
  speed?: number
  /** Batch aralığı (ms). ≤ 10 Hz kuralı gereği en az 100 ms. */
  tickMs?: number
}

const MIN_TICK_MS = 100
const DEFAULT_TICK_MS = 100

export class InProcessSimSource<THandle = unknown> implements TelemetrySource {
  readonly kind = 'IN_PROCESS' as const

  private readonly scheduler: IntervalScheduler<THandle>
  private readonly tickMs: number
  private readonly frameListeners = new Set<(frames: TelemetryFrame[], simT: SimTimeMs) => void>()
  private readonly statusListeners = new Set<(s: SourceStatus) => void>()

  private simulator: Simulator
  private scenarioId: ScenarioId
  private speed: number
  private simT: SimTimeMs = 0
  private backfilled = false
  private stopTimer: (() => void) | null = null

  constructor(options: InProcessSimSourceOptions<THandle>) {
    this.scheduler = options.scheduler
    this.tickMs = Math.max(MIN_TICK_MS, options.tickMs ?? DEFAULT_TICK_MS)
    this.scenarioId = options.scenarioId ?? 'demo_main'
    const scenario = getScenario(this.scenarioId)
    this.simulator = new Simulator(scenario, options.seed !== undefined ? { seed: options.seed } : {})
    this.speed = clampSpeed(options.speed ?? 1)
  }

  onFrames(cb: (frames: TelemetryFrame[], simT: SimTimeMs) => void): () => void {
    this.frameListeners.add(cb)
    return () => {
      this.frameListeners.delete(cb)
    }
  }

  onStatus(cb: (s: SourceStatus) => void): () => void {
    this.statusListeners.add(cb)
    return () => {
      this.statusListeners.delete(cb)
    }
  }

  getStatus(): SourceStatus {
    return {
      running: this.stopTimer !== null,
      simT: this.simT,
      day: dayOf(this.simT),
      speed: this.speed,
      scenarioId: this.scenarioId,
    }
  }

  getSimulator(): Simulator {
    return this.simulator
  }

  start(): void {
    if (this.stopTimer !== null) return
    this.ensureBackfillEmitted()
    const handle = this.scheduler.setInterval(() => this.tick(), this.tickMs)
    this.stopTimer = () => this.scheduler.clearInterval(handle)
    this.emitStatus()
  }

  pause(): void {
    if (this.stopTimer === null) return
    this.stopTimer()
    this.stopTimer = null
    this.emitStatus()
  }

  reset(): void {
    this.stopInternal()
    this.simulator.reset()
    this.simT = 0
    this.backfilled = false
    this.emitStatus()
  }

  setSpeed(speedMultiplier: number): void {
    this.speed = clampSpeed(speedMultiplier)
    this.emitStatus()
  }

  setScenario(id: ScenarioId, seed?: number): void {
    this.stopInternal()
    this.scenarioId = id
    const scenario = getScenario(id)
    this.simulator = new Simulator(scenario, seed !== undefined ? { seed } : {})
    this.simT = 0
    this.backfilled = false
    this.emitStatus()
  }

  seekToBookmark(index: number): void {
    const bookmark = this.simulator.scenario.bookmarks?.[index]
    if (!bookmark) return

    if (bookmark.t < this.simT) {
      this.simulator.reset()
      this.simT = 0
      this.backfilled = false
    }

    this.ensureBackfillEmitted()
    if (bookmark.t > this.simT) {
      const frames = this.simulator.advanceTo(bookmark.t)
      this.simT = bookmark.t
      if (frames.length > 0) {
        this.emitFrames(frames, this.simT)
      }
    }
    this.emitStatus()
  }

  private ensureBackfillEmitted(): void {
    if (this.backfilled) return
    this.backfilled = true
    const frames = this.simulator.backfill(this.simulator.scenario.backfillDays)
    if (frames.length > 0) {
      this.emitFrames(frames, 0)
    }
  }

  private tick(): void {
    const dtSim = this.tickMs * speedToSimMsPerRealMs(this.speed)
    const targetT = this.simT + dtSim
    const frames = this.simulator.advanceTo(targetT)
    this.simT = targetT
    if (frames.length > 0) {
      this.emitFrames(frames, this.simT)
    }
    this.emitStatus()
  }

  private stopInternal(): void {
    if (this.stopTimer !== null) {
      this.stopTimer()
      this.stopTimer = null
    }
  }

  private emitFrames(frames: TelemetryFrame[], simT: SimTimeMs): void {
    for (const listener of this.frameListeners) {
      listener(frames, simT)
    }
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const listener of this.statusListeners) {
      listener(status)
    }
  }
}
