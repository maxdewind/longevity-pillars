'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Protocol } from '@/lib/types'

interface CheckState {
  committed: boolean
  held: boolean
}

interface CountState {
  held: number
  committed: number
  days: number
}

interface HistoryRow {
  protocol_id: string
  held: boolean
  log_date: string
}

const UNCHECKED: CheckState = { committed: false, held: false }
const TRAILING_DAYS = 14
const WEEKLY_TARGET = 3

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function dayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return todayISO(d)
}

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [counts, setCounts] = useState<Record<string, CountState>>({})
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [resolution, setResolution] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: protos } = await supabase
        .from('protocols')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      const { data: rows } = await supabase
        .from('protocol_checks')
        .select('protocol_id, committed, held')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())

      setProtocols(((protos as Protocol[] | null) ?? []).filter((p) => p.enabled))
      const map: Record<string, CheckState> = {}
      ;(rows ?? []).forEach((r) => {
        map[r.protocol_id] = { committed: !!r.committed, held: !!r.held }
      })
      setChecks(map)

      // Trailing-14-day counts per protocol (read-only evidence line).
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - (TRAILING_DAYS - 1))
      const [{ data: recent }, { data: firstRow }, { data: profile }] = await Promise.all([
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
        supabase
          .from('profiles')
          .select('resolution')
          .eq('id', user.id)
          .single(),
      ])
      setHistory(((recent ?? []) as HistoryRow[]).map((r) => ({
        protocol_id: r.protocol_id,
        held: !!r.held,
        log_date: r.log_date,
      })))
      setResolution((profile?.resolution as string | undefined) ?? '')
      const firstDate = (firstRow?.[0]?.log_date as string | undefined) ?? todayISO()
      const windowDays = Math.min(TRAILING_DAYS, Math.max(1, daysBetween(firstDate, todayISO()) + 1))
      const countMap: Record<string, CountState> = {}
      ;((protos as Protocol[] | null) ?? []).forEach((p) => {
        const pr = (recent ?? []).filter((r) => r.protocol_id === p.id)
        countMap[p.id] = {
          held: pr.filter((r) => r.held).length,
          committed: pr.filter((r) => r.committed).length,
          days: windowDays,
        }
      })
      setCounts(countMap)
      setLoading(false)
    }
    load()
  }, [])

  const toggle = async (p: Protocol, key: 'committed' | 'held') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const current = checks[p.id] ?? UNCHECKED
    const next = { ...current, [key]: !current[key] }
    setChecks((c) => ({ ...c, [p.id]: next }))
    await supabase.from('protocol_checks').upsert(
      {
        user_id: user.id,
        protocol_id: p.id,
        log_date: todayISO(),
        committed: next.committed,
        held: next.held,
      },
      { onConflict: 'user_id,protocol_id,log_date' }
    )
  }

  // (toggleCardCommitted / toggleCardMandatory above handle the grouped card.)

  // A "miss" is a past day whose check row was left unheld, or a past day with
  // no check row at all once the routine became mandatory (mandatory means
  // daily, so an unlogged day cannot count as held). Days before the routine
  // became mandatory are unknown, not misses. Weekly-cadence routines are
  // scored per week, never per day, so they can never miss a single day.
  const missedOn = (p: Protocol, daysAgo: number): boolean => {
    if (p.cadence === 'weekly') return false
    const date = dayISO(daysAgo)
    const row = history.find((h) => h.protocol_id === p.id && h.log_date === date)
    if (row) return !row.held
    if (!p.is_mandatory || !p.mandatory_since) return false
    return date >= p.mandatory_since
  }

  // Tripwires fire on mandatory routines only. Interventions, never resets.
  const banners: { key: string; title: string; body: string }[] = []
  protocols
    .filter((p) => p.is_mandatory)
    .forEach((p) => {
      if (missedOn(p, 1) && missedOn(p, 2)) {
        banners.push({
          key: `${p.id}-consec`,
          title: `Two missed days in a row on ${p.label}.`,
          body: resolution
            ? `"${resolution}"`
            : 'Your resolution lives on the Record page. Go reread it, that is what it is for.',
        })
        return
      }
      let n = 0
      for (let off = 1; off <= 7; off++) if (missedOn(p, off)) n++
      if (n >= 3) {
        banners.push({
          key: `${p.id}-freq`,
          title: `You've missed ${n} of the last 7 days on ${p.label}.`,
          body: "What's getting in the way?",
        })
      }
    })

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Rows that share a card_group render as ONE card (e.g. the two meal rows).
  // Committed is per card (one tap commits every row); Held stays per row.
  interface Card {
    key: string
    title: string
    detail: string
    rows: Protocol[]
  }

  const toCards = (ps: Protocol[]): Card[] => {
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

  const nutrition = toCards(protocols.filter((p) => p.pillar === 'nutrition'))
  const movement = toCards(protocols.filter((p) => p.pillar === 'movement'))

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
    await Promise.all(
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
  }

  const toggleCardMandatory = async (card: Card) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const next = !card.rows[0].is_mandatory
    const nextSince = next ? todayISO() : null
    const ids = new Set(card.rows.map((r) => r.id))
    setProtocols((ps) =>
      ps.map((x) => (ids.has(x.id) ? { ...x, is_mandatory: next, mandatory_since: nextSince } : x))
    )
    await Promise.all(
      card.rows.map((r) =>
        supabase
          .from('protocols')
          .update({ is_mandatory: next, mandatory_since: nextSince })
          .eq('id', r.id)
      )
    )
  }

  const shortHalfName = (label: string): string => {
    const m = label.match(/ \((Meal \d)\)$/)
    return m ? m[1] : label
  }

  const renderCard = (card: Card) => {
    const rows = card.rows
    const split = rows.length > 1
    const committedOn = rows.every((r) => (checks[r.id] ?? UNCHECKED).committed)
    const mandatory = rows[0].is_mandatory
    const experimental = rows.some((r) => r.is_experimental)
    const missedYesterday = rows.some((r) => r.is_mandatory && missedOn(r, 1))
    const weeklyRow = rows.length === 1 ? rows[0] : null
    const isWeekly = !!weeklyRow && weeklyRow.cadence === 'weekly'
    // Sessions held since Monday (weekly routines aggregate Mon-Sun).
    const monday = (() => {
      const d = new Date()
      const dow = (d.getDay() + 6) % 7 // 0 = Monday
      d.setDate(d.getDate() - dow)
      return todayISO(d)
    })()
    const weeklySessions =
      isWeekly && weeklyRow
        ? history.filter((h) => h.protocol_id === weeklyRow.id && h.held && h.log_date >= monday).length
        : 0
    return (
      <div key={card.key} className="card">
        <div className="font-bold">
          {card.title}
          {experimental && (
            <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#2a2d36', color: '#9aa0ae' }}>
              Experimental
            </span>
          )}
        </div>
        <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{card.detail}</p>
        <button
          type="button"
          onClick={() => toggleCardMandatory(card)}
          className="text-xs mt-2 underline"
          style={{ color: '#9aa0ae' }}
        >
          {mandatory ? 'Mandatory · tap to unmark' : 'Not mandatory · tap to make mandatory'}
        </button>
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
            })()} mornings
          </p>
        ) : (
          (() => {
            const c = counts[rows[0].id]
            return c ? (
              <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
                Held {c.held}/{c.days} days · Committed {c.committed}/{c.days} mornings
              </p>
            ) : null
          })()
        )}
        {missedYesterday && (
          <p className="text-xs mt-2 font-medium" style={{ color: '#c9ccd4' }}>
            It was one day only - get back to routine!
          </p>
        )}
      </div>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">Today&apos;s protocol · {dateLabel}</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        Committed is the promise you make each morning. Held is what you record
        each night. Both start unchecked every day.
      </p>

      {loading && <p className="text-sm" style={{ color: '#9aa0ae' }}>Loading...</p>}

      {!loading && banners.length > 0 && (
        <section className="space-y-3">
          {banners.map((b) => (
            <div key={b.key} className="card">
              <p className="text-sm font-bold">{b.title}</p>
              <p className="text-sm mt-1 italic" style={{ color: '#9aa0ae' }}>{b.body}</p>
            </div>
          ))}
        </section>
      )}

      {!loading && nutrition.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">Nutrition</h2>
          {nutrition.map(renderCard)}
        </section>
      )}

      {!loading && movement.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">Movement</h2>
          {movement.map(renderCard)}
        </section>
      )}
    </main>
  )
}
