'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MASTER_PILLARS, MASTER_REVIEW_ROUTINES } from '@/lib/masterProtocol'

// Separate review module, v1 view only.
// Weekly review is on Sunday. Monthly review is on the last day of the
// month. Ticks here are local to this view in v1 and are not saved yet;
// the daily Committed/Held records on the protocol page are the saved
// record. Supplements are checked here, not in the daily draw.
export default function ReviewPage() {
  const [ticked, setTicked] = useState<Set<string>>(new Set())

  const toggleTick = (label: string) => {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const labelFor = (key: string) => MASTER_PILLARS.find((p) => p.key === key)?.label ?? key

  const renderList = (items: typeof MASTER_REVIEW_ROUTINES) => {
    if (items.length === 0) return <p className="text-sm" style={{ color: '#64748b' }}>Nothing in this section yet.</p>
    return (
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.label} className="card">
            <button
              type="button"
              onClick={() => toggleTick(r.label)}
              className="w-full text-left flex items-start gap-3"
              style={{ background: 'none' }}
            >
              <span className="mt-0.5 inline-block w-5 h-5 rounded border border-white/20 text-center text-sm leading-5">
                {ticked.has(r.label) ? '✓' : ''}
              </span>
              <span>
                <span className="font-bold block">{r.label}</span>
                <span className="text-sm block mt-1" style={{ color: '#64748b' }}>{r.detail}</span>
                <span className="text-xs block mt-1" style={{ color: '#64748b' }}>{labelFor(r.pillar)} · {r.timing}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    )
  }

  const weekly = MASTER_REVIEW_ROUTINES.filter((r) => r.timing === 'weekly')
  const monthly = MASTER_REVIEW_ROUTINES.filter((r) => r.timing === 'monthly' || r.timing === 'quarterly')
  const annual = MASTER_REVIEW_ROUTINES.filter((r) => r.timing === 'annual')
  const queued = MASTER_REVIEW_ROUTINES.filter((r) => r.timing === 'queued' || r.timing === 'open')
  const supplements = MASTER_REVIEW_ROUTINES.filter((r) => r.pillar === 'supplements')

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Weekly and monthly review</h1>
      <p className="text-sm" style={{ color: '#64748b' }}>
        A separate module from the daily draw. Weekly review is on Sunday.
        Monthly review is on the last day of the month. Supplements are
        checked here, not drawn daily. Ticks on this page are for this view
        only in this first version and are not saved yet.
      </p>
      <Link href="/app/protocol" className="card block" style={{ textDecoration: 'none' }}>
        <p className="text-sm font-bold">Back to today&apos;s habits →</p>
      </Link>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Weekly review · Sunday</h2>
        {renderList(weekly)}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Supplements · checked in review</h2>
        {renderList(supplements)}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Monthly review · last day of the month</h2>
        <p className="text-sm" style={{ color: '#64748b' }}>Monthly items below, plus quarterly items due that month.</p>
        {renderList(monthly)}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Annual and due items</h2>
        {renderList(annual)}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold">Queued and open items</h2>
        <p className="text-sm" style={{ color: '#64748b' }}>Queued items wait for their trigger, for example the heel clearing. Open items are gates and conversations, not daily habits.</p>
        {renderList(queued)}
      </section>
    </main>
  )
}
