// Mock motor (Faz 1 §3.5): gerçek motorla AYNI EngineClient arayüzü ve mesaj protokolü.
// Kişi A, Faz 2–7 bitmeden kokpiti bununla geliştirir; Faz 3'te gerçek engineClient'a geçiş UI'da değişiklik gerektirmez.
//
// Buradaki sayılar SAHTE GÖSTERİM VERİSİDİR — eşik değildir, hiçbir karar vermez.
// Gürültü deterministiktir (oransız sinüslerin toplamı): Math.random yok (PROJECT_MEMORY §10), aynı akış her seferinde aynı.
// Hız ve sim zamanı Evidence'tan (sim.speed.min/max, sim.secondsPerSimDay).
import { getNumber } from '@/core/evidence/registry'
import type {
  ActionCard,
  Alert,
  AlertEvent,
  CrewId,
  MetricId,
  SourceStatus,
  StateEstimate,
} from '@/core/types'
import { MIN_PER_DAY, minToMs, msToDays, msToMin, MS_PER_DAY, MS_PER_SEC, VITALS_INTERVAL_MIN } from '@/core/units'
import type { EngineClient, EngineListener } from '@/store/engineClient'
import {
  latestKey,
  type ChartFrame,
  type EngineSnapshot,
  type UiToWorkerMessage,
  type WorkerToUiMessage,
} from '@/workers/protocol'

/** Enjekte edilebilir zamanlayıcı: `every` iptal fonksiyonu döner (testte sahte zamanlayıcı). */
export interface MockScheduler {
  every(intervalMs: number, callback: () => void): () => void
}

const browserScheduler: MockScheduler = {
  every(intervalMs, callback) {
    const handle = setInterval(callback, intervalMs)
    return () => clearInterval(handle)
  },
}

export interface MockEngineOptions {
  scheduler?: MockScheduler
  /** Batch aralığı; ≤ 10 Hz (PROJECT_MEMORY §10). */
  tickMs?: number
}

const DEFAULT_TICK_MS = 100

// --- SAHTE gösterim verisi (eşik DEĞİL) ---
const MOCK_CREW: readonly { id: CrewId; phase: number; hr: number; spo2: number; hrv: number }[] = [
  { id: 'cdr', phase: 0.3, hr: 58, spo2: 97.6, hrv: 62 },
  { id: 'md', phase: 1.1, hr: 62, spo2: 97.9, hrv: 55 },
  { id: 'eng', phase: 2.2, hr: 66, spo2: 97.3, hrv: 48 },
  { id: 'sci', phase: 3.4, hr: 70, spo2: 97.7, hrv: 44 },
]
const MOCK_DOSE_RATE_MSV_DAY = 0.35
const MOCK_SPE_DOSE_MULTIPLIER = 6
const MOCK_SLEEP_ALERT_DAY = 1
const MOCK_SPE_DAY = 2

/** Deterministik sözde-gürültü, yaklaşık [-1, 1]. */
const wobble = (t: number, phase: number): number => {
  const m = msToMin(t)
  return (
    0.6 * Math.sin(m / 37 + phase) + 0.3 * Math.sin(m / 11.3 + 2 * phase) + 0.1 * Math.sin(m / 3.7)
  )
}

/** Gün içi ritim, [-1, 1]. */
const circadian = (t: number, phase: number): number =>
  Math.sin((2 * Math.PI * (msToMin(t) % MIN_PER_DAY)) / MIN_PER_DAY + phase)

export class MockEngine implements EngineClient {
  private readonly listeners = new Set<EngineListener>()
  private readonly scheduler: MockScheduler
  private readonly tickMs: number
  private stopTimer: (() => void) | null = null
  private scenarioId = 'demo_main'
  private speed = 1
  private simT = 0
  private nextFrameT = 0
  private alerts: Alert[] = []
  private cards: ActionCard[] = []
  private readonly latest: Record<string, number> = {}
  private disposed = false

  constructor(options: MockEngineOptions = {}) {
    this.scheduler = options.scheduler ?? browserScheduler
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.stop()
    this.listeners.clear()
    this.disposed = true
  }

  send(message: UiToWorkerMessage): void {
    if (this.disposed) return
    switch (message.type) {
      case 'INIT':
        this.scenarioId = message.scenarioId
        this.speed = this.clampSpeed(message.speed)
        this.resetState()
        this.emit({ type: 'READY' })
        this.emitStatus()
        this.emit({ type: 'SNAPSHOT', snapshot: this.snapshot() })
        return
      case 'START':
        if (!this.stopTimer) this.stopTimer = this.scheduler.every(this.tickMs, () => this.tick())
        this.emitStatus()
        return
      case 'PAUSE':
        this.stop()
        this.emitStatus()
        return
      case 'RESET':
        this.stop()
        this.resetState()
        this.emitStatus()
        this.emit({ type: 'SNAPSHOT', snapshot: this.snapshot() })
        return
      case 'SET_SPEED':
        this.speed = this.clampSpeed(message.speedMultiplier)
        this.emitStatus()
        return
      case 'SET_SCENARIO':
        this.stop()
        this.scenarioId = message.id
        this.resetState()
        this.emitStatus()
        this.emit({ type: 'SNAPSHOT', snapshot: this.snapshot() })
        return
      case 'SEEK_BOOKMARK':
        // Mock: bookmark i → gün i başı.
        this.simT = Math.max(this.simT, message.index * MS_PER_DAY)
        this.nextFrameT = this.simT
        this.emitStatus()
        return
      case 'ACK_ALERT':
        this.ackAlert(message.alertId)
        return
      case 'ACCEPT_ACTION':
        this.setCardState(message.cardId, 'ACCEPTED')
        return
      case 'DISMISS_ACTION':
        this.setCardState(message.cardId, 'DISMISSED')
        return
      case 'COMPLETE_ACTION':
        this.setCardState(message.cardId, 'DONE')
        return
      case 'REQUEST_VALIDATION':
        this.emit({ type: 'VALIDATION_PROGRESS', done: 1, total: 1 })
        this.emit({
          type: 'VALIDATION_RESULT',
          report: { mock: true, limitations: ['Mock motor: gerçek doğrulama Faz 8.'] },
        })
        return
      case 'SUBMIT_CHECKIN':
      case 'SUBMIT_PVT':
      case 'SET_EARTH_LINK':
      case 'SET_CONSENT':
      case 'GROUND_REPLY':
      case 'CANCEL_VALIDATION':
        // Mock'ta etkisiz (gerçek davranış Faz 6–8).
        return
      default: {
        const unhandled: never = message
        this.emit({ type: 'ERROR', code: 'UNKNOWN_MESSAGE', message: JSON.stringify(unhandled) })
      }
    }
  }

  private emit(message: WorkerToUiMessage): void {
    for (const listener of this.listeners) listener(message)
  }

  private emitStatus(): void {
    this.emit({ type: 'STATUS', status: this.status() })
  }

  private status(): SourceStatus {
    return {
      running: this.stopTimer !== null,
      simT: this.simT,
      day: Math.floor(msToDays(this.simT)),
      speed: this.speed,
      scenarioId: this.scenarioId,
    }
  }

  private clampSpeed(speed: number): number {
    return Math.min(getNumber('sim.speed.max'), Math.max(getNumber('sim.speed.min'), speed))
  }

  private stop(): void {
    this.stopTimer?.()
    this.stopTimer = null
  }

  private resetState(): void {
    this.simT = 0
    this.nextFrameT = 0
    this.alerts = []
    this.cards = []
    for (const key of Object.keys(this.latest)) delete this.latest[key]
  }

  /** 1× = 1 sim-gün / sim.secondsPerSimDay gerçek saniye (PROJECT_MEMORY §6). */
  private simMsPerTick(): number {
    return (this.speed * MS_PER_DAY * this.tickMs) / (getNumber('sim.secondsPerSimDay') * MS_PER_SEC)
  }

  private tick(): void {
    const targetT = this.simT + this.simMsPerTick()
    const frames: ChartFrame[] = []
    const step = minToMs(VITALS_INTERVAL_MIN)
    while (this.nextFrameT <= targetT) {
      frames.push(...this.framesAt(this.nextFrameT))
      this.nextFrameT += step
    }
    this.simT = targetT
    const alertEvents = this.openScheduledAlerts()

    if (frames.length > 0) this.emit({ type: 'FRAMES_BATCH', frames })
    this.emit({
      type: 'ENGINE_OUTPUT',
      output: {
        t: this.simT,
        ...(alertEvents.length > 0 ? { alertEvents } : {}),
        states: this.states(),
        cards: this.cards,
        dataQualityCount: 0,
      },
    })
    this.emitStatus()
  }

  private framesAt(t: number): ChartFrame[] {
    const speActive = msToDays(t) >= MOCK_SPE_DAY && msToDays(t) < MOCK_SPE_DAY + 0.5
    const frames: ChartFrame[] = []
    for (const crew of MOCK_CREW) {
      const values: [MetricId, number][] = [
        ['hr', crew.hr + 6 * circadian(t, crew.phase) + 2 * wobble(t, crew.phase)],
        ['spo2', crew.spo2 + 0.4 * wobble(t, crew.phase + 1)],
        ['hrv', crew.hrv - 5 * circadian(t, crew.phase) + 3 * wobble(t, crew.phase + 2)],
        [
          'rad.doseRateMsvDay',
          MOCK_DOSE_RATE_MSV_DAY * (speActive ? MOCK_SPE_DOSE_MULTIPLIER : 1) +
            0.02 * wobble(t, crew.phase + 3),
        ],
      ]
      for (const [metric, value] of values) {
        frames.push({ t, crewId: crew.id, metric, value })
        this.latest[latestKey(crew.id, metric)] = value
      }
    }
    return frames
  }

  private openScheduledAlerts(): AlertEvent[] {
    const events: AlertEvent[] = []
    const day = msToDays(this.simT)
    if (day >= MOCK_SLEEP_ALERT_DAY && !this.alerts.some((a) => a.id === 'mock-sleep-cdr')) {
      const alert: Alert = {
        id: 'mock-sleep-cdr',
        crewId: 'cdr',
        kind: 'STATE',
        severity: 'ADVISORY',
        state: 'sleep_debt',
        metric: 'sleep.durationH',
        titleKey: 'alert.sleep_debt.title',
        whyKeys: [{ key: 'why.sleep.belowBaseline', params: { valueH: 4.6, baselineH: 6.8, z: -3.4 } }],
        evidenceIds: ['det.trend.sleep.minDays', 'det.trend.sleep.hoursBelow'],
        suggestedActionIds: ['ACT_SLEEP_SHIFT', 'ACT_LIGHT_CONTROL'],
        earthDelayClass: 'CAN_WAIT_FOR_EARTH',
        timeToHarmMin: getNumber('earth.timeToHarmMin.sleep_debt'),
        confidence: 0.9,
        status: 'ACTIVE',
        firstSeenT: this.simT,
        lastSeenT: this.simT,
      }
      this.alerts.push(alert)
      this.cards.push(this.cardFor(alert, 'card-sleep-shift-cdr', 'ACT_SLEEP_SHIFT', 2))
      events.push({ type: 'OPENED', alert, t: this.simT })
    }
    if (day >= MOCK_SPE_DAY && !this.alerts.some((a) => a.id === 'mock-spe-sci')) {
      const alert: Alert = {
        id: 'mock-spe-sci',
        crewId: 'sci',
        kind: 'RADIATION',
        severity: 'CRITICAL',
        state: 'radiation_event',
        metric: 'rad.doseRateMsvDay',
        titleKey: 'alert.radiation_event.title',
        whyKeys: [{ key: 'why.radiation.rateRatio', params: { ratio: MOCK_SPE_DOSE_MULTIPLIER } }],
        evidenceIds: ['rad.spe.detect.ratio', 'rad.spe.limit.msv', 'noaa.s1.proton_flux.pfu'],
        suggestedActionIds: ['ACT_SHELTER', 'ACT_DOSE_CHECK'],
        earthDelayClass: 'ACT_NOW',
        timeToHarmMin: getNumber('earth.timeToHarmMin.radiation_event'),
        confidence: 1,
        status: 'ACTIVE',
        firstSeenT: this.simT,
        lastSeenT: this.simT,
      }
      this.alerts.push(alert)
      this.cards.unshift(this.cardFor(alert, 'card-shelter-sci', 'ACT_SHELTER', 1))
      events.push({ type: 'OPENED', alert, t: this.simT })
    }
    return events
  }

  private cardFor(alert: Alert, id: string, actionId: string, priority: number): ActionCard {
    return {
      id,
      actionId,
      crewId: alert.crewId,
      priority,
      earthDelayClass: alert.earthDelayClass,
      titleKey: `action.${actionId}.title`,
      stepKeys: [`action.${actionId}.step1`, `action.${actionId}.step2`],
      whyKeys: alert.whyKeys,
      sourceAlertIds: [alert.id],
      evidenceIds: alert.evidenceIds,
      state: 'SUGGESTED',
    }
  }

  private states(): StateEstimate[] {
    const day = msToDays(this.simT)
    return MOCK_CREW.map((crew) => {
      const sleepScore = crew.id === 'cdr' && day >= MOCK_SLEEP_ALERT_DAY ? 0.62 : 0.12
      return {
        crewId: crew.id,
        t: this.simT,
        state: 'sleep_debt',
        score: sleepScore,
        confidence: 0.9,
        contributors: [
          { metric: 'sleep.durationH', weight: 0.6, z: -2.1, contribution: 0.6 * sleepScore },
          { metric: 'sleep.midpointShiftMin', weight: 0.4, z: 0.8, contribution: 0.4 * sleepScore },
        ],
      }
    })
  }

  private ackAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId)
    if (!alert || alert.status !== 'ACTIVE') return
    alert.status = 'ACKED'
    alert.ackT = this.simT
    this.emit({
      type: 'ENGINE_OUTPUT',
      output: { t: this.simT, alertEvents: [{ type: 'ACKED', alert, t: this.simT }], dataQualityCount: 0 },
    })
  }

  private setCardState(cardId: string, state: ActionCard['state']): void {
    const card = this.cards.find((c) => c.id === cardId)
    if (!card) return
    card.state = state
    this.emit({ type: 'ENGINE_OUTPUT', output: { t: this.simT, cards: this.cards, dataQualityCount: 0 } })
  }

  private snapshot(): EngineSnapshot {
    return {
      t: this.simT,
      latest: { ...this.latest },
      activeAlerts: this.alerts.filter((a) => a.status !== 'RESOLVED'),
      states: this.states(),
      cards: this.cards,
      dataQualityCount: 0,
    }
  }
}
