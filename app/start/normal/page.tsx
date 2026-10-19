'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg, median } from '@/lib/levels'
import { todayISO, fmtSleepHM } from '@/lib/format'
import {
  baselineStats, DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS,
  type DayValue,
} from '@/lib/baseline'
import { type MetricKey } from '@/lib/referenceRanges'
import {
  type CompareMode, REFERENCE_DISCLAIMER, DEEP_SLEEP_INFO, OVERNIGHT_HR_INFO,
  HRV_SELF_COMPARE, SLEEP_RANGE_NOTE, DEEP_SLEEP_RANGE_NOTE, OVERNIGHT_HR_RANGE_NOTE,
  TOP_FALLBACK, vo2Anchors, vo2Percentile,
} from '@/lib/reference'
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
  bedtime: 'Bedtime',
}

interface Entry { entry_date: string; metric_key: string; value: number; source: string }

function RangeBar({ min, max, lo, hi, value }: { min: number; max: number; lo: number; hi: number; value: number }) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  return (
    <div className="relative h-2 rounded-full bg-white/10 mt-4">
      <div
        className="absolute top-0 h-full rounded-full bg-white/25"
        style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }}
      />
      <span
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white"
        style={{ left: `${pct(value)}%`, boxShadow: '0 0 0 3px rgba(255,255,255,0.15)' }}
      />
    </div>
  )
}

function StatusPill({ tone, children }: { tone: 'green' | 'amber'; children: React.ReactNode }) {
  const color = tone === 'green' ? '#7ee2a8' : '#e8c468'
  return (
    <span
      className="text-xs font-semibold rounded-full px-3 py-1 shrink-0"
      style={{ color, border: `1px solid ${color}` }}
    >
      {children}
    </span>
  )
}

function InfoButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="More info"
      onClick={onClick}
      className="w-6 h-6 rounded-full border border-white/25 text-muted text-xs font-semibold ml-2"
    >
      i
    </button>
  )
}

function InfoBox({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted mt-3 card !bg-white/5">{text}</p>
  )
}

export default function StartNormalPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK_DAYS)
  const [entries, setEntries] = useState<Entry[]>([])
  const [hrv90, setHrv90] = useState<{ avg: number; days: number } | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showExclusions, setShowExclusions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compare, setCompare] = useState<CompareMode>('off')
  const [age, setAge] = useState<number | null>(null)
  const [sex, setSex] = useState<'male' | 'female' | null>(null)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [formAge, setFormAge] = useState('')
  const [formSex, setFormSex] = useState<'male' | 'female' | ''>('')
  const [formHeight, setFormHeight] = useState('')
  const [bmiOn, setBmiOn] = useState(false)
  const [infoOpen, setInfoOpen] = useState<MetricKey | null>(null)

  const load = async (lb: number) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)
      const today = todayISO()
      const from = addDays(today, -(lb - 1))
      const from90 = addDays(today, -89)
      const [{ data: rows }, { data: excl }, { data: prof }, { data: hrvRows }] = await Promise.all([
        supabase.from('metric_entries').select('entry_date,metric_key,value,source')
          .eq('user_id', user.id).gte('entry_date', from).lte('entry_date', today).order('entry_date'),
        supabase.from('baseline_exclusions').select('excluded_date').eq('user_id', user.id),
        supabase.from('profiles').select('baseline_lookback_days,height_cm,age,sex').eq('id', user.id).maybeSingle(),
        supabase.from('metric_entries').select('entry_date,value')
          .eq('user_id', user.id).eq('metric_key', 'overnight_hrv_ms')
          .gte('entry_date', from90).lte('entry_date', today),
      ])
      setEntries(((rows as Entry[] | null) ?? []).map((r) => ({ ...r, value: Number(r.value) })))
      setExcluded(new Set(((excl as { excluded_date: string }[] | null) ?? []).map((e) => e.excluded_date)))
      const p = prof as { baseline_lookback_days?: number | null; height_cm?: number | null; age?: number | null; sex?: string | null } | null
      const plb = typeof p?.baseline_lookback_days === 'number' ? p.baseline_lookback_days : DEFAULT_LOOKBACK_DAYS
      setLookback((LOOKBACK_OPTIONS as readonly number[]).includes(plb) ? plb : DEFAULT_LOOKBACK_DAYS)
      setHeightCm(typeof p?.height_cm === 'number' ? p.height_cm : null)
      setAge(typeof p?.age === 'number' ? p.age : null)
      setSex(p?.sex === 'male' || p?.sex === 'female' ? p.sex : null)
      const hv = ((hrvRows as { entry_date: string; value: number }[] | null) ?? []).map((r) => Number(r.value))
      if (hv.length > 0) {
        const days = new Set(((hrvRows as { entry_date: string }[] | null) ?? []).map((r) => r.entry_date)).size
        setHrv90({ avg: hv.reduce((a, b) => a + b, 0) / hv.length, days })
      }
      if (lb !== plb) await load(plb)
    } catch (e) {
      setError(errMsg(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    load(DEFAULT_LOOKBACK_DAYS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    const a = parseInt(formAge, 10)
    if (!Number.isFinite(a) || a < 10 || a > 110) { setError('Enter an age between 10 and 110.'); return }
    if (formSex !== 'male' && formSex !== 'female') { setError('Choose male or female.'); return }
    const h = formHeight.trim() === '' ? null : parseFloat(formHeight)
    if (h != null && (!Number.isFinite(h) || h < 100 || h > 250)) { setError('Enter height in cm (100–250).'); return }
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const { error } = await supabase.from('profiles').upsert({ id: user.id, age: a, sex: formSex, height_cm: h })
      if (error) throw error
      setAge(a)
      setSex(formSex)
      setHeightCm(h)
      setEditingProfile(false)
    } catch (e) {
      setError(errMsg(e))
    }
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

  const vo2Median = useMemo(() => {
    const vals = entries.filter((e) => e.metric_key === 'vo2max').map((e) => e.value)
    if (vals.length === 0) return null
    const m = median(vals.slice(-3))
    if (m == null) return null
    return { value: m, n: Math.min(3, vals.length) }
  }, [entries])

  const days = useMemo(() => {
    const today = todayISO()
    return Array.from({ length: lookback }, (_, i) => addDays(today, -(lookback - 1 - i)))
  }, [lookback])
  const daysWithData = useMemo(() => new Set(entries.map((e) => e.entry_date)), [entries])

  const hasProfile = age != null && sex != null
  const pickCompare = (m: CompareMode) => {
    if (m !== 'off' && !hasProfile) {
      setFormAge(age != null ? String(age) : '')
      setFormSex(sex ?? '')
      setFormHeight(heightCm != null ? String(heightCm) : '')
      setEditingProfile(true)
      return
    }
    setCompare(m)
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

  const st = (k: MetricKey) => statsByMetric.get(k) ?? { avg: 0, sd: 0, n: 0 }
  const has = (k: MetricKey) => st(k).n > 0

  const renderOffGrid = () => (
    <div className="grid grid-cols-2 gap-3 mt-6">
      {GRID_ORDER.map((k) => {
        const s = st(k)
        let value = '—'
        let sub = 'no data yet'
        if (s.n > 0) {
          switch (k) {
            case 'weight_lb': value = `${s.avg.toFixed(0)} lb`; sub = `typical swing ±${s.sd.toFixed(1)}`; break
            case 'sleep_hours': value = fmtSleepHM(s.avg); sub = `typical swing ±${Math.round(s.sd * 60)}m`; break
            case 'overnight_hr_bpm': value = `${Math.round(s.avg)} bpm`; sub = `typical swing ±${Math.round(s.sd)}`; break
            case 'overnight_hrv_ms': value = `${Math.round(s.avg)} ms`; sub = 'context only'; break
            case 'deep_sleep_min': value = `${Math.round(s.avg)} min`; sub = `typical swing ±${Math.round(s.sd)}`; break
            case 'vo2max':
              value = vo2Median ? `${Math.round(vo2Median.value)}` : '—'
              sub = vo2Median ? `median of ${vo2Median.n} reading${vo2Median.n === 1 ? '' : 's'}` : 'no data yet'
              break
          }
        }
        return (
          <div key={k} className="card">
            <p className="text-xs text-muted uppercase tracking-widest">{CARD_LABEL[k]}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            <p className="text-sm text-muted mt-1">{sub}</p>
          </div>
        )
      })}
    </div>
  )

  const renderCompareCards = () => {
    const sleep = st('sleep_hours')
    const deep = st('deep_sleep_min')
    const hr = st('overnight_hr_bpm')
    const hrv = st('overnight_hrv_ms')
    const weight = st('weight_lb')
    const deepPct = sleep.avg > 0 && deep.n > 0 ? (deep.avg / (sleep.avg * 60)) * 100 : null
    const bmi = weight.n > 0 && heightCm ? (weight.avg / 2.20462) / Math.pow(heightCm / 100, 2) : null
    const hrvTrend = hrv.n > 0 && hrv90 ? hrv.avg - hrv90.avg : null
    const anchors = hasProfile && age != null && sex != null ? vo2Anchors(age, sex) : null
    const vo2pct = vo2Median && anchors && age != null && sex != null
      ? vo2Percentile(vo2Median.value, age, sex)
      : null

    return (
      <div className="space-y-3 mt-6">
        {/* SLEEP */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">Sleep</p>
            {has('sleep_hours') && (
              <StatusPill tone={sleep.avg >= 7 && sleep.avg <= 9 ? 'green' : 'amber'}>
                {sleep.avg >= 7 && sleep.avg <= 9 ? 'In range' : 'Room to move'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">{has('sleep_hours') ? fmtSleepHM(sleep.avg) : '—'}</p>
          {has('sleep_hours') && (
            <>
              <p className="text-sm text-muted mt-1">typical swing ±{Math.round(sleep.sd * 60)}m</p>
              <RangeBar min={4} max={12} lo={7} hi={9} value={sleep.avg} />
              <p className="text-sm text-muted mt-3">
                {compare === 'top' ? TOP_FALLBACK.sleep_hours : SLEEP_RANGE_NOTE}
              </p>
            </>
          )}
        </div>

        {/* DEEP SLEEP */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">
              Deep sleep
              <InfoButton open={infoOpen === 'deep_sleep_min'} onClick={() => setInfoOpen(infoOpen === 'deep_sleep_min' ? null : 'deep_sleep_min')} />
            </p>
            {deepPct != null && (
              <StatusPill tone={deepPct >= 13 && deepPct <= 23 ? 'green' : 'amber'}>
                {deepPct >= 13 && deepPct <= 23 ? 'In range' : 'Room to move'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">{has('deep_sleep_min') ? `${Math.round(deep.avg)} min` : '—'}</p>
          {has('deep_sleep_min') && deepPct != null && (
            <>
              <p className="text-sm text-muted mt-1">{Math.round(deepPct)}% of your sleep · typical swing ±{Math.round(deep.sd)}</p>
              <RangeBar min={5} max={30} lo={13} hi={23} value={deepPct} />
              <p className="text-sm text-muted mt-3">
                {compare === 'top' ? TOP_FALLBACK.deep_sleep_min : DEEP_SLEEP_RANGE_NOTE}
              </p>
            </>
          )}
          {infoOpen === 'deep_sleep_min' && <InfoBox text={DEEP_SLEEP_INFO} />}
        </div>

        {/* OVERNIGHT HR */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">
              Overnight HR
              <InfoButton open={infoOpen === 'overnight_hr_bpm'} onClick={() => setInfoOpen(infoOpen === 'overnight_hr_bpm' ? null : 'overnight_hr_bpm')} />
            </p>
            {has('overnight_hr_bpm') && (
              <StatusPill tone={hr.avg >= 50 && hr.avg <= 75 ? 'green' : 'amber'}>
                {hr.avg >= 50 && hr.avg <= 75 ? 'In range' : 'Room to move'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">{has('overnight_hr_bpm') ? `${Math.round(hr.avg)} bpm` : '—'}</p>
          {has('overnight_hr_bpm') && (
            <>
              <p className="text-sm text-muted mt-1">typical swing ±{Math.round(hr.sd)}</p>
              <RangeBar min={40} max={90} lo={50} hi={75} value={hr.avg} />
              <p className="text-sm text-muted mt-3">
                {compare === 'top' ? TOP_FALLBACK.overnight_hr_bpm : OVERNIGHT_HR_RANGE_NOTE}
              </p>
            </>
          )}
          {infoOpen === 'overnight_hr_bpm' && <InfoBox text={OVERNIGHT_HR_INFO} />}
        </div>

        {/* HRV */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">HRV</p>
            {hrvTrend != null && (
              <StatusPill tone={hrvTrend > 2 ? 'green' : hrvTrend < -2 ? 'amber' : 'green'}>
                {hrvTrend > 2 ? 'Trending up' : hrvTrend < -2 ? 'Trending down' : 'Steady'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">{has('overnight_hrv_ms') ? `${Math.round(hrv.avg)} ms` : '—'}</p>
          {hrv90 && (
            <p className="text-sm text-muted mt-1">
              Your own {hrv90.days}-day average is {Math.round(hrv90.avg)} ms<br />
              {HRV_SELF_COMPARE}
            </p>
          )}
        </div>

        {/* VO2MAX */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">VO2max</p>
            {vo2Median && compare === 'top' && vo2pct != null && (
              <StatusPill tone="amber">{vo2pct}th percentile</StatusPill>
            )}
            {vo2Median && compare === 'healthy' && anchors && (
              <StatusPill tone={vo2Median.value >= anchors.p50 ? 'green' : 'amber'}>
                {vo2Median.value >= anchors.p50 ? 'In range' : 'Room to move'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">{vo2Median ? Math.round(vo2Median.value) : '—'}</p>
          {vo2Median && (
            <>
              <p className="text-sm text-muted mt-1">median of {vo2Median.n} reading{vo2Median.n === 1 ? '' : 's'}</p>
              {anchors && (
                <>
                  <RangeBar
                    min={Math.max(10, anchors.p25 - 5)} max={anchors.p80 + 8}
                    lo={anchors.p50} hi={anchors.p80} value={vo2Median.value}
                  />
                  {compare === 'top' ? (
                    <p className="text-sm text-muted mt-3">Top 20% for your age starts around {Math.round(anchors.p80)}.</p>
                  ) : (
                    vo2Median.value < anchors.p50 && (
                      <p className="text-sm text-muted mt-3">Below the typical range for your age and sex.</p>
                    )
                  )}
                </>
              )}
              <div className="flex items-center justify-between mt-3 gap-2">
                <p className="text-sm">May help: Zone 2 cardio, weekly intervals</p>
                <Link href="/start/first" className="text-sm font-semibold text-accent underline underline-offset-4 shrink-0">
                  See experiments
                </Link>
              </div>
            </>
          )}
        </div>

        {/* WEIGHT */}
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted uppercase tracking-widest">Weight</p>
            {bmiOn && bmi != null && (
              <StatusPill tone={bmi >= 18.5 && bmi <= 24.9 ? 'green' : 'amber'}>
                {bmi >= 18.5 && bmi <= 24.9 ? 'In range' : 'Room to move'}
              </StatusPill>
            )}
          </div>
          <p className="text-4xl font-bold mt-2 tabular-nums">
            {has('weight_lb') ? `${weight.avg.toFixed(0)} lb${bmiOn && bmi != null ? ` · BMI ${bmi.toFixed(1)}` : ''}` : '—'}
          </p>
          {has('weight_lb') && <p className="text-sm text-muted mt-1">typical swing ±{weight.sd.toFixed(1)}</p>}
          {bmiOn && bmi != null ? (
            <>
              <RangeBar min={15} max={40} lo={18.5} hi={24.9} value={bmi} />
              <p className="text-sm text-muted mt-3">Healthy BMI range: 18.5 to 24.9.</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-muted">BMI doesn&apos;t account for muscle.</p>
                <button type="button" onClick={() => setBmiOn(false)} className="text-sm font-semibold text-accent underline underline-offset-4">
                  Hide BMI
                </button>
              </div>
            </>
          ) : (
            has('weight_lb') && (
              <>
                <button
                  type="button"
                  onClick={() => heightCm ? setBmiOn(true) : (setFormHeight(''), setEditingProfile(true))}
                  className="w-full mt-4 rounded-xl border border-white/15 py-3 font-semibold"
                >
                  Show based on BMI
                </button>
                <p className="text-sm text-muted mt-2">Optional. Uses the height in your Health profile.</p>
              </>
            )
          )}
        </div>

        <p className="text-sm text-muted">{REFERENCE_DISCLAIMER}</p>
      </div>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Step 2 of 3 · Sample data</p>
      <h1 className="text-3xl font-bold mt-3 leading-tight">This is your starting point</h1>
      <p className="text-muted mt-3">
        Every experiment is measured against these numbers.
      </p>

      {error && <p className="text-sm mt-4" style={{ color: '#e0607e' }}>{error}</p>}

      {loading ? (
        <p className="text-muted mt-6">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="mt-6">
          <div className="card mb-4">
            <p className="text-sm text-muted">
              No Apple Health history here yet. Enter what you have below — your starting
              point builds from these numbers.
            </p>
          </div>
          <MetricEntryForm initialValues={{}} />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted uppercase tracking-widest mt-6 mb-2">Compare my numbers · Optional</p>
          <div className="flex gap-2">
            {(['off', 'healthy', 'top'] as CompareMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pickCompare(m)}
                className={`flex-1 rounded-xl border px-2 py-2.5 text-sm font-semibold ${
                  compare === m ? 'bg-white text-black border-white' : 'border-white/15 text-white'
                }`}
              >
                {m === 'off' ? 'Off' : m === 'healthy' ? 'Healthy range' : 'Top percentile'}
              </button>
            ))}
          </div>

          {compare !== 'off' && (
            <p className="text-sm text-muted mt-3">
              {hasProfile ? (
                <>Using age {age}, {sex}, from your profile. </>
              ) : (
                <>Add your age and sex to compare. </>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormAge(age != null ? String(age) : '')
                  setFormSex(sex ?? '')
                  setFormHeight(heightCm != null ? String(heightCm) : '')
                  setEditingProfile(true)
                }}
                className="text-accent underline underline-offset-4"
              >
                Edit
              </button>
            </p>
          )}

          {editingProfile && (
            <div className="card mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted">Age</label>
                  <input value={formAge} onChange={(e) => setFormAge(e.target.value)} inputMode="numeric" placeholder="45" className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted">Sex</label>
                  <select value={formSex} onChange={(e) => setFormSex(e.target.value as 'male' | 'female' | '')} className="input mt-1">
                    <option value="">Choose…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">Height (cm, for BMI)</label>
                <input value={formHeight} onChange={(e) => setFormHeight(e.target.value)} inputMode="decimal" placeholder="183" className="input mt-1" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveProfile} className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setEditingProfile(false)} className="rounded-xl border border-white/15 px-4 font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {compare === 'off' ? renderOffGrid() : renderCompareCards()}

          {compare === 'off' && (
            <p className="text-sm text-muted mt-6">
              The ± is your typical day-to-day swing. We only call a result a signal when it
              beats that.
            </p>
          )}
        </>
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
                    const hasd = daysWithData.has(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        title={`${d}${out ? ' (excluded)' : ''}`}
                        className="rounded text-[10px] tabular-nums px-0 py-1"
                        style={{
                          width: 30,
                          background: out ? 'rgba(224,96,126,0.25)' : hasd ? 'rgba(255,255,255,0.12)' : 'transparent',
                          border: out ? '1px solid #e0607e' : '1px solid rgba(255,255,255,0.08)',
                          color: out ? '#e0607e' : hasd ? '#fff' : '#5a5f6b',
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
