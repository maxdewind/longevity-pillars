'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  addDays, errMsg, median, safetyConflicts, METRIC_LABELS,
  type ExperimentTemplate,
} from '@/lib/levels'
import { todayISO } from '@/lib/format'
import { fetchBaselineValues, fetchProfileExtras } from '@/lib/baseline'
import { startLevelExperiment } from '@/lib/levelStart'

const PILLARS = [
  { key: 'nutrition', label: 'Nutrition', sub: 'Food, meals, and eating windows.' },
  { key: 'movement', label: 'Movement', sub: 'Steps, strength, and moving more.' },
  { key: 'sleep', label: 'Sleep', sub: 'Nights, light, and winding down.' },
  { key: 'mind', label: 'Mind', sub: 'Stress, attention, and calm.' },
]

export default function StartPillarPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [templates, setTemplates] = useState<ExperimentTemplate[]>([])
  const [pillar, setPillar] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExperimentTemplate | null>(null)
  const [hypothesis, setHypothesis] = useState('')
  const [baselineDays, setBaselineDays] = useState<number | null>(null)
  const [baselineMedian, setBaselineMedian] = useState<number | null>(null)
  const [safetyAnswers, setSafetyAnswers] = useState<Record<string, boolean> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      const [{ data: t }, { data: a }] = await Promise.all([
        supabase.from('experiment_templates').select('*').order('level_number'),
        supabase.from('experiments').select('id').eq('user_id', user.id).eq('mode', 'levels').eq('status', 'active').limit(1),
      ])
      setTemplates(((t as ExperimentTemplate[] | null) ?? []).filter((x) => x.verdict_driver))
      setActiveId(((a as { id: string }[] | null)?.[0]?.id) ?? null)
    }
    load()
  }, [])

  const pickTemplate = async (t: ExperimentTemplate) => {
    setSelected(t)
    setHypothesis(t.detail)
    setError(null)
    setBaselineDays(null)
    setBaselineMedian(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [prof, { data: scr }] = await Promise.all([
        fetchProfileExtras(supabase, user.id),
        supabase.from('safety_screenings').select('answers').eq('user_id', user.id).limit(1).maybeSingle(),
      ])
      const lb = prof.lookback
      const vals = await fetchBaselineValues(supabase, user.id, t.primary_metric, todayISO(), lb)
      setBaselineDays(vals.length)
      setBaselineMedian(vals.length > 0 ? median(vals.map((v) => v.value)) : null)
      setSafetyAnswers(((scr as { answers?: Record<string, boolean> | null } | null)?.answers) ?? null)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const start = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const conflicts = safetyConflicts(selected.contraindications, safetyAnswers)
      if (conflicts.length > 0) {
        throw new Error(`Blocked for safety (${conflicts.join(', ')}): talk to your clinician before starting this level.`)
      }
      const id = await startLevelExperiment(supabase, user.id, selected, hypothesis)
      window.location.href = `/start/app/levels/${id}`
    } catch (e) {
      setError(errMsg(e))
    }
    setSaving(false)
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

  const options = pillar == null ? [] : templates.filter((t) => (t.pillars ?? []).includes(pillar))

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 6 of 6 · Your focus</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Which pillar do you want to focus on first?</h1>
      <p className="text-sm text-muted mb-6">
        Pick a pillar, then choose your first experiment. One at a time: finish it,
        then choose your next.
      </p>

      {activeId ? (
        <div className="card">
          <p className="text-sm text-muted mb-3">You already have a run going.</p>
          <Link href={`/start/app/levels/${activeId}`} className="btn-primary w-full block text-center">
            Open my current run
          </Link>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {PILLARS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPillar(p.key); setSelected(null) }}
                className={`card text-left ${pillar === p.key ? '!border-accent bg-accent/10' : ''}`}
              >
                <p className="font-semibold">{p.label}</p>
                <p className="text-xs text-muted mt-1">{p.sub}</p>
              </button>
            ))}
          </div>

          {pillar != null && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted">
                Experiments for {PILLARS.find((p) => p.key === pillar)?.label}
              </p>
              {options.map((t) => {
                const others = (t.pillars ?? []).filter((x) => x !== pillar)
                const isSel = selected?.level_number === t.level_number
                return (
                  <button
                    key={t.level_number}
                    type="button"
                    onClick={() => pickTemplate(t)}
                    className={`card w-full text-left ${isSel ? '!border-accent bg-accent/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{t.title}</p>
                      <span
                        className="text-xs font-bold shrink-0"
                        style={{
                          color: t.evidence_tier === 'A' ? '#7ee2a8' : t.evidence_tier === 'B' ? '#e8c468' : '#9aa0ae',
                          border: '1px solid currentColor', borderRadius: 999, padding: '2px 8px',
                        }}
                      >
                        Evidence {t.evidence_tier}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">{t.detail}</p>
                    <p className="text-xs text-muted mt-2">
                      Targets: {METRIC_LABELS[t.primary_metric]?.label ?? t.primary_metric}
                      {others.length > 0 && (
                        <span> · Also helps: {others.join(', ')}</span>
                      )}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {selected && (
            <div className="card mt-6">
              <p className="font-semibold">{selected.title}</p>
              <label className="text-xs text-muted mt-3 block">Your hypothesis (edit if you like)</label>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-ink border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
              <p className="text-xs text-muted mt-2">
                Baseline: {baselineDays == null ? '…' : `${baselineDays} days`} of {selected.primary_metric} history
                {baselineMedian != null && ` (median ${baselineMedian})`}.
              </p>
              {error && <p className="text-sm mt-2" style={{ color: '#e0607e' }}>{error}</p>}
              <button
                type="button"
                onClick={start}
                disabled={saving}
                className="btn-primary w-full mt-4"
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                {saving ? 'Starting…' : 'Start my first experiment'}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
