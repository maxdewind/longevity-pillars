'use client'

import { useState } from 'react'
import Link from 'next/link'
import GoalSliderForm from '@/components/levels/GoalSliderForm'
import PositionView, { usePositionData } from '@/components/levels/PositionView'

export default function AppGoalsPage() {
  const { goals, entries, loading, reload } = usePositionData()
  const [editing, setEditing] = useState(false)

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
        {goals.length > 0 && !loading && (
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
          <button type="button" onClick={() => setEditing(true)} className="btn-primary block text-center w-full">
            Pick goals
          </button>
        </div>
      ) : (
        <PositionView goals={goals} entries={entries} />
      )}
      <p className="text-center text-xs text-muted mt-4">
        <Link href="/start/metrics" className="underline underline-offset-2">Log today&apos;s metrics</Link>
      </p>
    </div>
  )
}
