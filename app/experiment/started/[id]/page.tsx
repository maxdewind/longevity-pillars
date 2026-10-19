'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errMsg, type ExperimentTemplate, type LevelsExperiment } from '@/lib/levels'
import { primaryPhrase } from '@/lib/firstRun'
import { fmtMD } from '@/lib/format'

import { loadRunPrefs, saveRunPrefs } from '@/lib/runPrefs'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-14 h-8 rounded-full shrink-0 transition-colors"
      style={{ background: on ? '#f0506e' : 'rgba(255,255,255,0.15)' }}
    >
      <span
        className="block w-6 h-6 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(30px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

export default function StartedPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [prefs, setPrefs] = useState({ morningCommitment: true, eveningCheckin: true })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPrefs(loadRunPrefs())
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
        if (e.template_level != null) {
          const { data: tRow } = await supabase
            .from('experiment_templates')
            .select('*')
            .eq('level_number', e.template_level)
            .maybeSingle()
          setTemplate((tRow as ExperimentTemplate | null) ?? null)
        }
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [params.id])

  const setPref = (k: 'morningCommitment' | 'eveningCheckin', v: boolean) => {
    setPrefs((p) => {
      const next = { ...p, [k]: v }
      saveRunPrefs(next)
      return next
    })
  }

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>
  if (error || !exp) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-sm" style={{ color: '#e0607e' }}>{error ?? 'Experiment not found.'}</p>
          <Link href="/experiment/app/levels" className="btn-primary w-full block text-center mt-4">
            Back to Experiments
          </Link>
        </div>
      </main>
    )
  }

  const windowDays = exp.window_days ?? 12
  const steps = [
    {
      title: 'Commit in the morning, hold it at night',
      sub: 'Morning promise is optional. In the evening, tap Held if you stuck to it.',
    },
    {
      title: 'We read Apple Health overnight',
      sub: 'No logging. Wear your watch to bed.',
    },
    {
      title: `${fmtMD(exp.end_date)}: your verdict`,
      sub: `Held 10 of ${windowDays} days, then we compare with your starting point.`,
    },
  ]

  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Experiment started</p>
      <h1 className="text-4xl font-bold mt-3 leading-tight">You&apos;re in. Day 1 starts now.</h1>

      <div className="card mt-6">
        <p className="font-semibold text-xl">{exp.title}</p>
        <p className="text-sm text-muted mt-1">
          {windowDays} days · {fmtMD(exp.start_date)} to {fmtMD(exp.end_date)}
        </p>
        {template && (
          <p className="text-sm mt-2">
            <span className="font-bold">Primary:</span>{' '}
            <span className="text-muted">{primaryPhrase(template)}</span>
          </p>
        )}
      </div>

      <p className="text-xs text-muted uppercase tracking-widest mt-8 mb-4">What happens next</p>
      <div>
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className="w-9 h-9 rounded-full border flex items-center justify-center font-bold shrink-0"
                style={{ borderColor: '#f0506e', color: '#f0506e' }}
              >
                {i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className="w-px flex-1" style={{ background: 'rgba(240,80,110,0.35)', minHeight: 24 }} />
              )}
            </div>
            <div className="pb-6">
              <p className="font-semibold text-lg">{s.title}</p>
              <p className="text-sm text-muted">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-lg">Morning commitment</p>
            <p className="text-sm text-muted">Optional. A quick promise to yourself at 07:30.</p>
          </div>
          <Toggle on={prefs.morningCommitment} onChange={(v) => setPref('morningCommitment', v)} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-lg">Evening check-in</p>
            <p className="text-sm text-muted">Tap Held at 19:30.</p>
          </div>
          <Toggle on={prefs.eveningCheckin} onChange={(v) => setPref('eveningCheckin', v)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/experiment/app/levels/${exp.id}`)}
        className="btn-primary w-full mt-8 !py-4 text-lg"
      >
        Go to Today
      </button>
    </main>
  )
}
