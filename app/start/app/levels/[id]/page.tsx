'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import { fmtMD } from '@/lib/format'
import {
  WINDOW_DAYS, OBSERVED_REQUIRED, EXTEND_DAYS,
  addDays, diffDays, errMsg, suggestVerdict, readSignal,
  METRIC_LABELS,
  type ExperimentTemplate, type LevelsExperiment, type SignalRead, type VerdictKind, type VerdictSuggestion,
} from '@/lib/levels'
import { fetchBaselineValues, fetchProfileExtras } from '@/lib/baseline'
import { watchLabel } from '@/lib/firstRun'
import { loadRunPrefs } from '@/lib/runPrefs'
import { type MetricKey } from '@/lib/referenceRanges'

const VERDICT_BUTTONS: { kind: VerdictKind; label: string }[] = [
  { kind: 'keep', label: 'Keep it' },
  { kind: 'extend', label: 'Extend 5 days' },
  { kind: 'drop', label: 'Drop it' },
  { kind: 'inconclusive', label: 'Inconclusive' },
]

function fmtVal(metric: string, v: number): string {
  switch (metric) {
    case 'weight_lb': return `${v.toFixed(1)} lb`
    case 'sleep_hours': {
      const h = Math.floor(v)
      const m = Math.round((v - h) * 60)
      return `${h}h ${m}m`
    }
    case 'deep_sleep_min': return `${Math.round(v)} min`
    case 'overnight_hr_bpm': return `${Math.round(v)} bpm`
    case 'overnight_hrv_ms': return `${Math.round(v)} ms`
    case 'vo2max': return `${Math.round(v)}`
    default: return `${v.toFixed(1)}`
  }
}

function fmtDelta(metric: string, d: number): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const a = Math.abs(d)
  switch (metric) {
    case 'weight_lb': return `${sign}${a.toFixed(1)}`
    case 'sleep_hours': return `${sign}${Math.round(a * 60)} min`
    case 'deep_sleep_min': return `${sign}${Math.round(a)} min`
    case 'overnight_hr_bpm': return `${sign}${Math.round(a)}`
    case 'overnight_hrv_ms': return `${sign}${Math.round(a)}`
    case 'vo2max': return `${sign}${a.toFixed(1)}`
    default: return `${sign}${a.toFixed(1)}`
  }
}

interface SecondaryRead {
  key: string
  latest: number | null
  baselineAvg: number | null
}

export default function LevelRunPage({ params }: { params: { id: string } }) {
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [signal, setSignal] = useState<SignalRead | null>(null)
  const [suggestion, setSuggestion] = useState<VerdictSuggestion | null>(null)
  const [heldToday, setHeldToday] = useState(false)
  const [committedToday, setCommittedToday] = useState(false)
  const [dayHeld, setDayHeld] = useState<Record<string, boolean>>({})
  const [observedDays, setObservedDays] = useState(0)
  const [observedRequired, setObservedRequired] = useState(OBSERVED_REQUIRED)
  const [baselineHeldPct, setBaselineHeldPct] = useState<number | null>(null)
  const [baselineAvg, setBaselineAvg] = useState<number | null>(null)
  const [baselineSd, setBaselineSd] = useState<number | null>(null)
  const [latestPrimary, setLatestPrimary] = useState<number | null>(null)
  const [latestPrimaryDate, setLatestPrimaryDate] = useState<string | null>(null)
  const [secondaries, setSecondaries] = useState<SecondaryRead[]>([])
  const [morningCommitment, setMorningCommitment] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMorningCommitment(loadRunPrefs().morningCommitment)
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }
        const { data: eRow, error: eErr } = await supabase
          .from('experiments')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', user.id)
          .single()
        if (eErr) throw eErr
        const e = eRow as LevelsExperiment
        setExp(e)

        const { data: tRow, error: tErr } = await supabase
          .from('experiment_templates')
          .select('*')
          .eq('level_number', e.template_level)
          .single()
        if (tErr) throw tErr
        const t = tRow as ExperimentTemplate
        setTemplate(t)

        const today = todayISO()
        const windowEnd = today < e.end_date ? today : e.end_date
        const metricKey = t.primary_metric
        const req = e.observed_days_required ?? OBSERVED_REQUIRED
        setObservedRequired(req)

        const profLb = await fetchProfileExtras(supabase, user.id)
        const lb = profLb.lookback
        const baselineDayVals = await fetchBaselineValues(supabase, user.id, metricKey, e.start_date, lb)
        const baselineVals = baselineDayVals.map((r) => r.value)
        if (baselineVals.length > 0) {
          const avg = baselineVals.reduce((a, b) => a + b, 0) / baselineVals.length
          const sd = Math.sqrt(baselineVals.reduce((a, b) => a + (b - avg) ** 2, 0) / baselineVals.length)
          setBaselineAvg(avg)
          setBaselineSd(sd)
        }

        const { data: entries } = await supabase
          .from('metric_entries')
          .select('entry_date, value')
          .eq('user_id', user.id)
          .eq('metric_key', metricKey)
          .gte('entry_date', e.start_date)
          .lte('entry_date', windowEnd)
          .order('entry_date')
        const all = (entries as { entry_date: string; value: number }[] | null) ?? []
        const observedVals = all.map((r) => Number(r.value))
        const observedDates = new Set(all.map((r) => r.entry_date))
        setObservedDays(observedDates.size)
        const lastObs = all.length > 0 ? all[all.length - 1] : null
        const lastBase = baselineDayVals.length > 0 ? baselineDayVals[baselineDayVals.length - 1] : null
        setLatestPrimary(lastObs ? Number(lastObs.value) : lastBase ? lastBase.value : null)
        setLatestPrimaryDate(lastObs ? lastObs.entry_date : lastBase ? lastBase.date : null)

        // Secondary ("also watching") metrics: baseline avg + latest in-window reading.
        const secKeys = (t.secondary_metrics ?? []).filter((k) => k !== metricKey).slice(0, 4)
        const secReads: SecondaryRead[] = await Promise.all(secKeys.map(async (k) => {
          const [bVals, { data: sEntries }] = await Promise.all([
            fetchBaselineValues(supabase, user.id, k as MetricKey, e.start_date, lb),
            supabase.from('metric_entries').select('entry_date, value')
              .eq('user_id', user.id).eq('metric_key', k)
              .gte('entry_date', e.start_date).lte('entry_date', windowEnd).order('entry_date'),
          ])
          const b = bVals.map((r) => r.value)
          const s = ((sEntries as { entry_date: string; value: number }[] | null) ?? []).map((r) => Number(r.value))
          return {
            key: k,
            latest: s.length > 0 ? s[s.length - 1] : (b.length > 0 ? b[b.length - 1] : null),
            baselineAvg: b.length > 0 ? b.reduce((a, x) => a + x, 0) / b.length : null,
          }
        }))
        setSecondaries(secReads)

        const sig = readSignal(t.primary_metric, t.threshold_direction, baselineVals, observedVals)
        setSignal(sig)

        const { data: checks } = await supabase
          .from('protocol_checks')
          .select('log_date, held, committed')
          .eq('user_id', user.id)
          .eq('protocol_id', e.protocol_id)
          .gte('log_date', e.start_date)
          .lte('log_date', windowEnd)
        const heldMap: Record<string, boolean> = {}
        let committed = false
        ;((checks as { log_date: string; held: boolean; committed: boolean }[] | null) ?? []).forEach((c) => {
          heldMap[c.log_date] = c.held
          if (c.log_date === today && c.committed) committed = true
        })
        setDayHeld(heldMap)
        setHeldToday(heldMap[today] === true)
        setCommittedToday(committed)

        const windowDays = e.window_days ?? WINDOW_DAYS
        const elapsed = Math.min(diffDays(e.start_date, windowEnd) + 1, windowDays)
        const adherence = elapsed > 0
          ? Object.values(heldMap).filter(Boolean).length / elapsed
          : null

        const expPids = new Set([e.protocol_id])
        const { data: protos } = await supabase
          .from('protocols')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('track', 'levels')
          .eq('enabled', true)
        const baseline = ((protos as { id: string; created_at: string }[] | null) ?? []).filter((p) => !expPids.has(p.id))
        let stab: number | null = null
        if (baseline.length > 0) {
          const stabStart = addDays(today, -9)
          const { data: bchecks } = await supabase
            .from('protocol_checks')
            .select('protocol_id, log_date, held')
            .eq('user_id', user.id)
            .in('protocol_id', baseline.map((b) => b.id))
            .gte('log_date', stabStart)
            .lte('log_date', today)
          const list = (bchecks as { protocol_id: string; log_date: string; held: boolean }[] | null) ?? []
          let num = 0, den = 0
          for (const b of baseline) {
            const since = b.created_at.slice(0, 10)
            const from = since > stabStart ? since : stabStart
            den += diffDays(from, today) + 1
            num += list.filter((c) => c.protocol_id === b.id && c.log_date >= from && c.held).length
          }
          stab = den > 0 ? num / den : null
        }
        setBaselineHeldPct(stab)

        const { data: prof } = await supabase
          .from('profiles')
          .select('stability_gate_pct')
          .eq('id', user.id)
          .single()
        const gate = (prof as { stability_gate_pct?: number | null } | null)?.stability_gate_pct
        const gatePct = typeof gate === 'number' && gate >= 80 && gate <= 100 ? gate : 90

        setSuggestion(suggestVerdict({
          template: t,
          signal: sig,
          observedDays: observedDates.size,
          observedRequired: req,
          baselineDays: baselineVals.length,
          experimentAdherence: adherence,
          baselineStability: stab,
          stabilityGatePct: gatePct,
        }))
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [params.id])

  const upsertCheck = async (patch: { held?: boolean; committed?: boolean }) => {
    if (!exp || acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const { error } = await supabase.from('protocol_checks').upsert(
        { user_id: user.id, protocol_id: exp.protocol_id, log_date: todayISO(), ...patch },
        { onConflict: 'user_id,protocol_id,log_date' },
      )
      if (error) throw error
    } catch (e) {
      setError(errMsg(e))
    }
    setActing(false)
  }

  const toggleHeld = async () => {
    const next = !heldToday
    await upsertCheck({ held: next })
    setHeldToday(next)
    setDayHeld((prev) => ({ ...prev, [todayISO()]: next }))
  }

  const toggleCommitted = async () => {
    const next = !committedToday
    await upsertCheck({ committed: next })
    setCommittedToday(next)
  }

  const skipToday = async () => {
    await upsertCheck({ held: false, committed: false })
    setHeldToday(false)
    setCommittedToday(false)
    setDayHeld((prev) => ({ ...prev, [todayISO()]: false }))
  }

  const recordVerdict = async (kind: VerdictKind) => {
    if (!exp || acting) return
    if (!confirm(kind === 'drop'
      ? 'Drop this level? It will be disabled and the next level stays locked until the baseline is stable.'
      : `Record verdict: ${kind === 'keep' ? 'Keep it' : kind === 'extend' ? 'Extend 5 days' : 'Inconclusive'}?`)) return
    setActing(true)
    try {
      const supabase = createClient()
      if (kind === 'extend') {
        const newEnd = addDays(exp.end_date, EXTEND_DAYS)
        const newWindow = (exp.window_days ?? WINDOW_DAYS) + EXTEND_DAYS
        const { error } = await supabase.from('experiments').update({
          end_date: newEnd,
          window_days: newWindow,
          observed_days_required: newWindow - 2,
          duration_days: (exp.duration_days ?? WINDOW_DAYS) + EXTEND_DAYS,
        }).eq('id', exp.id)
        if (error) throw error
        window.location.reload()
        return
      }
      if (kind === 'drop') {
        await supabase.from('protocols').update({ enabled: false }).eq('id', exp.protocol_id)
      }
      const { error } = await supabase.from('experiments').update({
        status: 'done',
        verdict: kind,
      }).eq('id', exp.id)
      if (error) throw error
      window.location.href = '/start/app/levels'
    } catch (e) {
      setError(errMsg(e))
    }
    setActing(false)
  }

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>
  if (error && !exp) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>
        <Link href="/start/app/levels" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to Levels</Link>
      </main>
    )
  }
  if (!exp || !template) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-muted">Level run not found.</p>
        <Link href="/start/app/levels" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to Levels</Link>
      </main>
    )
  }

  const today = todayISO()
  const windowDays = exp.window_days ?? WINDOW_DAYS
  const dayNum = Math.min(Math.max(diffDays(exp.start_date, today) + 1, 1), windowDays)
  const verdictOpen = today >= exp.end_date || dayNum >= windowDays
  const metricMeta = METRIC_LABELS[template.primary_metric]
  const heldCount = Object.values(dayHeld).filter(Boolean).length
  const alreadyExtended = windowDays > WINDOW_DAYS
  const withinSwing = latestPrimary != null && baselineAvg != null && baselineSd != null
    ? Math.abs(latestPrimary - baselineAvg) <= baselineSd
    : null
  const primaryDelta = latestPrimary != null && baselineAvg != null ? latestPrimary - baselineAvg : null

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Day {dayNum} of {windowDays}</p>
      <h1 className="text-3xl font-bold mt-2">{exp.title}</h1>

      <div className="flex gap-2 mt-4">
        {Array.from({ length: windowDays }, (_, i) => addDays(exp.start_date, i)).map((d) => {
          const isToday = d === today
          const held = dayHeld[d]
          return (
            <span
              key={d}
              title={d}
              className="rounded-full"
              style={{
                width: 26, height: 26,
                background: held ? '#f0506e' : 'transparent',
                border: `1.5px solid ${held || isToday ? '#f0506e' : '#4a5160'}`,
              }}
            />
          )
        })}
      </div>
      <p className="text-sm text-muted mt-3">
        Held {heldCount} of {windowDays} · Data days {observedDays} of {observedRequired} · Verdict {fmtMD(exp.end_date)}
      </p>

      <div className="card mt-5" style={{ borderColor: '#f0506e', borderWidth: 1.5 }}>
        <p className="text-xs text-muted uppercase tracking-widest">Today</p>
        <p className="font-semibold text-xl mt-2 leading-snug">{template.detail}</p>
        {morningCommitment ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <button
                type="button"
                onClick={toggleCommitted}
                disabled={acting}
                className="w-full rounded-xl py-3.5 font-semibold text-lg"
                style={committedToday
                  ? { background: 'rgba(126,226,168,0.15)', border: '1.5px solid #7ee2a8', color: '#7ee2a8' }
                  : { background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff' }}
              >
                {committedToday ? 'Committed' : 'Commit'}
              </button>
              <p className="text-xs text-muted text-center mt-2">
                {committedToday ? 'Promised this morning' : 'Tap this morning'}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={toggleHeld}
                disabled={acting}
                className="w-full rounded-xl py-3.5 font-semibold text-lg"
                style={heldToday
                  ? { background: '#f0506e', border: 'none', color: '#fff' }
                  : { background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff' }}
              >
                {heldToday ? 'Held ✓' : 'Held'}
              </button>
              <p className="text-xs text-muted text-center mt-2">
                {heldToday ? 'Stuck to it' : 'Tap tonight'}
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleHeld}
            disabled={acting}
            className="btn-primary w-full mt-4 !py-4 text-lg"
          >
            {heldToday ? 'Held ✓ — tap to undo' : 'Mark today held'}
          </button>
        )}
        <p className="text-center mt-4">
          <button
            type="button"
            onClick={skipToday}
            className="text-sm text-muted underline underline-offset-4"
          >
            Skip today (sick or travelling)
          </button>
        </p>
      </div>
      {error && <p className="text-sm mt-3" style={{ color: '#e0607e' }}>{error}</p>}

      <div className="card mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted uppercase tracking-widest">{metricMeta.label} · Primary</p>
          {withinSwing != null && (
            <span
              className="text-xs font-semibold rounded-full px-3 py-1 shrink-0"
              style={withinSwing
                ? { color: '#9aa0ae', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: '#e8c468', border: '1px solid #e8c468' }}
            >
              {withinSwing ? 'Within typical swing' : 'Outside typical swing'}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-2 gap-2">
          <p className="text-4xl font-bold tabular-nums">
            {latestPrimary != null ? fmtVal(template.primary_metric, latestPrimary) : '—'}
          </p>
          {primaryDelta != null && baselineAvg != null && (
            <p className="text-sm text-muted tabular-nums shrink-0 text-right">
              {latestPrimaryDate && <>{fmtMD(latestPrimaryDate)} · </>}
              {fmtDelta(template.primary_metric, primaryDelta)} vs starting point {fmtVal(template.primary_metric, baselineAvg).replace(/(\d)\.0\b/, '$1')}
            </p>
          )}
        </div>
        {secondaries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-muted uppercase tracking-widest mb-3">Also watching</p>
            <div className="space-y-2.5">
              {secondaries.map((s) => (
                <div key={s.key} className="flex items-baseline justify-between gap-2">
                  <p>{watchLabel(s.key)}</p>
                  <p className="tabular-nums shrink-0">
                    {s.latest != null ? (
                      <>
                        <span className="font-bold text-lg" style={{ color: '#f0506e' }}>{fmtVal(s.key, s.latest)}</span>
                        {s.baselineAvg != null && (
                          <span className="text-sm text-muted ml-2">
                            {fmtDelta(s.key, s.latest - s.baselineAvg)} vs {fmtVal(s.key, s.baselineAvg).replace(/(\d)\.0\b/, '$1')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {dayNum === 1 && (
          <p className="text-sm text-muted mt-4">
            Last night, before you started. Your first experiment reading arrives tomorrow.
            One night is noisy, so the verdict uses all {windowDays} days.
          </p>
        )}
      </div>

      <div className="card mt-4 p-5">
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted uppercase tracking-widest">Baseline held (last 10 days)</p>
          {baselineHeldPct != null && (
            <p className="text-sm font-bold" style={{ color: baselineHeldPct >= 0.9 ? '#7ee2a8' : '#e8c468' }}>{Math.round(baselineHeldPct * 100)}%</p>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">The baseline has to stay stable for the verdict to count. Below your gate, the verdict is capped at inconclusive.</p>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs text-muted uppercase tracking-widest">Verdict</p>
        {!verdictOpen ? (
          <p className="mt-2 text-sm text-muted">
            Verdict unlocks {fmtMD(exp.end_date)} – decisions on day {windowDays}.
          </p>
        ) : suggestion ? (
          <>
            <div className="mt-3 p-4 rounded-lg" style={{ background: '#22262f' }}>
              <p className="text-sm font-bold text-white">
                Suggested: {suggestion.verdict === 'keep' ? 'Keep it' : suggestion.verdict === 'extend' ? 'Extend 5 days' : suggestion.verdict === 'drop' ? 'Drop it' : 'Inconclusive'}
              </p>
              <ul className="mt-2 space-y-1">
                {suggestion.reasons.map((r, i) => (
                  <li key={i} className="text-sm text-muted">· {r}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {VERDICT_BUTTONS.map((b) => {
                const isSuggested = suggestion.verdict === b.kind
                const disabled =
                  acting ||
                  (template.verdict_driver === false && b.kind !== 'inconclusive') ||
                  (b.kind === 'extend' && alreadyExtended)
                return (
                  <button
                    key={b.kind}
                    onClick={() => recordVerdict(b.kind)}
                    disabled={disabled}
                    className="btn"
                    style={{
                      background: isSuggested ? '#e0607e' : 'transparent',
                      border: isSuggested ? 'none' : '1px solid #4a5160',
                      color: isSuggested ? '#fff' : '#9aa0ae',
                      opacity: disabled && !isSuggested ? 0.4 : 1,
                    }}
                  >
                    {b.label}{b.kind === 'extend' && alreadyExtended ? ' (used)' : ''}
                  </button>
                )
              })}
            </div>
            {template.verdict_driver === false && (
              <p className="mt-2 text-xs" style={{ color: '#e8c468' }}>This level is informational only in v1, so only Inconclusive is available.</p>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
