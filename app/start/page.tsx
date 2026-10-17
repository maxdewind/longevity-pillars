'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { key: 'weight', label: 'Weight', sub: 'Body weight trend' },
  { key: 'sleep', label: 'Sleep', sub: 'Hours and deep sleep' },
  { key: 'heart', label: 'Heart', sub: 'Resting heart rate and HRV' },
  { key: 'fitness', label: 'Fitness', sub: 'VO2max' },
]

export default function StartPage() {
  const router = useRouter()
  const [pick, setPick] = useState<string | null>(null)

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 1 of 6 · Intake</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Where do you want to start?</h1>
      <p className="text-sm text-muted mb-6">
        Which of these four would you most want to move? One tap, we use it to order your suggestions.
      </p>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setPick(o.key)}
            className={`card w-full text-left ${pick === o.key ? '!border-accent bg-accent/10' : ''}`}
          >
            <p className="font-semibold">{o.label}</p>
            <p className="text-xs text-muted">{o.sub}</p>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!pick}
        onClick={() => router.push('/start/safety')}
        className="btn-primary w-full mt-6"
        style={{ opacity: pick ? 1 : 0.4 }}
      >
        Continue
      </button>
    </main>
  )
}
