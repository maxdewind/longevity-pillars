'use client'

import { useDemo, DemoGate, fmtPub } from '../DemoProvider'

const WEEKS = 12

function cellClass(held: number, hasData: boolean): string {
  if (!hasData) return 'bg-white/[0.04]'
  if (held === 0) return 'bg-white/10'
  if (held <= 2) return 'bg-accent/25'
  if (held <= 5) return 'bg-accent/50'
  return 'bg-accent'
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function RecordBody() {
  const { snap, publishedAt } = useDemo()
  if (!snap) return null
  const rec = snap.record

  // Heatmap grid: last 12 weeks ending on the publish date, Sunday-first.
  const end = publishedAt ? new Date(publishedAt) : new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1)

  const byDate = new Map<string, number>()
  rec.heatmap.forEach((h) => byDate.set(h.log_date, h.held))

  const cells: { key: string; held: number; hasData: boolean; future: boolean }[] = []
  const cursor = new Date(start)
  while (cursor <= end || cells.length % 7 !== 0) {
    const key = isoDay(cursor)
    const held = byDate.get(key)
    cells.push({ key, held: held ?? 0, hasData: held !== undefined, future: cursor > end })
    cursor.setDate(cursor.getDate() + 1)
    if (cells.length > WEEKS * 7 + 7) break
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Track record</h1>
      <p className="text-sm" style={{ color: '#64748b' }}>
        His body of evidence, as published{publishedAt ? ` ${fmtPub(publishedAt)}` : ''}. Streaks reset to zero. This doesn&apos;t.
      </p>

      <section className="card">
        <h2 className="font-semibold mb-1">My resolution</h2>
        {snap.resolution ? (
          <p className="text-sm italic">&ldquo;{snap.resolution}&rdquo;</p>
        ) : (
          <p className="text-sm" style={{ color: '#64748b' }}>No resolution written yet.</p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-2xl font-bold tabular-nums">{rec.total_committed}</p>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>mornings committed</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold tabular-nums">{rec.total_held}</p>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>evenings held</p>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Held days</h2>
        <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
          {cells.map((c) =>
            c.future ? (
              <div key={c.key} className="w-3 h-3 rounded-[3px] bg-transparent" />
            ) : (
              <div
                key={c.key}
                title={`${c.key}: ${c.held} held`}
                className={`w-3 h-3 rounded-[3px] ${cellClass(c.held, c.hasData)}`}
              />
            )
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs" style={{ color: '#64748b' }}>
            Last {WEEKS} weeks. Darker = more routines held that day.
          </p>
          <div className="flex items-center gap-1 text-xs" style={{ color: '#64748b' }}>
            <span>Less</span>
            <span className="w-3 h-3 rounded-[3px] bg-white/[0.04]" />
            <span className="w-3 h-3 rounded-[3px] bg-accent/25" />
            <span className="w-3 h-3 rounded-[3px] bg-accent/50" />
            <span className="w-3 h-3 rounded-[3px] bg-accent" />
            <span>More</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">By routine</h2>
        <div className="space-y-3">
          {rec.routine_stats.map((s) => (
            <div key={s.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs tabular-nums whitespace-nowrap" style={{ color: '#64748b' }}>
                  {s.rate}% held
                </p>
              </div>
              <p className="text-xs tabular-nums" style={{ color: '#64748b' }}>
                {s.held} evenings held · {s.committed} mornings committed
                {s.days > 0 ? ` · ${s.days} days tracked` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function DemoRecordPage() {
  return (
    <DemoGate>
      <RecordBody />
    </DemoGate>
  )
}
