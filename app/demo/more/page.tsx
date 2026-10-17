'use client'

import { MILESTONES } from '@/lib/milestones'
import { useDemo, DemoGate } from '../DemoProvider'

const RECORD_MILESTONES = [7, 30, 100]

function MoreBody() {
  const { snap } = useDemo()
  if (!snap) return null

  const elapsedHours = (Date.now() - new Date(snap.journey_start + 'T12:00:00').getTime()) / 3600000
  const records = snap.record.routine_stats.map((s) => ({ id: s.id, label: s.label, holds: s.held }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Milestones</h1>
      <div className="space-y-3">
        {MILESTONES.map((m) => {
          const achieved = elapsedHours >= m.hours
          if (achieved) {
            return (
              <div key={m.id} className="card flex gap-3">
                <span className="text-[#f0506e] font-bold shrink-0" aria-label="achieved">
                  ✓
                </span>
                <div>
                  <h2 className="font-semibold">{m.title}</h2>
                  <p className="text-[#9aa0ae] text-sm mt-1">{m.bodyState}</p>
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className="card opacity-60">
              <p className="text-[#9aa0ae] text-sm">
                Milestone {m.id} &middot; in about {m.hours}h from start
              </p>
              <h2 className="font-semibold text-[#9aa0ae] mt-1">{m.title}</h2>
            </div>
          )
        })}
      </div>
      <p className="text-[#9aa0ae] text-xs text-center">
        Milestones 2-12 are proposed timings. The journey is the point.
      </p>

      {records.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-1">Routine records</h2>
          <p className="text-sm mb-4" style={{ color: '#9aa0ae' }}>
            Hold counts no slip can take away.
          </p>
          <div className="space-y-3">
            {records.map((r) => {
              const next = RECORD_MILESTONES.find((m) => r.holds < m) ?? null
              return (
                <div key={r.id} className="card">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{r.label}</p>
                    <p className="text-sm tabular-nums whitespace-nowrap" style={{ color: '#9aa0ae' }}>
                      {r.holds} {r.holds === 1 ? 'hold' : 'holds'}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs">
                    {RECORD_MILESTONES.map((m) => (
                      <span
                        key={m}
                        className={`px-2 py-1 rounded-full border ${
                          r.holds >= m
                            ? 'text-accent border-accent/40'
                            : 'text-muted border-white/10'
                        }`}
                      >
                        {r.holds >= m ? `✓ ${m}` : `${m}`}
                      </span>
                    ))}
                  </div>
                  {next && (
                    <p className="text-xs mt-2" style={{ color: '#9aa0ae' }}>
                      Next record at {next} holds.
                    </p>
                  )}
                  {!next && (
                    <p className="text-xs mt-2 text-accent">
                      All records set. The bar is yours to raise.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default function DemoMorePage() {
  return (
    <DemoGate>
      <MoreBody />
    </DemoGate>
  )
}
