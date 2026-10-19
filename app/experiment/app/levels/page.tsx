'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import {
  WINDOW_DAYS, OBSERVED_REQUIRED, MIN_BASELINE_DAYS,
  addDays, diffDays, errMsg, median, fmtD, lockStateForLevel, safetyConflicts,
  METRIC_LABELS,
  type ExperimentTemplate, type LevelsExperiment,
} from '@/lib/levels'
import { fetchBaselineValues, fetchProfileExtras, DEFAULT_LOOKBACK_DAYS } from '@/lib/baseline'

const PILLAR_FOR_METRIC: Record<string, 'nutrition' | 'movement' | 'mind'> = {
  weight_lb: 'nutrition',
  sleep_hours: 'mind',
  deep_sleep_min: 'mind',
  overnight_hr_bpm: 'movement',
  overnight_hrv_ms: 'movement',
  vo2max: 'movement',
}

interface DoneInfo { template_level: number | null; verdict: string | null }

export default function LevelsPage() {
  const [templates, setTemplates] = useState<ExperimentTemplate[]>([])
  const [activeExp, setActiveExp] = useState<LevelsExperiment | null>(null)
  const [done, setDone] = useState<DoneInfo[]>([])
  const [hasBaselineRoutines, setHasBaselineRoutines] = useState(false)
  const [stabilityPct, setStabilityPct] = useState<number | null>(null)
  const [gatePct, setGatePct] = useState(90)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-registration state
  const [selected, setSelected] = useState<ExperimentTemplate | null>(null)
  const [hypothesis, setHypothesis] = useState('')
  const [baselineDays, setBaselineDays] = useState<number | null>(null)
  const [baselineMedian, setBaselineMedian] = useState<number | null>(null)
  const [lookbackDays, setLookbackDays] = useState<number | null>(null)
  const [safetyAnswers, setSafetyAnswers] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)
  const [preErr, setPreErr] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }

        const { data: tpl, error: tErr } = await supabase
          .from('experiment_templates')
          .select('*')
          .order('level_number')
        if (tErr) throw tErr
        setTemplates((tpl as ExperimentTemplate[] | null) ?? [])

        const { data: exps, error: xErr } = await supabase
          .from('experiments')
          .select('*')
          .eq('user_id', user.id)
          .eq('mode', 'levels')
        if (xErr) throw xErr
        const all = (exps as LevelsExperiment[] | null) ?? []
        setActiveExp(all.find((e) => e.status === 'active') ?? null)
        setDone(all.filter((e) => e.status === 'done').map((e) => ({ template_level: e.template_level, verdict: e.verdict })))

        // Baseline routines: enabled track='levels' protocols, excluding only the
        // active level's own row. A kept level joins the baseline once adopted.
        const expProtocolIds = new Set(all.filter((e) => e.status === 'active').map((e) => e.protocol_id))
        const { data: protos, error: pErr } = await supabase
          .from('protocols')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('track', 'levels')
          .eq('enabled', true)
        if (pErr) throw pErr
        const baseline = ((protos as { id: string; created_at: string }[] | null) ?? [])
          .filter((p) => !expProtocolIds.has(p.id))
        setHasBaselineRoutines(baseline.length > 0)

        const today = todayISO()
        const winStart = addDays(today, -9)
        let stab: number | null = null
        if (baseline.length > 0) {
          const { data: checks } = await supabase
            .from('protocol_checks')
            .select('protocol_id, log_date, held')
            .eq('user_id', user.id)
            .in('protocol_id', baseline.map((b) => b.id))
            .gte('log_date', winStart)
            .lte('log_date', today)
          const list = (checks as { protocol_id: string; log_date: string; held: boolean }[] | null) ?? []
          let num = 0, den = 0
          for (const b of baseline) {
            const since = b.created_at.slice(0, 10)
            const from = since > winStart ? since : winStart
            const days = diffDays(from, today) + 1
            den += days
            num += list.filter((c) => c.protocol_id === b.id && c.log_date >= from && c.held).length
          }
          stab = den > 0 ? num / den : null
        }
        setStabilityPct(stab)

        const { data: prof } = await supabase
          .from('profiles')
          .select('stability_gate_pct')
          .eq('id', user.id)
          .single()
        const g = (prof as { stability_gate_pct?: number | null } | null)?.stability_gate_pct
        if (typeof g === 'number' && g >= 80 && g <= 100) setGatePct(g)
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [])

  const lockFor = (level: number) => {
    const levelDone = done.some((d) => d.template_level === level)
    const anyActive = activeExp != null
    return lockStateForLevel({
      level, hasBaselineRoutines, anyActive, levelDone,
      stabilityPct, gatePct,
    })
  }

  const openPrereg = async (t: ExperimentTemplate) => {
    setSelected(t)
    setHypothesis(t.detail)
    setPreErr(null)
    setBaselineDays(null)
    setBaselineMedian(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = todayISO()
      const prof = await fetchProfileExtras(supabase, user.id)
      const lb = prof.lookback
      setLookbackDays(lb)
      const vals = await fetchBaselineValues(supabase, user.id, t.primary_metric, today, lb)
      setBaselineDays(vals.length)
      setBaselineMedian(median(vals.map((v) => v.value)))
      try {
        const { data: scr } = await supabase
          .from('safety_screenings')
          .select('answers')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const a = (scr as { answers?: Record<string, boolean> | null } | null)?.answers
        setSafetyAnswers(a ?? null)
      } catch {
        setSafetyAnswers(null)
      }
    } catch (e) {
      setPreErr(errMsg(e))
    }
  }

  const startLevel = async () => {
    if (!selected || saving) return
    setSaving(true)
    setPreErr(null)
    try {
      const supabase = createClient()
      const { data: { user }, error: uErr } = await supabase.auth.getUser()
      if (uErr) throw uErr
      if (!user) throw new Error('Not signed in. Please log in again.')

      // One experiment at a time, re-checked at write time.
      const { data: activeNow, error: aErr } = await supabase
        .from('experiments')
        .select('id')
        .eq('user_id', user.id)
        .eq('mode', 'levels')
        .eq('status', 'active')
        .limit(1)
      if (aErr) throw aErr
      if (activeNow && activeNow.length > 0) throw new Error('A level is already running. Finish it before starting another.')

      const conflicts = safetyConflicts(selected.contraindications, safetyAnswers)
      if (conflicts.length > 0) throw new Error('Blocked: talk to your clinician before starting this level.')

      // Retry-safe: reuse a level protocol with the same label.
      let protocolId: string | null = null
      const { data: dup, error: dErr } = await supabase
        .from('protocols')
        .select('id')
        .eq('user_id', user.id)
        .eq('track', 'levels')
        .eq('label', selected.title)
        .limit(1)
      if (dErr) throw dErr
      protocolId = (dup as { id: string }[] | null)?.[0]?.id ?? null
      if (!protocolId) {
        const { data: last } = await supabase
          .from('protocols')
          .select('position')
          .eq('user_id', user.id)
          .eq('pillar', PILLAR_FOR_METRIC[selected.primary_metric] ?? 'mind')
          .order('position', { ascending: false })
          .limit(1)
        const pos = ((last as { position: number }[] | null)?.[0]?.position ?? -1) + 1
        const { data: proto, error: pErr } = await supabase
          .from('protocols')
          .insert({
            user_id: user.id,
            pillar: PILLAR_FOR_METRIC[selected.primary_metric] ?? 'mind',
            label: selected.title,
            detail: selected.detail,
            position: pos,
            track: 'levels',
            enabled: true,
          })
          .select('id')
          .single()
        if (pErr) throw pErr
        protocolId = (proto as { id: string }).id
      }

      const startDate = todayISO()
      const { data: exp, error: eErr } = await supabase
        .from('experiments')
        .insert({
          user_id: user.id,
          protocol_id: protocolId,
          title: selected.title,
          hypothesis: hypothesis.trim() || selected.detail,
          start_date: startDate,
          end_date: addDays(startDate, WINDOW_DAYS - 1),
          duration_days: WINDOW_DAYS,
          baseline_snapshot: [],
          status: 'active',
          mode: 'levels',
          window_days: WINDOW_DAYS,
          observed_days_required: OBSERVED_REQUIRED,
          template_level: selected.level_number,
        })
        .select('id')
        .single()
      if (eErr) throw eErr
      window.location.href = `/experiment/app/levels/${(exp as { id: string }).id}`
    } catch (e) {
      setPreErr(errMsg(e))
    }
    setSaving(false)
  }

  const doneByLevel = useMemo(() => {
    const m = new Map<number, DoneInfo>()
    for (const d of done) if (d.template_level != null) m.set(d.template_level, d)
    return m
  }, [done])

  if (!loaded) return <main className="p-6" style={{ color: '#9aa0ae' }}>Loading…</main>

  const startDate = todayISO()

  return (
    <main className="p-6 max-w-xl mx-auto pb-28">
      <h1 className="text-2xl font-bold">Levels</h1>
      <p className="mt-1 text-sm" style={{ color: '#9aa0ae' }}>
        One at a time. Finish a level, then choose your next.
      </p>
      {error && <p className="mt-4 text-sm" style={{ color: '#e0607e' }}>{error}</p>}

      {activeExp && (
        <Link href={`/experiment/app/levels/${activeExp.id}`} className="card mt-4 p-5 block" style={{ textDecoration: 'none', border: '1px solid #e0607e' }}>
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#e0607e' }}>RUNNING NOW</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#fff' }}>Level {activeExp.template_level}: {activeExp.title}</p>
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>Day {Math.min(diffDays(activeExp.start_date, todayISO()) + 1, WINDOW_DAYS)} of {activeExp.window_days ?? WINDOW_DAYS}. Tap to open the run screen.</p>
        </Link>
      )}

      {templates.length === 0 && !error && (
        <div className="card mt-6 p-5">
          <p className="text-sm" style={{ color: '#9aa0ae' }}>The level catalogue is still being set up. Check back soon.</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {templates.map((t) => {
          const lock = lockFor(t.level_number)
          const isActive = activeExp?.template_level === t.level_number
          const doneInfo = doneByLevel.get(t.level_number)
          const metricLabel = METRIC_LABELS[t.primary_metric]?.label ?? t.primary_metric
          return (
            <div key={t.level_number} className="card p-5" style={{ opacity: !lock.unlocked && !isActive ? 0.75 : 1 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>LEVEL {t.level_number}</p>
                  <p className="text-lg font-bold mt-1">{t.title}</p>
                  <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{metricLabel}: {t.threshold_label}</p>
                </div>
                <span className="text-xs font-bold" style={{
                  color: t.evidence_tier === 'A' ? '#7ee2a8' : t.evidence_tier === 'B' ? '#e8c468' : '#9aa0ae',
                  border: '1px solid currentColor', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap',
                }}>
                  Evidence {t.evidence_tier}
                </span>
              </div>
              <div className="mt-3">
                {isActive ? (
                  <Link href={`/experiment/app/levels/${activeExp.id}`} className="btn inline-block" style={{ textDecoration: 'none' }}>
                    Open run screen
                  </Link>
                ) : doneInfo && !(lock.unlocked && !activeExp) ? (
                  <p className="text-sm" style={{ color: '#7ee2a8' }}>
                    Completed ({doneInfo.verdict ? doneInfo.verdict.replace('_', ' ') : 'verdict recorded'}).
                  </p>
                ) : lock.unlocked && !activeExp ? (
                  <button onClick={() => openPrereg(t)} className="btn">{doneInfo ? 'Run again' : 'Start level'}</button>
                ) : (
                  <p className="text-sm" style={{ color: '#9aa0ae' }}>🔒 {lock.reason ?? 'Locked'}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pre-registration panel */}
      {selected && (
        <div className="card mt-6 p-5" style={{ border: '1px solid #e0607e' }}>
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#e0607e' }}>PRE-REGISTER LEVEL {selected.level_number}</p>
          <p className="text-xl font-bold mt-1">{selected.title}</p>
          {preErr && <p className="mt-3 text-sm" style={{ color: '#e0607e' }}>{preErr}</p>}

          <p className="mt-4 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>MY HYPOTHESIS</p>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            rows={3}
            className="card mt-2 w-full p-4"
            style={{ background: '#22262f', border: '1px solid #2c313d', color: '#fff', outline: 'none', resize: 'vertical' }}
          />

          <div className="mt-4 text-sm" style={{ color: '#9aa0ae' }}>
            <p><span style={{ color: '#fff', fontWeight: 600 }}>{METRIC_LABELS[selected.primary_metric]?.label}</span>: {selected.threshold_label}</p>
            <p className="mt-1">Window: {WINDOW_DAYS} days ({fmtD(startDate)} – {fmtD(addDays(startDate, WINDOW_DAYS - 1))}), {OBSERVED_REQUIRED} observed days required. An observed day is a day in the window with a logged value for this metric.</p>
            {selected.verdict_driver === false && (
              <p className="mt-1" style={{ color: '#e8c468' }}>Informational only in v1: the verdict is always inconclusive for this level.</p>
            )}
          </div>

          <p className="mt-4 text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>BASELINE SNAPSHOT (LAST {lookbackDays ?? DEFAULT_LOOKBACK_DAYS} DAYS)</p>
          {baselineDays == null ? (
            <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Loading baseline…</p>
          ) : (
            <p className="mt-2 text-sm" style={{ color: baselineDays < MIN_BASELINE_DAYS ? '#e0607e' : '#9aa0ae' }}>
              {baselineDays} days logged
              {baselineMedian != null && <> · median {METRIC_LABELS[selected.primary_metric]?.fmt(baselineMedian)}</>}
              {baselineDays < MIN_BASELINE_DAYS && '. The verdict will be capped at inconclusive with a weak baseline.'}
            </p>
          )}

          {(() => {
            const conflicts = safetyConflicts(selected.contraindications, safetyAnswers)
            if (conflicts.length > 0) {
              return (
                <div className="mt-4 p-4" style={{ background: '#3a2228', borderRadius: 8 }}>
                  <p className="text-sm font-bold" style={{ color: '#e0607e' }}>Talk to your clinician before starting this level.</p>
                  <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>
                    This level is flagged for: {conflicts.join(', ')}. Starting is blocked until a clinician clears it.
                  </p>
                </div>
              )
            }
            return null
          })()}

          <button
            onClick={startLevel}
            disabled={saving || safetyConflicts(selected.contraindications, safetyAnswers).length > 0}
            className="btn w-full mt-5"
            style={{ opacity: saving ? 0.5 : 1, padding: '16px' }}
          >
            {saving ? 'Starting…' : `Start Level ${selected.level_number} today`}
          </button>
          <button onClick={() => setSelected(null)} className="w-full mt-2 text-sm" style={{ color: '#9aa0ae', background: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}
    </main>
  )
}
