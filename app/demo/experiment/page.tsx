'use client'

import { useDemo, DemoGate, fmtPub } from '../DemoProvider'
import { cap } from '../shared'

function ExperimentBody() {
  const { snap, publishedAt } = useDemo()
  if (!snap) return null
  const exp = snap.experiment

  if (!exp) {
    return (
      <div className="card">
        <p className="text-sm" style={{ color: '#9aa0ae' }}>
          No active experiment when this snapshot was published.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Self-Experiment</h1>
      <div className="card" style={{ borderColor: '#f0506e' }}>
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#f0506e' }}>
          SELF-EXPERIMENT · DAY {exp.day_number} OF {exp.duration_days} · AS PUBLISHED{publishedAt ? ` ${fmtPub(publishedAt).toUpperCase()}` : ''}
        </p>
        <p className="text-xl font-bold mt-1">{exp.title}</p>
        <p className="mt-2">
          <span className="inline-block text-xs font-bold tracking-wider" style={{ color: '#f0506e', border: '1px solid #f0506e', borderRadius: 999, padding: '4px 12px' }}>
            {cap(exp.pillar)}
          </span>
        </p>
        {exp.hypothesis && <p className="mt-2 italic text-sm" style={{ color: '#9aa0ae' }}>{exp.hypothesis}</p>}
        <div className="mt-4 flex gap-2 flex-wrap">
          {exp.dots.map((d) => (
            <span key={d.date} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: d.held ? '#f0506e' : 'transparent',
              border: `1px solid ${d.held ? '#f0506e' : '#4a5160'}`,
            }} />
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>{exp.held_count} of {exp.duration_days} days held</p>
        {exp.weight_delta_lb != null && (
          <p className="mt-2 text-3xl font-bold">
            <span style={{ color: '#f0506e' }}>{exp.weight_delta_lb > 0 ? '+' : ''}{exp.weight_delta_lb.toFixed(1)} lb</span>
            <span className="text-xl font-normal"> vs day 1</span>
          </p>
        )}
        {exp.baseline_labels.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>
              BASELINE – THE CONTROL{exp.baseline_held_pct != null && ` · ${Math.round(exp.baseline_held_pct * 100)}% HELD`}
            </p>
            {exp.baseline_labels.map((l) => (
              <p key={l} className="text-sm py-1" style={{ borderBottom: '1px solid #2c313d' }}>🔒 {l}</p>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: '#9aa0ae' }}>
        One change at a time, pre-registered. Everything else stays constant.
      </p>
    </div>
  )
}

export default function DemoExperimentPage() {
  return (
    <DemoGate>
      <ExperimentBody />
    </DemoGate>
  )
}
