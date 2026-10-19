'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { errMsg, safetyConflicts, fmtBedtime, type ExperimentTemplate } from '@/lib/levels'
import { startLevelExperiment } from '@/lib/levelStart'
import { ensureStarterBaseline } from '@/lib/starterBaseline'
import {
  loadFirstRunSelection, clearFirstRunSelection, hypothesisFor,
  type FirstRunSelection,
} from '@/lib/firstRun'
import { fetchBaselineValues, fetchProfileExtras } from '@/lib/baseline'
import { todayISO, fmtSleepHM } from '@/lib/format'
import { type MetricKey } from '@/lib/referenceRanges'

const RULES = [
  { title: 'Change one thing', sub: "Don't start anything else new." },
  { title: 'Hold it most days', sub: 'At least 10 of 12 days. Weekly habits: 80% of planned sessions.' },
  { title: 'Keep life normal', sub: 'Same routines otherwise.' },
  { title: 'Log your data', sub: 'Wear your watch to bed.' },
  { title: 'Stop if unwell', sub: 'Wellness information, not medical advice.' },
]

function fmtStartingPoint(metric: MetricKey, avg: number): string {
  switch (metric) {
    case 'weight_lb': return `${avg.toFixed(0)} lb`
    case 'sleep_hours': return fmtSleepHM(avg)
    case 'deep_sleep_min': return `${Math.round(avg)} min`
    case 'overnight_hr_bpm': return `${Math.round(avg)} bpm`
    case 'overnight_hrv_ms': return `${Math.round(avg)} ms`
    case 'vo2max': return `${Math.round(avg)}`
    case 'bedtime': return fmtBedtime(avg)
  }
}

export default function StartGroundRulesPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [selection, setSelection] = useState<FirstRunSelection | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [hypothesis, setHypothesis] = useState('')
  const [startingPoint, setStartingPoint] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sel = loadFirstRunSelection()
    if (!sel) { setSignedIn(true); return }
    setSelection(sel)
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      if (sel.kind === 'template') {
        const { data: t } = await supabase
          .from('experiment_templates')
          .select('*')
          .eq('level_number', sel.level_number)
          .maybeSingle()
        const tpl = (t as ExperimentTemplate | null) ?? null
        setTemplate(tpl)
        if (tpl) {
          setHypothesis(hypothesisFor(tpl.title, tpl))
          try {
            const prof = await fetchProfileExtras(supabase, user.id)
            const vals = await fetchBaselineValues(supabase, user.id, tpl.primary_metric, todayISO(), prof.lookback)
            if (vals.length > 0) {
              const avg = vals.reduce((a, v) => a + v.value, 0) / vals.length
              setStartingPoint(
                `Starting point for this experiment: ${fmtStartingPoint(tpl.primary_metric, avg)}, your ${prof.lookback} days before.`,
              )
            }
          } catch {
            /* starting point stays hidden */
          }
        }
      } else {
        setHypothesis(sel.hypothesis)
        try {
          const prof = await fetchProfileExtras(supabase, user.id)
          const vals = await fetchBaselineValues(supabase, user.id, sel.primary_metric, todayISO(), prof.lookback)
          if (vals.length > 0) {
            const avg = vals.reduce((a, v) => a + v.value, 0) / vals.length
            setStartingPoint(
              `Starting point for this experiment: ${fmtStartingPoint(sel.primary_metric, avg)}, your ${prof.lookback} days before.`,
            )
          }
        } catch {
          /* starting point stays hidden */
        }
      }
    }
    load()
  }, [])

  const start = async () => {
    if (!selection || starting) return
    setStarting(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      await ensureStarterBaseline(supabase, user.id)

      let tpl: { level_number: number | null; title: string; detail: string; pillars: string[] | null }
      if (selection.kind === 'template') {
        if (!template) throw new Error('Experiment not found.')
        const { data: scr } = await supabase
          .from('safety_screenings')
          .select('answers')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()
        const answers = ((scr as { answers?: Record<string, boolean> | null } | null)?.answers) ?? null
        const conflicts = safetyConflicts(template.contraindications, answers)
        if (conflicts.length > 0) {
          throw new Error(`Blocked for safety (${conflicts.join(', ')}): talk to your clinician before starting this level.`)
        }
        tpl = template
      } else {
        tpl = {
          level_number: null,
          title: selection.title,
          detail: selection.detail,
          pillars: [selection.pillar],
        }
      }
      const id = await startLevelExperiment(supabase, user.id, tpl, hypothesis)
      clearFirstRunSelection()
      window.location.href = `/start/started/${id}`
    } catch (e) {
      setError(errMsg(e))
    }
    setStarting(false)
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

  if (!selection) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-muted mb-3">Pick an experiment first.</p>
          <Link href="/start/first" className="btn-primary w-full block text-center">
            Choose my experiment
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Before day 1</p>
      <h1 className="text-3xl font-bold mt-3">Ground rules</h1>

      <div className="card mt-6" style={{ borderColor: '#f0506e', borderWidth: 1.5 }}>
        <p className="text-xs text-muted uppercase tracking-widest">Your hypothesis</p>
        <p className="font-semibold text-lg mt-2 leading-snug">{hypothesis || '…'}</p>
        {startingPoint && <p className="text-sm text-muted mt-2">{startingPoint}</p>}
      </div>

      <div className="mt-6 space-y-4">
        {RULES.map((r, i) => (
          <div key={r.title} className="flex gap-4">
            <p className="text-accent font-bold text-lg w-6 shrink-0">{i + 1}</p>
            <div>
              <p className="font-semibold text-lg">{r.title}</p>
              <p className="text-sm text-muted">{r.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm mt-6" style={{ color: '#e0607e' }}>{error}</p>}

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="btn-primary w-full mt-8 !py-4 text-lg"
        style={{ opacity: starting ? 0.6 : 1 }}
      >
        {starting ? 'Starting day 1…' : "I'm in. Start day 1"}
      </button>
    </main>
  )
}
