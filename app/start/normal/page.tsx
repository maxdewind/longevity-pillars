'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg } from '@/lib/levels'
import { todayISO, fmtSleepHM } from '@/lib/format'
import {
  baselineStats, DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS,
  fetchProfileExtras, type DayValue,
} from '@/lib/baseline'
import { type MetricKey } from '@/lib/referenceRanges'
import MetricEntryForm from '@/components/levels/MetricEntryForm'

const GRID_ORDER: MetricKey[] = [
  'weight_lb',
  'sleep_hours',
  'overnight_hr_bpm',
  'overnight_hrv_ms',
  'deep_sleep_min',
  'vo2max',
]

const CARD_LABEL: Record<MetricKey, string> = {
  weight_lb: 'Weight',
  sleep_hours: 'Sleep',
  deep_sleep_min: 'Deep sleep',
  overnight_hr_bpm: 'Overnight HR',
  overnight_hrv_ms: 'HRV',
  vo2max: 'VO2max',
}

interface Entry { entry_date: string; metric_key: string; value: number; source: string }

function cardContent(k: MetricKey, st: { avg: number; sd: number; n: number } | null, latest: number | null): { value: string; sub: string } {
  if (!st || st.n === 0) return { value: '—', sub: 'no data yet' }
  switch (k) {
    case 'weight_lb':
      return { value: `${st.avg.toFixed(0)} lb`, sub: `usually ±${st.sd.toFixed(1)}` }
    case 'sleep_hours':
      return { value: fmtSleepHM(st.avg), sub: `usually ±${Math.round(st.sd * 60)}m` }
    case 'overnight_hr_bpm':
      return { value: `${Math.round(st.avg)} bpm`, sub: `usually ±${Math.round(st.sd)}` }
    case 'overnight_hrv_ms':
      return { value: `${Math.round(st.avg)} ms`, sub: 'context only' }
    case 'deep_sleep_min':
      return { value: `${Math.round(st.avg)} min`, sub: `usually ±${Math.round(st.sd)}` }
    case 'vo2max':
      return { value: latest != null ? `${Math.round(latest)}` : '—', sub: 'latest value' }
  }
}

export default function StartNormalPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK_DAYS)
  const [entries, setEntries] = useState<Entry[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showExclusions, setShowExclusions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (lb: number) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)
      const today = todayISO()
      const from = addDays(today, -(lb - 1))
      const [{ data: rows }, { data: excl }] = await Promise.all([
        supabase.from('metric_entries').select('entry_date,metric_key,value,source')
          .eq('user_id', user.id).gte('entry_date', from).lte('entry_date', today).order('entry_date'),
        supabase.from('baseline_exclusions').select('excluded_date').eq('user_id', user.id),
      ])
      setEntries(((rows as Entry[] | null) ?? []).map((r) => ({ ...r, value: Number(r.value) })))
      setExcluded(new Set(((excl as { excluded_date: string }[] | null) ?? []).map((e) => e.excluded_date)))
    } catch (e) {
      setError(errMsg(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSignedIn(false); setLoading(false); return }
        const prof = await fetchProfileExtras(supabase, user.id)
        const lb = (LOOKBACK_OPTIONS as readonly number[]).includes(prof.lookback) ? prof.lookback : DEFAULT_LOOKBACK_DAYS
        setLookback(lb)
        await load(lb)
      } catch (e) {
        setError(errMsg(e))
        setLoading(false)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = async (date: string) => {
    const next = new Set(excluded)
    const removing = next.has(date)
    if (removing) next.delete(date); else next.add(date)
    setExcluded(next)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (removing) {
        await supabase.from('baseline_exclusions').delete().eq('user_id', user.id).eq('excluded_date', date)
      } else {
        await supabase.from('baseline_exclusions').insert({ user_id: user.id, excluded_date: date })
      }
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const statsByMetric = useMemo(() => {
    const m = new Map<MetricKey, { avg: number; sd: number; n: number }>()
    for (const k of GRID_ORDER) {
      const vals: DayValue[] = entries
        .filter((e) => e.metric_key === k)
        .map((e) => ({ date: e.entry_date, value: e.value }))
      const st = baselineStats(vals, excluded)
      m.set(k, st && st.n > 0 ? { avg: st.avg, sd: st.sd, n: st.n } : { avg: 0, sd: 0, n: 0 })
    }
    return m
  }, [entries, excluded])

  const latestByMetric = useMemo(() => {
    const m = new Map<MetricKey, number>()
    for (const k of GRID_ORDER) {
      const vals = entries.filter((e) => e.metric_key === k)
      if (vals.length > 0) m.set(k, vals[vals.length - 1].value)
    }
    return m
  }, [entries])

  const days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: lookback }, (_, i) => addDays(today, -(lookback - 1 - i)))
  }, [lookback])
  const daysWithData = useMemo(() => new Set(entries.map((e) => e.entry_date)), [entries])

  if (signedIn === false) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Step 2 of 3 · Sample data</p>
      <h1 className="text-3xl font-bold mt-3 leading-tight">This is your normal</h1>
      <p className="text-muted mt-3">
        Every experiment is measured against these numbers, not against generic averages.
      </p>

      {error && <p className="text-sm mt-4" style={{ color: '#e0607e' }}>{error}</p>}

      {loading ? (
        <p className="text-muted mt-6">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="mt-6">
          <div className="card mb-4">
            <p className="text-sm text-muted">
              No Apple Health history here yet. Enter what you have below — your normal
              builds from these numbers.
            </p>
          </div>
          <MetricEntryForm initialValues={{}} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mt-6">
          {GRID_ORDER.map((k) => {
            const st = statsByMetric.get(k) ?? null
            const c = cardContent(k, st && st.n > 0 ? st : null, latestByMetric.get(k) ?? null)
            return (
              <div key={k} className="card">
                <p className="text-xs text-muted uppercase tracking-widest">{CARD_LABEL[k]}</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">{c.value}</p>
                <p className="text-sm text-muted mt-1">{c.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      {entries.length > 0 && (
        <p className="text-sm text-muted mt-6">
          The ± is your usual day-to-day swing. We only call a result a signal when it
          beats that.
        </p>
      )}

      <button
        type="button"
        onClick={() => router.push('/start/first')}
        className="btn-primary w-full mt-8 !py-4 text-lg"
      >
        Pick my first experiment
      </button>

      {entries.length > 0 && (
        <div>
          <p className="text-center mt-4">
            <button
              type="button"
              onClick={() => setShowExclusions((v) => !v)}
              className="text-sm text-muted underline underline-offset-4"
            >
              Exclude sick or travel days
            </button>
          </p>
          {showExclusions && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted mb-2">
                Timeline · tap a day to exclude it
              </p>
              <div className="card p-2 overflow-x-auto">
                <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
                  {days.map((d) => {
                    const out = excluded.has(d)
                    const has = daysWithData.has(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        title={`${d}${out ? ' (excluded)' : ''}`}
                        className="rounded text-[10px] tabular-nums px-0 py-1"
                        style={{
                          width: 30,
                          background: out ? 'rgba(224,96,126,0.25)' : has ? 'rgba(255,255,255,0.12)' : 'transparent',
                          border: out ? '1px solid #e0607e' : '1px solid rgba(255,255,255,0.08)',
                          color: out ? '#e0607e' : has ? '#fff' : '#5a5f6b',
                          textDecoration: out ? 'line-through' : 'none',
                        }}
                      >
                        {d.slice(8)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {excluded.size > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) await supabase.from('baseline_exclusions').delete().eq('user_id', user.id)
                    setExcluded(new Set())
                  }}
                  className="text-xs text-muted underline underline-offset-2 mt-2"
                >
                  Clear {excluded.size} excluded day{excluded.size === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
