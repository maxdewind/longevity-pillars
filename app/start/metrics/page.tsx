'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg } from '@/lib/levels'
import { todayISO } from '@/lib/format'
import { fmtSleepHM } from '@/lib/format'
import {
  baselineStats, DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS, weightBandsLb, BAND_BAR, fetchProfileExtras, type DayValue,
} from '@/lib/baseline'
import { REFERENCE_RANGES, METRIC_ORDER, type MetricKey } from '@/lib/referenceRanges'
import { SHEET_ID, fetchSheetRows } from '@/lib/sheetSync'
import BandBar from '@/components/levels/BandBar'
import MetricEntryForm from '@/components/levels/MetricEntryForm'

function fmtAvgSd(k: MetricKey, avg: number, sd: number): string {
  switch (k) {
    case 'sleep_hours': return `${fmtSleepHM(avg)} ± ${Math.round(sd * 60)} min`
    case 'weight_lb': return `${avg.toFixed(1)} ± ${sd.toFixed(1)} lb`
    case 'deep_sleep_min': return `${Math.round(avg)} ± ${Math.round(sd)} min`
    case 'overnight_hr_bpm': return `${Math.round(avg)} ± ${Math.round(sd)} bpm`
    case 'overnight_hrv_ms': return `${Math.round(avg)} ± ${Math.round(sd)} ms`
    case 'vo2max': return `${avg.toFixed(1)} ± ${sd.toFixed(1)}`
  }
}

interface Entry { entry_date: string; metric_key: string; value: number; source: string }

export default function StartMetricsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK_DAYS)
  const [entries, setEntries] = useState<Entry[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)

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
        setHeightCm(prof.heightCm)
        await load(lb)
      } catch (e) {
        setError(errMsg(e))
        setLoading(false)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changeLookback = async (lb: number) => {
    setLookback(lb)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('profiles').upsert({ id: user.id, baseline_lookback_days: lb })
    } catch (e) {
      setError(errMsg(e))
    }
    await load(lb)
  }

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

  const syncNow = async () => {
    setSyncNote(null)
    if (!SHEET_ID) {
      setSyncNote('Apple Health sync turns on after the one-time setup. Your history below is already here.')
      return
    }
    setSyncing(true)
    try {
      const rows = await fetchSheetRows(SHEET_ID)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const payload = rows.map((r) => ({ user_id: user.id, entry_date: r.date, metric_key: r.metric_key, value: r.value, source: 'apple_health' }))
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('metric_entries').upsert(payload.slice(i, i + 200), { onConflict: 'user_id,entry_date,metric_key,source' })
        if (error) throw error
      }
      setSyncNote(`Synced ${rows.length} daily readings from Apple Health.`)
      await load(lookback)
    } catch (e) {
      setSyncNote(errMsg(e))
    }
    setSyncing(false)
  }

  const days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: lookback }, (_, i) => addDays(today, -(lookback - 1 - i)))
  }, [lookback])

  const sourceInUse = useMemo(() => {
    if (entries.length === 0) return null
    return entries.some((e) => e.source === 'apple_health') ? 'apple_health' : entries[0].source
  }, [entries])

  const statsByMetric = useMemo(() => {
    const m = new Map<MetricKey, ReturnType<typeof baselineStats>>()
    for (const k of METRIC_ORDER) {
      const vals: DayValue[] = entries
        .filter((e) => e.metric_key === k && (sourceInUse == null || e.source === sourceInUse))
        .map((e) => ({ date: e.entry_date, value: e.value }))
      m.set(k, baselineStats(vals, excluded))
    }
    return m
  }, [entries, excluded, sourceInUse])

  const daysWithData = useMemo(() => new Set(entries.map((e) => e.entry_date)), [entries])
  const lastDataDay = useMemo(() => (entries.length > 0 ? entries[entries.length - 1].entry_date : null), [entries])

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
      <p className="text-xs text-muted uppercase tracking-wide">Step 2 of 6 · Your numbers</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Your baseline, from Apple Health</h1>
      <p className="text-sm text-muted mb-4">
        No typing. Your history is already here. Pick a lookback, tap any day to
        exclude it (illness, travel), and the averages below update.
      </p>

      <div className="flex gap-2 mb-2">
        {(LOOKBACK_OPTIONS as readonly number[]).map((lb) => (
          <button
            key={lb}
            type="button"
            onClick={() => changeLookback(lb)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${lookback === lb ? 'border-accent bg-accent/10' : 'border-white/10'}`}
          >
            {lb === 14 ? '2 weeks' : lb === 28 ? '28 days' : '90 days'}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted">
          {sourceInUse === 'apple_health' ? `Apple Health · through ${lastDataDay ?? '—'}` : 'Manual entries'}
        </p>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="text-xs text-accent underline underline-offset-2"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      {syncNote && <p className="text-xs text-muted mb-4">{syncNote}</p>}
      {error && <p className="text-sm mb-4" style={{ color: '#e0607e' }}>{error}</p>}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div>
          <div className="card mb-4">
            <p className="text-sm text-muted">
              No Apple Health history here yet. Enter what you have below, or come back
              after the sync is connected.
            </p>
          </div>
          <MetricEntryForm initialValues={{}} />
        </div>
      ) : (
        <div>
          <div className="space-y-3">
            {METRIC_ORDER.map((k) => {
              const st = statsByMetric.get(k)
              const def = REFERENCE_RANGES[k]
              const bar = BAND_BAR[k]
              const bands = k === 'weight_lb' && heightCm != null ? weightBandsLb(heightCm) : undefined
              return (
                <div key={k} className="card">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{def.label}</p>
                    <p className="text-sm tabular-nums">
                      {st ? (
                        <span>{fmtAvgSd(k, st.avg, st.sd)} <span className="text-muted text-xs">· {st.n}d</span></span>
                      ) : (
                        <span className="text-muted text-xs">No data</span>
                      )}
                    </p>
                  </div>
                  {st && (
                    <div className="mt-3">
                      <BandBar
                        min={bar.min} max={bar.max}
                        pop={bands?.pop ?? bar.pop} asp={bands?.asp ?? bar.asp}
                        direction={bar.direction} avg={st.avg} sd={st.sd} showLegend={!!(bands ?? bar.pop)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs uppercase tracking-wide text-muted mt-6 mb-2">
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

      <Link href="/start/goals" className="btn-primary w-full mt-6 block text-center">
        Continue
      </Link>
    </main>
  )
}
