import { describe, expect, it } from 'vitest'
import {
  applyAdjustments,
  BLOCK_PRIORITY,
  blocksOverlap,
  buildBaseSchedule,
} from '@/core/decision/planner'
import { getNumber } from '@/core/evidence/registry'
import type { CrewProfile } from '@/core/types/crew'
import type { DaySchedule, ScheduleBlock } from '@/core/types/schedule'

const CREW: CrewProfile = {
  id: 'CREW_01',
  displayName: 'Alex',
  role: 'CDR',
  ageBand: '30-39',
  priorCareerDoseMsv: 120,
  baselines: {},
  circadianAmplitudeHr: 5,
  sleepWindow: { startMin: 1320, durationMin: 480 }, // 22:00 - 06:00 (gece yarısı sarma)
}

function sumTypeDuration(blocks: readonly ScheduleBlock[], type: ScheduleBlock['type']): number {
  return blocks.filter((b) => b.type === type).reduce((sum, b) => sum + b.durationMin, 0)
}

describe('Planner (Faz 7 §3.2)', () => {
  it('buildBaseSchedule gece yarısını saran sleepWindow ile çakışmasız baz takvim üretir', () => {
    const base = buildBaseSchedule(CREW, 1)
    expect(base.day).toBe(1)
    expect(base.crewId).toBe('CREW_01')
    expect(sumTypeDuration(base.blocks, 'SLEEP')).toBe(480)
    expect(base.blocks.some((b) => b.type === 'WORK')).toBe(true)
    expect(base.blocks.some((b) => b.type === 'EXERCISE_RESISTIVE')).toBe(true)
    expect(base.blocks.some((b) => b.type === 'COMMS')).toBe(true)

    for (let i = 0; i < base.blocks.length; i += 1) {
      for (let j = i + 1; j < base.blocks.length; j += 1) {
        const a = base.blocks[i]
        const b = base.blocks[j]
        if (!a || !b) continue
        expect(blocksOverlap(a, b), `${a.id} vs ${b.id}`).toBe(false)
      }
    }
  })

  it('ACT_REST_BLOCK eklendiğinde REST bloğu ekler ve baz takvimi mutate etmez', () => {
    const base = buildBaseSchedule(CREW, 1)
    const snapshot = JSON.stringify(base)

    const res = applyAdjustments(base, [{ actionId: 'ACT_REST_BLOCK', byAlertId: 'AL_FATIGUE' }])

    expect(JSON.stringify(base)).toBe(snapshot)
    const addedRest = res.schedule.blocks.find((b) => b.id.includes('-adj-rest-'))
    expect(addedRest).toBeDefined()
    expect(addedRest?.durationMin).toBe(getNumber('plan.rest.durationMin'))
    expect(res.diff.some((d) => d.change === 'ADDED' && d.byAlertId === 'AL_FATIGUE')).toBe(true)
  })

  it('ACT_REDUCE_WORKLOAD WORK yoğunluğunu LOW yapar, süresini kısaltır ve direnç egzersizini kaldırmaz (LOW)', () => {
    const base = buildBaseSchedule(CREW, 1)
    const res = applyAdjustments(base, [{ actionId: 'ACT_REDUCE_WORKLOAD', byAlertId: 'AL_WORK' }])

    const resistive = res.schedule.blocks.filter((b) => b.type === 'EXERCISE_RESISTIVE')
    expect(resistive.length).toBeGreaterThanOrEqual(1)
    expect(resistive.every((b) => b.intensity === 'LOW')).toBe(true)

    const works = res.schedule.blocks.filter((b) => b.type === 'WORK')
    expect(works.every((b) => b.intensity === 'LOW')).toBe(true)
    expect(sumTypeDuration(res.schedule.blocks, 'WORK')).toBeLessThan(
      sumTypeDuration(base.blocks, 'WORK'),
    )
  })

  it('ACT_SLEEP_SHIFT uyku penceresini kaydırır ve uzatır', () => {
    const base = buildBaseSchedule(CREW, 1)
    const baseSleep = base.blocks.find((b) => b.type === 'SLEEP')!
    const res = applyAdjustments(base, [{ actionId: 'ACT_SLEEP_SHIFT', byAlertId: 'AL_SLEEP' }])
    const nextSleep = res.schedule.blocks.find((b) => b.type === 'SLEEP')!

    const shiftMin = getNumber('plan.sleepShiftMin')
    expect(nextSleep.startMin).toBe((baseSleep.startMin - shiftMin + 1440) % 1440)
    expect(nextSleep.durationMin).toBe(baseSleep.durationMin + shiftMin)
  })

  it('ACT_HYDRATE plan.hydrate.extraBlocks kadar HYDRATION ekler ve hedefi hydration.max.L üst sınırında tutar', () => {
    const base = buildBaseSchedule(CREW, 1)
    const maxL = getNumber('hydration.max.L')
    const extraCount = getNumber('plan.hydrate.extraBlocks')

    const baseHydCount = base.blocks.filter((b) => b.type === 'HYDRATION').length
    const resNormal = applyAdjustments(base, [{ actionId: 'ACT_HYDRATE', byAlertId: 'AL_HYD' }], {
      baselineHydrationL: 2.0,
    })
    const hydBlocks = resNormal.schedule.blocks.filter((b) => b.type === 'HYDRATION')
    expect(hydBlocks).toHaveLength(baseHydCount + extraCount)
    expect(resNormal.hydrationTargetL).toBeGreaterThan(2.0)
    expect(resNormal.hydrationTargetL).toBeLessThanOrEqual(maxL)

    const resCapped = applyAdjustments(base, [{ actionId: 'ACT_HYDRATE' }], {
      baselineHydrationL: maxL - 0.1,
    })
    expect(resCapped.hydrationTargetL).toBe(maxL)
  })

  it('ACT_SHELTER kilitsiz egzersiz/EVA/WORK bloklarını iptal eder, SHELTER ekler ve kilitli bloğa dokunmaz', () => {
    const base = buildBaseSchedule(CREW, 1)
    const customBase: DaySchedule = {
      ...base,
      blocks: base.blocks.map((b) => (b.id === 'd1-work-1' ? { ...b, locked: true } : b)),
    }

    const res = applyAdjustments(customBase, [{ actionId: 'ACT_SHELTER', byAlertId: 'AL_SPE' }])

    expect(res.schedule.blocks.some((b) => b.type === 'EVA')).toBe(false)
    expect(res.schedule.blocks.some((b) => b.type === 'EXERCISE_AERO')).toBe(false)
    expect(res.schedule.blocks.some((b) => b.type === 'EXERCISE_RESISTIVE')).toBe(false)
    expect(res.schedule.blocks.some((b) => b.type === 'SHELTER')).toBe(true)
    expect(res.schedule.blocks.some((b) => b.id === 'd1-work-1')).toBe(true)
    expect(res.diff.some((d) => d.change === 'CONFLICT' && d.blockId === 'd1-work-1')).toBe(true)
  })

  it('düşük öncelikli blok yüksek öncelikli blok ile çakışırsa yüksek öncelikli korunur (SHELTER > SLEEP > ... > WORK)', () => {
    expect(BLOCK_PRIORITY.SHELTER).toBeGreaterThan(BLOCK_PRIORITY.SLEEP)
    expect(BLOCK_PRIORITY.SLEEP).toBeGreaterThan(BLOCK_PRIORITY.HYDRATION)
    expect(BLOCK_PRIORITY.HYDRATION).toBeGreaterThan(BLOCK_PRIORITY.REST)
    expect(BLOCK_PRIORITY.REST).toBeGreaterThan(BLOCK_PRIORITY.WORK)

    const base: DaySchedule = {
      day: 2,
      crewId: 'CREW_01',
      blocks: [
        {
          id: 'sleep-1',
          type: 'SLEEP',
          startMin: 0,
          durationMin: 480,
          intensity: 'LOW',
          locked: false,
        },
        {
          id: 'work-1',
          type: 'WORK',
          startMin: 480,
          durationMin: 240,
          intensity: 'MED',
          locked: false,
        },
      ],
    }

    // SLEEP saat 08:00'e kadar uzatılınca WORK'ü ileri iter veya kısaltır; SLEEP tam kalır.
    const res = applyAdjustments(
      base,
      [
        {
          actionId: 'ACT_SLEEP_SHIFT',
          effectsOverride: [{ op: 'EXTEND', target: 'SLEEP', durationMinParamId: 'plan.rest.durationMin' }],
        },
      ],
      { baselineSleepMin: 480 },
    )

    const sleep = res.schedule.blocks.find((b) => b.id === 'sleep-1')!
    const work = res.schedule.blocks.find((b) => b.id === 'work-1')!
    expect(sleep.durationMin).toBe(480 + getNumber('plan.rest.durationMin'))
    expect(blocksOverlap(sleep, work)).toBe(false)
  })

  it('güvenlik tabanları: uyku plan.sleep.minFractionOfBaseline altına düşmez ve haftada kalan 0 ise direnç egzersizi korunur', () => {
    const minFraction = getNumber('plan.sleep.minFractionOfBaseline')
    const base: DaySchedule = {
      day: 3,
      crewId: 'CREW_01',
      blocks: [
        {
          id: 'sleep-core',
          type: 'SLEEP',
          startMin: 0,
          durationMin: 450,
          intensity: 'LOW',
          locked: false,
        },
        {
          id: 'res-1',
          type: 'EXERCISE_RESISTIVE',
          startMin: 600,
          durationMin: 60,
          intensity: 'HIGH',
          locked: false,
        },
      ],
    }

    const res = applyAdjustments(
      base,
      [
        {
          actionId: 'ACT_REDUCE_WORKLOAD',
          effectsOverride: [
            { op: 'SHORTEN', target: 'SLEEP', durationMinParamId: 'plan.rest.durationMin' },
            { op: 'REMOVE', targets: ['EXERCISE_RESISTIVE'] },
          ],
        },
      ],
      { baselineSleepMin: 480, remainingWeeklyResistiveSessions: 0 },
    )

    const sleep = res.schedule.blocks.find((b) => b.id === 'sleep-core')!
    expect(sleep.durationMin).toBeGreaterThanOrEqual(480 * minFraction)
    expect(res.schedule.blocks.some((b) => b.type === 'EXERCISE_RESISTIVE')).toBe(true)
    expect(res.diff.some((d) => d.reasonKey === 'plan.diff.sleepFloorProtected')).toBe(true)
    expect(res.diff.some((d) => d.reasonKey === 'plan.diff.resistiveFloorProtected')).toBe(true)
  })
})
