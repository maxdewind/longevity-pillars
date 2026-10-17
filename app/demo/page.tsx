'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MILESTONES, getJourneyState } from '@/lib/milestones'
import { formatHMS, formatRemaining, formatMoney } from '@/lib/format'
import { useDemo, DemoGate } from './DemoProvider'

const SAVINGS_PER_DAY = 22.5
const WAKING_SECONDS_PER_DAY = 16 * 3600
const WAVE_MINUTES = 20
const WAVE_SECONDS = WAVE_MINUTES * 60

function ProgressBody() {
  const { snap } = useDemo()
  const [now, setNow] = useState(() => new Date())
  const [waveSecondsLeft, setWaveSecondsLeft] = useState<number | null>(null)
  const [waveDoneMsg, setWaveDoneMsg] = useState(false)
  const [wavesRidden, setWavesRidden] = useState(0)
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(t)
      if (waveTimerRef.current) clearInterval(waveTimerRef.current)
      if (waveDoneTimeoutRef.current) clearTimeout(waveDoneTimeoutRef.current)
    }
  }, [])

  if (!snap) return null

  function startWave() {
    if (waveTimerRef.current) clearInterval(waveTimerRef.current)
    setWaveDoneMsg(false)
    setWaveSecondsLeft(WAVE_SECONDS)
    waveTimerRef.current = setInterval(() => {
      setWaveSecondsLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          if (waveTimerRef.current) clearInterval(waveTimerRef.current)
          setWaveSecondsLeft(null)
          setWavesRidden((c) => c + 1)
          setWaveDoneMsg(true)
          if (waveDoneTimeoutRef.current) clearTimeout(waveDoneTimeoutRef.current)
          waveDoneTimeoutRef.current = setTimeout(() => setWaveDoneMsg(false), 8000)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelWave() {
    if (waveTimerRef.current) clearInterval(waveTimerRef.current)
    waveTimerRef.current = null
    setWaveSecondsLeft(null)
  }

  const waveRunning = waveSecondsLeft !== null
  const startedAt = new Date(snap.journey_start + 'T12:00:00')
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const elapsedSeconds = elapsedMs / 1000
  const fullDays = Math.floor(elapsedMs / 86400000)
  const saved = (elapsedSeconds * SAVINGS_PER_DAY) / WAKING_SECONDS_PER_DAY
  const journey = getJourneyState(startedAt, now)
  const upcoming = MILESTONES[journey.currentIndex]
  const allComplete = journey.currentIndex >= MILESTONES.length

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#9aa0ae] text-center">
        A frozen copy of the builder&apos;s own account. He publishes it himself, when he feels like it.
      </p>

      <section className="card text-center">
        <p className="text-6xl font-bold tabular-nums">{fullDays}</p>
        <p className="text-[#9aa0ae] text-sm mt-1">clean days</p>
        <p className="text-2xl font-semibold tabular-nums mt-3">{formatHMS(elapsedMs)}</p>
        <p className="text-[#9aa0ae] text-xs mt-1">since his day 1 · live</p>
      </section>

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

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-lg font-semibold tabular-nums">{formatMoney(saved)}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">on pace to save · live</p>
        </div>
        <div className="card">
          <p className="text-lg font-semibold tabular-nums">{wavesRidden}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">craving waves ridden</p>
        </div>
      </section>

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

      <section className="card text-center space-y-3">
        <p className="text-[#9aa0ae] text-sm">
          This is the real thing, running on a real person&apos;s real days. Your day 1 starts the moment you sign up.
        </p>
        <Link href="/signup" className="btn-primary w-full block text-center">
          Start my real day 1
        </Link>
      </section>
    </div>
  )
}

export default function DemoProgressPage() {
  return (
    <DemoGate>
      <ProgressBody />
    </DemoGate>
  )
}
