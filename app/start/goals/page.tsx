'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg } from '@/lib/levels'
import { todayISO } from '@/lib/format'
import {
  baselineStats, defaultGoalFor, fetchProfileExtras, type DefaultGoal, type DayValue,
} from '@/lib/baseline'
import { METRIC_ORDER, type MetricKey } from '@/lib/referenceRanges'
import GoalSliderForm from '@/components/levels/GoalSliderForm'
import DefaultGoalsView from '@/components/levels/DefaultGoalsView'

export default function StartGoalsPage() {
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [goals, setGoals] = useState<DefaultGoal[]>([])
  const [baselineNote, setBaselineNote] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const [{ count }, prof] = await Promise.all([
          supabase.from('experiments').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('mode', 'levels').eq('status', 'done'),
          fetchProfileExtras(supabase, user.id),
        ])
        if ((count ?? 0) > 0) { setUnlocked(true); setLoading(false); return }
        const lb = prof.lookback
        const heightCm = prof.heightCm
        const today = todayISO()
        const [{ data: rows }, { data: excl }] = await Promise.all([
          supabase.from('metric_entries').select('entry_date,metric_key,value,source')
            .eq('user_id', user.id).gte('entry_date', addDays(today, -(lb - 1))).lte('entry_date', today),
          supabase.from('baseline_exclusions').select('excluded_date').eq('user_id', user.id),
        ])
        const all = ((rows as { entry_date: string; metric_key: string; value: number; source: string }[] | null) ?? [])
        const useSource = all.some((r) => r.source === 'apple_health') ? 'apple_health' : null
        const excluded = new Set(((excl as { excluded_date: string }[] | null) ?? []).map((e) => e.excluded_date))
        const list: DefaultGoal[] = []
        for (const k of METRIC_ORDER) {
          const vals: DayValue[] = all
            .filter((r) => r.metric_key === k && (useSource == null || r.source === useSource))
            .map((r) => ({ date: r.entry_date, value: Number(r.value) }))
          const st = baselineStats(vals, excluded)
          if (st) {
            const g = defaultGoalFor(k as MetricKey, st.avg, heightCm)
            if (g) list.push(g)
          }
        }
        setGoals(list)
        setBaselineNote(`Computed from your ${lb}-day Apple Health baseline${excluded.size > 0 ? ` (${excluded.size} excluded day${excluded.size === 1 ? '' : 's'})` : ''} and the population bands.`)
      } catch {
        // fall through to empty defaults
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 3 of 6 · Goals</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Your starting goals</h1>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : unlocked ? (
        <div>
          <p className="text-sm text-muted mb-6">
            Tick a metric, then slide the marker to where you would like to be.
          </p>
          <GoalSliderForm nextHref="/start/position" nextLabel="Save goals and continue" />
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted mb-6">
            Based on your baseline and the population bands. Nothing to decide yet:
            run your first experiment, then make these yours.
          </p>
          <DefaultGoalsView goals={goals} baselineNote={baselineNote} nextHref="/start/position" />
          <div className="card mt-4 p-4" style={{ opacity: 0.75 }}>
            <p className="text-sm font-semibold">Personalized goal setting</p>
            <p className="text-xs text-muted mt-1">
              Set your own exact targets with sliders. Unlocks after your first experiment ends.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
