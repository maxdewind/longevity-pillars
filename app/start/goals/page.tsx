'use client'

import GoalSliderForm from '@/components/levels/GoalSliderForm'

export default function StartGoalsPage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 3 of 5 · Goals</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Where do you want to be?</h1>
      <p className="text-sm text-muted mb-6">
        Your numbers are next to the bands. Tick a metric, then slide the marker to
        where you would like to be. Set one goal or several, or skip this entirely.
      </p>
      <GoalSliderForm nextHref="/start/baseline" nextLabel="Save goals and continue" />
    </main>
  )
}
