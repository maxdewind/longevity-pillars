'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'

interface LevelsProtocol {
  id: string
  label: string
  detail: string
  created_at: string
}

interface CheckState {
  committed: boolean
  held: boolean
}

const UNCHECKED: CheckState = { committed: false, held: false }
const STABILITY_DAYS = 10

function dayISO(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return todayISO(d)
}

export default function LevelsTodayPage() {
  const [protocols, setProtocols] = useState<LevelsProtocol[]>([])
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [gate, setGate] = useState(90)
  const [stability, setStability] = useState<{ held: number; possible: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)

      const [{ data: protos }, { data: profile }] = await Promise.all([
        supabase
          .from('protocols')
          .select('id,label,detail,created_at')
          .eq('user_id', user.id)
          .eq('track', 'levels')
          .eq('enabled', true)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('stability_gate_pct').eq('id', user.id).single(),
      ])
      const list = ((protos as LevelsProtocol[] | null) ?? [])
      setProtocols(list)
      setGate((profile?.stability_gate_pct as number | null) ?? 90)

      const cutoff = dayISO(STABILITY_DAYS - 1)
      const [{ data: todayRows }, { data: windowRows }] = await Promise.all([
        supabase
          .from('protocol_checks')
          .select('protocol_id,committed,held')
          .eq('user_id', user.id)
          .eq('log_date', todayISO()),
        list.length > 0
          ? supabase
              .from('protocol_checks')
              .select('protocol_id,held,log_date')
              .eq('user_id', user.id)
              .in('protocol_id', list.map((p) => p.id))
              .gte('log_date', cutoff)
          : { data: [] as { protocol_id: string; held: boolean; log_date: string }[] },
      ])
      const map: Record<string, CheckState> = {}
      ;((todayRows as { protocol_id: string; committed: boolean; held: boolean }[] | null) ?? []).forEach((r) => {
        map[r.protocol_id] = { committed: !!r.committed, held: !!r.held }
      })
      setChecks(map)

      // Baseline stability: held days over possible days in the trailing window.
      // A routine's possible days start when it was created.
      const win = ((windowRows as { protocol_id: string; held: boolean; log_date: string }[] | null) ?? [])
      let held = 0
      let possible = 0
      list.forEach((p) => {
        const created = (p.created_at ?? '').slice(0, 10)
        for (let ago = 0; ago < STABILITY_DAYS; ago++) {
          const date = dayISO(ago)
          if (created && date < created) continue
          possible += 1
          const row = win.find((w) => w.protocol_id === p.id && w.log_date === date)
          if (row?.held) held += 1
        }
      })
      setStability({ held, possible })
      setLoading(false)
    }
    load()
  }, [])

  const toggle = async (id: string, key: 'committed' | 'held') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const current = checks[id] ?? UNCHECKED
    const next = { ...current, [key]: !current[key] }
    setChecks((c) => ({ ...c, [id]: next }))
    setStability((s) =>
      s && key === 'held'
        ? { held: s.held + (next.held ? 1 : -1), possible: s.possible }
        : s
    )
    await supabase.from('protocol_checks').upsert(
      {
        user_id: user.id,
        protocol_id: id,
        log_date: todayISO(),
        committed: next.committed,
        held: next.held,
      },
      { onConflict: 'user_id,protocol_id,log_date' }
    )
  }

  if (signedIn === false) {
    return (
      <div className="card">
        <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
      </div>
    )
  }

  if (loading) return <p className="text-muted">Loading…</p>

  if (protocols.length === 0) {
    return (
      <div className="card">
        <p className="text-muted mb-3">Your baseline is not set up yet.</p>
        <Link href="/experiment/lookback" className="btn-primary block text-center">Set up my baseline</Link>
      </div>
    )
  }

  const pct = stability && stability.possible > 0 ? Math.round((stability.held / stability.possible) * 100) : null

  return (
    <div>
      <div className="card mb-4">
        <p className="text-xs text-muted uppercase tracking-wide">Baseline stability</p>
        <p className="text-2xl font-bold mt-1 tabular-nums">
          {pct == null ? 'No data' : `${pct}%`}
          <span className="text-sm font-normal text-muted"> · bar {gate}%</span>
        </p>
        <p className="text-xs text-muted mt-1">
          Held days over the trailing {STABILITY_DAYS} days. New levels unlock when the
          previous level has a verdict and this stays at or above the bar.
        </p>
        <div className="h-2 rounded-full bg-white/10 mt-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, pct ?? 0)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted uppercase tracking-wide mb-2">Today</p>
      <div className="space-y-2">
        {protocols.map((p) => {
          const c = checks[p.id] ?? UNCHECKED
          return (
            <div key={p.id} className="card">
              <p className="font-semibold">{p.label}</p>
              {p.detail && <p className="text-xs text-muted mt-0.5">{p.detail}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => toggle(p.id, 'committed')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    c.committed ? 'border-accent bg-accent/10 text-accent' : 'border-slate-200 text-muted'
                  }`}
                >
                  {c.committed ? '✓ Committed' : 'Committed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(p.id, 'held')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    c.held ? 'border-accent bg-accent/10 text-accent' : 'border-slate-200 text-muted'
                  }`}
                >
                  {c.held ? '✓ Held' : 'Held'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted mt-4">
        Committed is your morning promise. Held is the nightly evidence.
      </p>
    </div>
  )
}
