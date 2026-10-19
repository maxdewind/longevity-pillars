'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays } from '@/lib/levels'
import { todayISO } from '@/lib/format'
import {
  DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS, fetchProfileExtras,
} from '@/lib/baseline'
import { type MetricKey } from '@/lib/referenceRanges'

const EXPLAINERS: Record<number, string> = {
  14: '14 days is the most current: two fresh weeks, but noisier.',
  28: '28 days is our pick: four full weeks of weekdays and weekends.',
  60: '60 days is steadier: two full months, slower to reflect change.',
  90: '90 days is the steadiest read, but old habits weigh in.',
}

const ROW_ORDER: MetricKey[] = [
  'weight_lb',
  'sleep_hours',
  'overnight_hr_bpm',
  'overnight_hrv_ms',
  'deep_sleep_min',
  'vo2max',
]

const ROW_LABEL: Record<MetricKey, string> = {
  weight_lb: 'Weight',
  sleep_hours: 'Sleep',
  deep_sleep_min: 'Deep sleep',
  overnight_hr_bpm: 'Overnight heart rate',
  overnight_hrv_ms: 'Overnight HRV',
  vo2max: 'VO2max',
  bedtime: 'Bedtime',
}

interface Entry { entry_date: string; metric_key: string }

function completenessWord(found: number): string {
  if (found >= 6) return 'Complete'
  if (found >= 4) return 'Mostly complete'
  if (found >= 2) return 'Partial'
  return 'Just starting'
}

export default function StartLookbackPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK_DAYS)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
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

  const daysByMetric = useMemo(() => {
    const m = new Map<MetricKey, number>()
    for (const k of ROW_ORDER) {
      m.set(k, new Set(entries.filter((e) => e.metric_key === k).map((e) => e.entry_date)).size)
    }
    return m
  }, [entries])

  // About 20 of 28 days, scaled to the chosen lookback.
  const required = Math.max(1, Math.round((lookback * 20) / 28))
  const found = ROW_ORDER.filter((k) => (daysByMetric.get(k) ?? 0) > 0).length
  const warnings = useMemo(() => {
    const w: string[] = []
    for (const k of ROW_ORDER) {
      const n = daysByMetric.get(k) ?? 0
      if (n === 0) {
        w.push(`No ${ROW_LABEL[k]} found. Experiments that need it are skipped.`)
      } else if (n < required) {
        w.push(
          `${ROW_LABEL[k]} has gaps (${n} of ${lookback} days). We'll show it for context, not as a verdict metric.`,
        )
      }
    }
    return w
  }, [daysByMetric, required, lookback])

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
      <p className="text-xs text-muted uppercase tracking-widest">Step 1 of 3 · Your starting point</p>
      <h1 className="text-3xl font-bold mt-3 leading-tight">We&apos;ll learn your starting point from Apple Health</h1>
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

      <div className="card mt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-lg">
              {loading ? 'Checking your history…' : `Found ${found} of 6 metrics`}
            </p>
            {!loading && <p className="text-sm text-muted">{completenessWord(found)}</p>}
          </div>
          {!loading && (
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="text-accent font-semibold shrink-0"
            >
              {detailsOpen ? 'Hide' : 'Details'}
            </button>
          )}
        </div>

        {detailsOpen && !loading && (
          <div className="mt-4 space-y-2.5">
            {ROW_ORDER.map((k) => {
              const n = daysByMetric.get(k) ?? 0
              const ok = n >= required
              return (
                <div key={k} className="flex items-baseline justify-between">
                  <p>{ROW_LABEL[k]}</p>
                  {n === 0 ? (
                    <p className="font-semibold" style={{ color: '#e8c468' }}>Not found</p>
                  ) : (
                    <p
                      className="font-semibold tabular-nums"
                      style={{ color: ok ? '#7ee2a8' : '#e8c468' }}
                    >
                      {n} of {lookback} days
                    </p>
                  )}
                </div>
              )
            })}
            <p className="text-sm text-muted pt-1">
              We need about {required} of {lookback} days to use a metric as your measure.
            </p>
          </div>
        )}

        {!loading && warnings.length > 0 && (
          <div className={`space-y-3 ${detailsOpen ? 'mt-4' : 'mt-4'}`}>
            {warnings.map((w) => (
              <div key={w} className="flex gap-2.5">
                <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: '#e8c468' }} />
                <p className="text-sm" style={{ color: '#e8c468' }}>{w}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.push('/experiment/normal')}
        className="btn-primary w-full mt-8 !py-4 text-lg"
      >
        Continue
      </button>
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
