'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayISO, fmtMD } from '@/lib/format'
import {
  SPRINT_DAYS, addDays, errMsg,
  type ExperimentTemplate, type LevelsExperiment,
} from '@/lib/levels'
import { fmtHeldNights } from '@/lib/sprint'

export default function SmallerRulePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [heldCount, setHeldCount] = useState(0)
  const [customSmaller, setCustomSmaller] = useState('')
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
          .from('experiments').select('*')
          .eq('id', params.id).eq('user_id', user.id).single()
        if (eErr) throw eErr
        const e = eRow as LevelsExperiment
        setExp(e)
        if (e.template_level != null) {
          const { data: tRow } = await supabase
            .from('experiment_templates').select('*')
            .eq('level_number', e.template_level).maybeSingle()
          setTemplate((tRow as ExperimentTemplate | null) ?? null)
        }
        const { data: checks } = await supabase
          .from('protocol_checks').select('log_date, held')
          .eq('user_id', user.id).eq('protocol_id', e.protocol_id)
          .gte('log_date', e.start_date).lte('log_date', e.end_date)
        setHeldCount(((checks as { held: boolean }[] | null) ?? []).filter((c) => c.held).length)
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [params.id])

  const startRamp = async (steps: { label: string; detail: string }[]) => {
    if (!exp || acting) return
    setActing(true)
    try {
      const supabase = createClient()
      await supabase.from('experiments').update({
        status: 'done', verdict: 'not_held',
      }).eq('id', exp.id)
      // New 7-day sprint at the first (smallest) step.
      const startDate = todayISO()
      const { data: proto } = await supabase.from('protocols').select('pillar').eq('id', exp.protocol_id).single()
      const pillar = ((proto as { pillar?: string } | null)?.pillar as string) ?? 'mind'
      const { data: newProto, error: pErr } = await supabase.from('protocols').insert({
        user_id: exp.user_id,
        pillar,
        label: exp.title,
        detail: steps[0].detail,
        track: 'levels',
        enabled: true,
      }).select('id').single()
      if (pErr) throw pErr
      const protocolId = (newProto as { id: string }).id
      const { data: newExp, error: eErr } = await supabase.from('experiments').insert({
        user_id: exp.user_id,
        protocol_id: protocolId,
        title: exp.title,
        hypothesis: steps[0].detail,
        start_date: startDate,
        end_date: addDays(startDate, SPRINT_DAYS - 1),
        duration_days: SPRINT_DAYS,
        status: 'active',
        mode: 'levels',
        window_days: SPRINT_DAYS,
        observed_days_required: SPRINT_DAYS - 2,
        template_level: exp.template_level,
        ramp_steps: steps,
        ramp_step: 0,
      }).select('id').single()
      if (eErr) throw eErr
      router.push(`/experiment/app/levels/${(newExp as { id: string }).id}`)
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const setAside = async () => {
    if (!exp || acting) return
    setActing(true)
    try {
      const supabase = createClient()
      await supabase.from('experiments').update({ status: 'done', verdict: 'not_held' }).eq('id', exp.id)
      router.push('/experiment/app/protocol')
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>
  if (error || !exp) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-sm" style={{ color: '#e0607e' }}>{error ?? 'Experiment not found.'}</p>
        <Link href="/experiment/app/protocol" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to My protocol</Link>
      </main>
    )
  }

  const steps: { label: string; detail: string }[] | null =
    (template?.ramp_steps as { label: string; detail: string }[] | null)
    ?? (exp.ramp_steps as { label: string; detail: string }[] | null)
    ?? null
  const windowDays = exp.window_days ?? SPRINT_DAYS
  const originalLabel = steps && steps.length > 0 ? steps[steps.length - 1].label : exp.title

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <h1 className="text-xl font-bold leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {exp.title}
      </h1>
      <h2 className="text-3xl font-bold mt-4">Try a smaller version</h2>
      <p className="text-muted mt-2">
        Same rule, a bar you can reach. Still one fixed time, no flexibility.
      </p>

      <div className="card mt-6" style={{ background: '#262a35' }}>
        <p className="text-xs text-muted uppercase tracking-widest">Now</p>
        <p className="text-xl font-bold mt-1">{template?.detail ?? exp.hypothesis ?? exp.title}</p>
        <p className="text-sm text-muted mt-1">{fmtHeldNights(heldCount, windowDays)}</p>
      </div>

      {steps ? (
        <>
          <p className="font-semibold mt-6 mb-3" style={{ color: '#f0506e' }}>
            Your ramp back to {originalLabel}
          </p>
          <div className="flex gap-3 items-end">
            {steps.map((s, i) => (
              <div
                key={s.label}
                className="flex-1 rounded-xl border p-4 text-center"
                style={i === 0
                  ? { background: '#f0506e', borderColor: '#f0506e', minHeight: 120 }
                  : { borderColor: '#4a5160', minHeight: 96 + i * 12 }}
              >
                <p className="font-bold text-lg" style={{ color: i === 0 ? '#fff' : '#f0506e' }}>{s.label}</p>
                <p className="text-sm" style={{ color: i === 0 ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                  Week {i + 1}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted mt-4">
            Hold a step on 6 of 7 nights to move up to the next one.
          </p>
          <button
            type="button"
            onClick={() => startRamp(steps)}
            disabled={acting}
            className="btn-primary w-full mt-4 !py-4 text-lg"
          >
            Start at {steps[0].label}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/experiment/app/levels/${exp.id}`)}
            disabled={acting}
            className="btn w-full mt-3 !py-4 text-lg"
          >
            Keep {originalLabel}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mt-6">
            This rule is on or off, so there is no smaller version. Name one fixed smaller bar:
          </p>
          <input
            value={customSmaller}
            onChange={(e) => setCustomSmaller(e.target.value)}
            placeholder="e.g. Lights out by 11:30 PM"
            className="input w-full mt-3"
          />
          <button
            type="button"
            onClick={() => customSmaller.trim() && startRamp([{ label: customSmaller.trim(), detail: customSmaller.trim() }])}
            disabled={acting || !customSmaller.trim()}
            className="btn-primary w-full mt-4 !py-4 text-lg"
          >
            Start smaller
          </button>
          <button
            type="button"
            onClick={() => router.push(`/experiment/app/levels/${exp.id}`)}
            disabled={acting}
            className="btn w-full mt-3 !py-4 text-lg"
          >
            Keep the original rule
          </button>
        </>
      )}

      <p className="text-center mt-5">
        <button type="button" onClick={setAside} disabled={acting} className="text-muted underline underline-offset-4">
          Set it aside
        </button>
      </p>
      {error && <p className="text-sm mt-3" style={{ color: '#e0607e' }}>{error}</p>}
    </main>
  )
}
