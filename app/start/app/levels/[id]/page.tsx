'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO, parseSleepHM } from '@/lib/format'
import {
  WINDOW_DAYS, OBSERVED_REQUIRED, BASELINE_DAYS, MIN_BASELINE_DAYS, EXTEND_DAYS,
  addDays, diffDays, errMsg, fmtD, readSignal, suggestVerdict,
  METRIC_LABELS,
  type ExperimentTemplate, type LevelsExperiment, type SignalRead, type VerdictKind, type VerdictSuggestion,
} from '@/lib/levels'

const VERDICT_BUTTONS: { kind: VerdictKind; label: string }[] = [
  { kind: 'keep', label: 'Keep it' },
  { kind: 'extend', label: 'Extend 5 days' },
  { kind: 'drop', label: 'Drop it' },
  { kind: 'inconclusive', label: 'Inconclusive' },
]

const fmtShiftVal = (metric: string, v: number): string => {
  const sign = v > 0 ? '+' : ''
  switch (metric) {
    case 'weight_lb': return `${sign}${v.toFixed(1)} lb`
    case 'sleep_hours': return `${sign}${Math.round(v * 60)} min`
    case 'deep_sleep_min': return `${sign}${Math.round(v)} min`
    case 'overnight_hr_bpm': return `${sign}${Math.round(v)} bpm`
    case 'overnight_hrv_ms': return `${sign}${Math.round(v)} ms`
    case 'vo2max': return `${sign}${v.toFixed(1)}`
    default: return `${sign}${v.toFixed(1)}`
  }
}

export default function LevelRunPage({ params }: { params: { id: string } }) {
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [signal, setSignal] = useState<SignalRead | null>(null)
  const [suggestion, setSuggestion] = useState<VerdictSuggestion | null>(null)
  const [heldToday, setHeldToday] = useState(false)
  const [dayHeld, setDayHeld] = useState<Record<string, boolean>>({})
  const [observedDays, setObservedDays] = useState(0)
  const [observedRequired, setObservedRequired] = useState(OBSERVED_REQUIRED)
  const [baselineHeldPct, setBaselineHeldPct] = useState<number | null>(null)
  const [metricValue, setMetricValue] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

        const { data: entries } = await supabase
          .from('metric_entries')
          .select('entry_date, value')
          .eq('user_id', user.id)
          .eq('metric_key', metricKey)
          .gte('entry_date', addDays(e.start_date, -BASELINE_DAYS))
          .lte('entry_date', windowEnd)
          .order('entry_date')
        const all = (entries as { entry_date: string; value: number }[] | null) ?? []
        const baselineVals = all.filter((r) => r.entry_date < e.start_date).map((r) => Number(r.value))
        const observedVals = all.filter((r) => r.entry_date >= e.start_date).map((r) => Number(r.value))
        const observedDates = new Set(all.filter((r) => r.entry_date >= e.start_date).map((r) => r.entry_date))
        setObservedDays(observedDates.size)

        const sig = readSignal(t.primary_metric, t.threshold_direction, baselineVals, observedVals)
        setSignal(sig)

        const { data: checks } = await supabase
          .from('protocol_checks')
          .select('log_date, held')
          .eq('user_id', user.id)
          .eq('protocol_id', e.protocol_id)
          .gte('log_date', e.start_date)
          .lte('log_date', windowEnd)
        const heldMap: Record<string, boolean> = {}
        ;((checks as { log_date: string; held: boolean }[] | null) ?? []).forEach((c) => { heldMap[c.log_date] = c.held })
        setDayHeld(heldMap)
        setHeldToday(heldMap[today] === true)

        const windowDays = e.window_days ?? WINDOW_DAYS
        const elapsed = Math.min(diffDays(e.start_date, windowEnd) + 1, windowDays)
        const adherence = elapsed > 0
          ? Object.values(heldMap).filter(Boolean).length / elapsed
          : null

        // Baseline stability: trailing 10 days across enabled track='levels'
        // protocols, excluding only this run's own row. Kept levels count
        // toward the baseline once adopted.
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

  const toggleHeld = async () => {
    if (!exp || acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const next = !heldToday
      const { error } = await supabase.from('protocol_checks').upsert(
        { user_id: user.id, protocol_id: exp.protocol_id, log_date: todayISO(), held: next },
        { onConflict: 'user_id,protocol_id,log_date' },
      )
      if (error) throw error
      setHeldToday(next)
      setDayHeld((prev) => ({ ...prev, [todayISO()]: next }))
    } catch (e) {
      setError(errMsg(e))
    }
    setActing(false)
  }

  const logMetric = async () => {
    if (!exp || !template) return
    let v: number | null
    if (template.primary_metric === 'sleep_hours') {
      v = parseSleepHM(metricValue)
      if (v == null) { setSavedMsg('Enter hours and minutes like 7:30.'); return }
    } else {
      v = parseFloat(metricValue)
      if (Number.isNaN(v)) { setSavedMsg('Enter a number.'); return }
    }
    setActing(true)
    setSavedMsg(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const today = todayISO()
      const { data: existing } = await supabase
        .from('metric_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('entry_date', today)
        .eq('metric_key', template.primary_metric)
        .limit(1)
      const row = { user_id: user.id, entry_date: today, metric_key: template.primary_metric, value: v, source: 'manual' }
      if ((existing as { id: string }[] | null)?.length) {
        const { error } = await supabase.from('metric_entries').update({ value: v, source: 'manual' }).eq('id', (existing as { id: string }[])[0].id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('metric_entries').insert(row)
        if (error) throw error
      }
      setMetricValue('')
      setSavedMsg('Saved. This day now counts as observed.')
    } catch (e) {
      setSavedMsg(errMsg(e))
    }
    setActing(false)
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

  if (!loaded) return <main className="p-6" style={{ color: '#9aa0ae' }}>Loading…</main>
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
        <p className="text-sm" style={{ color: '#9aa0ae' }}>Level run not found.</p>
        <Link href="/start/app/levels" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to Levels</Link>
      </main>
    )
  }

  const today = todayISO()
  const windowDays = exp.window_days ?? WINDOW_DAYS
  const dayNum = Math.min(Math.max(diffDays(exp.start_date, today) + 1, 1), windowDays)
  const verdictOpen = today >= exp.end_date || dayNum >= windowDays
  const metricMeta = METRIC_LABELS[template.primary_metric]
  const signalColor = signal?.strength === 'signal' ? '#7ee2a8' : signal?.strength === 'suggestive' ? '#e8c468' : '#9aa0ae'
  const heldCount = Object.values(dayHeld).filter(Boolean).length
  const alreadyExtended = windowDays > WINDOW_DAYS

  return (
    <main className="p-6 max-w-xl mx-auto pb-28">
      <Link href="/start/app/levels" className="text-sm" style={{ color: '#9aa0ae', textDecoration: 'none' }}>← Levels</Link>
      <p className="text-xs font-semibold tracking-wider mt-3" style={{ color: '#e0607e' }}>LEVEL {template.level_number}</p>
      <h1 className="text-2xl font-bold mt-1">{exp.title}</h1>
      {exp.hypothesis && <p className="mt-2 italic text-sm" style={{ color: '#9aa0ae' }}>{exp.hypothesis}</p>}
      {error && <p className="mt-3 text-sm" style={{ color: '#e0607e' }}>{error}</p>}

      <div className="card mt-4 p-5">
        <div className="flex justify-between text-sm">
          <span>Day {dayNum} of {windowDays}</span>
          <span style={{ color: '#e0607e', fontWeight: 700 }}>{Math.round((dayNum / windowDays) * 100)}%</span>
        </div>
        <div className="mt-2" style={{ height: 10, borderRadius: 999, background: '#2c313d' }}>
          <div style={{ width: `${(dayNum / windowDays) * 100}%`, height: '100%', borderRadius: 999, background: '#e0607e' }} />
        </div>
        <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>
          {observedDays} of {observedRequired} observed days logged
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {Array.from({ length: windowDays }, (_, i) => addDays(exp.start_date, i)).map((d) => (
            <span key={d} title={`${fmtD(d)}${d === today ? ' (today)' : ''}`} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: dayHeld[d] ? '#e0607e' : 'transparent',
              border: `1px solid ${dayHeld[d] ? '#e0607e' : d === today ? '#e0607e' : '#4a5160'}`,
            }} />
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>{heldCount} of {windowDays} days held · {fmtD(exp.start_date)} – {fmtD(exp.end_date)}</p>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>TODAY</p>
        <button onClick={toggleHeld} disabled={acting} className="btn w-full mt-3" style={{
          background: heldToday ? '#e0607e' : 'transparent',
          border: heldToday ? 'none' : '1px solid #e0607e',
          color: heldToday ? '#fff' : '#e0607e',
        }}>
          {heldToday ? '✓ Held today' : 'Mark today held'}
        </button>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>{metricMeta.label.toUpperCase()} VS BASELINE</p>
        {signal && signal.baselineMedian != null ? (
          <>
            <p className="mt-2 text-3xl font-bold">
              <span style={{ color: signalColor }}>
                {signal.shift != null ? fmtShiftVal(template.primary_metric, signal.shift) : '–'}
              </span>
              <span className="text-xl"> vs baseline</span>
            </p>
            <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>
              Baseline median {metricMeta.fmt(signal.baselineMedian)} · {signal.directionDays} of {signal.observedDays} days moving {template.threshold_direction === 'down' ? 'down' : 'up'}
            </p>
            <p className="mt-2 text-sm font-semibold" style={{ color: signalColor }}>
              {signal.strength === 'signal' ? 'Signal' : signal.strength === 'suggestive' ? 'Suggestive' : 'No signal'}
            </p>
            <p className="mt-1 text-sm" style={{ color: '#9aa0ae' }}>{signal.text}</p>
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>
            Log your 7-day average {metricMeta.label.toLowerCase()} daily. The signal reads against your 7-day pre-level median once data lands.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={metricValue}
            onChange={(e) => setMetricValue(e.target.value)}
            placeholder={template.primary_metric === 'sleep_hours' ? '7-day average sleep (7:30)' : `7-day average ${metricMeta.label.toLowerCase()} (${metricMeta.unit})`}
            inputMode="decimal"
            className="card flex-1 p-3"
            style={{ background: '#22262f', border: '1px solid #2c313d', color: '#fff', outline: 'none' }}
          />
          <button onClick={logMetric} disabled={acting} className="btn">Log</button>
        </div>
        {savedMsg && <p className="mt-2 text-sm" style={{ color: '#7ee2a8' }}>{savedMsg}</p>}
      </div>

      <div className="card mt-4 p-5">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>BASELINE HELD (LAST 10 DAYS)</p>
          {baselineHeldPct != null && (
            <p className="text-sm font-bold" style={{ color: baselineHeldPct >= 0.9 ? '#7ee2a8' : '#e8c468' }}>{Math.round(baselineHeldPct * 100)}%</p>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>The baseline has to stay stable for the verdict to count. Below your gate, the verdict is capped at inconclusive.</p>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>VERDICT</p>
        {!verdictOpen ? (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>
            Verdict unlocks {fmtD(exp.end_date)} – decisions on day {windowDays}.
          </p>
        ) : suggestion ? (
          <>
            <div className="mt-3 p-4" style={{ background: '#22262f', borderRadius: 8 }}>
              <p className="text-sm font-bold" style={{ color: '#fff' }}>
                Suggested: {suggestion.verdict === 'keep' ? 'Keep it' : suggestion.verdict === 'extend' ? 'Extend 5 days' : suggestion.verdict === 'drop' ? 'Drop it' : 'Inconclusive'}
              </p>
              <ul className="mt-2 space-y-1">
                {suggestion.reasons.map((r, i) => (
                  <li key={i} className="text-sm" style={{ color: '#9aa0ae' }}>· {r}</li>
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
