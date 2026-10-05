'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MILESTONES, getJourneyState } from '@/lib/milestones'
import { formatHMS, formatRemaining, formatMoney, todayISO } from '@/lib/format'
import type { Attempt, WeightLog } from '@/lib/types'

const SAVINGS_PER_DAY = 22.5
const WAKING_SECONDS_PER_DAY = 16 * 3600 // 57600
const WAVE_MINUTES = 20
const WAVE_SECONDS = WAVE_MINUTES * 60

export default function ProgressPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [waveCount, setWaveCount] = useState(0)
  const [waveSecondsLeft, setWaveSecondsLeft] = useState<number | null>(null)
  const [waveDoneMsg, setWaveDoneMsg] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipNote, setSlipNote] = useState('')
  const [loggingSlip, setLoggingSlip] = useState(false)
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      setUserId(uid)
      if (!uid) {
        setLoading(false)
        return
      }

      const { data: attemptData } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', uid)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)

      let current = attemptData?.[0] ?? null
      if (!current) {
        const { data: inserted } = await supabase
          .from('attempts')
          .insert({ user_id: uid })
          .select()
          .single()
        current = inserted ?? null
      }
      setAttempt(current)

      const { data: weightData } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', uid)
        .order('log_date', { ascending: true })
      setWeights((weightData ?? []) as WeightLog[])

      const { count } = await supabase
        .from('wave_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
      setWaveCount(count ?? 0)

      setLoading(false)
    }
    init()
    return () => {
      if (waveTimerRef.current) clearInterval(waveTimerRef.current)
      if (waveDoneTimeoutRef.current) clearTimeout(waveDoneTimeoutRef.current)
    }
  }, [])

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="card">
          <p className="text-[#9aa0ae]">Loading my progress...</p>
        </div>
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="card">
          <p>I need to be signed in to track my progress.</p>
        </div>
      </main>
    )
  }

  const startedAt = attempt ? new Date(attempt.started_at) : now
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const elapsedSeconds = elapsedMs / 1000
  const fullDays = Math.floor(elapsedMs / 86400000)
  const saved = (elapsedSeconds * SAVINGS_PER_DAY) / WAKING_SECONDS_PER_DAY
  const journey = getJourneyState(startedAt, now)
  const upcoming = MILESTONES[journey.currentIndex]
  const allComplete = journey.currentIndex >= MILESTONES.length

  const startedCaption = startedAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const startWeight = weights[0]?.weight_lb ?? null
  const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight_lb : null

  async function handleLogWeight() {
    const val = parseFloat(weightInput)
    if (!val || val <= 0 || !userId) return
    setSavingWeight(true)
    const supabase = createClient()
    await supabase.from('weight_logs').upsert(
      { user_id: userId, log_date: todayISO(), weight_lb: val },
      { onConflict: 'user_id,log_date' }
    )
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: true })
    setWeights((data ?? []) as WeightLog[])
    setWeightInput('')
    setSavingWeight(false)
  }

  function startWave() {
    if (waveTimerRef.current) clearInterval(waveTimerRef.current)
    setWaveDoneMsg(false)
    setWaveSecondsLeft(WAVE_SECONDS)
    waveTimerRef.current = setInterval(async () => {
      setWaveSecondsLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          if (waveTimerRef.current) clearInterval(waveTimerRef.current)
          void finishWave()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  async function finishWave() {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('wave_logs').insert({ user_id: userId, duration_min: WAVE_MINUTES })
    setWaveCount((c) => c + 1)
    setWaveSecondsLeft(null)
    setWaveDoneMsg(true)
    if (waveDoneTimeoutRef.current) clearTimeout(waveDoneTimeoutRef.current)
    waveDoneTimeoutRef.current = setTimeout(() => setWaveDoneMsg(false), 8000)
  }

  function cancelWave() {
    if (waveTimerRef.current) clearInterval(waveTimerRef.current)
    waveTimerRef.current = null
    setWaveSecondsLeft(null)
  }

  async function handleLogSlip() {
    if (!userId || !attempt || loggingSlip) return
    setLoggingSlip(true)
    const supabase = createClient()
    await supabase.from('slip_logs').insert({ user_id: userId, note: slipNote || null })
    await supabase
      .from('attempts')
      .update({ ended_at: new Date().toISOString(), slip_count: attempt.slip_count + 1 })
      .eq('id', attempt.id)
    const { data: fresh } = await supabase
      .from('attempts')
      .insert({ user_id: userId })
      .select()
      .single()
    setAttempt((fresh ?? null) as Attempt | null)
    setSlipNote('')
    setSlipOpen(false)
    setLoggingSlip(false)
  }

  const waveRunning = waveSecondsLeft !== null

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      {/* Counter card */}
      <section className="card text-center">
        <p className="text-6xl font-bold tabular-nums">{fullDays}</p>
        <p className="text-[#9aa0ae] text-sm mt-1">clean days</p>
        <p className="text-2xl font-semibold tabular-nums mt-3">{formatHMS(elapsedMs)}</p>
        <p className="text-[#9aa0ae] text-xs mt-1">since {startedCaption}</p>
      </section>

      {/* Milestone card, directly under the counter */}
      <section className="card">
        {allComplete ? (
          <p className="font-semibold">All 12 milestones complete.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-[#9aa0ae]">
                Upcoming &middot; Milestone {upcoming.id} of 12
              </p>
              <p className="text-sm text-[#9aa0ae] tabular-nums whitespace-nowrap">
                {formatRemaining(journey.msRemaining)}
              </p>
            </div>
            <h2 className="text-lg font-semibold mt-1">{upcoming.title}</h2>
            <p className="text-[#9aa0ae] text-sm mt-1">{upcoming.bodyState}</p>
            <div className="h-2 rounded-full bg-[#14161d] mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#f0506e]"
                style={{ width: `${Math.min(100, Math.max(0, journey.progressPct))}%` }}
              />
            </div>
          </>
        )}
      </section>

      {/* Weight card */}
      <section className="card">
        <h2 className="font-semibold">Weight</h2>
        {weights.length === 0 ? (
          <>
            <p className="text-[#9aa0ae] text-sm mt-1">
              I log my starting weight today, then check in daily from tomorrow.
            </p>
            <label className="label" htmlFor="start-weight">Starting weight (lb)</label>
            <div className="flex gap-2 mt-1">
              <input
                id="start-weight"
                type="number"
                inputMode="decimal"
                className="input flex-1"
                placeholder="e.g. 218.5"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary whitespace-nowrap"
                onClick={handleLogWeight}
                disabled={savingWeight}
              >
                Log starting weight
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[#9aa0ae] text-sm mt-1">
              Starting weight {startWeight} lb
            </p>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {currentWeight} <span className="text-sm font-normal text-[#9aa0ae]">lb today</span>
            </p>
            <label className="label" htmlFor="daily-weight">Update my weight (lb)</label>
            <div className="flex gap-2 mt-1">
              <input
                id="daily-weight"
                type="number"
                inputMode="decimal"
                className="input flex-1"
                placeholder={String(currentWeight)}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary whitespace-nowrap"
                onClick={handleLogWeight}
                disabled={savingWeight}
              >
                Log today
              </button>
            </div>
            <Link href="/weight" className="inline-block mt-3 text-[#f0506e] text-sm font-medium">
              Weight plan &rarr;
            </Link>
          </>
        )}
      </section>

      {/* Stat cards row */}
      <section className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-lg font-semibold tabular-nums">{formatMoney(saved)}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">on pace to save &middot; live</p>
        </div>
        <div className="card">
          <p className="text-lg font-semibold tabular-nums">{fullDays}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">total clean days</p>
        </div>
        <div className="card">
          <p className="text-lg font-semibold tabular-nums">{waveCount}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">craving waves ridden</p>
        </div>
      </section>

      {/* Wave rider */}
      <section className="card text-center">
        {!waveRunning && !waveDoneMsg && (
          <>
            <p className="text-[#9aa0ae] text-sm">A craving is a wave. It peaks, then it passes.</p>
            <button type="button" className="btn-primary mt-3 w-full" onClick={startWave}>
              Ride out a wave
            </button>
          </>
        )}
        {waveRunning && (
          <>
            <p className="text-5xl font-bold tabular-nums">
              {formatHMS(waveSecondsLeft * 1000).slice(3)}
            </p>
            <p className="text-sm mt-2">
              A craving wave passes in minutes. You can ride this one out.
            </p>
            <button type="button" className="btn-ghost mt-3" onClick={cancelWave}>
              Cancel
            </button>
          </>
        )}
        {waveDoneMsg && !waveRunning && (
          <p className="font-semibold">Wave ridden. Nice.</p>
        )}
      </section>

      {/* Slip logging */}
      <section className="card">
        {!slipOpen ? (
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => setSlipOpen(true)}
          >
            Log a slip
          </button>
        ) : (
          <>
            <label className="label" htmlFor="slip-note">
              What happened? (optional)
            </label>
            <textarea
              id="slip-note"
              className="input w-full min-h-[72px]"
              placeholder="I ate late after a stressful call..."
              value={slipNote}
              onChange={(e) => setSlipNote(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => setSlipOpen(false)}
              >
                Keep going
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleLogSlip}
                disabled={loggingSlip}
              >
                Log slip
              </button>
            </div>
          </>
        )}
        <p className="text-[#9aa0ae] text-xs mt-3 text-center">
          A slip restarts the counter, never the story.
        </p>
      </section>
    </main>
  )
}
