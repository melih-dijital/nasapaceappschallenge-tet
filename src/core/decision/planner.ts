// Kural tabanlı görev takvimi planlayıcısı (FAZ_07 §3.2): öneri planı + şeffaf diff üretir.
// Otomatik uygulama yapmaz; kilitli (locked) bloklara dokunmaz; güvenlik sınırlarını Evidence'tan okur.
import { registry, type EvidenceId, type EvidenceRegistry } from '../evidence/registry'
import type { ActionId } from '../types/action'
import type { CrewProfile } from '../types/crew'
import type {
  DaySchedule,
  ScheduleBlock,
  ScheduleBlockType,
  ScheduleDiffItem,
  ScheduleEffect,
} from '../types/schedule'
import { MIN_PER_DAY, MIN_PER_HOUR, VITALS_INTERVAL_MIN } from '../units'
import { getActionDef } from './actions'

/** Çakışma önceliği (yüksek sayı = daha yüksek öncelik, FAZ_07 §3.2). */
export const BLOCK_PRIORITY: Record<ScheduleBlockType, number> = {
  SHELTER: 11,
  SLEEP: 10,
  HYDRATION: 9,
  REST: 8,
  MEAL: 7,
  PSYCH_CHECKIN: 6,
  EVA: 5,
  EXERCISE_AERO: 4,
  EXERCISE_RESISTIVE: 3,
  COMMS: 2,
  WORK: 1,
}

export interface ActiveActionInput {
  actionId: ActionId
  byAlertId?: string
  sourceAlertIds?: readonly string[]
  effectsOverride?: readonly ScheduleEffect[]
}

export interface PlannerContext {
  baselineSleepMin?: number
  baselineHydrationL?: number
  /** Haftada kalan diğer direnç egzersizi sayısı; 0 ise (acil sığınma hariç) sıfıra inmesi engellenir. */
  remainingWeeklyResistiveSessions?: number
  evidence?: EvidenceRegistry
}

export interface PlannerResult {
  schedule: DaySchedule
  diff: ScheduleDiffItem[]
  hydrationTargetL: number
}

const DEFAULT_HYDRATION_BASELINE_DIVISOR = 2

const modDay = (min: number): number => ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY

function toSegments(startMin: number, durationMin: number): readonly [number, number][] {
  if (durationMin <= 0) return []
  if (durationMin >= MIN_PER_DAY) return [[0, MIN_PER_DAY]]
  const start = modDay(startMin)
  const end = start + durationMin
  if (end <= MIN_PER_DAY) return [[start, end]]
  return [
    [start, MIN_PER_DAY],
    [0, end - MIN_PER_DAY],
  ]
}

export function blocksOverlap(
  a: Pick<ScheduleBlock, 'startMin' | 'durationMin'>,
  b: Pick<ScheduleBlock, 'startMin' | 'durationMin'>,
): boolean {
  const segA = toSegments(a.startMin, a.durationMin)
  const segB = toSegments(b.startMin, b.durationMin)
  for (const [a1, a2] of segA) {
    for (const [b1, b2] of segB) {
      if (Math.max(a1, b1) < Math.min(a2, b2)) return true
    }
  }
  return false
}

function overlapMinutes(
  a: Pick<ScheduleBlock, 'startMin' | 'durationMin'>,
  b: Pick<ScheduleBlock, 'startMin' | 'durationMin'>,
): number {
  const segA = toSegments(a.startMin, a.durationMin)
  const segB = toSegments(b.startMin, b.durationMin)
  let total = 0
  for (const [a1, a2] of segA) {
    for (const [b1, b2] of segB) {
      const overlap = Math.min(a2, b2) - Math.max(a1, b1)
      if (overlap > 0) total += overlap
    }
  }
  return total
}

function totalTypeDuration(blocks: readonly ScheduleBlock[], type: ScheduleBlockType): number {
  return blocks.filter((b) => b.type === type).reduce((sum, b) => sum + b.durationMin, 0)
}

function resolveNumber(evidence: EvidenceRegistry, paramId: string): number {
  return evidence.getNumber(paramId as EvidenceId)
}

interface BaseSlotSpec {
  offsetMin: number
  durationMin: number
  type: ScheduleBlockType
  intensity?: ScheduleBlock['intensity']
}

const AWAKE_SLOTS: readonly BaseSlotSpec[] = [
  { offsetMin: 0, durationMin: 30, type: 'MEAL' },
  { offsetMin: 30, durationMin: 15, type: 'HYDRATION' },
  { offsetMin: 45, durationMin: 15, type: 'PSYCH_CHECKIN' },
  { offsetMin: 60, durationMin: 210, type: 'WORK', intensity: 'MED' },
  { offsetMin: 270, durationMin: 60, type: 'EXERCISE_AERO', intensity: 'MED' },
  { offsetMin: 330, durationMin: 15, type: 'HYDRATION' },
  { offsetMin: 345, durationMin: 45, type: 'MEAL' },
  { offsetMin: 390, durationMin: 180, type: 'WORK', intensity: 'MED' },
  { offsetMin: 570, durationMin: 60, type: 'EXERCISE_RESISTIVE', intensity: 'MED' },
  { offsetMin: 630, durationMin: 15, type: 'HYDRATION' },
  { offsetMin: 645, durationMin: 90, type: 'WORK', intensity: 'MED' },
  { offsetMin: 735, durationMin: 45, type: 'MEAL' },
  { offsetMin: 780, durationMin: 30, type: 'COMMS' },
  { offsetMin: 810, durationMin: 60, type: 'REST' },
]

/** Kişinin uyku penceresine göre 24 saatlik çakışmasız baz görev takvimi oluşturur. */
export function buildBaseSchedule(
  crew: CrewProfile,
  day: number,
  evidence: EvidenceRegistry = registry,
): DaySchedule {
  const fallbackSleepMin = resolveNumber(evidence, 'plan.sleep.durationH') * MIN_PER_HOUR
  const sleepStart = modDay(crew.sleepWindow.startMin)
  const sleepDuration = Math.min(
    MIN_PER_DAY - MIN_PER_HOUR,
    crew.sleepWindow.durationMin > 0 ? crew.sleepWindow.durationMin : fallbackSleepMin,
  )
  const wakeMin = modDay(sleepStart + sleepDuration)
  const awakeBudget = MIN_PER_DAY - sleepDuration

  const blocks: ScheduleBlock[] = [
    {
      id: `d${day}-sleep-0`,
      type: 'SLEEP',
      startMin: sleepStart,
      durationMin: sleepDuration,
    },
  ]

  const typeCounts = new Map<ScheduleBlockType, number>()
  for (const slot of AWAKE_SLOTS) {
    if (slot.offsetMin + slot.durationMin > awakeBudget) continue
    const idx = typeCounts.get(slot.type) ?? 0
    typeCounts.set(slot.type, idx + 1)
    blocks.push({
      id: `d${day}-${slot.type.toLowerCase()}-${idx}`,
      type: slot.type,
      startMin: modDay(wakeMin + slot.offsetMin),
      durationMin: slot.durationMin,
      ...(slot.intensity ? { intensity: slot.intensity } : {}),
    })
  }

  return { day, crewId: crew.id, blocks }
}

function cloneSchedule(schedule: DaySchedule): DaySchedule {
  return {
    day: schedule.day,
    crewId: schedule.crewId,
    blocks: schedule.blocks.map((b) => ({ ...b })),
  }
}

function candidateStartMinutes(blocks: readonly ScheduleBlock[]): number[] {
  const sleepBlock = blocks.find((b) => b.type === 'SLEEP')
  const wakeAnchor = sleepBlock ? modDay(sleepBlock.startMin + sleepBlock.durationMin) : 0
  const starts: number[] = []
  for (let offset = 0; offset < MIN_PER_DAY; offset += VITALS_INTERVAL_MIN) {
    starts.push(modDay(wakeAnchor + offset))
  }
  return starts
}

function findSlotForNewBlock(
  blocks: readonly ScheduleBlock[],
  blockType: ScheduleBlockType,
  durationMin: number,
): { startMin: number; clean: boolean; blockedByHighOrLocked: boolean } {
  const priority = BLOCK_PRIORITY[blockType]
  const starts = candidateStartMinutes(blocks)

  let bestDisplaceStart: number | null = null
  let bestDisplaceCost = Infinity
  let bestConflictStart = starts[0] ?? 0
  let bestConflictCost = Infinity

  for (const startMin of starts) {
    const candidate = { startMin, durationMin }
    const overlapping = blocks.filter((b) => blocksOverlap(candidate, b))
    if (overlapping.length === 0) {
      return { startMin, clean: true, blockedByHighOrLocked: false }
    }

    const hitsProtected = overlapping.some(
      (b) => b.locked === true || BLOCK_PRIORITY[b.type] >= priority,
    )
    const overlapCost = overlapping.reduce((acc, b) => acc + overlapMinutes(candidate, b), 0)

    if (!hitsProtected && overlapCost < bestDisplaceCost) {
      bestDisplaceCost = overlapCost
      bestDisplaceStart = startMin
    }
    if (overlapCost < bestConflictCost) {
      bestConflictCost = overlapCost
      bestConflictStart = startMin
    }
  }

  if (bestDisplaceStart !== null) {
    return { startMin: bestDisplaceStart, clean: false, blockedByHighOrLocked: false }
  }
  return { startMin: bestConflictStart, clean: false, blockedByHighOrLocked: true }
}

function trimBlockAroundPlaced(
  other: ScheduleBlock,
  placed: Pick<ScheduleBlock, 'startMin' | 'durationMin'>,
  reduceBy: number,
): void {
  const placedStart = modDay(placed.startMin)
  const otherStart = modDay(other.startMin)
  const relOtherStart = modDay(otherStart - placedStart)
  const headOverlap = relOtherStart < placed.durationMin
  other.durationMin -= reduceBy
  if (headOverlap) {
    other.startMin = modDay(otherStart + reduceBy)
  }
}

function resolveConflictsForBlock(
  blocks: ScheduleBlock[],
  placed: ScheduleBlock,
  diff: ScheduleDiffItem[],
  reasonKey: string,
  byAlertId: string | undefined,
  minSleepMin: number,
): void {
  const placedPriority = BLOCK_PRIORITY[placed.type]
  const toRemoveIds = new Set<string>()

  for (const other of blocks) {
    if (other.id === placed.id) continue
    if (!blocksOverlap(placed, other)) continue

    if (other.locked === true || BLOCK_PRIORITY[other.type] >= placedPriority) {
      diff.push({
        blockId: placed.id,
        change: 'CONFLICT',
        reasonKey: 'plan.diff.conflictOverlap',
        ...(byAlertId ? { byAlertId } : {}),
      })
      continue
    }

    const overlap = overlapMinutes(placed, other)
    if (other.type === 'SLEEP') {
      const currentSleep = totalTypeDuration(blocks, 'SLEEP')
      const maxReducible = Math.max(0, currentSleep - minSleepMin)
      const reduceBy = Math.min(overlap, maxReducible)
      if (reduceBy <= 0) {
        diff.push({
          blockId: other.id,
          change: 'CONFLICT',
          reasonKey: 'plan.diff.sleepFloorProtected',
          ...(byAlertId ? { byAlertId } : {}),
        })
        continue
      }
      trimBlockAroundPlaced(other, placed, reduceBy)
      diff.push({
        blockId: other.id,
        change: 'SHORTENED',
        reasonKey,
        ...(byAlertId ? { byAlertId } : {}),
      })
      if (reduceBy < overlap) {
        diff.push({
          blockId: other.id,
          change: 'CONFLICT',
          reasonKey: 'plan.diff.sleepFloorProtected',
          ...(byAlertId ? { byAlertId } : {}),
        })
      }
      continue
    }

    if (other.durationMin - overlap >= VITALS_INTERVAL_MIN) {
      trimBlockAroundPlaced(other, placed, overlap)
      diff.push({
        blockId: other.id,
        change: 'SHORTENED',
        reasonKey,
        ...(byAlertId ? { byAlertId } : {}),
      })
    } else {
      toRemoveIds.add(other.id)
      diff.push({
        blockId: other.id,
        change: 'REMOVED',
        reasonKey,
        ...(byAlertId ? { byAlertId } : {}),
      })
    }
  }

  if (toRemoveIds.size > 0) {
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const block = blocks[i]
      if (block && toRemoveIds.has(block.id)) {
        blocks.splice(i, 1)
      }
    }
  }
}

/**
 * Aktif önerilen eylemlere göre öneri takvimi ve satır bazlı fark (`diff`) üretir.
 * Kullanıcı onayı olmadan baz takvimi değiştirmez (saf fonksiyon).
 */
export function applyAdjustments(
  base: DaySchedule,
  activeActions: readonly ActiveActionInput[],
  ctx: PlannerContext = {},
): PlannerResult {
  const evidence = ctx.evidence ?? registry
  const next = cloneSchedule(base)
  const diff: ScheduleDiffItem[] = []

  const baseSleepMin = totalTypeDuration(base.blocks, 'SLEEP')
  const baselineSleepMin = ctx.baselineSleepMin ?? baseSleepMin
  const minSleepFraction = resolveNumber(evidence, 'plan.sleep.minFractionOfBaseline')
  const minSleepMin = baselineSleepMin * minSleepFraction

  const maxHydrationL = resolveNumber(evidence, 'hydration.max.L')
  const baseHydrationL =
    ctx.baselineHydrationL ?? maxHydrationL / DEFAULT_HYDRATION_BASELINE_DIVISOR
  let hydrationTargetL = Math.min(maxHydrationL, baseHydrationL)

  let addedCounter = 0

  for (const input of activeActions) {
    const def = getActionDef(input.actionId)
    const effects = input.effectsOverride ?? def?.scheduleEffects ?? []
    const byAlertId = input.byAlertId ?? input.sourceAlertIds?.[0]
    const reasonKey = `plan.diff.${input.actionId}`
    const isEmergencyShelter = input.actionId === 'ACT_SHELTER'

    if (input.actionId === 'ACT_HYDRATE') {
      const extraBlocks = resolveNumber(evidence, 'plan.hydrate.extraBlocks')
      const stepL = resolveNumber(evidence, 'minScale.hydrationL')
      hydrationTargetL = Math.min(maxHydrationL, hydrationTargetL + extraBlocks * stepL)
    }

    for (const effect of effects) {
      switch (effect.op) {
        case 'REMOVE': {
          const targets = new Set<ScheduleBlockType>(effect.targets)
          for (let i = next.blocks.length - 1; i >= 0; i -= 1) {
            const block = next.blocks[i]
            if (!block || !targets.has(block.type)) continue
            if (block.locked === true) {
              diff.push({
                blockId: block.id,
                change: 'CONFLICT',
                reasonKey: 'plan.diff.conflictLocked',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            if (
              block.type === 'EXERCISE_RESISTIVE' &&
              !isEmergencyShelter &&
              (ctx.remainingWeeklyResistiveSessions ?? 0) === 0
            ) {
              block.intensity = 'LOW'
              block.reasonKey = reasonKey
              diff.push({
                blockId: block.id,
                change: 'INTENSITY',
                reasonKey: 'plan.diff.resistiveFloorProtected',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            next.blocks.splice(i, 1)
            diff.push({
              blockId: block.id,
              change: 'REMOVED',
              reasonKey,
              ...(byAlertId ? { byAlertId } : {}),
            })
          }
          break
        }

        case 'SET_INTENSITY': {
          for (const block of next.blocks) {
            if (block.type !== effect.target) continue
            if (block.locked === true) {
              diff.push({
                blockId: block.id,
                change: 'CONFLICT',
                reasonKey: 'plan.diff.conflictLocked',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            if (block.intensity !== effect.intensity) {
              block.intensity = effect.intensity
              block.reasonKey = reasonKey
              diff.push({
                blockId: block.id,
                change: 'INTENSITY',
                reasonKey,
                ...(byAlertId ? { byAlertId } : {}),
              })
            }
          }
          break
        }

        case 'SHIFT': {
          const delta = resolveNumber(evidence, effect.deltaMinParamId)
          const signedDelta = effect.direction === 'EARLIER' ? -delta : delta
          for (const block of next.blocks) {
            if (block.type !== effect.target) continue
            if (block.locked === true) {
              diff.push({
                blockId: block.id,
                change: 'CONFLICT',
                reasonKey: 'plan.diff.conflictLocked',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            block.startMin = modDay(block.startMin + signedDelta)
            block.reasonKey = reasonKey
            diff.push({
              blockId: block.id,
              change: 'MOVED',
              reasonKey,
              ...(byAlertId ? { byAlertId } : {}),
            })
            resolveConflictsForBlock(next.blocks, block, diff, reasonKey, byAlertId, minSleepMin)
          }
          break
        }

        case 'EXTEND': {
          const addMin = resolveNumber(evidence, effect.durationMinParamId)
          for (const block of next.blocks) {
            if (block.type !== effect.target) continue
            if (block.locked === true) {
              diff.push({
                blockId: block.id,
                change: 'CONFLICT',
                reasonKey: 'plan.diff.conflictLocked',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            block.durationMin = Math.min(MIN_PER_DAY, block.durationMin + addMin)
            block.reasonKey = reasonKey
            diff.push({
              blockId: block.id,
              change: 'EXTENDED',
              reasonKey,
              ...(byAlertId ? { byAlertId } : {}),
            })
            resolveConflictsForBlock(next.blocks, block, diff, reasonKey, byAlertId, minSleepMin)
          }
          break
        }

        case 'SHORTEN': {
          const cutMin = resolveNumber(evidence, effect.durationMinParamId)
          for (let i = next.blocks.length - 1; i >= 0; i -= 1) {
            const block = next.blocks[i]
            if (!block || block.type !== effect.target) continue
            if (block.locked === true) {
              diff.push({
                blockId: block.id,
                change: 'CONFLICT',
                reasonKey: 'plan.diff.conflictLocked',
                ...(byAlertId ? { byAlertId } : {}),
              })
              continue
            }
            if (block.type === 'SLEEP') {
              const currentSleep = totalTypeDuration(next.blocks, 'SLEEP')
              const maxCut = Math.max(0, currentSleep - minSleepMin)
              const actualCut = Math.min(cutMin, maxCut)
              if (actualCut <= 0) {
                diff.push({
                  blockId: block.id,
                  change: 'CONFLICT',
                  reasonKey: 'plan.diff.sleepFloorProtected',
                  ...(byAlertId ? { byAlertId } : {}),
                })
                continue
              }
              block.durationMin -= actualCut
              block.reasonKey = reasonKey
              diff.push({
                blockId: block.id,
                change: 'SHORTENED',
                reasonKey,
                ...(byAlertId ? { byAlertId } : {}),
              })
              if (actualCut < cutMin) {
                diff.push({
                  blockId: block.id,
                  change: 'CONFLICT',
                  reasonKey: 'plan.diff.sleepFloorProtected',
                  ...(byAlertId ? { byAlertId } : {}),
                })
              }
              continue
            }
            if (block.durationMin - cutMin < VITALS_INTERVAL_MIN) {
              next.blocks.splice(i, 1)
              diff.push({
                blockId: block.id,
                change: 'REMOVED',
                reasonKey,
                ...(byAlertId ? { byAlertId } : {}),
              })
            } else {
              block.durationMin -= cutMin
              block.reasonKey = reasonKey
              diff.push({
                blockId: block.id,
                change: 'SHORTENED',
                reasonKey,
                ...(byAlertId ? { byAlertId } : {}),
              })
            }
          }
          break
        }

        case 'ADD': {
          const durationMin = resolveNumber(evidence, effect.durationMinParamId)
          const count = effect.countParamId ? Math.round(resolveNumber(evidence, effect.countParamId)) : 1
          for (let c = 0; c < count; c += 1) {
            const slot = findSlotForNewBlock(next.blocks, effect.blockType, durationMin)
            const blockId = `d${base.day}-adj-${effect.blockType.toLowerCase()}-${addedCounter}`
            addedCounter += 1
            const added: ScheduleBlock = {
              id: blockId,
              type: effect.blockType,
              startMin: slot.startMin,
              durationMin,
              reasonKey,
            }
            next.blocks.push(added)
            diff.push({
              blockId,
              change: 'ADDED',
              reasonKey,
              ...(byAlertId ? { byAlertId } : {}),
            })
            if (!slot.clean) {
              resolveConflictsForBlock(next.blocks, added, diff, reasonKey, byAlertId, minSleepMin)
            }
          }
          break
        }
      }
    }
  }

  return { schedule: next, diff, hydrationTargetL }
}
