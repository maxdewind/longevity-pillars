'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MILESTONES, getJourneyState } from '@/lib/milestones'
import { formatHMS, formatRemaining, formatMoney } from '@/lib/format'
import type { DemoPayload, DemoRoutineSnapshot } from '@/lib/demoSnapshot'

// The public demo mirrors this account's published snapshot.
const FEATURED_USER_ID = 'd9409fba-fedc-48bb-b457-1c9e9dc91ad3'

const SAVINGS_PER_DAY = 22.5
const WAKING_SECONDS_PER_DAY = 16 * 3600
const WAVE_MINUTES = 20
const WAVE_SECONDS = WAVE_MINUTES * 60

const fmtPub = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const shortHalfName = (label: string) => {
  const m = label.match(/ \((Meal \d)\)$/)
  return m ? m[1] : label
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function statePill(on: boolean, label: string) {
  return (
    <span
      className={`text-xs font-semibold px-3 py-2 rounded-lg border whitespace-nowrap ${
        on ? 'bg-[#f0506e] border-[#f0506e] text-white' : 'border-[#2c313d] text-[#9aa0ae]'
      }`}
    >
      {on ? `✓ ${label}` : label}
    </span>
  )
}

interface DemoCard {
  key: string
  title: string
  detail: string
  rows: DemoRoutineSnapshot[]
}

function toCards(routines: DemoRoutineSnapshot[]): DemoCard[] {
  const cards: DemoCard[] = []
  routines.forEach((r) => {
    if (r.card_group) {
      const existing = cards.find((c) => c.key === r.card_group)
      if (existing) {
        existing.rows.push(r)
        existing.rows.sort((a, b) => a.label.localeCompare(b.label))
        return
      }
      cards.push({
        key: r.card_group,
        title: r.label.replace(/ \(Meal \d\)$/, ''),
        detail: r.detail,
        rows: [r],
      })
      return
    }
    cards.push({ key: r.id, title: r.label, detail: r.detail, rows: [r] })
  })
  return cards
}

function WeightSparkline({ weights }: { weights: { log_date: string; weight_lb: number }[] }) {
  const pts = weights.slice(-30)
  if (pts.length < 2) return null
  const W = 320
  const H = 90
  const P = 8
  const vals = pts.map((w) => w.weight_lb)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = Math.max((max - min) * 0.2, 0.5)
  const xFor = (i: number) => P + (i / Math.max(pts.length - 1, 1)) * (W - 2 * P)
  const yFor = (v: number) => P + (1 - (v - (min - pad)) / (max + pad - (min - pad))) * (H - 2 * P)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: 110 }}>
      <polyline
        points={pts.map((w, i) => `${xFor(i)},${yFor(w.weight_lb)}`).join(' ')}
        fill="none"
        stroke="#f0506e"
        strokeWidth={2}
      />
      {pts.map((w, i) => (
        <circle key={w.log_date} cx={xFor(i)} cy={yFor(w.weight_lb)} r={3} fill="#f0506e" />
      ))}
    </svg>
  )
}

export default function DemoPage() {
  const [snap, setSnap] = useState<DemoPayload | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('demo_snapshot')
        .select('payload, updated_at')
        .eq('user_id', FEATURED_USER_ID)
        .limit(1)
      const row = (data as { payload: DemoPayload; updated_at: string }[] | null)?.[0]
      if (row) {
        setSnap(row.payload)
        setPublishedAt(row.updated_at)
      }
      setLoaded(true)
    }
    load()
  }, [])

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

  if (!loaded) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <p className="text-sm" style={{ color: '#9aa0ae' }}>Loading the demo…</p>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        <div className="card text-center">
          <p className="font-semibold">The live demo hasn&apos;t been published yet.</p>
          <p className="text-sm mt-2" style={{ color: '#9aa0ae' }}>
            Check back soon, or start your own day 1 now.
          </p>
          <Link href="/signup" className="btn-primary w-full block text-center mt-4">
            Start my real day 1
          </Link>
        </div>
      </div>
    )
  }

  const startedAt = new Date(snap.journey_start + 'T12:00:00')
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const elapsedSeconds = elapsedMs / 1000
  const fullDays = Math.floor(elapsedMs / 86400000)
  const saved = (elapsedSeconds * SAVINGS_PER_DAY) / WAKING_SECONDS_PER_DAY
  const journey = getJourneyState(startedAt, now)
  const upcoming = MILESTONES[journey.currentIndex]
  const allComplete = journey.currentIndex >= MILESTONES.length

  const nutrition = toCards(snap.routines.filter((r) => r.pillar === 'nutrition'))
  const movement = toCards(snap.routines.filter((r) => r.pillar === 'movement'))
  const mind = toCards(snap.routines.filter((r) => r.pillar === 'mind'))
  const exp = snap.experiment
  const latestWeight = snap.weights[snap.weights.length - 1] ?? null

  const renderCard = (card: DemoCard) => {
    const rows = card.rows
    const split = rows.length > 1
    const committedOn = rows.every((r) => r.committed)
    return (
      <div key={card.key} className="card">
        <button
          type="button"
          onClick={() => setExpanded((e) => ({ ...e, [card.key]: !e[card.key] }))}
          className="w-full text-left flex items-start justify-between gap-2"
          style={{ background: 'none' }}
        >
          <span className="font-bold">
            {card.title}
            {rows.some((r) => r.is_experimental) && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#2a2d36', color: '#9aa0ae' }}>
                Experimental
              </span>
            )}
          </span>
          <span style={{ color: '#9aa0ae' }}>{expanded[card.key] ? '▾' : '▸'}</span>
        </button>
        {expanded[card.key] && (
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{card.detail}</p>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          {statePill(committedOn, 'Committed')}
          {rows.map((r) => {
            const label = r.held_at ? `Ended ${fmtTime(r.held_at)}` : shortHalfName(r.label)
            return <span key={r.id}>{statePill(r.held, split ? label : 'Held')}</span>
          })}
        </div>
        {!split && (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
            Held {rows[0].held14}/{rows[0].days14} days · Committed {rows[0].committed14}/{rows[0].days14} mornings
          </p>
        )}
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
            <span className="text-[#9aa0ae]">
              Max&apos;s real protocol, published {publishedAt ? fmtPub(publishedAt) : 'recently'}. Nothing here is saved.
            </span>
          </p>
          <Link href="/signup" className="btn-primary whitespace-nowrap !py-2 !px-4 text-sm">
            Start my real day 1
          </Link>
        </div>
      </div>

      <main className="px-4 pt-4 space-y-4">
        <p className="text-xs text-[#9aa0ae] text-center">
          A frozen copy of the builder&apos;s own account. He publishes it himself, when he feels like it.
        </p>

        {/* Counter card */}
        <section className="card text-center">
          <p className="text-6xl font-bold tabular-nums">{fullDays}</p>
          <p className="text-[#9aa0ae] text-sm mt-1">clean days</p>
          <p className="text-2xl font-semibold tabular-nums mt-3">{formatHMS(elapsedMs)}</p>
          <p className="text-[#9aa0ae] text-xs mt-1">since his day 1 · live</p>
        </section>

        {/* Milestone card */}
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
            His actual check-ins, as published {publishedAt ? fmtPub(publishedAt) : ''}. Read-only.
          </p>
          {mind.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-[#9aa0ae] uppercase tracking-wide">Mind</h3>
              {mind.map(renderCard)}
            </>
          )}
          <h3 className="text-sm font-bold text-[#9aa0ae] uppercase tracking-wide">Nutrition</h3>
          {nutrition.map(renderCard)}
          <h3 className="text-sm font-bold text-[#9aa0ae] uppercase tracking-wide pt-2">Movement</h3>
          {movement.map(renderCard)}
        </section>

        {/* Experiment */}
        {exp && (
          <section className="card" style={{ borderColor: '#f0506e' }}>
            <p className="text-xs font-semibold tracking-wider" style={{ color: '#f0506e' }}>
              SELF-EXPERIMENT · DAY {exp.day_number} OF {exp.duration_days}
            </p>
            <p className="text-xl font-bold mt-1">{exp.title}</p>
            <p className="mt-2">
              <span className="inline-block text-xs font-bold tracking-wider" style={{ color: '#f0506e', border: '1px solid #f0506e', borderRadius: 999, padding: '4px 12px' }}>
                {cap(exp.pillar)}
              </span>
            </p>
            {exp.hypothesis && <p className="mt-2 italic text-sm" style={{ color: '#9aa0ae' }}>{exp.hypothesis}</p>}
            <div className="mt-4 flex gap-2 flex-wrap">
              {exp.dots.map((d) => (
                <span key={d.date} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: d.held ? '#f0506e' : 'transparent',
                  border: `1px solid ${d.held ? '#f0506e' : '#4a5160'}`,
                }} />
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>{exp.held_count} of {exp.duration_days} days held</p>
            {exp.weight_delta_lb != null && (
              <p className="mt-2 text-2xl font-bold">
                <span style={{ color: '#f0506e' }}>{exp.weight_delta_lb > 0 ? '+' : ''}{exp.weight_delta_lb.toFixed(1)} lb</span>
                <span className="text-base font-normal"> vs day 1</span>
              </p>
            )}
            {exp.baseline_labels.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>
                  BASELINE – THE CONTROL{exp.baseline_held_pct != null && ` · ${Math.round(exp.baseline_held_pct * 100)}% HELD`}
                </p>
                {exp.baseline_labels.map((l) => (
                  <p key={l} className="text-sm py-1" style={{ borderBottom: '1px solid #2c313d' }}>🔒 {l}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Weight */}
        {latestWeight && (
          <section className="card">
            <h2 className="font-semibold">Weight</h2>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {latestWeight.weight_lb.toFixed(1)} <span className="text-sm font-normal text-[#9aa0ae]">lb · {fmtPub(latestWeight.log_date)}</span>
            </p>
            <WeightSparkline weights={snap.weights} />
            <p className="text-[#9aa0ae] text-xs mt-2">His last 30 weigh-ins, as published.</p>
          </section>
        )}

        {/* Stat cards */}
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
            This is the real thing, running on a real person&apos;s real days. Your day 1 starts the moment you sign up.
          </p>
          <Link href="/signup" className="btn-primary w-full block text-center">
            Start my real day 1
          </Link>
        </section>
      </main>
    </div>
  )
}
