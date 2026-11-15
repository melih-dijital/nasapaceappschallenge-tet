// Motorun UI'a gönderdiği her i18n anahtarı en.ts VE tr.ts'de olmalı (ekranda ham anahtar görünmesin).
// 8 senaryo canlı hattaki ortak fabrikayla (createDefaultEngine: Modules + Detection + Decision) baştan sona koşar.
import { describe, expect, it } from 'vitest'
import type { DecisionStageSnapshot } from '@/core/decision'
import { createDefaultEngine } from '@/core/pipeline'
import { MS_PER_DAY, MS_PER_HOUR } from '@/core/units'
import { BUILTIN_SCENARIO_IDS, getScenario } from '@/sim/scenarios'
import { Simulator } from '@/sim/simulator'
import { en } from '@/ui/i18n/en'
import { tr } from '@/ui/i18n/tr'

const enKeys = new Set(Object.keys(en))
const trKeys = new Set(Object.keys(tr))

function engineKeysFor(scenarioId: string): Set<string> {
  const scenario = getScenario(scenarioId)
  const sim = new Simulator(scenario)
  const crew = sim.getCrew()
  const engine = createDefaultEngine({
    scenario,
    crewProfiles: crew,
    priorCareerDoseMsv: (id) => crew.find((c) => c.id === id)?.priorCareerDoseMsv,
    missionDays: scenario.durationDays,
  })
  engine.ingest(sim.backfill(), 0)

  // Not: senaryo tanımlarındaki `bookmark.*` labelKey'leri UI'da gösterilmez (yalnız demo_main için UI'nın kendi
  // `bookmark.demo_main.N` anahtarları kullanılır), bu yüzden kapsam dışıdır.
  const keys = new Set<string>()
  const step = 6 * MS_PER_HOUR
  for (let t = step; t <= scenario.durationDays * MS_PER_DAY; t += step) {
    const out = engine.ingest(sim.advanceTo(t), t)
    for (const e of out.alertEvents ?? []) {
      keys.add(e.alert.titleKey)
      for (const w of e.alert.whyKeys) keys.add(w.key)
    }
    const snap = out.decisions?.at(-1) as DecisionStageSnapshot | undefined
    if (!snap) continue
    for (const c of snap.cards) {
      keys.add(c.titleKey)
      for (const s of c.stepKeys) keys.add(s)
      for (const w of c.whyKeys) keys.add(w.key)
    }
    for (const s of Object.values(snap.schedulesByCrew))
      for (const d of s.diff) keys.add(d.reasonKey)
    for (const m of snap.earth.inbox) {
      const templateId = (m.payload as { templateId?: unknown } | null)?.templateId
      if (typeof templateId === 'string') {
        for (const part of ['title', 'body', 'followUp'])
          keys.add(`ground.reply.${templateId}.${part}`)
      }
    }
  }
  return keys
}

describe('i18n — motorun ürettiği anahtarlar sözlükte', () => {
  it.each(BUILTIN_SCENARIO_IDS)(
    '%s: tüm uyarı/kart/plan/yer cevabı anahtarları en ve tr içinde',
    (id) => {
      const keys = engineKeysFor(id)
      expect(keys.size).toBeGreaterThan(0)
      const missingEn = [...keys].filter((k) => !enKeys.has(k)).sort()
      const missingTr = [...keys].filter((k) => !trKeys.has(k)).sort()
      expect(missingEn, `en.ts eksik: ${missingEn.join(', ')}`).toEqual([])
      expect(missingTr, `tr.ts eksik: ${missingTr.join(', ')}`).toEqual([])
    },
  )

  it('en.ts ve tr.ts aynı anahtar kümesine sahip', () => {
    expect([...enKeys].filter((k) => !trKeys.has(k))).toEqual([])
    expect([...trKeys].filter((k) => !enKeys.has(k))).toEqual([])
  })
})
