'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Protocol, Experiment } from '@/lib/types'

interface CheckState {
  committed: boolean
  held: boolean
  held_at: string | null
}

interface CountState {
  held: number
  committed: number
  days: number
  start: string
  isNew: boolean
}

interface HistoryRow {
  protocol_id: string
  held: boolean
  log_date: string
}

const UNCHECKED: CheckState = { committed: false, held: false, held_at: null }
const TRAILING_DAYS = 14
const WEEKLY_TARGET = 3
const DRAW_PER_PILLAR = 3
const FOCUS_DAYS = 7

const PILLARS: { key: Protocol['pillar']; label: string }[] = [
  { key: 'mind', label: 'Mind' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'movement', label: 'Movement' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'social', label: 'Social connections' },
]

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Deterministic daily shuffle: the same pillar draws the same 3 habits all
// day (so morning Committed and night Held line up), and a new set tomorrow.
// Seeded only by the date and the pillar, never by the user, so no server
// table is needed to remember today's draw.
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  let state = seed || 1
  const next = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

interface Card {
  key: string
  title: string
  detail: string
  rows: Protocol[]
}

function toCards(ps: Protocol[]): Card[] {
  const cards: Card[] = []
  ps.forEach((p) => {
    if (p.card_group) {
      const existing = cards.find((c) => c.key === p.card_group)
      if (existing) {
        existing.rows.push(p)
        existing.rows.sort((a, b) => a.label.localeCompare(b.label))
        return
      }
      cards.push({
        key: p.card_group as string,
        title: p.label.replace(/ \(Meal \d\)$/, ''),
        detail: p.detail,
        rows: [p],
      })
      return
    }
    cards.push({ key: p.id, title: p.label, detail: p.detail, rows: [p] })
  })
  return cards
}

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [counts, setCounts] = useState<Record<string, CountState>>({})
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState<Protocol | null>(null)
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDetail, setNewDetail] = useState('')
  const [newPillar, setNewPillar] = useState<Protocol['pillar']>('nutrition')
  const [adding, setAdding] = useState(false)

  const today = todayISO()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: protos, error: pErr } = await supabase
        .from('protocols')
        .select('*')
        .eq('user_id', user.id)
        .eq('track', 'classic')
        .order('position', { ascending: true })
      if (pErr) setActionError(pErr.message)

      const { data: rows } = await supabase
        .from('protocol_checks')
        .select('protocol_id, committed, held, held_at')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())

      setProtocols(((protos as Protocol[] | null) ?? []).filter((p) => p.enabled))
      const map: Record<string, CheckState> = {}
      ;(rows ?? []).forEach((r) => {
        map[r.protocol_id] = { committed: !!r.committed, held: !!r.held, held_at: (r.held_at as string | null) ?? null }
      })
      setChecks(map)

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (TRAILING_DAYS - 1))
      const [{ data: recent }, { data: firstRow }] = await Promise.all([
        supabase
          .from('protocol_checks')
          .select('protocol_id, committed, held, log_date')
          .eq('user_id', user.id)
          .gte('log_date', todayISO(cutoff)),
        supabase
          .from('protocol_checks')
          .select('log_date')
          .eq('user_id', user.id)
          .order('log_date', { ascending: true })
          .limit(1),
      ])
      setHistory(((recent ?? []) as HistoryRow[]).map((r) => ({
        protocol_id: r.protocol_id,
        held: !!r.held,
        log_date: r.log_date,
      })))
      const { data: expRows } = await supabase
        .from('experiments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      setExperiment(((expRows as Experiment[] | null) ?? [])[0] ?? null)
      const firstDate = (firstRow?.[0]?.log_date as string | undefined) ?? todayISO()
      const countMap: Record<string, CountState> = {}
      ;((protos as Protocol[] | null) ?? []).forEach((p) => {
        const addedOn = (p.created_at ?? '').slice(0, 10)
        const start = addedOn && addedOn > firstDate ? addedOn : firstDate
        const pr = ((recent ?? []) as { protocol_id: string; committed: boolean; held: boolean; log_date: string }[]).filter(
          (r) => r.protocol_id === p.id && r.log_date >= start
        )
        countMap[p.id] = {
          held: pr.filter((r) => r.held).length,
          committed: pr.filter((r) => r.committed).length,
          days: Math.min(TRAILING_DAYS, Math.max(1, daysBetween(start, today) + 1)),
          start,
          isNew: start > firstDate,
        }
      })
      setCounts(countMap)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (p: Protocol, key: 'committed' | 'held') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const current = checks[p.id] ?? UNCHECKED
    const next = { ...current, [key]: !current[key] }
    setChecks((c) => ({ ...c, [p.id]: next }))
    const { error } = await supabase.from('protocol_checks').upsert(
      {
        user_id: user.id,
        protocol_id: p.id,
        log_date: todayISO(),
        committed: next.committed,
        held: next.held,
      },
      { onConflict: 'user_id,protocol_id,log_date' }
    )
    if (error) setActionError(error.message)
    else setActionError(null)
  }

  const isMealEnd = (p: Protocol) =>
    p.card_group === 'two-meals' && / \(Meal 2\)$/.test(p.label)

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const writeMealEnd = async (p: Protocol, next: CheckState) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setChecks((c) => ({ ...c, [p.id]: next }))
    const { error } = await supabase.from('protocol_checks').upsert(
      {
        user_id: user.id,
        protocol_id: p.id,
        log_date: todayISO(),
        committed: next.committed,
        held: next.held,
        held_at: next.held_at,
      },
      { onConflict: 'user_id,protocol_id,log_date' }
    )
    if (error) setActionError(error.message)
    else setActionError(null)
  }

  const onMealEndTap = (p: Protocol) => {
    const current = checks[p.id] ?? UNCHECKED
    if (current.held_at) {
      setConfirmClear(p)
      return
    }
    void writeMealEnd(p, { ...current, held: true, held_at: new Date().toISOString() })
  }

  const toggleCardCommitted = async (card: Card) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const next = !card.rows.every((r) => (checks[r.id] ?? UNCHECKED).committed)
    const nextChecks = { ...checks }
    card.rows.forEach((r) => {
      const current = nextChecks[r.id] ?? UNCHECKED
      nextChecks[r.id] = { ...current, committed: next }
    })
    setChecks(nextChecks)
    const results = await Promise.all(
      card.rows.map((r) => {
        const s = nextChecks[r.id]
        return supabase.from('protocol_checks').upsert(
          {
            user_id: user.id,
            protocol_id: r.id,
            log_date: todayISO(),
            committed: s.committed,
            held: s.held,
          },
          { onConflict: 'user_id,protocol_id,log_date' }
        )
      })
    )
    const err = results.find((r) => r.error)?.error
    if (err) setActionError(err.message)
    else setActionError(null)
  }

  // --- Habit-draw actions: Pause, Retire, Needs focus -------------------
  const updateCard = async (card: Card, patch: Partial<Protocol>) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ids = new Set(card.rows.map((r) => r.id))
    setProtocols((ps) => ps.map((x) => (ids.has(x.id) ? { ...x, ...patch } : x)))
    const results = await Promise.all(
      card.rows.map((r) => supabase.from('protocols').update(patch).eq('id', r.id))
    )
    const err = results.find((r) => r.error)?.error
    if (err) {
      setActionError(err.message)
    } else {
      setActionError(null)
    }
  }

  const isRetired = (card: Card) => card.rows.some((r) => r.retired)
  const isPausedToday = (card: Card) => card.rows.some((r) => r.paused_on === today)
  const isFocused = (card: Card) => card.rows.some((r) => r.focus_until && r.focus_until >= today)
  const focusUntil = (card: Card) => card.rows.map((r) => r.focus_until).filter(Boolean).sort()[0] ?? null

  const onPause = (card: Card) => void updateCard(card, { paused_on: today })
  const onRetire = (card: Card) => void updateCard(card, { retired: true })
  const onRestore = (card: Card) => void updateCard(card, { retired: false, paused_on: null, focus_until: null })
  const onFocus = (card: Card) => {
    if (isFocused(card)) {
      void updateCard(card, { focus_until: null })
    } else {
      // Today plus the next 6 days: in the draw for the next week.
      void updateCard(card, { focus_until: addDaysISO(today, FOCUS_DAYS - 1) })
    }
  }

  const onAddHabit = async () => {
    const label = newLabel.trim()
    if (!label || adding) return
    setAdding(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }
    const samePillar = protocols.filter((p) => p.pillar === newPillar)
    const position = samePillar.length ? Math.max(...samePillar.map((p) => p.position)) + 1 : 1
    const { data, error } = await supabase
      .from('protocols')
      .insert({
        user_id: user.id,
        track: 'classic',
        pillar: newPillar,
        label,
        detail: newDetail.trim(),
        position,
        enabled: true,
      })
      .select('*')
      .single()
    if (error) {
      setActionError(error.message)
    } else {
      setActionError(null)
      if (data) setProtocols((ps) => [...ps, data as Protocol])
      setNewLabel('')
      setNewDetail('')
    }
    setAdding(false)
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const shortHalfName = (label: string): string => {
    const m = label.match(/ \((Meal \d)\)$/)
    return m ? m[1] : label
  }

  const smallBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#3a2a2e' : 'rgba(255,255,255,0.05)',
    color: active ? '#f0a0b0' : '#c9ccd4',
    border: `1px solid ${active ? '#e0607e' : 'rgba(255,255,255,0.1)'}`,
  })

  const renderSmallActions = (card: Card) => {
    const focused = isFocused(card)
    const paused = isPausedToday(card)
    const retired = isRetired(card)
    const until = focusUntil(card)
    return (
      <div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button type="button" onClick={() => onPause(card)} className="text-xs px-2 py-2 rounded-xl" style={smallBtn(paused)} disabled={retired}>
            {paused ? 'Paused today' : 'Pause'}
          </button>
          <button type="button" onClick={() => onRetire(card)} className="text-xs px-2 py-2 rounded-xl" style={smallBtn(retired)} disabled={retired}>
            Retire
          </button>
          <button type="button" onClick={() => onFocus(card)} className="text-xs px-2 py-2 rounded-xl" style={smallBtn(focused)} disabled={retired}>
            {focused ? 'Focused' : 'Needs focus'}
          </button>
        </div>
        {focused && until && (
          <p className="text-xs mt-2" style={{ color: '#9aa0ae' }}>
            Needs focus until {fmtShort(until)}: it stays in the daily 3 for this pillar.
          </p>
        )}
        {paused && !retired && (
          <p className="text-xs mt-2" style={{ color: '#9aa0ae' }}>
            Paused today only. It is back in the draw tomorrow.
          </p>
        )}
      </div>
    )
  }

  const renderCard = (card: Card) => {
    const rows = card.rows
    const split = rows.length > 1
    const committedOn = rows.every((r) => (checks[r.id] ?? UNCHECKED).committed)
    const experimental = rows.some((r) => r.is_experimental)
    const weeklyRow = rows.length === 1 ? rows[0] : null
    const isWeekly = !!weeklyRow && weeklyRow.cadence === 'weekly'
    const monday = (() => {
      const d = new Date()
      const dow = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dow)
      return todayISO(d)
    })()
    const weeklySessions =
      isWeekly && weeklyRow
        ? history.filter((h) => h.protocol_id === weeklyRow.id && h.held && h.log_date >= monday).length
        : 0
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
            {experimental && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#2a2d36', color: '#9aa0ae' }}>
                Experimental
              </span>
            )}
            {isFocused(card) && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#3a2a2e', color: '#f0a0b0' }}>
                Needs focus
              </span>
            )}
          </span>
          <span style={{ color: '#9aa0ae' }}>{expanded[card.key] ? '▾' : '▸'}</span>
        </button>
        {expanded[card.key] && (
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{card.detail}</p>
        )}
        {split ? (
          <div className="grid grid-cols-4 gap-2 mt-3">
            <button
              type="button"
              onClick={() => toggleCardCommitted(card)}
              className={`${committedOn ? 'btn-primary' : 'btn-ghost'} col-span-2`}
            >
              Committed
            </button>
            {rows.map((r) => {
              const s = checks[r.id] ?? UNCHECKED
              if (isMealEnd(r)) {
                const t = s.held_at ? fmtTime(s.held_at) : null
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onMealEndTap(r)}
                    className={s.held ? 'btn-primary' : 'btn-ghost'}
                    title={t ? 'Tap again to unclick' : 'Stamp when the meal ended'}
                  >
                    {t ? `Ended ${t}` : 'Meal end'}
                  </button>
                )
              }
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r, 'held')}
                  className={s.held ? 'btn-primary' : 'btn-ghost'}
                >
                  {shortHalfName(r.label)}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() => toggleCardCommitted(card)}
              className={committedOn ? 'btn-primary' : 'btn-ghost'}
            >
              Committed
            </button>
            <button
              type="button"
              onClick={() => toggle(rows[0], 'held')}
              className={(checks[rows[0].id] ?? UNCHECKED).held ? 'btn-primary' : 'btn-ghost'}
            >
              Held
            </button>
          </div>
        )}
        {renderSmallActions(card)}
        {isWeekly ? (
          <p className="text-xs tabular-nums mt-2 font-medium" style={{ color: '#c9ccd4' }}>
            {weeklySessions} of {WEEKLY_TARGET} sessions this week (Mon-Sun)
          </p>
        ) : split ? (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
            {rows.map((r) => {
              const c = counts[r.id]
              return `${shortHalfName(r.label)} held ${c ? `${c.held}/${c.days}` : '–'}`
            }).join(' · ')}
            {' · '}Committed {(() => {
              const c0 = counts[rows[0].id]
              return c0 ? `${c0.committed}/${c0.days}` : '–'
            })()} mornings{(() => {
              const late = rows.map((r) => counts[r.id]).find((c) => c?.isNew)
              return late ? ` · s. ${fmtShort(late.start)}` : ''
            })()}
          </p>
        ) : (
          (() => {
            const c = counts[rows[0].id]
            return c ? (
              <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
                Held {c.held}/{c.days} days · Committed {c.committed}/{c.days} mornings{c.isNew ? ` · s. ${fmtShort(c.start)}` : ''}
              </p>
            ) : null
          })()
        )}
      </div>
    )
  }

  const renderLibraryCard = (card: Card) => {
    const retired = isRetired(card)
    const focused = isFocused(card)
    return (
      <div key={card.key} className="card">
        <p className="font-bold">
          {card.title}
          {focused && (
            <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#3a2a2e', color: '#f0a0b0' }}>
              Needs focus
            </span>
          )}
          {retired && (
            <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#2a2d36', color: '#9aa0ae' }}>
              Retired
            </span>
          )}
        </p>
        {card.detail && <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{card.detail}</p>}
        {retired ? (
          <button type="button" onClick={() => onRestore(card)} className="text-xs px-2 py-2 rounded-xl mt-3" style={smallBtn(false)}>
            Restore to the pool
          </button>
        ) : (
          renderSmallActions(card)
        )}
      </div>
    )
  }

  // Daily draw, per pillar: Needs focus cards first, then a seeded random
  // shuffle of the rest, take 3. Paused-today and retired cards never draw.
  // A paused or retired card frees its slot, so a replacement draws in.
  const dailyForPillar = (pillar: Protocol['pillar']): { cards: Card[]; pool: Card[] } => {
    const allCards = toCards(protocols.filter((p) => p.pillar === pillar))
    const pool = allCards.filter((c) => !isRetired(c))
    const eligible = allCards.filter((c) => !isRetired(c) && !isPausedToday(c))
    const focused = eligible.filter((c) => isFocused(c)).sort((a, b) => a.rows[0].position - b.rows[0].position)
    const rest = seededShuffle(
      eligible.filter((c) => !isFocused(c)),
      hashString(`${today}:${pillar}`)
    )
    const drawn = [...focused, ...rest].slice(0, DRAW_PER_PILLAR)
    return { cards: drawn, pool }
  }

  const retiredCards = toCards(protocols.filter((p) => p.retired))

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">Today&apos;s habits · {dateLabel}</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        Each day, 3 habits per pillar are drawn at random from your full pool.
        Committed is the promise you make each morning. Held is what you record
        each night. Needs focus keeps a habit in the daily 3 for a week.
        Pause skips today only. Retire moves it to the retired list below.
      </p>

      {loading && <p className="text-sm" style={{ color: '#9aa0ae' }}>Loading...</p>}

      {actionError && (
        <div className="card" style={{ borderColor: '#e0607e' }}>
          <p className="text-sm font-bold" style={{ color: '#e0607e' }}>That did not save</p>
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{actionError}</p>
        </div>
      )}

      {!loading && experiment && (
        <Link href="/app/experiment" className="card block" style={{ textDecoration: 'none', borderColor: '#e0607e' }}>
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#e0607e' }}>SELF-EXPERIMENT · DAY {Math.min(Math.max(Math.round((new Date(todayISO() + 'T12:00:00').getTime() - new Date(experiment.start_date + 'T12:00:00').getTime()) / 86400000) + 1, 1), experiment.duration_days)} OF {experiment.duration_days}</p>
          <p className="text-sm font-bold mt-1">{experiment.title}</p>
          <p className="text-xs mt-1" style={{ color: '#9aa0ae' }}>Tap to view weight vs adherence →</p>
        </Link>
      )}

      {!loading && !experiment && (
        <Link href="/app/experiment/new" className="card block" style={{ textDecoration: 'none' }}>
          <p className="text-sm font-bold">Run a self-experiment</p>
          <p className="text-xs mt-1" style={{ color: '#9aa0ae' }}>Pre-register one change for a week and track it against your baseline.</p>
        </Link>
      )}

      <button
        type="button"
        onClick={() => setShowLibrary((v) => !v)}
        className="btn-ghost w-full"
      >
        {showLibrary ? 'Hide full library' : 'Show full library · add a habit'}
      </button>

      {!loading && PILLARS.map(({ key, label }) => {
        const { cards, pool } = dailyForPillar(key)
        return (
          <section key={key} className="space-y-3">
            <h2 className="text-base font-bold">{label}</h2>
            {pool.length === 0 && (
              <p className="text-sm" style={{ color: '#9aa0ae' }}>No habits yet in this pillar.</p>
            )}
            {pool.length > 0 && cards.length === 0 && (
              <p className="text-sm" style={{ color: '#9aa0ae' }}>All habits in this pillar are paused or retired today.</p>
            )}
            {pool.length > 0 && (
              <p className="text-xs" style={{ color: '#9aa0ae' }}>{cards.length} of {pool.length} drawn today</p>
            )}
            {cards.map(renderCard)}
          </section>
        )
      })}

      {!loading && showLibrary && (
        <section className="space-y-4">
          <h2 className="text-base font-bold">Full library</h2>
          <div className="card space-y-3">
            <p className="font-bold">Add a habit to the pool</p>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Habit, e.g. Call a friend"
              className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10"
            />
            <input
              type="text"
              value={newDetail}
              onChange={(e) => setNewDetail(e.target.value)}
              placeholder="Detail (optional)"
              className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10"
            />
            <select
              value={newPillar}
              onChange={(e) => setNewPillar(e.target.value as Protocol['pillar'])}
              className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10"
            >
              {PILLARS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => void onAddHabit()} className="btn-primary w-full" disabled={!newLabel.trim() || adding}>
              {adding ? 'Adding...' : 'Add to the pool'}
            </button>
            <p className="text-xs" style={{ color: '#9aa0ae' }}>A new habit joins tomorrow&apos;s draw, unless you mark it Needs focus.</p>
          </div>

          {PILLARS.map(({ key, label }) => {
            const cards = toCards(protocols.filter((p) => p.pillar === key && !p.retired))
            if (cards.length === 0) return null
            return (
              <section key={key} className="space-y-3">
                <h3 className="text-base font-bold">{label}</h3>
                {cards.map(renderLibraryCard)}
              </section>
            )
          })}

          {retiredCards.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-base font-bold">Retired</h3>
              <p className="text-sm" style={{ color: '#9aa0ae' }}>Retired habits stay here. Restore one any time to put it back in the pool.</p>
              {retiredCards.map(renderLibraryCard)}
            </section>
          )}
        </section>
      )}

      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setConfirmClear(null)}
        >
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">Are you sure?</p>
            <p className="text-sm mt-2" style={{ color: '#9aa0ae' }}>
              Meal end 3 hours before bed is really important for how you will feel tomorrow morning.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button type="button" className="btn-primary" onClick={() => setConfirmClear(null)}>
                Leave it as it is
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const p = confirmClear
                  setConfirmClear(null)
                  void writeMealEnd(p, { ...(checks[p.id] ?? UNCHECKED), held: false, held_at: null })
                }}
              >
                Yes, unclick meal end
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
