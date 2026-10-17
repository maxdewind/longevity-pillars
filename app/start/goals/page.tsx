'use client'

import GoalPicker from '@/components/levels/GoalPicker'

export default function StartGoalsPage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 4 of 6 · Goals</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Pick your targets</h1>
      <p className="text-sm text-muted mb-6">
        For each metric, choose the population band or the aspirational band as your target.
        Pick at least one. Reference bands are pending clinical review.
      </p>
      <GoalPicker nextHref="/start/baseline" nextLabel="Save goals and continue" />
    </main>
  )
}
