'use client'

import { useDemo, DemoGate, fmtPub } from '../DemoProvider'
import { WeightChart } from '../shared'

function WeightBody() {
  const { snap, publishedAt } = useDemo()
  if (!snap) return null
  const weights = snap.weights
  const latest = weights[weights.length - 1] ?? null
  const first = weights[0] ?? null
  const totalDelta = latest && first ? latest.weight_lb - first.weight_lb : null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Weight</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        His weigh-ins, as published{publishedAt ? ` ${fmtPub(publishedAt)}` : ''}.
      </p>
      {latest ? (
        <section className="card">
          <p className="text-4xl font-bold tabular-nums">{latest.weight_lb.toFixed(1)}</p>
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>
            lb · {new Date(latest.log_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          {totalDelta != null && (
            <p className="text-sm mt-2 font-semibold" style={{ color: '#f0506e' }}>
              {totalDelta > 0 ? '+' : ''}{totalDelta.toFixed(1)} lb since tracking began
            </p>
          )}
          <WeightChart weights={weights} height={150} />
          <p className="text-xs mt-2" style={{ color: '#9aa0ae' }}>
            Every weigh-in on record. Signal check, not proof.
          </p>
        </section>
      ) : (
        <div className="card">
          <p className="text-sm" style={{ color: '#9aa0ae' }}>No weigh-ins in this snapshot.</p>
        </div>
      )}
    </div>
  )
}

export default function DemoWeightPage() {
  return (
    <DemoGate>
      <WeightBody />
    </DemoGate>
  )
}
