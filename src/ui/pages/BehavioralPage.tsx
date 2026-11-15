// FAZ 10 §3.3 — Davranışsal Sağlık Sayfası (/behavioral):
// Günlük check-in, 60 sn PVT-benzeri reaksiyon testi, 14 günlük eğilimler, pasif proxy ve tanı koymayan dil.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, CheckCircle2, FlaskConical, Lock, Play, Square, Timer } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getNumber } from '@/core/evidence/registry'
import { cn } from '@/lib/utils'
import { SectionCard } from '@/ui/components/SectionCard'
import { useT } from '@/ui/i18n'
import {
  actions,
  selectCrewStates,
  useBehavioralStore,
  useSessionStore,
  useStateStore,
} from '@/ui/store'

type PvtPhase = 'IDLE' | 'WAITING' | 'STIMULUS' | 'DONE'

export interface PvtTestSummary {
  medianMs: number
  lapses: number
  falseStarts: number
  trials: number
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
}

export function BehavioralPage() {
  const { t, formatNumber } = useT()
  const selectedCrewId = useSessionStore((s) => s.selectedCrewId)
  const day = useSessionStore((s) => s.day)

  const checkIns = useBehavioralStore((s) => s.checkInsByCrew[selectedCrewId] ?? [])
  const pvtHistory = useBehavioralStore((s) => s.pvtByCrew[selectedCrewId] ?? [])
  const proxies = useBehavioralStore((s) => s.proxiesByCrew[selectedCrewId])
  const journals = useBehavioralStore((s) => s.journalsByCrew[selectedCrewId] ?? [])
  const byCrew = useStateStore((s) => s.byCrew)

  const todayCheckIn = checkIns.find((c) => c.day === day)

  const [stress, setStress] = useState<number>(todayCheckIn?.stress ?? 4)
  const [mood, setMood] = useState<number>(todayCheckIn?.mood ?? 7)
  const [motivation, setMotivation] = useState<number>(todayCheckIn?.motivation ?? 7)
  const [journalText, setJournalText] = useState('')
  const [savedBanner, setSavedBanner] = useState(false)

  const syncKey = `${selectedCrewId}:${day}`
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey)
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey)
    setStress(todayCheckIn?.stress ?? 4)
    setMood(todayCheckIn?.mood ?? 7)
    setMotivation(todayCheckIn?.motivation ?? 7)
    setSavedBanner(false)
  }

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    actions.submitCheckIn(selectedCrewId, { stress, mood, motivation }, journalText)
    setJournalText('')
    setSavedBanner(true)
  }

  // --- 60 sn PVT-benzeri Reaksiyon Testi ---
  const lapseThresholdMs = getNumber('pvt.lapse.thresholdMs')
  const [pvtPhase, setPvtPhase] = useState<PvtPhase>('IDLE')
  const [falseStartNotice, setFalseStartNotice] = useState(false)
  const [lastRtMs, setLastRtMs] = useState<number | null>(null)
  const [pvtSummary, setPvtSummary] = useState<PvtTestSummary | null>(null)

  const rtsRef = useRef<number[]>([])
  const falseStartsRef = useRef<number>(0)
  const stimulusShownAtRef = useRef<number>(0)
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (waitTimerRef.current !== null) {
      clearTimeout(waitTimerRef.current)
      waitTimerRef.current = null
    }
    if (endTimerRef.current !== null) {
      clearTimeout(endTimerRef.current)
      endTimerRef.current = null
    }
  }, [])

  const scheduleNextStimulus = useCallback(() => {
    if (waitTimerRef.current !== null) clearTimeout(waitTimerRef.current)
    // PROJECT_MEMORY §10 istisnası: PVT uyaran aralığı (2–10 sn) yalnızca UI bileşeninde Math.random() kullanır
    const delayMs = 2000 + Math.floor(Math.random() * 8000)
    setPvtPhase('WAITING')
    waitTimerRef.current = setTimeout(() => {
      stimulusShownAtRef.current = performance.now()
      setFalseStartNotice(false)
      setPvtPhase('STIMULUS')
    }, delayMs)
  }, [])

  const finishPvtTest = useCallback(() => {
    clearTimers()
    const rts = rtsRef.current
    const medianMs = rts.length > 0 ? computeMedian(rts) : 0
    const lapses = rts.filter((v) => v >= lapseThresholdMs).length
    const falseStarts = falseStartsRef.current
    const summary: PvtTestSummary = {
      medianMs,
      lapses,
      falseStarts,
      trials: rts.length,
    }
    setPvtSummary(summary)
    setPvtPhase('DONE')
    if (rts.length > 0) {
      actions.submitPvt(selectedCrewId, medianMs, lapses, falseStarts)
    }
  }, [clearTimers, lapseThresholdMs, selectedCrewId])

  const startPvtTest = () => {
    clearTimers()
    rtsRef.current = []
    falseStartsRef.current = 0
    setFalseStartNotice(false)
    setLastRtMs(null)
    setPvtSummary(null)
    scheduleNextStimulus()
    endTimerRef.current = setTimeout(() => {
      finishPvtTest()
    }, 60_000)
  }

  const handlePvtResponse = useCallback(() => {
    if (pvtPhase === 'WAITING') {
      falseStartsRef.current += 1
      setFalseStartNotice(true)
      return
    }
    if (pvtPhase === 'STIMULUS') {
      const rt = Math.max(50, Math.round(performance.now() - stimulusShownAtRef.current))
      rtsRef.current.push(rt)
      setLastRtMs(rt)
      scheduleNextStimulus()
    }
  }, [pvtPhase, scheduleNextStimulus])

  useEffect(() => {
    if (pvtPhase !== 'WAITING' && pvtPhase !== 'STIMULUS') return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault()
        handlePvtResponse()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pvtPhase, handlePvtResponse])

  useEffect(() => () => clearTimers(), [clearTimers])

  const behavioralStates = selectCrewStates({ byCrew }, selectedCrewId).filter(
    (s) => s.state === 'mood_decline' || s.state === 'stress' || s.state === 'fatigue',
  )

  return (
    <div className="mx-auto max-w-[1440px] space-y-4" data-testid="behavioral-page">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          {t('behavioral.pageTitle')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('behavioral.pageSubtitle')}</p>
      </div>

      {/* Üst Satır: Günlük Check-In + 60 sn PVT Testi */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Günlük Check-In */}
        <SectionCard
          title={t('behavioral.checkinTitle')}
          subtitle={todayCheckIn ? t('behavioral.checkinSubmittedToday') : undefined}
        >
          <form onSubmit={handleCheckInSubmit} className="space-y-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label htmlFor="slider-stress" className="font-medium">
                  {t('metric.mood.stress')}
                </label>
                <span className="font-mono font-bold tabular-nums">{stress} / 10</span>
              </div>
              <Slider
                id="slider-stress"
                aria-label={t('metric.mood.stress')}
                data-testid="checkin-stress-slider"
                min={1}
                max={10}
                step={1}
                value={[stress]}
                onValueChange={(v) => typeof v[0] === 'number' && setStress(v[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label htmlFor="slider-mood" className="font-medium">
                  {t('metric.mood.mood')}
                </label>
                <span className="font-mono font-bold tabular-nums">{mood} / 10</span>
              </div>
              <Slider
                id="slider-mood"
                aria-label={t('metric.mood.mood')}
                data-testid="checkin-mood-slider"
                min={1}
                max={10}
                step={1}
                value={[mood]}
                onValueChange={(v) => typeof v[0] === 'number' && setMood(v[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label htmlFor="slider-motivation" className="font-medium">
                  {t('metric.mood.motivation')}
                </label>
                <span className="font-mono font-bold tabular-nums">{motivation} / 10</span>
              </div>
              <Slider
                id="slider-motivation"
                aria-label={t('metric.mood.motivation')}
                data-testid="checkin-motivation-slider"
                min={1}
                max={10}
                step={1}
                value={[motivation]}
                onValueChange={(v) => typeof v[0] === 'number' && setMotivation(v[0])}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="journal-note-input" className="font-medium">
                  {t('behavioral.journalLabel')}
                </label>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary">
                  <Lock aria-hidden="true" className="size-3" />
                  <span>{t('behavioral.journalPrivacy')}</span>
                </span>
              </div>
              <textarea
                id="journal-note-input"
                data-testid="checkin-journal-input"
                rows={2}
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder={t('behavioral.journalPlaceholder')}
                className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button type="submit" size="sm" data-testid="checkin-submit-btn">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                <span>{t('behavioral.checkinSubmit')}</span>
              </Button>

              {savedBanner && (
                <span
                  data-testid="checkin-saved-badge"
                  className="font-mono text-[11px] font-semibold text-primary"
                >
                  ✓ {t('behavioral.checkinSubmittedToday')}
                </span>
              )}
            </div>

            {journals.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-[11px] text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">
                  Local entries ({journals.length}):
                </span>{' '}
                {journals[0]!.text}
              </div>
            )}
          </form>
        </SectionCard>

        {/* 60 sn PVT-benzeri Reaksiyon Testi */}
        <SectionCard
          title={t('behavioral.pvtTitle')}
          subtitle={t('behavioral.pvtNotClinical')}
          provenanceId="pvt.lapse.thresholdMs"
        >
          <div className="space-y-3 text-xs">
            <div
              data-testid="pvt-stimulus-area"
              onClick={handlePvtResponse}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePvtResponse()
              }}
              className={cn(
                'flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-colors select-none',
                pvtPhase === 'STIMULUS'
                  ? 'border-primary bg-primary/25 text-primary'
                  : pvtPhase === 'WAITING'
                    ? 'border-border bg-background/80 text-muted-foreground'
                    : 'border-border/70 bg-background/50 text-muted-foreground',
              )}
            >
              <Timer aria-hidden="true" className="mb-2 size-7" />
              {pvtPhase === 'IDLE' && <span>{t('behavioral.pvtStart')}</span>}
              {pvtPhase === 'WAITING' && (
                <span className="font-mono font-semibold">{t('behavioral.pvtWait')}</span>
              )}
              {pvtPhase === 'STIMULUS' && (
                <span
                  data-testid="pvt-tap-cue"
                  className="font-mono text-lg font-bold tracking-wider"
                >
                  {t('behavioral.pvtTapNow')}
                </span>
              )}
              {pvtPhase === 'DONE' && pvtSummary && (
                <span
                  data-testid="pvt-summary-text"
                  className="font-mono font-semibold text-primary"
                >
                  {t('behavioral.pvtResult', {
                    median: pvtSummary.medianMs,
                    lapses: pvtSummary.lapses,
                    falseStarts: pvtSummary.falseStarts,
                  })}
                </span>
              )}

              {falseStartNotice && (
                <span
                  data-testid="pvt-false-start-msg"
                  className="mt-2 font-mono text-[11px] font-bold text-status-warning"
                >
                  {t('behavioral.pvtFalseStart')}
                </span>
              )}
              {lastRtMs !== null && pvtPhase !== 'DONE' && (
                <span className="mt-2 font-mono text-xs text-foreground tabular-nums">
                  {lastRtMs} ms
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              {pvtPhase === 'WAITING' || pvtPhase === 'STIMULUS' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={finishPvtTest}
                  data-testid="pvt-stop-btn"
                >
                  <Square aria-hidden="true" className="size-3.5" />
                  <span>{t('behavioral.pvtStop')}</span>
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={startPvtTest} data-testid="pvt-start-btn">
                  <Play aria-hidden="true" className="size-3.5" />
                  <span>{t('behavioral.pvtStart')}</span>
                </Button>
              )}

              {pvtHistory.length > 0 && (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  Latest: {pvtHistory[pvtHistory.length - 1]!.medianMs} ms ·{' '}
                  {pvtHistory[pvtHistory.length - 1]!.lapses} lapses
                </span>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Alt Satır: 14 Günlük Eğilimler & Pasif Proxy + Durum Göstergeleri */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SectionCard
            title={t('behavioral.trendsTitle')}
            subtitle={
              proxies
                ? t('behavioral.moodSlope', { slope: formatNumber(proxies.moodTrendSlope, 2) })
                : undefined
            }
            headerRight={
              // Motorda davranış modülü (FAZ_06 §4.4) yok: 14 günlük eğilim ve pasif proxy UI'da üretilen örnek veridir.
              <span
                data-testid="behavioral-sample-data-badge"
                title={t('behavioral.sampleDataHint')}
                className="inline-flex items-center gap-1 rounded border border-status-advisory/50 bg-status-advisory/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-status-advisory"
              >
                <FlaskConical aria-hidden="true" className="size-3" />
                <span>{t('behavioral.sampleDataBadge')}</span>
              </span>
            }
          >
            <div className="space-y-4">
              <div className="h-56 w-full" data-testid="behavioral-trends-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={checkIns} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(d) => `D${d}`}
                    />
                    <YAxis
                      domain={[1, 10]}
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        fontSize: 11,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      name={t('metric.mood.mood')}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="stress"
                      name={t('metric.mood.stress')}
                      stroke="var(--status-warning)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="motivation"
                      name={t('metric.mood.motivation')}
                      stroke="var(--status-advisory)"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {proxies && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                      <div className="text-[10px] text-muted-foreground">
                        {t('behavioral.sleepRegularity')}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                        {Math.round(proxies.sleepRegularityIndex * 100)}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                      <div className="text-[10px] text-muted-foreground">
                        {t('behavioral.missedExercise')}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                        {proxies.missedExerciseCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                      <div className="text-[10px] text-muted-foreground">
                        {t('behavioral.checkinCompliance')}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                        {proxies.checkInCompliancePct}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/40 bg-primary/10 p-2.5">
                      <div className="text-[10px] text-primary">
                        {t('behavioral.passiveProxyScore')}
                      </div>
                      <div
                        data-testid="passive-proxy-score"
                        className="mt-0.5 font-mono text-sm font-bold text-primary tabular-nums"
                      >
                        {formatNumber(proxies.passiveProxyScore, 2)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('behavioral.passiveProxyHint')}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Davranışsal Durum Çipleri */}
        <div className="lg:col-span-4">
          <SectionCard title={t('behavioral.statesTitle')} subtitle={t('behavioral.statesNote')}>
            <div className="space-y-3">
              {behavioralStates.map((st) => (
                <div
                  key={st.state}
                  className="space-y-1.5 rounded-lg border border-border/70 bg-background/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Brain aria-hidden="true" className="size-3.5 text-primary" />
                      <span>{t(`state.${st.state}`)}</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      {Math.round(st.score * 100)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    {st.contributors.slice(0, 3).map((c) => (
                      <div
                        key={c.metric}
                        className="flex justify-between font-mono text-[10px] text-muted-foreground"
                      >
                        <span>{t(`metric.${c.metric}`)}</span>
                        <span>
                          z={c.z.toFixed(1)} ({Math.round(c.weight * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
