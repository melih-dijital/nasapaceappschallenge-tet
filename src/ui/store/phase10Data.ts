// FAZ 10 — Planlayıcı önizleme, davranışsal ÖRNEK eğilimler (motor davranış modülü yok; UI'da "sample data"
// etiketiyle gösterilir) ve cihaz-içi günlük yardımcıları. Doğrulama raporu burada ÜRETİLMEZ: src/ui/data/.
import {
  type ActionCard,
  type Alert,
  type CrewId,
  type DaySchedule,
  type JournalEntry,
  type ScenarioId,
  type ScheduleBlock,
  type ScheduleDiffItem,
  type SimTimeMs,
} from '@/core/types'
import { getCrewProfile } from './crewProfiles'

export interface CheckInRecord {
  day: number
  t: SimTimeMs
  stress: number
  mood: number
  motivation: number
  hasJournalNote: boolean
}

export interface PvtRecord {
  day: number
  t: SimTimeMs
  medianMs: number
  lapses: number
  falseStarts: number
}

export interface PassiveProxySummary {
  sleepRegularityIndex: number
  missedExerciseCount: number
  checkInCompliancePct: number
  passiveProxyScore: number
  moodTrendSlope: number
}

export const GROUND_REPLY_TEMPLATE_IDS = [
  'REPLY_GENERIC_ACK',
  'REPLY_SPE_ACK',
  'REPLY_SPO2_ACK',
  'REPLY_SLEEP_ACK',
  'REPLY_FATIGUE_ACK',
  'REPLY_STRESS_ACK',
  'REPLY_DEHYDRATION_ACK',
  'REPLY_CARDIO_ACK',
  'REPLY_MOOD_ACK',
] as const
export type GroundReplyTemplateId = (typeof GROUND_REPLY_TEMPLATE_IDS)[number]

const JOURNAL_STORAGE_PREFIX = 'astro_cockpit_journal_v1_'

export function loadLocalJournals(crewId: CrewId): JournalEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(`${JOURNAL_STORAGE_PREFIX}${crewId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is JournalEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as JournalEntry).id === 'string' &&
        typeof (item as JournalEntry).text === 'string' &&
        typeof (item as JournalEntry).t === 'number',
    )
  } catch {
    return []
  }
}

export function saveLocalJournalEntry(crewId: CrewId, entry: JournalEntry): JournalEntry[] {
  const existing = loadLocalJournals(crewId)
  const next = [entry, ...existing].slice(0, 30)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${JOURNAL_STORAGE_PREFIX}${crewId}`, JSON.stringify(next))
    } catch {
      // Depolama kotası aşımında bellek içi devam edilir
    }
  }
  return next
}

export function buildCrewBaseSchedule(crewId: CrewId, day: number): DaySchedule {
  const profile = getCrewProfile(crewId)
  const sleepStart = profile.sleepWindow.startMin
  const sleepDur = profile.sleepWindow.durationMin
  const blocks: ScheduleBlock[] = [
    {
      id: `${crewId}-sleep-night`,
      type: 'SLEEP',
      startMin: 0,
      durationMin: Math.min(480, sleepDur),
      locked: true,
    },
    {
      id: `${crewId}-meal-bf`,
      type: 'MEAL',
      startMin: 480,
      durationMin: 45,
      locked: true,
    },
    {
      id: `${crewId}-work-am`,
      type: 'WORK',
      startMin: 525,
      durationMin: 180,
      intensity: 'MED',
    },
    {
      id: `${crewId}-ex-aero`,
      type: 'EXERCISE_AERO',
      startMin: 705,
      durationMin: 60,
      intensity: 'HIGH',
    },
    {
      id: `${crewId}-meal-lunch`,
      type: 'MEAL',
      startMin: 765,
      durationMin: 45,
      locked: true,
    },
    {
      id: `${crewId}-eva-ops`,
      type: crewId === 'eng' || crewId === 'cdr' ? 'EVA' : 'WORK',
      startMin: 810,
      durationMin: 150,
      intensity: 'HIGH',
    },
    {
      id: `${crewId}-ex-res`,
      type: 'EXERCISE_RESISTIVE',
      startMin: 960,
      durationMin: 60,
      intensity: 'MED',
    },
    {
      id: `${crewId}-checkin`,
      type: 'PSYCH_CHECKIN',
      startMin: 1020,
      durationMin: 20,
    },
    {
      id: `${crewId}-comms`,
      type: 'COMMS',
      startMin: 1040,
      durationMin: 40,
    },
    {
      id: `${crewId}-meal-dinner`,
      type: 'MEAL',
      startMin: 1080,
      durationMin: 60,
      locked: true,
    },
    {
      id: `${crewId}-rest-pm`,
      type: 'REST',
      startMin: 1140,
      durationMin: Math.max(60, sleepStart - 1140),
    },
    {
      id: `${crewId}-sleep-eve`,
      type: 'SLEEP',
      startMin: sleepStart,
      durationMin: 1440 - sleepStart,
    },
  ]

  return { day, crewId, blocks }
}

function applyCardsToBlocks(
  base: DaySchedule,
  cards: ActionCard[],
  alerts: Alert[],
): { schedule: DaySchedule; diffs: ScheduleDiffItem[] } {
  const blocks: ScheduleBlock[] = base.blocks.map((b) => ({ ...b }))
  const diffs: ScheduleDiffItem[] = []

  const findAlertId = (card: ActionCard): string | undefined =>
    card.sourceAlertIds[0] ?? alerts.find((a) => a.crewId === card.crewId)?.id

  for (const card of cards) {
    if (card.state === 'DISMISSED') continue
    const byAlertId = findAlertId(card)

    if (card.actionId === 'ACT_SHELTER') {
      const evaBlock = blocks.find((b) => b.type === 'EVA' || b.id.endsWith('-eva-ops'))
      if (evaBlock) {
        evaBlock.type = 'SHELTER'
        evaBlock.intensity = 'LOW'
        evaBlock.reasonKey = 'plan.diff.ACT_SHELTER'
        diffs.push({
          blockId: evaBlock.id,
          change: 'ADDED',
          reasonKey: 'plan.diff.ACT_SHELTER',
          byAlertId,
        })
      }
      const aero = blocks.find((b) => b.type === 'EXERCISE_AERO')
      if (aero) {
        aero.intensity = 'LOW'
        diffs.push({
          blockId: aero.id,
          change: 'CONFLICT',
          reasonKey: 'plan.diff.conflictOverlap',
          byAlertId,
        })
      }
    } else if (card.actionId === 'ACT_SLEEP_SHIFT') {
      const eveSleep = blocks.find((b) => b.id.endsWith('-sleep-eve'))
      if (eveSleep) {
        eveSleep.startMin = Math.max(1260, eveSleep.startMin - 30)
        eveSleep.durationMin = 1440 - eveSleep.startMin
        eveSleep.reasonKey = 'plan.diff.ACT_SLEEP_SHIFT'
        diffs.push({
          blockId: eveSleep.id,
          change: 'EXTENDED',
          reasonKey: 'plan.diff.ACT_SLEEP_SHIFT',
          byAlertId,
        })
      }
    } else if (card.actionId === 'ACT_REST_BLOCK') {
      const workAm = blocks.find((b) => b.id.endsWith('-work-am'))
      if (workAm && workAm.durationMin > 60) {
        workAm.durationMin -= 30
        diffs.push({
          blockId: workAm.id,
          change: 'SHORTENED',
          reasonKey: 'plan.diff.ACT_REST_BLOCK',
          byAlertId,
        })
        const restId = `${base.crewId}-rest-added`
        blocks.push({
          id: restId,
          type: 'REST',
          startMin: workAm.startMin + workAm.durationMin,
          durationMin: 30,
          reasonKey: 'plan.diff.ACT_REST_BLOCK',
        })
        diffs.push({
          blockId: restId,
          change: 'ADDED',
          reasonKey: 'plan.diff.ACT_REST_BLOCK',
          byAlertId,
        })
      }
    } else if (card.actionId === 'ACT_REDUCE_WORKLOAD') {
      const res = blocks.find((b) => b.type === 'EXERCISE_RESISTIVE')
      if (res) {
        res.intensity = 'LOW'
        res.reasonKey = 'plan.diff.resistiveFloorProtected'
        diffs.push({
          blockId: res.id,
          change: 'INTENSITY',
          reasonKey: 'plan.diff.resistiveFloorProtected',
          byAlertId,
        })
      }
    } else if (card.actionId === 'ACT_HYDRATE') {
      const hydId = `${base.crewId}-hydrate-added`
      if (!blocks.some((b) => b.id === hydId)) {
        blocks.push({
          id: hydId,
          type: 'HYDRATION',
          startMin: 690,
          durationMin: 15,
          reasonKey: 'plan.diff.ACT_HYDRATE',
        })
        diffs.push({
          blockId: hydId,
          change: 'ADDED',
          reasonKey: 'plan.diff.ACT_HYDRATE',
          byAlertId,
        })
      }
    } else if (card.actionId === 'ACT_COMMS_FAMILY') {
      const comms = blocks.find((b) => b.type === 'COMMS')
      if (comms) {
        comms.durationMin += 20
        comms.reasonKey = 'plan.diff.ACT_COMMS_FAMILY'
        diffs.push({
          blockId: comms.id,
          change: 'EXTENDED',
          reasonKey: 'plan.diff.ACT_COMMS_FAMILY',
          byAlertId,
        })
      }
    }
  }

  blocks.sort((a, b) => a.startMin - b.startMin)
  return { schedule: { ...base, blocks }, diffs }
}

export function buildCrewScheduleViews(
  crewId: CrewId,
  day: number,
  cards: ActionCard[],
  alerts: Alert[],
): {
  base: DaySchedule
  suggested: DaySchedule
  accepted: DaySchedule
  diffs: ScheduleDiffItem[]
} {
  const base = buildCrewBaseSchedule(crewId, day)
  const crewCards = cards.filter((c) => c.crewId === crewId)
  const suggestedResult = applyCardsToBlocks(
    base,
    crewCards.filter((c) => c.state !== 'DISMISSED'),
    alerts,
  )
  const acceptedResult = applyCardsToBlocks(
    base,
    crewCards.filter((c) => c.state === 'ACCEPTED' || c.state === 'DONE'),
    alerts,
  )
  return {
    base,
    suggested: suggestedResult.schedule,
    accepted: acceptedResult.schedule,
    diffs: suggestedResult.diffs,
  }
}

export function buildMockBehavioralTrends(
  crewId: CrewId,
  simDay: number,
  scenarioId: ScenarioId,
): {
  checkIns: CheckInRecord[]
  pvtHistory: PvtRecord[]
  proxies: PassiveProxySummary
} {
  const profile = getCrewProfile(crewId)
  const baseMood = profile.baselines['mood.mood']?.mean ?? 7.4
  const baseStress = profile.baselines['mood.stress']?.mean ?? 3.1
  const baseMot = profile.baselines['mood.motivation']?.mean ?? 7.6
  const basePvt = profile.baselines['pvt.medianMs']?.mean ?? 255

  const isMoodDrop =
    (scenarioId === 'isolation_low_mood' || scenarioId === 'demo_main') && crewId === 'sci'
  const isSleepDebt =
    (scenarioId === 'sleep_debt' || scenarioId === 'demo_main') && crewId === 'cdr'

  const checkIns: CheckInRecord[] = []
  const pvtHistory: PvtRecord[] = []

  for (let offset = -13; offset <= 0; offset++) {
    const day = simDay + offset
    const t = day * 86_400_000
    const wave = Math.sin((offset + 4) * 0.7) * 0.35
    const moodDrop = isMoodDrop && offset > -5 ? (offset + 5) * 0.32 : 0
    const stressLift = isMoodDrop && offset > -5 ? (offset + 5) * 0.35 : 0
    const sleepPenalty = isSleepDebt && offset > -3 ? (offset + 3) * 18 : 0

    checkIns.push({
      day,
      t,
      stress: Number(Math.min(10, Math.max(1, baseStress + stressLift + wave)).toFixed(1)),
      mood: Number(Math.min(10, Math.max(1, baseMood - moodDrop - wave * 0.6)).toFixed(1)),
      motivation: Number(
        Math.min(10, Math.max(1, baseMot - moodDrop * 0.8 + wave * 0.4)).toFixed(1),
      ),
      hasJournalNote: offset % 3 === 0,
    })

    pvtHistory.push({
      day,
      t,
      medianMs: Math.round(basePvt + sleepPenalty + wave * 12),
      lapses: isSleepDebt && offset > -2 ? 3 : isMoodDrop && offset > -2 ? 2 : 0,
      falseStarts: offset === -4 ? 1 : 0,
    })
  }

  const sleepRegularityIndex = isSleepDebt ? 0.68 : 0.89
  const missedExerciseCount = isMoodDrop ? 2 : 0
  const checkInCompliancePct = isMoodDrop ? 86 : 96
  const moodTrendSlope = isMoodDrop ? -0.34 : 0.04
  const passiveProxyScore = Number(
    Math.min(
      1,
      Math.max(
        0,
        sleepRegularityIndex * 0.45 +
          (checkInCompliancePct / 100) * 0.35 +
          (missedExerciseCount === 0 ? 0.2 : 0.08),
      ),
    ).toFixed(2),
  )

  return {
    checkIns,
    pvtHistory,
    proxies: {
      sleepRegularityIndex,
      missedExerciseCount,
      checkInCompliancePct,
      passiveProxyScore,
      moodTrendSlope,
    },
  }
}
