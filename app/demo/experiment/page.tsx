'use client'

import { useDemo, DemoGate, fmtPub } from '../DemoProvider'
import { cap } from '../shared'

const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const diffDays = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
const fmtD = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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

  const unlocked = publishedAt ? publishedAt.slice(0, 10) >= exp.end_date : false
  const weights = snap.weights
  const thisWeek = weights.filter((w) => w.log_date >= exp.start_date).map((w) => w.weight_lb)
  const lastWeek = weights.filter((w) => w.log_date < exp.start_date).map((w) => w.weight_lb)
  const thisMed = median(thisWeek)
  const lastMed = median(lastWeek)
  const inExp = weights.filter((w) => w.log_date >= exp.start_date)
  const anchor = inExp[0] ?? null
  const verdictDelta = thisMed != null && lastMed != null ? thisMed - lastMed : null

  const W = 320
  const H = 130
  const P = 12
  const winDays = exp.duration_days
  const domainW = inExp.length > 0 ? inExp : weights
  const allVals = [
    ...domainW.map((w) => w.weight_lb),
    ...(thisMed != null ? [thisMed] : []),
    ...(lastMed != null ? [lastMed] : []),
    ...(anchor ? [anchor.weight_lb] : []),
  ]
  const wMin = Math.min(...allVals)
  const wMax = Math.max(...allVals)
  const pad = Math.max((wMax - wMin) * 0.2, 0.5)
  const xFor = (iso: string) => P + (diffDays(exp.start_date, iso) / Math.max(winDays - 1, 1)) * (W - 2 * P)
  const yFor = (v: number) => P + (1 - (v - (wMin - pad)) / ((wMax + pad) - (wMin - pad))) * (H - 2 * P)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Self-Experiment</h1>

      <div className="card">
        <p className="text-xs" style={{ color: '#9aa0ae' }}>PRE-REGISTERED PROMISE</p>
        <p className="text-xl font-bold mt-1">{exp.title}</p>
        <p className="mt-2">
          <span className="inline-block text-xs font-bold tracking-wider" style={{ color: '#f0506e', border: '1px solid #f0506e', borderRadius: 999, padding: '4px 12px' }}>
            {cap(exp.pillar)}
          </span>
        </p>
        {exp.hypothesis && <p className="mt-2 italic text-sm" style={{ color: '#9aa0ae' }}>{exp.hypothesis}</p>}
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span>Day {exp.day_number} of {exp.duration_days}</span>
            <span style={{ color: '#f0506e', fontWeight: 700 }}>{Math.round((exp.day_number / exp.duration_days) * 100)}%</span>
          </div>
          <div className="mt-2" style={{ height: 10, borderRadius: 999, background: '#2c313d' }}>
            <div style={{ width: `${(exp.day_number / exp.duration_days) * 100}%`, height: '100%', borderRadius: 999, background: '#f0506e' }} />
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {exp.dots.map((d) => (
            <span key={d.date} title={fmtD(d.date)} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: d.held ? '#f0506e' : 'transparent',
              border: `1px solid ${d.held ? '#f0506e' : '#4a5160'}`,
            }} />
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>{exp.held_count} of {exp.duration_days} days held</p>
      </div>

      <div className="card">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>WEIGHT CHANGE</p>
        {!unlocked ? (
          anchor && exp.weight_delta_lb != null ? (
            <>
              <p className="mt-2 text-3xl font-bold">
                <span style={{ color: '#f0506e' }}>{exp.weight_delta_lb > 0 ? '+' : ''}{exp.weight_delta_lb.toFixed(1)} lb</span>
                <span className="text-xl"> vs day 1</span>
              </p>
              <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>Anchor {anchor.weight_lb.toFixed(1)} lb · {fmtD(anchor.log_date)}. Signal check, not proof.</p>
            </>
          ) : (
            <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Day 1 sets the anchor.</p>
          )
        ) : verdictDelta != null ? (
          <>
            <p className="mt-2 text-3xl font-bold">
              <span style={{ color: '#f0506e' }}>{verdictDelta > 0 ? '+' : ''}{verdictDelta.toFixed(1)} lb</span>
              <span className="text-xl"> vs last week</span>
            </p>
            <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>Week median {thisMed!.toFixed(1)} lb vs prior week {lastMed!.toFixed(1)} lb. Signal check, not proof.</p>
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Not enough weigh-ins for the week comparison.</p>
        )}
        {inExp.length >= 2 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: 150 }}>
            {unlocked && thisMed != null && (
              <line x1={0} x2={W} y1={yFor(thisMed)} y2={yFor(thisMed)} stroke="#f0506e" strokeWidth={1.5} />
            )}
            {!unlocked && anchor && (
              <line x1={0} x2={W} y1={yFor(anchor.weight_lb)} y2={yFor(anchor.weight_lb)} stroke="#9aa0ae" strokeWidth={1.5} strokeDasharray="5 4" />
            )}
            {unlocked && lastMed != null && (
              <line x1={0} x2={W} y1={yFor(lastMed)} y2={yFor(lastMed)} stroke="#9aa0ae" strokeWidth={1.5} strokeDasharray="5 4" />
            )}
            <polyline
              points={inExp.map((w) => `${xFor(w.log_date)},${yFor(w.weight_lb)}`).join(' ')}
              fill="none"
              stroke="#f0506e"
              strokeWidth={2}
            />
            {inExp.map((w) => (
              <circle key={w.log_date} cx={xFor(w.log_date)} cy={yFor(w.weight_lb)} r={4} fill="#f0506e" />
            ))}
          </svg>
        )}
        {inExp.length >= 2 && (
          <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>
            {!unlocked && anchor ? (
              <><span style={{ color: '#9aa0ae' }}>- -</span> day-1 anchor ({anchor.weight_lb.toFixed(1)} lb)</>
            ) : (
              <><span style={{ color: '#f0506e' }}>—</span> this week median&nbsp;&nbsp;<span style={{ color: '#9aa0ae' }}>- -</span> pre-experiment median</>
            )}
          </p>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>BASELINE – THE CONTROL</p>
          {exp.baseline_held_pct != null && (
            <p className="text-sm font-bold" style={{ color: '#f0506e' }}>{Math.round(exp.baseline_held_pct * 100)}% held</p>
          )}
        </div>
        <div className="mt-2">
          {exp.baseline_labels.map((b) => (
            <p key={b} className="text-sm py-1" style={{ borderBottom: '1px solid #2c313d' }}>🔒 {b}</p>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>VERDICT</p>
        {unlocked ? (
          <div className="mt-3 flex gap-2">
            <span className="btn flex-1 text-center opacity-50">Keep it</span>
            <span className="flex-1 text-center opacity-50" style={{ background: 'transparent', border: '1px solid #f0506e', color: '#f0506e', borderRadius: 12, padding: '12px 0' }}>Another week</span>
            <span className="flex-1 text-center opacity-50" style={{ background: 'transparent', border: '1px solid #4a5160', color: '#9aa0ae', borderRadius: 12, padding: '12px 0' }}>Drop it</span>
          </div>
        ) : (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Verdict unlocks {fmtD(exp.end_date)} – decisions on Day {exp.duration_days}.</p>
        )}
      </div>
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
