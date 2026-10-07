import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Protocol, ProtocolCheck } from '@/lib/types'
import ResolutionCard from '@/components/ResolutionCard'

const WEEKS = 12

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cellClass(held: number, hasData: boolean): string {
  if (!hasData) return 'bg-white/[0.04]'
  if (held === 0) return 'bg-white/10'
  if (held <= 2) return 'bg-accent/25'
  if (held <= 5) return 'bg-accent/50'
  return 'bg-accent'
}

export default async function RecordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: protocols }, { data: checks }] = await Promise.all([
    supabase
      .from('protocols')
      .select('id,label,pillar,position,enabled')
      .eq('user_id', user.id)
      .order('position', { ascending: true }),
    supabase
      .from('protocol_checks')
      .select('protocol_id,log_date,committed,held')
      .eq('user_id', user.id),
  ])

  const protos = ((protocols ?? []) as Protocol[]).filter((p) => p.enabled)
  const rows = (checks ?? []) as ProtocolCheck[]

  const totalCommitted = rows.filter((r) => r.committed).length
  const totalHeld = rows.filter((r) => r.held).length

  const stats = protos.map((p) => {
    const pr = rows.filter((r) => r.protocol_id === p.id)
    const days = new Set(pr.map((r) => r.log_date)).size
    const committed = pr.filter((r) => r.committed).length
    const held = pr.filter((r) => r.held).length
    const rate = days > 0 ? Math.round((held / days) * 100) : 0
    return { id: p.id, label: p.label, committed, held, days, rate }
  })

  // Heatmap: last 12 weeks, Sunday-first columns, GitHub style.
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1)

  const byDate = new Map<string, { held: number; hasData: boolean }>()
  rows.forEach((r) => {
    const cur = byDate.get(r.log_date) ?? { held: 0, hasData: false }
    byDate.set(r.log_date, {
      held: cur.held + (r.held ? 1 : 0),
      hasData: true,
    })
  })

  const cells: { key: string; held: number; hasData: boolean; future: boolean }[] = []
  const cursor = new Date(start)
  while (cursor <= end || cells.length % 7 !== 0) {
    const key = isoDay(cursor)
    const info = byDate.get(key)
    cells.push({
      key,
      held: info?.held ?? 0,
      hasData: info?.hasData ?? false,
      future: cursor > end,
    })
    cursor.setDate(cursor.getDate() + 1)
    if (cells.length > WEEKS * 7 + 7) break
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Track record</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        Your body of evidence. Streaks reset to zero. This doesn&apos;t. This
        is your Rung 1 record: ninety days of Held evenings is how you
        graduate.
      </p>

      <ResolutionCard />

      {rows.length === 0 ? (
        <div className="card">
          <p className="text-sm" style={{ color: '#9aa0ae' }}>
            No entries yet. Your evidence starts with your first committed
            morning.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-2xl font-bold tabular-nums">{totalCommitted}</p>
              <p className="text-xs mt-1" style={{ color: '#9aa0ae' }}>
                mornings committed
              </p>
            </div>
            <div className="card">
              <p className="text-2xl font-bold tabular-nums">{totalHeld}</p>
              <p className="text-xs mt-1" style={{ color: '#9aa0ae' }}>
                evenings held
              </p>
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
              <p className="text-xs" style={{ color: '#9aa0ae' }}>
                Last {WEEKS} weeks. Darker = more routines held that day.
              </p>
              <div className="flex items-center gap-1 text-xs" style={{ color: '#9aa0ae' }}>
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
              {stats.map((s) => (
                <div key={s.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs tabular-nums whitespace-nowrap" style={{ color: '#9aa0ae' }}>
                      {s.rate}% held
                    </p>
                  </div>
                  <p className="text-xs tabular-nums" style={{ color: '#9aa0ae' }}>
                    {s.held} evenings held · {s.committed} mornings committed
                    {s.days > 0 ? ` · ${s.days} days tracked` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
