'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg } from '@/lib/levels'
import { todayISO } from '@/lib/format'
import {
  DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS, fetchProfileExtras,
} from '@/lib/baseline'
import { METRIC_ORDER, REFERENCE_RANGES, type MetricKey } from '@/lib/referenceRanges'
import { SHEET_ID, fetchSheetRows } from '@/lib/sheetSync'

const EXPLAINERS: Record<number, string> = {
  14: '14 days is the most current: two fresh weeks, but noisier.',
  28: '28 days is our pick: four full weeks of weekdays and weekends.',
  60: '60 days is steadier: two full months, slower to reflect change.',
  90: '90 days is the steadiest read, but old habits weigh in.',
}

const COVERAGE_LABEL: Record<MetricKey, string> = {
  weight_lb: 'Weight',
  sleep_hours: 'Sleep',
  deep_sleep_min: 'Deep sleep',
  overnight_hr_bpm: 'Overnight heart rate',
  overnight_hrv_ms: 'Overnight HRV',
  vo2max: 'VO2max',
}

const COVERAGE_ORDER: MetricKey[] = [
  'weight_lb',
  'sleep_hours',
  'deep_sleep_min',
  'overnight_hr_bpm',
  'overnight_hrv_ms',
]

interface Entry { entry_date: string; metric_key: string }

export default function StartLookbackPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK_DAYS)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [showWhy, setShowWhy] = useState(false)

  const load = async (lb: number) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)
      const today = todayISO()
      const from = addDays(today, -(lb - 1))
      const { data: rows } = await supabase
        .from('metric_entries')
        .select('entry_date,metric_key')
        .eq('user_id', user.id)
        .gte('entry_date', from)
        .lte('entry_date', today)
      setEntries(((rows as Entry[] | null) ?? []))
    } catch {
      /* coverage stays empty */
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
        const lb = (LOOKBACK_OPTIONS as readonly number[]).includes(prof.lookback)
          ? prof.lookback
          : DEFAULT_LOOKBACK_DAYS
        setLookback(lb)
        await load(lb)
      } catch {
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
    } catch {
      /* lookback still applies locally */
    }
    await load(lb)
  }

  const coverage = useMemo(() => {
    const m = new Map<MetricKey, number>()
    for (const k of COVERAGE_ORDER) {
      m.set(k, new Set(entries.filter((e) => e.metric_key === k).map((e) => e.entry_date)).size)
    }
    return m
  }, [entries])

  const totalDays = entries.length

  const allowAccess = async () => {
    setNote(null)
    if (!SHEET_ID) {
      setNote('Apple Health sync is not connected yet. Enter your numbers manually instead.')
      return
    }
    setBusy(true)
    try {
      const rows = await fetchSheetRows(SHEET_ID)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const payload = rows.map((r) => ({
        user_id: user.id, entry_date: r.date, metric_key: r.metric_key,
        value: r.value, source: 'apple_health',
      }))
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('metric_entries').upsert(
          payload.slice(i, i + 200),
          { onConflict: 'user_id,entry_date,metric_key,source' },
        )
        if (error) throw error
      }
      await load(lookback)
      router.push('/start/normal')
    } catch (e) {
      setNote(totalDays > 0 ? null : errMsg(e))
      if (totalDays > 0) router.push('/start/normal')
    }
    setBusy(false)
  }

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
      <p className="text-xs text-muted uppercase tracking-widest">Step 1 of 3 · Your normal</p>
      <h1 className="text-3xl font-bold mt-3 leading-tight">We&apos;ll learn your normal from Apple Health</h1>
      <p className="text-muted mt-3">
        How far back should we look? Longer is steadier. Shorter is more current.
      </p>

      <div className="flex gap-2 mt-6">
        {(LOOKBACK_OPTIONS as readonly number[]).map((lb) => (
          <button
            key={lb}
            type="button"
            onClick={() => changeLookback(lb)}
            className={`flex-1 rounded-xl border px-2 py-2.5 text-sm font-semibold ${
              lookback === lb ? 'bg-white text-black border-white' : 'border-white/15 text-white'
            }`}
          >
            {lb} days
          </button>
        ))}
      </div>
      <p className="text-sm text-muted mt-3">{EXPLAINERS[lookback] ?? ''}</p>

      <div className="card mt-6 space-y-2.5">
        {loading ? (
          <p className="text-muted text-sm">Checking your history…</p>
        ) : (
          COVERAGE_ORDER.map((k) => (
            <div key={k} className="flex items-baseline justify-between">
              <p>{COVERAGE_LABEL[k]}</p>
              <p className="font-semibold tabular-nums" style={{ color: '#7ee2a8' }}>
                {coverage.get(k) ?? 0} of {lookback} days
              </p>
            </div>
          ))
        )}
      </div>
      {!loading && totalDays === 0 && (
        <p className="text-xs text-muted mt-3">
          No history here yet. Allowing access pulls it in, or you can enter numbers manually.
        </p>
      )}

      <button
        type="button"
        onClick={allowAccess}
        disabled={busy}
        className="btn-primary w-full mt-8 !py-4 text-lg"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {busy ? 'Pulling your history…' : 'Allow Health access'}
      </button>
      {note && <p className="text-sm text-muted mt-3">{note}</p>}
      <p className="text-center mt-4">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="text-sm text-muted underline underline-offset-4"
        >
          Why we ask
        </button>
      </p>
      {showWhy && (
        <p className="text-sm text-muted mt-3 card">
          Your past readings teach us your normal, so every experiment is judged against
          you, not against population averages. Your data stays in your account.
        </p>
      )}
    </main>
  )
}
