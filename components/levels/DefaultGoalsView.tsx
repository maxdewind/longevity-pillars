'use client'

// Read-only list of computed default goals: "given your baseline and the
// population bands, here is a sensible first target for each metric."

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errMsg } from '@/lib/levels'
import { fmtSleepHM } from '@/lib/format'
import type { DefaultGoal } from '@/lib/baseline'
import type { MetricKey } from '@/lib/referenceRanges'

const LABEL: Record<MetricKey, string> = {
  weight_lb: 'Weight',
  sleep_hours: 'Sleep',
  deep_sleep_min: 'Deep sleep',
  overnight_hr_bpm: 'Overnight heart rate',
  overnight_hrv_ms: 'Overnight HRV',
  vo2max: 'VO2max',
}

function fmtTarget(k: MetricKey, v: number): string {
  if (k === 'sleep_hours') return fmtSleepHM(v)
  if (k === 'weight_lb') return `${v.toFixed(1)} lb`
  if (k === 'deep_sleep_min') return `${Math.round(v)} min`
  if (k === 'overnight_hr_bpm') return `${Math.round(v)} bpm`
  if (k === 'overnight_hrv_ms') return `${Math.round(v)} ms`
  return v.toFixed(1)
}

interface Props {
  goals: DefaultGoal[]
  baselineNote: string
  /** When set, shows a save button that writes the goals and navigates there. */
  nextHref?: string
  saveLabel?: string
}

export default function DefaultGoalsView({ goals, baselineNote, nextHref, saveLabel }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!nextHref) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      await supabase.from('goals').delete().eq('user_id', user.id)
      if (goals.length > 0) {
        const { error } = await supabase.from('goals').insert(
          goals.map((g) => ({
            user_id: user.id,
            metric_key: g.metric_key,
            band: g.band,
            target_value: g.target_value,
            target_label: g.target_label,
          })),
        )
        if (error) throw error
      }
      router.push(nextHref)
    } catch (e) {
      setError(errMsg(e))
    }
    setSaving(false)
  }

  if (goals.length === 0) {
    return (
      <div className="card">
        <p className="text-muted text-sm">No baseline data to base goals on yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{baselineNote}</p>
      {goals.map((g) => (
        <div key={g.metric_key} className="card">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">{LABEL[g.metric_key]}</p>
            <p className="text-sm tabular-nums">
              Target: <span className="font-semibold" style={{ color: '#7ee2a8' }}>{fmtTarget(g.metric_key, g.target_value)}</span>
            </p>
          </div>
          <p className="text-xs text-muted mt-1">{g.rationale}</p>
        </div>
      ))}
      {error && <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>}
      {nextHref && (
        <button type="button" onClick={save} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : (saveLabel ?? 'Save goals and continue')}
        </button>
      )}
    </div>
  )
}
