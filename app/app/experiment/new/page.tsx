'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Protocol } from '@/lib/types'

const PILLARS = [
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'movement', label: 'Movement' },
  { value: 'mind', label: 'Mind' },
] as const

const errMsg = (e: unknown) =>
  e instanceof Error
    ? e.message
    : ((e as { message?: string } | null)?.message ?? JSON.stringify(e))

const nextMondayISO = () => {
  const d = new Date()
  const add = ((8 - d.getDay()) % 7) || 7
  d.setDate(d.getDate() + add)
  return todayISO(d)
}

const startLabel = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function NewExperimentPage() {
  const router = useRouter()
  const [change, setChange] = useState('')
  const [pillar, setPillar] = useState<'nutrition' | 'movement' | 'mind'>('nutrition')
  const [hypothesis, setHypothesis] = useState('')
  const [days, setDays] = useState(7)
  const [startWhen, setStartWhen] = useState<'today' | 'monday'>('today')
  const [baseline, setBaseline] = useState<Protocol[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [hasActive, setHasActive] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }
        const { data: exp, error: eErr } = await supabase
          .from('experiments')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
        if (eErr) throw eErr
        if (exp && exp.length > 0) {
          setHasActive(true)
          setLoaded(true)
          return
        }
        const { data: rows, error: pErr } = await supabase
          .from('protocols')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_mandatory', true)
          .eq('enabled', true)
          .order('position')
        if (pErr) throw pErr
        setBaseline((rows as Protocol[] | null) ?? [])
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [])

  const startDate = startWhen === 'monday' ? nextMondayISO() : todayISO()
  const endDate = (() => {
    const d = new Date(startDate + 'T12:00:00')
    d.setDate(d.getDate() + days - 1)
    return todayISO(d)
  })()

  const start = async () => {
    const title = change.trim()
    if (!title || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user }, error: uErr } = await supabase.auth.getUser()
      if (uErr) throw uErr
      if (!user) throw new Error('Not signed in. Please log in again.')
      const { data: activeNow, error: aErr } = await supabase
        .from('experiments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
      if (aErr) throw aErr
      if (activeNow && activeNow.length > 0) throw new Error('An experiment is already active.')
      // Reuse the routine if a retry already created it.
      const { data: dup, error: dErr } = await supabase
        .from('protocols')
        .select('id')
        .eq('user_id', user.id)
        .eq('label', title)
        .limit(1)
      if (dErr) throw dErr
      let protocolId = (dup as { id: string }[] | null)?.[0]?.id
      if (!protocolId) {
        const { data: last } = await supabase
          .from('protocols')
          .select('position')
          .eq('user_id', user.id)
          .eq('pillar', pillar)
          .order('position', { ascending: false })
          .limit(1)
        const pos = ((last as { position: number }[] | null)?.[0]?.position ?? -1) + 1
        const { data: proto, error: pErr } = await supabase
          .from('protocols')
          .insert({
            user_id: user.id,
            pillar,
            label: title,
            detail: 'Self-experiment change. One change at a time.',
            position: pos,
            is_mandatory: false,
            mandatory_since: null,
            cadence: 'daily',
            is_experimental: true,
          })
          .select('id')
          .single()
        if (pErr) throw pErr
        if (!proto) throw new Error('Could not create the routine.')
        protocolId = (proto as { id: string }).id
      }
      const { error: eErr } = await supabase.from('experiments').insert({
        user_id: user.id,
        protocol_id: protocolId,
        title,
        hypothesis: hypothesis.trim() || null,
        start_date: startDate,
        end_date: endDate,
        duration_days: days,
        baseline_snapshot: baseline
          .filter((b) => !excluded.has(b.id))
          .map((b) => ({ id: b.id, label: b.label })),
        status: 'active',
      })
      if (eErr) throw eErr
      router.push('/app/experiment')
    } catch (e) {
      setError(errMsg(e))
    }
    setSaving(false)
  }

  const chip = (on: boolean) => ({
    padding: '10px 18px',
    borderRadius: 999,
    border: '1px solid',
    borderColor: on ? '#e0607e' : '#2c313d',
    background: on ? '#e0607e' : 'transparent',
    color: on ? '#fff' : '#9aa0ae',
    fontWeight: 600 as const,
    fontSize: 14,
  })

  if (!loaded) return <main className="p-6" style={{ color: '#9aa0ae' }}>Loading…</main>

  if (hasActive) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">New Experiment</h1>
        <div className="card mt-6 p-5">
          <p style={{ color: '#9aa0ae' }}>One experiment at a time. Finish or end the current one before starting a new change.</p>
          <Link href="/app/experiment" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>
            View current experiment
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">New Experiment</h1>
      <p className="mt-1 text-sm" style={{ color: '#9aa0ae' }}>Pre-register one change. The baseline stays the control.</p>
      {error && (
        <p className="mt-4 text-sm" style={{ color: '#e0607e' }}>{error}</p>
      )}

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>THE ONE CHANGE</p>
      <input
        value={change}
        onChange={(e) => setChange(e.target.value)}
        placeholder="e.g. No tea with dessert after the 2nd meal"
        className="card mt-2 w-full p-4"
        style={{ background: '#22262f', border: '1px solid #2c313d', color: '#fff', outline: 'none' }}
      />

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>PILLAR</p>
      <div className="mt-2 flex gap-2">
        {PILLARS.map((p) => (
          <button key={p.value} onClick={() => setPillar(p.value)} style={chip(pillar === p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>MY HYPOTHESIS</p>
      <textarea
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
        placeholder="I expect…"
        rows={2}
        className="card mt-2 w-full p-4"
        style={{ background: '#22262f', border: '1px solid #2c313d', color: '#fff', outline: 'none', resize: 'vertical' }}
      />

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>DURATION</p>
      <div className="mt-2 flex gap-2">
        {[7, 14].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={chip(days === d)}>
            {d} days
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>START</p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setStartWhen('today')} style={chip(startWhen === 'today')}>
          Today ({startLabel(todayISO())})
        </button>
        <button onClick={() => setStartWhen('monday')} style={chip(startWhen === 'monday')}>
          Next Monday ({startLabel(nextMondayISO())})
        </button>
      </div>
      <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>Weeks run {startLabel(startDate)} – {startLabel(endDate)}. Going forward, start on Monday.</p>

      <p className="mt-6 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>BASELINE – UNCHECK WHAT YOU WON&apos;T ENFORCE</p>
      <div className="card mt-2 p-4">
        {baseline.length === 0 && <p className="text-sm" style={{ color: '#9aa0ae' }}>No mandatory routines yet.</p>}
        {baseline.map((b) => {
          const on = !excluded.has(b.id)
          return (
            <button
              key={b.id}
              onClick={() => setExcluded((prev) => {
                const next = new Set(prev)
                if (next.has(b.id)) next.delete(b.id)
                else next.add(b.id)
                return next
              })}
              className="flex items-center gap-3 py-2 w-full text-left"
              style={{ borderBottom: '1px solid #2c313d', background: 'none', cursor: 'pointer' }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: on ? '#e0607e' : 'transparent',
                border: on ? 'none' : '1px solid #4a5160',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>{on ? '✓' : ''}</span>
              <span className="text-sm" style={{ color: on ? '#fff' : '#9aa0ae' }}>{b.label}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-xs" style={{ color: '#9aa0ae' }}>One change at a time. Everything else stays constant.</p>

      {error && (
        <p className="mt-4 text-sm" style={{ color: '#e0607e' }}>{error}</p>
      )}

      <button
        onClick={start}
        disabled={!change.trim() || saving}
        className="btn w-full mt-6"
        style={{ opacity: !change.trim() || saving ? 0.5 : 1, padding: '16px' }}
      >
        {saving ? 'Starting…' : 'Start experiment'}
      </button>
    </main>
  )
}
