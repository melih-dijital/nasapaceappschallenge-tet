// Deterministik telemetri simülatörü (FAZ_02 §3.8). Saf TS, DOM/Math.random/Date.now yok.
import type {
  CrewId,
  CrewProfile,
  ExpectedDetection,
  SimTimeMs,
  TelemetryFrame,
} from '../core/types'
import {
  MS_PER_DAY,
  MS_PER_MIN,
  RADIATION_INTERVAL_MIN,
  VITALS_INTERVAL_MIN,
  minToMs,
} from '../core/units'
import { getCalibrationData, type CalibrationData } from './calibration'
import { generateCrew } from './crew'
import { SIM_DEMO_DEFAULTS } from './defaults'
import {
  createInitialCrewState,
  generateDailyFrame,
  generateRadiationFrame,
  generateVitalsFrame,
  type CrewSimState,
} from './generators'
import { Rng } from './rng'
import {
  EMPTY_ACTIVE_EFFECTS,
  resolveActiveEffects,
  type Scenario,
  type ScenarioEvent,
} from './scenario'

export interface SimulatorOptions {
  seed?: number
  calibration?: CalibrationData
}

export interface GroundTruth {
  events: readonly ScenarioEvent[]
  expected: readonly ExpectedDetection[]
}

export interface UserDailySubmission {
  mood?: { stress: number; mood: number; motivation: number }
  pvt?: { medianMs: number; lapses: number }
}

const VITALS_STEP_MS = minToMs(VITALS_INTERVAL_MIN)
const RAD_STEP_MS = minToMs(RADIATION_INTERVAL_MIN)

/** Gün d'nin gün sonu çerçeve zamanı: (d + 1) * MS_PER_DAY - 1 dk (backfill d<0 iken t<0 sağlar). */
export function dailyFrameTimeForDay(day: number): SimTimeMs {
  return (day + 1) * MS_PER_DAY - MS_PER_MIN
}

interface CrewRngBundle {
  vitals: Rng
  radiation: Rng
  daily: Rng
}

export class Simulator {
  readonly scenario: Scenario
  private seed: number
  private readonly calibration: CalibrationData
  private crew: CrewProfile[] = []
  private crewStates = new Map<CrewId, CrewSimState>()
  private crewRngs = new Map<CrewId, CrewRngBundle>()
  private cabinRng!: Rng
  private cabinCo2Dev = 0

  private cursorT: SimTimeMs = 0
  private nextVitalsT: SimTimeMs = 0
  private nextRadT: SimTimeMs = 0
  private nextDailyDay = 0
  private backfilled = false
  private userSubmissions = new Map<string, UserDailySubmission>()

  constructor(scenario: Scenario, options: SimulatorOptions = {}) {
    this.scenario = scenario
    this.seed = options.seed ?? scenario.seed
    this.calibration = options.calibration ?? getCalibrationData()
    this.initInternalState()
  }

  private initInternalState(): void {
    const rootRng = new Rng(this.seed)
    this.crew = generateCrew(this.seed, this.scenario.crewCount, this.calibration)
    this.crewStates = new Map()
    this.crewRngs = new Map()

    for (const member of this.crew) {
      this.crewStates.set(member.id, createInitialCrewState())
      const memberRoot = rootRng.fork(`stream:${member.id}`)
      this.crewRngs.set(member.id, {
        vitals: memberRoot.fork('vitals'),
        radiation: memberRoot.fork('radiation'),
        daily: memberRoot.fork('daily'),
      })
    }

    this.cabinRng = rootRng.fork('cabin')
    this.cabinCo2Dev = 0
    this.cursorT = 0
    this.nextVitalsT = 0
    this.nextRadT = 0
    this.nextDailyDay = 0
    this.backfilled = false
    this.userSubmissions.clear()
  }

  recordUserSubmission(crewId: CrewId, day: number, sub: UserDailySubmission): void {
    const key = `${crewId}|${day}`
    const prev = this.userSubmissions.get(key)
    this.userSubmissions.set(key, {
      ...(prev?.mood ? { mood: prev.mood } : {}),
      ...(prev?.pvt ? { pvt: prev.pvt } : {}),
      ...(sub.mood ? { mood: { ...sub.mood } } : {}),
      ...(sub.pvt ? { pvt: { ...sub.pvt } } : {}),
    })
  }

  reset(seed?: number): void {
    if (seed !== undefined) {
      this.seed = seed
    }
    this.initInternalState()
  }

  getSeed(): number {
    return this.seed
  }

  getCrew(): readonly CrewProfile[] {
    return this.crew
  }

  getCurrentT(): SimTimeMs {
    return this.cursorT
  }

  getActiveEvents(t: SimTimeMs): ScenarioEvent[] {
    return this.scenario.events.filter((event) => event.fromT <= t && t < event.toT)
  }

  getGroundTruth(): GroundTruth {
    return {
      events: this.scenario.events,
      expected: this.scenario.expected,
    }
  }

  /**
   * Olaysız geçmişi anında üretir: t ∈ [-days * MS_PER_DAY, 0), daily.day = -days .. -1.
   * PROJECT_MEMORY §6: backfill yalnızca T0 öncesini doldurur ve AR(1) durumunu t=0'a taşır.
   */
  backfill(days: number = this.scenario.backfillDays): TelemetryFrame[] {
    if (this.backfilled || days <= 0) return []
    if (this.cursorT > 0) {
      throw new Error('Simulator.backfill: aktif akış başladıktan sonra backfill çağrılamaz')
    }
    this.backfilled = true

    const startT = -days * MS_PER_DAY
    const frames = this.produceRange(startT, 0, -days, 0, true)
    this.nextVitalsT = 0
    this.nextRadT = 0
    this.nextDailyDay = 0
    this.cursorT = 0
    return frames
  }

  /** Son cursorT'den hedef t'ye kadar düşen tüm çerçeveleri zaman sıralı üretir. */
  advanceTo(t: SimTimeMs): TelemetryFrame[] {
    if (t <= this.cursorT) return []

    const frames: TelemetryFrame[] = []
    while (true) {
      const candVitals = this.nextVitalsT < t ? this.nextVitalsT : Number.POSITIVE_INFINITY
      const candRad = this.nextRadT < t ? this.nextRadT : Number.POSITIVE_INFINITY
      const dailyT = dailyFrameTimeForDay(this.nextDailyDay)
      const candDaily = dailyT < t ? dailyT : Number.POSITIVE_INFINITY

      const minT = Math.min(candVitals, candRad, candDaily)
      if (!Number.isFinite(minT)) break

      if (candVitals === minT) {
        frames.push(...this.emitVitalsAt(minT, false))
        this.nextVitalsT += VITALS_STEP_MS
      }
      if (candRad === minT) {
        frames.push(...this.emitRadiationAt(minT, false))
        this.nextRadT += RAD_STEP_MS
      }
      if (candDaily === minT) {
        frames.push(...this.emitDailyAt(minT, this.nextDailyDay, false))
        this.nextDailyDay += 1
      }
    }

    this.cursorT = t
    return frames
  }

  private produceRange(
    startT: SimTimeMs,
    endT: SimTimeMs,
    startDay: number,
    endDay: number,
    eventFree: boolean,
  ): TelemetryFrame[] {
    const frames: TelemetryFrame[] = []
    let vitalsT = startT
    let radT = startT
    let day = startDay

    while (true) {
      const candVitals = vitalsT < endT ? vitalsT : Number.POSITIVE_INFINITY
      const candRad = radT < endT ? radT : Number.POSITIVE_INFINITY
      const dailyT = day < endDay ? dailyFrameTimeForDay(day) : Number.POSITIVE_INFINITY

      const minT = Math.min(candVitals, candRad, dailyT)
      if (!Number.isFinite(minT)) break

      if (candVitals === minT) {
        frames.push(...this.emitVitalsAt(minT, eventFree))
        vitalsT += VITALS_STEP_MS
      }
      if (candRad === minT) {
        frames.push(...this.emitRadiationAt(minT, eventFree))
        radT += RAD_STEP_MS
      }
      if (dailyT === minT) {
        frames.push(...this.emitDailyAt(minT, day, eventFree))
        day += 1
      }
    }
    return frames
  }

  private emitVitalsAt(t: SimTimeMs, eventFree: boolean): TelemetryFrame[] {
    const out: TelemetryFrame[] = []
    for (const member of this.crew) {
      const state = this.crewStates.get(member.id)
      const rngs = this.crewRngs.get(member.id)
      if (!state || !rngs) continue
      const effects = eventFree ? EMPTY_ACTIVE_EFFECTS : resolveActiveEffects(this.scenario.events, member.id, t)
      const result = generateVitalsFrame(state, t, member, rngs.vitals, effects, this.calibration)
      this.crewStates.set(member.id, result.nextState)
      out.push(result.frame)
    }
    return out
  }

  private emitRadiationAt(t: SimTimeMs, eventFree: boolean): TelemetryFrame[] {
    const out: TelemetryFrame[] = []
    for (const member of this.crew) {
      const state = this.crewStates.get(member.id)
      const rngs = this.crewRngs.get(member.id)
      if (!state || !rngs) continue
      const effects = eventFree ? EMPTY_ACTIVE_EFFECTS : resolveActiveEffects(this.scenario.events, member.id, t)
      const result = generateRadiationFrame(
        state,
        t,
        member,
        rngs.radiation,
        effects,
        this.scenario.environment,
        this.calibration,
      )
      this.crewStates.set(member.id, result.nextState)
      out.push(result.frame)
    }
    return out
  }

  private emitDailyAt(t: SimTimeMs, day: number, eventFree: boolean): TelemetryFrame[] {
    const co2Cal = this.calibration.metrics.cabinCo2ppm
    const phi = SIM_DEMO_DEFAULTS.co2CabinPhi
    this.cabinCo2Dev = this.cabinRng.ar1(
      this.cabinCo2Dev,
      0,
      phi,
      co2Cal.withinSd * Math.sqrt(1 - phi * phi),
    )

    const out: TelemetryFrame[] = []
    for (const member of this.crew) {
      const state = this.crewStates.get(member.id)
      const rngs = this.crewRngs.get(member.id)
      if (!state || !rngs) continue
      const effects = eventFree ? EMPTY_ACTIVE_EFFECTS : resolveActiveEffects(this.scenario.events, member.id, t)
      const result = generateDailyFrame(
        state,
        t,
        member,
        rngs.daily,
        effects,
        { day, cabinCo2Deviation: this.cabinCo2Dev },
        this.calibration,
      )
      this.crewStates.set(member.id, result.nextState)
      const userSub = !eventFree ? this.userSubmissions.get(`${member.id}|${day}`) : undefined
      if (userSub) {
        out.push({
          ...result.frame,
          ...(userSub.mood ? { mood: { ...userSub.mood } } : {}),
          ...(userSub.pvt ? { pvt: { ...userSub.pvt } } : {}),
          userSubmitted: true,
        })
      } else {
        out.push(result.frame)
      }
    }
    return out
  }
}
