'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MILESTONES, getJourneyState } from '@/lib/milestones'
import { formatHMS, formatRemaining, formatMoney } from '@/lib/format'

const SAVINGS_PER_DAY = 22.5
const WAKING_SECONDS_PER_DAY = 16 * 3600
const WAVE_MINUTES = 20
const WAVE_SECONDS = WAVE_MINUTES * 60

interface DemoProtocol {
  id: string
  pillar: 'nutrition' | 'movement'
  label: string
  detail: string
}

const DEMO_PROTOCOLS: DemoProtocol[] = [
  { id: 'n1', pillar: 'nutrition', label: 'First meal at or after 11:30', detail: 'First MEAL at or after 11:30 AM. Fuel (morning fuel cap, changeroom shake) is governed by its own line and is not a meal.' },
  { id: 'n2', pillar: 'nutrition', label: 'Eating closed by 19:30', detail: 'All eating done by 19:30. Scored independently - a missed start never cancels the closure.' },
  { id: 'n3', pillar: 'nutrition', label: 'Eat 2 meals, each within 30 minutes', detail: 'Two clear meals instead of all-day grazing.' },
  { id: 'n4', pillar: 'nutrition', label: 'No added sugar', detail: 'Keep today free of foods with added sugar.' },
  { id: 'n5', pillar: 'nutrition', label: 'No white rice or white flour', detail: 'Choose foods outside the refined white-rice and white-flour pattern.' },
  { id: 'n6', pillar: 'nutrition', label: 'Stay gluten-free', detail: 'Keep both meals gluten-free.' },
  { id: 'n7', pillar: 'nutrition', label: 'No fast food', detail: 'Cook or choose clean. No fast food today.' },
  { id: 'm1', pillar: 'movement', label: 'Daily movement', detail: '8,000+ steps or 30 minutes of walking, cycling, elliptical or equivalent activity. Never-zero fallback: a micro bodyweight set counts when nothing else is possible.' },
  { id: 'm2', pillar: 'movement', label: 'Strength training 3×/week', detail: 'Three strength sessions per week. Any split, any duration that counts.' },
]

export default function DemoPage() {
  // The demo "attempt" starts the moment this page loads. Nothing is persisted.
  const [startedAt] = useState(() => new Date())
  const [now, setNow] = useState(() => new Date())
  const [toggles, setToggles] = useState<Record<string, { committed: boolean; held: boolean }>>({})
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

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const elapsedSeconds = elapsedMs / 1000
  const fullDays = Math.floor(elapsedMs / 86400000)
  const saved = (elapsedSeconds * SAVINGS_PER_DAY) / WAKING_SECONDS_PER_DAY
  const journey = getJourneyState(startedAt, now)
  const upcoming = MILESTONES[journey.currentIndex]
  const allComplete = journey.currentIndex >= MILESTONES.length

  const nutrition = DEMO_PROTOCOLS.filter((p) => p.pillar === 'nutrition')
  const movement = DEMO_PROTOCOLS.filter((p) => p.pillar === 'movement')

  function toggle(p: DemoProtocol, key: 'committed' | 'held') {
    setToggles((prev) => {
      const current = prev[p.id] ?? { committed: false, held: false }
      return { ...prev, [p.id]: { ...current, [key]: !current[key] } }
    })
  }

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

  const renderItem = (p: DemoProtocol) => {
    const state = toggles[p.id] ?? { committed: false, held: false }
    return (
      <div key={p.id} className="card">
        <div className="font-bold">{p.label}</div>
        <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{p.detail}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={() => toggle(p, 'committed')}
            className={state.committed ? 'btn-primary' : 'btn-ghost'}
          >
            Committed
          </button>
          <button
            type="button"
            onClick={() => toggle(p, 'held')}
            className={state.held ? 'btn-primary' : 'btn-ghost'}
          >
            Held
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto pb-16">
      {/* Persistent demo banner */}
      <div className="sticky top-0 z-40 bg-[#f0506e]/15 backdrop-blur border-b border-[#f0506e]/30">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">Demo mode.</span>{' '}
            <span className="text-[#9aa0ae]">Nothing here is saved.</span>
          </p>
          <Link href="/signup" className="btn-primary whitespace-nowrap !py-2 !px-4 text-sm">
            Start my real day 1
          </Link>
        </div>
      </div>

      <main className="px-4 pt-4 space-y-4">
        <p className="text-xs text-[#9aa0ae] text-center">
          Sample data shown for illustration. Your real account starts fresh.
        </p>

        {/* Counter card */}
        <section className="card text-center">
          <p className="text-6xl font-bold tabular-nums">{fullDays}</p>
          <p className="text-[#9aa0ae] text-sm mt-1">clean days</p>
          <p className="text-2xl font-semibold tabular-nums mt-3">{formatHMS(elapsedMs)}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">
            since you opened this demo
          </p>
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

        {/* Protocol */}
        <section className="space-y-3">
          <h2 className="text-base font-bold">Today&apos;s protocol</h2>
          <p className="text-sm" style={{ color: '#9aa0ae' }}>
            Committed is the promise you make each morning. Held is what you
            record each night. Try the toggles. They only live in this demo.
          </p>
          <h3 className="text-sm font-bold text-[#9aa0ae] uppercase tracking-wide">Nutrition</h3>
          {nutrition.map(renderItem)}
          <h3 className="text-sm font-bold text-[#9aa0ae] uppercase tracking-wide pt-2">Movement</h3>
          {movement.map(renderItem)}
        </section>

        {/* Weight card (sample) */}
        <section className="card">
          <h2 className="font-semibold">Weight</h2>
          <p className="text-[#9aa0ae] text-sm mt-1">Starting weight 218.5 lb</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            216.2 <span className="text-sm font-normal text-[#9aa0ae]">lb today</span>
          </p>
          <p className="text-[#9aa0ae] text-xs mt-2">Sample numbers for the demo.</p>
        </section>

        {/* Stat cards */}
        <section className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-lg font-semibold tabular-nums">{formatMoney(saved)}</p>
            <p className="text-[#9aa0ae] text-xs mt-1">on pace to save &middot; live</p>
          </div>
          <div className="card">
            <p className="text-lg font-semibold tabular-nums">{wavesRidden}</p>
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

        {/* Bottom CTA */}
        <section className="card text-center space-y-3">
          <p className="text-[#9aa0ae] text-sm">
            Liked the feel of it? Your real day 1 starts the moment you sign up.
          </p>
          <Link href="/signup" className="btn-primary w-full block text-center">
            Start my real day 1
          </Link>
        </section>
      </main>
    </div>
  )
}
