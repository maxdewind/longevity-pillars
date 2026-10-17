'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { key: 'weight', label: 'Weight and metabolic health', sub: 'Weight trend and metabolic markers' },
  { key: 'sleep', label: 'Sleep', sub: 'Hours and deep sleep' },
  { key: 'heart', label: 'Heart', sub: 'Resting heart rate and HRV' },
  { key: 'fitness', label: 'Fitness', sub: 'VO2max' },
]

function ExampleCard({ change, result, verdict, tone }: { change: string; result: string; verdict: string; tone: string }) {
  return (
    <div className="card p-3">
      <p className="font-semibold text-sm">{change}</p>
      <p className="text-xs text-muted mt-1">{result}</p>
      <p className="text-xs font-semibold mt-2" style={{ color: tone }}>Verdict: {verdict}</p>
    </div>
  )
}

export default function StartPage() {
  const router = useRouter()
  const [pick, setPick] = useState<string | null>(null)

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      {/* Hero: Option B, the experiment card, with worked examples. */}
      <section className="mb-10">
        <p className="text-xs text-muted uppercase tracking-wide">Longevity Pillars</p>
        <h1 className="text-3xl font-bold mt-2">One experiment at a time.</h1>
        <p className="text-sm text-muted mt-2">
          Pre-register a single change, measure it against your own baseline, let the data decide.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6">
          <div className="card text-center p-3">
            <p className="font-semibold text-sm">The change</p>
            <p className="text-xs text-muted mt-1">State your hypothesis</p>
          </div>
          <div className="card text-center p-3">
            <p className="font-semibold text-sm">12 days</p>
            <p className="text-xs text-muted mt-1">Track and measure</p>
          </div>
          <div className="card text-center p-3">
            <p className="font-semibold text-sm">Verdict</p>
            <p className="text-xs text-muted mt-1">Keep, extend, or drop</p>
          </div>
        </div>

        <p className="text-sm mt-6">
          Generic advice goes in. Personal proof comes out. Every experiment answers one
          question: does this specific change actually move the needle for me? People are
          different, so we test on the only person who matters here: you.
        </p>

        <p className="text-xs uppercase tracking-wide text-muted mt-6 mb-2">How a verdict looks</p>
        <div className="space-y-2">
          <ExampleCard
            change="No foods with added sugar"
            result="12 days. Weight down 3.5 lb."
            verdict="Keep"
            tone="#7ee2a8"
          />
          <ExampleCard
            change="No food 3 hours before bed"
            result="12 days. Deep sleep up 11 minutes a night."
            verdict="Keep"
            tone="#7ee2a8"
          />
          <ExampleCard
            change="Going gluten-free"
            result="12 days, but only 5 of 10 days held. No clean read."
            verdict="Extend 5 days"
            tone="#e8c468"
          />
        </div>
      </section>

      <p className="text-xs text-muted uppercase tracking-wide">Step 1 of 6 · Intake</p>
      <h2 className="text-2xl font-bold mt-2 mb-1">Where do you want to start?</h2>
      <p className="text-sm text-muted mb-6">
        Pick any focus area to begin. The plan is to cover them all eventually,
        at your pace and discretion. One change, one experiment, one verdict at a time.
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
