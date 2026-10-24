'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Protocol } from '@/lib/types'
import { MASTER_PILLARS, MASTER_DAILY_ROUTINES, FIXED_FIRST_MIND_LABEL } from '@/lib/masterProtocol'

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
const FOCUS_DAYS = 7

// Master 9 pillars, Mind first and fundamental. Draw counts are the user's:
// Mind 3, Nutrition 3, Family 2, every other daily pillar 1, Supplements 0
// (Supplements live in the weekly/monthly review module, not the daily draw).
const PILLARS = MASTER_PILLARS

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

      // Seed the master daily pool. Missing master routines are inserted
      // on every load (so a later addition, like the fixed Mind card,
      // appears for users who already seeded), without duplicating
      // existing labels. Only on the first master seed are old classic
      // routines that are not in the master list retired, not deleted,
      // so their history stays and they can be restored from the library.
      // Changeroom shake is skipped by the user's word, so it retires here.
      let protosList = ((protos as Protocol[] | null) ?? [])
      const hasMaster = protosList.some((p) => ['cardio', 'family', 'preventive', 'accountability'].includes(p.pillar))
      if (!pErr) {
        const existingLabels = new Set(protosList.map((p) => p.label))
        const toInsert = MASTER_DAILY_ROUTINES
          .filter((r) => !existingLabels.has(r.label))
          .map((r, idx) => ({
            user_id: user.id,
            track: 'classic',
            pillar: r.pillar,
            label: r.label,
            detail: r.detail,
            position: r.label === FIXED_FIRST_MIND_LABEL ? 99 : 200 + idx,
            enabled: true,
            cadence: 'daily',
          }))
        if (toInsert.length > 0) {
          const { error: seedErr } = await supabase.from('protocols').insert(toInsert)
          if (seedErr) {
            setActionError(seedErr.message)
          } else {
            if (!hasMaster) {
              const keepLabels = new Set([...MASTER_DAILY_ROUTINES.map((r) => r.label), 'Keep positive thoughts', 'Morning fuel cap'])
              const toRetire = protosList.filter((p) => p.enabled && !keepLabels.has(p.label))
              await Promise.all(toRetire.map((p) => supabase.from('protocols').update({ retired: true }).eq('id', p.id)))
            }
            const { data: refetched } = await supabase
              .from('protocols')
              .select('*')
              .eq('user_id', user.id)
              .eq('track', 'classic')
              .order('position', { ascending: true })
            if (refetched) protosList = refetched as Protocol[]
          }
        }
      }

      const { data: rows } = await supabase
        .from('protocol_checks')
        .select('protocol_id, committed, held, held_at')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())

      setProtocols(protosList.filter((p) => p.enabled))
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
      const firstDate = (firstRow?.[0]?.log_date as string | undefined) ?? todayISO()
      const countMap: Record<string, CountState> = {}
      ;(protosList).forEach((p) => {
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
    background: active ? '#ffe4e6' : '#f1f5f9',
    color: active ? '#be123c' : '#334155',
    border: `1px solid ${active ? '#e0607e' : '#e2e8f0'}`,
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
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>
            Needs focus until {fmtShort(until)}: it stays in the daily 3 for this pillar.
          </p>
        )}
        {paused && !retired && (
          <p className="text-xs mt-2" style={{ color: '#64748b' }}>
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
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#e2e8f0', color: '#64748b' }}>
                Experimental
              </span>
            )}
            {card.title === FIXED_FIRST_MIND_LABEL && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#ffe4e6', color: '#be123c' }}>
                Fixed first
              </span>
            )}
            {isFocused(card) && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#ffe4e6', color: '#be123c' }}>
                Needs focus
              </span>
            )}
          </span>
          <span style={{ color: '#64748b' }}>{expanded[card.key] ? '▾' : '▸'}</span>
        </button>
        {expanded[card.key] && (
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{card.detail}</p>
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
            {card.title === '7 PM meal closure' ? (
              (() => {
                const s = checks[rows[0].id] ?? UNCHECKED
                const t = s.held_at ? fmtTime(s.held_at) : null
                return (
                  <button
                    type="button"
                    onClick={() => onMealEndTap(rows[0])}
                    className={s.held ? 'btn-primary' : 'btn-ghost'}
                    title={t ? 'Tap again to unclick' : 'Stamp when the meal ended'}
                  >
                    {t ? `Ended ${t}` : 'Meal end'}
                  </button>
                )
              })()
            ) : (
              <button
                type="button"
                onClick={() => toggle(rows[0], 'held')}
                className={(checks[rows[0].id] ?? UNCHECKED).held ? 'btn-primary' : 'btn-ghost'}
              >
                Held
              </button>
            )}
          </div>
        )}
        {renderSmallActions(card)}
        {isWeekly ? (
          <p className="text-xs tabular-nums mt-2 font-medium" style={{ color: '#334155' }}>
            {weeklySessions} of {WEEKLY_TARGET} sessions this week (Mon-Sun)
          </p>
        ) : split ? (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#64748b' }}>
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
              <p className="text-xs tabular-nums mt-2" style={{ color: '#64748b' }}>
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
            <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#ffe4e6', color: '#be123c' }}>
              Needs focus
            </span>
          )}
          {retired && (
            <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#e2e8f0', color: '#64748b' }}>
              Retired
            </span>
          )}
        </p>
        {card.detail && <p className="text-sm mt-1" style={{ color: '#64748b' }}>{card.detail}</p>}
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
  // shuffle of the rest, take the pillar's draw count. Paused-today and
  // retired cards never draw. A paused or retired card frees its slot, so
  // a replacement draws in. Only daily-cadence cards draw; weekly and
  // monthly items live on the Review page.
  const dailyForPillar = (pillar: Protocol['pillar'], draw: number): { cards: Card[]; pool: Card[] } => {
    const allCards = toCards(protocols.filter((p) => p.pillar === pillar && p.cadence === 'daily'))
    const pool = allCards.filter((c) => !isRetired(c))
    const eligible = allCards.filter((c) => !isRetired(c) && !isPausedToday(c))
    // Fixed first Mind card: always first in Mind, if eligible, and it
    // counts toward Mind's draw count. Pausing or retiring it frees
    // the slot like any other card.
    const fixed = pillar === 'mind' ? eligible.filter((c) => c.title === FIXED_FIRST_MIND_LABEL) : []
    const nonFixed = eligible.filter((c) => c.title !== FIXED_FIRST_MIND_LABEL)
    const focused = nonFixed.filter((c) => isFocused(c)).sort((a, b) => a.rows[0].position - b.rows[0].position)
    const rest = seededShuffle(
      nonFixed.filter((c) => !isFocused(c)),
      hashString(`${today}:${pillar}`)
    )
    const drawn = [...fixed, ...focused, ...rest].slice(0, draw)
    return { cards: drawn, pool }
  }

  const retiredCards = toCards(protocols.filter((p) => p.retired))

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">Today&apos;s habits · {dateLabel}</h1>
      <p className="text-sm" style={{ color: '#64748b' }}>
        Daily draw, 13 cards in total: Mind 3, Nutrition 3, Family 2, and 1
        each for Training, Cardiovascular, Sleep, Preventive, and
        Accountability. Supplements live in the weekly and monthly review.
        Committed is the promise you make each morning. Held is what you record
        each night. Needs focus keeps a habit in the daily draw for a week.
        Pause skips today only. Retire moves it to the retired list below.
      </p>
      <Link href="/app/review" className="card block" style={{ textDecoration: 'none' }}>
        <p className="text-sm font-bold">Weekly and monthly review</p>
        <p className="text-xs mt-1" style={{ color: '#64748b' }}>Sunday weekly review, last-day monthly review, supplements, and preventive items. A separate module.</p>
      </Link>

      {loading && <p className="text-sm" style={{ color: '#64748b' }}>Loading...</p>}

      {actionError && (
        <div className="card" style={{ borderColor: '#e0607e' }}>
          <p className="text-sm font-bold" style={{ color: '#e0607e' }}>That did not save</p>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{actionError}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowLibrary((v) => !v)}
        className="btn-ghost w-full"
      >
        {showLibrary ? 'Hide full library' : 'Show full library · add a habit'}
      </button>

      {!loading && PILLARS.map(({ key, label, draw, fundamental }) => {
        const { cards, pool } = dailyForPillar(key, draw)
        return (
          <section key={key} className="space-y-3" style={fundamental ? { border: '1px solid #e0607e', borderRadius: '1rem', padding: '0.75rem' } : undefined}>
            <h2 className="text-base font-bold">
              {label}
              {fundamental && (
                <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#ffe4e6', color: '#be123c' }}>
                  Fundamental
                </span>
              )}
            </h2>
            {fundamental && (
              <p className="text-xs" style={{ color: '#64748b' }}>Mind comes first. It holds the plan, the commitment, and the lapse re-entry rule.</p>
            )}
            {draw === 0 && (
              <p className="text-sm" style={{ color: '#64748b' }}>No daily draw here. Supplements are checked in the weekly and monthly review.</p>
            )}
            {draw > 0 && pool.length === 0 && (
              <p className="text-sm" style={{ color: '#64748b' }}>No habits yet in this pillar.</p>
            )}
            {draw > 0 && pool.length > 0 && cards.length === 0 && (
              <p className="text-sm" style={{ color: '#64748b' }}>All habits in this pillar are paused or retired today.</p>
            )}
            {draw > 0 && pool.length > 0 && (
              <p className="text-xs" style={{ color: '#64748b' }}>{cards.length} of {pool.length} drawn today</p>
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
              className="w-full rounded-xl px-3 py-2 bg-slate-100 border border-slate-200"
            />
            <input
              type="text"
              value={newDetail}
              onChange={(e) => setNewDetail(e.target.value)}
              placeholder="Detail (optional)"
              className="w-full rounded-xl px-3 py-2 bg-slate-100 border border-slate-200"
            />
            <select
              value={newPillar}
              onChange={(e) => setNewPillar(e.target.value as Protocol['pillar'])}
              className="w-full rounded-xl px-3 py-2 bg-slate-100 border border-slate-200"
            >
              {PILLARS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => void onAddHabit()} className="btn-primary w-full" disabled={!newLabel.trim() || adding}>
              {adding ? 'Adding...' : 'Add to the pool'}
            </button>
            <p className="text-xs" style={{ color: '#64748b' }}>A new habit joins tomorrow&apos;s draw, unless you mark it Needs focus.</p>
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
              <p className="text-sm" style={{ color: '#64748b' }}>Retired habits stay here. Restore one any time to put it back in the pool.</p>
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
            <p className="text-sm mt-2" style={{ color: '#64748b' }}>
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
