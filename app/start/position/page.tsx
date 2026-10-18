'use client'

import Link from 'next/link'
import PositionView, { usePositionData } from '@/components/levels/PositionView'

export default function StartPositionPage() {
  const { goals, entries, heightCm, loading } = usePositionData()

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 4 of 6 · Your position</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Where you stand</h1>
      <p className="text-sm text-muted mb-6">
        Your current 7-day medians against the bands you picked. VO2max shows your latest
        value. This is the scoreboard your levels will move.
      </p>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : goals.length === 0 ? (
        <div className="card">
          <p className="text-muted mb-3">No goals picked yet.</p>
          <Link href="/start/goals" className="btn-primary block text-center">Pick goals</Link>
        </div>
      ) : (
        <>
          <PositionView goals={goals} entries={entries} heightCm={heightCm} />
          <Link href="/start/baseline" className="btn-primary w-full block text-center mt-6">
            Continue
          </Link>
        </>
      )}
    </main>
  )
}
