'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { SlipLog } from '@/lib/types'

const formatDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function DiaryPage() {
  const [meal1, setMeal1] = useState('')
  const [meal2, setMeal2] = useState('')
  const [slips, setSlips] = useState<SlipLog[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: meals } = await supabase
        .from('meal_logs')
        .select('meal_number, description')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())

      ;(meals ?? []).forEach((m) => {
        if (m.meal_number === 1) setMeal1(m.description ?? '')
        if (m.meal_number === 2) setMeal2(m.description ?? '')
      })

      const { data: slipRows } = await supabase
        .from('slip_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })

      setSlips((slipRows as SlipLog[] | null) ?? [])
    }
    load()
  }, [])

  const saveMeals = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('meal_logs').upsert(
      [
        { user_id: user.id, log_date: todayISO(), meal_number: 1, description: meal1 },
        { user_id: user.id, log_date: todayISO(), meal_number: 2, description: meal2 },
      ],
      { onConflict: 'user_id,log_date,meal_number' }
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      <section className="space-y-3">
        <h1 className="text-xl font-bold">Today&apos;s meals</h1>
        <div>
          <label className="label" htmlFor="meal1">Meal 1</label>
          <input
            id="meal1"
            type="text"
            className="input"
            placeholder="What did you eat? A sentence is enough."
            value={meal1}
            onChange={(e) => setMeal1(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="meal2">Meal 2</label>
          <input
            id="meal2"
            type="text"
            className="input"
            placeholder="What did you eat? A sentence is enough."
            value={meal2}
            onChange={(e) => setMeal2(e.target.value)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={saveMeals}>
          Save meals
        </button>
        {saved && <p className="text-sm">Saved.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Slip history</h2>
        {slips.length === 0 ? (
          <p className="text-sm" style={{ color: '#9aa0ae' }}>
            No slips logged. The diary keeps the story either way.
          </p>
        ) : (
          slips.map((s) => (
            <div key={s.id} className="card">
              <div className="text-sm font-bold">{formatDate(s.occurred_at.slice(0, 10))}</div>
              <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{s.note || 'No note'}</p>
            </div>
          ))
        )}
      </section>
    </main>
  )
}
