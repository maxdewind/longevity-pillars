'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GoalSliderForm from '@/components/levels/GoalSliderForm'
import PositionView, { usePositionData } from '@/components/levels/PositionView'

export default function AppGoalsPage() {
  const { goals, entries, heightCm, loading, reload } = usePositionData()
  const [editing, setEditing] = useState(false)
  const [unlocked, setUnlocked] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setUnlocked(false); return }
      const { count } = await supabase.from('experiments').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('mode', 'levels').eq('status', 'done')
      setUnlocked((count ?? 0) > 0)
    }
    check()
  }, [])

  if (editing) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-1">Change my goals</h1>
        <p className="text-sm text-muted mb-4">
          Tick a metric, then slide the marker to where you would like to be.
        </p>
        <GoalSliderForm nextHref="/start/app/goals" nextLabel="Save goals" onSaved={() => { setEditing(false); reload() }} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-bold">Goals</h1>
        {goals.length > 0 && !loading && unlocked && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-accent underline underline-offset-2"
          >
            Change my goals
          </button>
        )}
      </div>
      <p className="text-sm text-muted mb-4">
        Your position against the bands you picked. This is the scoreboard your levels will move.
      </p>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : goals.length === 0 ? (
        <div className="card">
          <p className="text-muted mb-3">No goals picked yet.</p>
          {unlocked ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-primary block text-center w-full">
              Pick goals
            </button>
          ) : (
            <p className="text-sm text-muted">Your starting goals were set during onboarding.</p>
          )}
        </div>
      ) : (
        <PositionView goals={goals} entries={entries} heightCm={heightCm} />
      )}
      {unlocked === false && (
        <div className="card mt-4 p-4" style={{ opacity: 0.75 }}>
          <p className="text-sm font-semibold">Personalized goal setting</p>
          <p className="text-xs text-muted mt-1">
            Set your own exact targets with sliders. Unlocks after your first experiment ends.
          </p>
        </div>
      )}
      <p className="text-center text-xs text-muted mt-4">
        <Link href="/start/metrics" className="underline underline-offset-2">Log today&apos;s metrics</Link>
      </p>
    </div>
  )
}
