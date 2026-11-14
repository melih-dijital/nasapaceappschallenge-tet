import { describe, expect, it } from 'vitest'
import { MemoryFrameStore } from '@/core/storage'
import type { IntervalScheduler } from '@/core/telemetry'
import type { DailyFrame } from '@/core/types'
import { MS_PER_DAY, MS_PER_HOUR, minToMs } from '@/core/units'
import type { EngineOutputLite, EngineSnapshot, WorkerToUiMessage } from '@/workers/protocol'
import { createWorkerHandler } from '@/workers/workerHandler'

class FakeWorkerScheduler implements IntervalScheduler<number> {
  private nextId = 1
  private callbacks = new Map<number, () => void>()

  setInterval(callback: () => void): number {
    const id = this.nextId++
    this.callbacks.set(id, callback)
    return id
  }

  clearInterval(handle: number): void {
    this.callbacks.delete(handle)
  }

  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      for (const cb of [...this.callbacks.values()]) cb()
    }
  }
}

describe('Worker protokolü ve handleMessage (Worker olmadan)', () => {
  it('geçersiz mesajları Zod ile reddeder ve ERROR döner', () => {
    const out: WorkerToUiMessage[] = []
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler: new FakeWorkerScheduler(),
    })

    handler.handleMessage({})
    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', speed: 'fast' })
    handler.handleMessage({ type: 'UNKNOWN_CMD' })

    expect(out).toHaveLength(3)
    expect(out.every((m) => m.type === 'ERROR' && m.code === 'INVALID_MESSAGE')).toBe(true)
    handler.dispose()
  })

  it('INIT -> START -> PAUSE -> SEEK_BOOKMARK -> RESET -> SET_SCENARIO yaşam döngüsü', () => {
    const out: WorkerToUiMessage[] = []
    const scheduler = new FakeWorkerScheduler()
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler,
    })

    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', speed: 50 })
    expect(out.some((m) => m.type === 'READY')).toBe(true)
    expect(out.some((m) => m.type === 'SNAPSHOT')).toBe(true)

    out.length = 0
    handler.handleMessage({ type: 'START' })
    // İlk START backfill yayar (FRAMES_BATCH + ENGINE_OUTPUT + STATUS)
    const firstBatch = out.find((m) => m.type === 'FRAMES_BATCH')
    expect(firstBatch?.type).toBe('FRAMES_BATCH')
    if (firstBatch?.type === 'FRAMES_BATCH') {
      expect(firstBatch.frames.every((f) => f.t < 0)).toBe(true)
    }

    // Canlı tick'ler t >= 0 ile gelir
    out.length = 0
    scheduler.step(2)
    const liveBatches = out.filter((m) => m.type === 'FRAMES_BATCH')
    expect(liveBatches.length).toBeGreaterThan(0)

    handler.handleMessage({ type: 'SET_SPEED', speedMultiplier: 10 })
    handler.handleMessage({ type: 'SEEK_BOOKMARK', index: 3 })
    const lastSnap = [...out].reverse().find((m) => m.type === 'SNAPSHOT')
    if (lastSnap?.type === 'SNAPSHOT') {
      expect(lastSnap.snapshot.t).toBe(3.5 * MS_PER_DAY)
    }

    handler.handleMessage({ type: 'PAUSE' })
    handler.handleMessage({ type: 'RESET' })
    handler.handleMessage({ type: 'SET_SCENARIO', id: 'nominal' })
    const statusAfterScenario = [...out].reverse().find((m) => m.type === 'STATUS')
    if (statusAfterScenario?.type === 'STATUS') {
      expect(statusAfterScenario.status.scenarioId).toBe('nominal')
      expect(statusAfterScenario.status.running).toBe(false)
    }

    handler.dispose()
  })

  it('demo_main seed 42 → D+003 12:30: ACT_SHELTER kartı, egzersiz iptali + SHELTER bloğu, 840 sn gecikme, ~+43 dk bekleyen cevap ve karar komutları', () => {
    const out: WorkerToUiMessage[] = []
    const scheduler = new FakeWorkerScheduler()
    // tickMs=125 ve speed=5/3 => her tick tam 15 sim-dakika (900_000 ms) ilerler
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler,
      tickMs: 125,
    })

    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', seed: 42, speed: 5 / 3 })
    handler.handleMessage({ type: 'START' })
    // Bookmark 3 = SPE_START (D+003 12:00 = 3.5 * MS_PER_DAY)
    handler.handleMessage({ type: 'SEEK_BOOKMARK', index: 3 })

    // D+003 12:00 -> 12:15 (1. tick) -> 12:30 (2. tick) -> 12:30 çerçevelerini üretmek için 3. tick
    out.length = 0
    scheduler.step(2)

    const outputsAt1230 = out.filter(
      (m): m is Extract<WorkerToUiMessage, { type: 'ENGINE_OUTPUT' }> => m.type === 'ENGINE_OUTPUT',
    )
    expect(outputsAt1230.length).toBeGreaterThan(0)
    const latestOut: EngineOutputLite = outputsAt1230.at(-1)!.output
    const decisionSnap = latestOut.decisions?.at(-1)
    expect(decisionSnap).toBeDefined()
    expect(decisionSnap!.t).toBe(3 * MS_PER_DAY + 12.5 * MS_PER_HOUR)

    // 1. ACT_SHELTER kartı var ve ACT_NOW
    const shelterCard = latestOut.cards?.find((c) => c.actionId === 'ACT_SHELTER')
    expect(shelterCard).toBeDefined()
    expect(shelterCard!.earthDelayClass).toBe('ACT_NOW')

    // 2. Plan farkında egzersiz kaldırılmış, SHELTER bloğu eklenmiş
    const crewScheduleOut = decisionSnap!.schedulesByCrew[shelterCard!.crewId]
    expect(crewScheduleOut).toBeDefined()
    const crewDiff = crewScheduleOut!.diff
    const baseBlocksById = new Map(
      (crewScheduleOut!.baseSchedule?.blocks ?? []).map((b) => [b.id, b]),
    )
    const nextBlocksById = new Map(crewScheduleOut!.schedule.blocks.map((b) => [b.id, b]))
    expect(
      crewDiff.some((d) => {
        const b = baseBlocksById.get(d.blockId)
        return (
          d.change === 'REMOVED' &&
          d.reasonKey === 'plan.diff.ACT_SHELTER' &&
          (b?.type === 'EXERCISE_AERO' || b?.type === 'EXERCISE_RESISTIVE')
        )
      }),
    ).toBe(true)
    expect(
      crewDiff.some((d) => {
        const b = nextBlocksById.get(d.blockId)
        return d.change === 'ADDED' && d.reasonKey === 'plan.diff.ACT_SHELTER' && b?.type === 'SHELTER'
      }),
    ).toBe(true)

    // 3. Earth Link tek yön 840 sn (14 dk)
    expect(decisionSnap!.earth.config.oneWayDelaySec).toBe(840)

    // 4. En az 1 bekleyen cevap ETA ≈ +43 dk (~2580 sn)
    expect(decisionSnap!.earth.pending.length).toBeGreaterThanOrEqual(1)
    const pendingEtaMin = decisionSnap!.earth.pending.map((p) => p.remainingMs / minToMs(1))
    expect(pendingEtaMin.some((m) => Math.abs(m - 43) <= 1)).toBe(true)

    // 5. Karar ve Earth Link komutları: ACCEPT_ACTION, COMPLETE_ACTION, DISMISS_ACTION, SET_EARTH_LINK, SET_CONSENT, GROUND_REPLY
    out.length = 0
    handler.handleMessage({ type: 'ACCEPT_ACTION', cardId: shelterCard!.id })
    const snapAfterAccept = [...out]
      .reverse()
      .find((m): m is Extract<WorkerToUiMessage, { type: 'SNAPSHOT' }> => m.type === 'SNAPSHOT')
    expect(
      snapAfterAccept?.snapshot.cards.find((c) => c.id === shelterCard!.id)?.state,
    ).toBe('ACCEPTED')

    out.length = 0
    handler.handleMessage({ type: 'COMPLETE_ACTION', cardId: shelterCard!.id })
    const snapAfterComplete = [...out]
      .reverse()
      .find((m): m is Extract<WorkerToUiMessage, { type: 'SNAPSHOT' }> => m.type === 'SNAPSHOT')
    expect(
      snapAfterComplete?.snapshot.cards.find((c) => c.id === shelterCard!.id)?.state,
    ).toBe('DONE')

    const anotherCard = snapAfterComplete?.snapshot.cards.find((c) => c.id !== shelterCard!.id)
    if (anotherCard) {
      out.length = 0
      handler.handleMessage({ type: 'DISMISS_ACTION', cardId: anotherCard.id })
      const snapAfterDismiss = [...out]
        .reverse()
        .find((m): m is Extract<WorkerToUiMessage, { type: 'SNAPSHOT' }> => m.type === 'SNAPSHOT')
      expect(
        snapAfterDismiss?.snapshot.cards.find((c) => c.id === anotherCard.id)?.state,
      ).toBe('DISMISSED')
    }

    // Kullanıcı SET_EARTH_LINK ile değiştirirse senaryonun EARTH_DELAY olayına göre önceliklidir
    out.length = 0
    handler.handleMessage({
      type: 'SET_EARTH_LINK',
      config: { preset: 'MARS_MAX', oneWayDelaySec: 1320, blackout: false },
    })
    scheduler.step(1)
    const snapAfterOverride = [...out]
      .reverse()
      .find((m): m is Extract<WorkerToUiMessage, { type: 'ENGINE_OUTPUT' }> => m.type === 'ENGINE_OUTPUT')
    expect(snapAfterOverride?.output.decisions?.at(-1)?.earth.config.oneWayDelaySec).toBe(1320)

    out.length = 0
    handler.handleMessage({ type: 'SET_CONSENT', categories: ['VITALS_SUMMARY', 'ALERTS'] })
    handler.handleMessage({
      type: 'GROUND_REPLY',
      templateId: 'REPLY_SPE_ACK',
      relatedAlertId: shelterCard!.sourceAlertIds[0],
    })
    const snapAfterReply = [...out]
      .reverse()
      .find((m): m is Extract<WorkerToUiMessage, { type: 'SNAPSHOT' }> => m.type === 'SNAPSHOT')
    expect(snapAfterReply?.snapshot.decision?.earth.consentCategories).toEqual([
      'VITALS_SUMMARY',
      'ALERTS',
    ])
    expect(
      snapAfterReply?.snapshot.decision?.earth.pending.some((p) => p.messageId.startsWith('down-')),
    ).toBe(true)

    handler.dispose()
  })

  it('SUBMIT_CHECKIN ve SUBMIT_PVT aynı günün DailyFrame kaydına userSubmitted:true ile birleşir; journalText motora ve Earth Link e girmez', async () => {
    const out: WorkerToUiMessage[] = []
    const scheduler = new FakeWorkerScheduler()
    const frameStore = new MemoryFrameStore()
    const handler = createWorkerHandler({
      postMessage: (m) => out.push(m),
      scheduler,
      frameStore,
    })

    handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', seed: 42, speed: 1 })
    handler.handleMessage({ type: 'START' })
    out.length = 0

    const secretJournal = 'GIZLI_CIHAZ_ICI_GUNLUK_METNI_998877'
    handler.handleMessage({
      type: 'SUBMIT_CHECKIN',
      crewId: 'cdr',
      mood: { stress: 8, mood: 4, motivation: 5 },
      journalText: secretJournal,
    })
    handler.handleMessage({
      type: 'SUBMIT_PVT',
      crewId: 'cdr',
      medianMs: 325,
      lapses: 5,
    })

    const batches = out.filter(
      (m): m is Extract<WorkerToUiMessage, { type: 'FRAMES_BATCH' }> => m.type === 'FRAMES_BATCH',
    )
    expect(batches).toHaveLength(2)

    // FrameStore'da aynı gün için tek birleşik DailyFrame bulunur
    const storedDaily = (await frameStore.query({ crewId: 'cdr', kind: 'daily', fromT: 0 })).filter(
      (f): f is DailyFrame => f.kind === 'daily' && f.day === 0,
    )
    expect(storedDaily).toHaveLength(1)
    expect(storedDaily[0]?.userSubmitted).toBe(true)
    expect(storedDaily[0]?.mood).toEqual({ stress: 8, mood: 4, motivation: 5 })
    expect(storedDaily[0]?.pvt).toEqual({ medianMs: 325, lapses: 5 })

    // journalText hiçbir mesajda, motorda, FrameStore'da veya Earth Link paketinde yer almaz
    expect(JSON.stringify(out)).not.toContain(secretJournal)
    expect(JSON.stringify(storedDaily)).not.toContain(secretJournal)

    handler.dispose()
  })

  it('aynı seed ile iki worker/motor koşusu birebir aynı çıktıyı üretir', () => {
    const runWithSeed = (seed: number): { outputs: EngineOutputLite[]; finalSnapshot: EngineSnapshot | undefined } => {
      const out: WorkerToUiMessage[] = []
      const scheduler = new FakeWorkerScheduler()
      const handler = createWorkerHandler({
        postMessage: (m) => out.push(m),
        scheduler,
        tickMs: 125,
      })

      handler.handleMessage({ type: 'INIT', scenarioId: 'demo_main', seed, speed: 5 / 3 })
      handler.handleMessage({ type: 'START' })
      handler.handleMessage({ type: 'SEEK_BOOKMARK', index: 3 })
      scheduler.step(4)
      handler.handleMessage({ type: 'PAUSE' })

      const outputs = out
        .filter((m): m is Extract<WorkerToUiMessage, { type: 'ENGINE_OUTPUT' }> => m.type === 'ENGINE_OUTPUT')
        .map((m) => m.output)
      const finalSnapshot = [...out]
        .reverse()
        .find((m): m is Extract<WorkerToUiMessage, { type: 'SNAPSHOT' }> => m.type === 'SNAPSHOT')?.snapshot

      handler.dispose()
      return { outputs, finalSnapshot }
    }

    const run1 = runWithSeed(42)
    const run2 = runWithSeed(42)
    expect(run1.outputs).toEqual(run2.outputs)
    expect(run1.finalSnapshot).toEqual(run2.finalSnapshot)
  })
})
