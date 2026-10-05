'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { WeightLog } from '@/lib/types'

const formatDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const fmt = (n: number) => n.toFixed(1)

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [weight, setWeight] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: rows } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('log_date', { ascending: true })
      const list = (rows as WeightLog[] | null) ?? []
      setLogs(list)
      if (list.length > 0) setWeight(String(list[list.length - 1].weight_lb))
    }
    load()
  }, [])

  const saveWeight = async () => {
    const w = parseFloat(weight)
    if (Number.isNaN(w)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('weight_logs').upsert(
      { user_id: user.id, log_date: todayISO(), weight_lb: w },
      { onConflict: 'user_id,log_date' }
    )
    setLogs((ls) => {
      const next = ls.filter((l) => l.log_date !== todayISO())
      return [...next, { id: todayISO(), user_id: user.id, log_date: todayISO(), weight_lb: w } as WeightLog]
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const start = logs.length > 0 ? logs[0].weight_lb : null

  const targets: { label: string; loPct: number; hiPct: number }[] = [
    { label: 'Month 1', loPct: 2, hiPct: 4 },
    { label: 'Month 2', loPct: 4, hiPct: 7 },
    { label: 'Month 3', loPct: 6, hiPct: 10 },
    { label: 'Month 6', loPct: 10, hiPct: 18 },
  ]

  const chart = (() => {
    if (logs.length < 2) return null
    const values = logs.map((l) => l.weight_lb)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const pts = values.map((v, i) => {
      const x = 10 + (i / (values.length - 1)) * 280
      const y = 110 - ((v - min) / span) * 100
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    const dots = values.map((v, i) => {
      const x = 10 + (i / (values.length - 1)) * 280
      const y = 110 - ((v - min) / span) * 100
      return { x, y }
    })
    return { pts: pts.join(' '), dots }
  })()

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      <section className="space-y-3">
        <h1 className="text-xl font-bold">Log today</h1>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="label" htmlFor="weight">Weight (lb)</label>
            <input
              id="weight"
              type="number"
              step="0.1"
              className="input"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={saveWeight}>
            Save
          </button>
        </div>
        {saved && <p className="text-sm">Saved.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Trend</h2>
        {chart ? (
          <div className="card">
            <svg viewBox="0 0 300 120" className="w-full">
              <polyline
                points={chart.pts}
                fill="none"
                stroke="#f0506e"
                strokeWidth="2"
              />
              {chart.dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r="3" fill="#f0506e" />
              ))}
            </svg>
            <div className="flex justify-between text-xs" style={{ color: '#9aa0ae' }}>
              <span>{formatDate(logs[0].log_date)}</span>
              <span>{formatDate(logs[logs.length - 1].log_date)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#9aa0ae' }}>Log a few days to see your trend.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Phase targets</h2>
        <div className="card">
          {start === null ? (
            <p className="text-sm" style={{ color: '#9aa0ae' }}>
              Log your weight to see phase targets.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {targets.map((t) => {
                  const hi = start * (1 - t.loPct / 100)
                  const lo = start * (1 - t.hiPct / 100)
                  return (
                    <div key={t.label} className="flex justify-between text-sm">
                      <span className="font-bold">{t.label}</span>
                      <span>{fmt(lo)} – {fmt(hi)} lb</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs mt-3" style={{ color: '#9aa0ae' }}>
                Editable estimates, not promises. Based on a steady 0.5–1% per week pace.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
