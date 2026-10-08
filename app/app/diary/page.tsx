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
  const [summary, setSummary] = useState<null | {
    daysSinceSlip: number | null
    mandatoryCount: number
    heldTotal: number
    weakestLabel: string
    weakestPct: number
  }>(null)

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

      const slipList = (slipRows as SlipLog[] | null) ?? []
      setSlips(slipList)

      // Progress summary over mandatory routines only: days since last slip
      // (resets), held evidence (survives), weakest routine's % of the 90-day
      // target (worst axis blocks the climb).
      const [{ data: protos }, { data: checkRows }] = await Promise.all([
        supabase.from('protocols').select('id,label,is_mandatory').eq('user_id', user.id),
        supabase.from('protocol_checks').select('protocol_id,held').eq('user_id', user.id),
      ])
      const mandatory = (
        (protos as { id: string; label: string; is_mandatory: boolean }[] | null) ?? []
      ).filter((p) => p.is_mandatory)
      const mrows = (
        (checkRows as { protocol_id: string; held: boolean }[] | null) ?? []
      ).filter((c) => mandatory.some((m) => m.id === c.protocol_id))
      const heldTotal = mrows.filter((c) => c.held).length
      let weakestLabel = ''
      let weakestPct = 0
      mandatory.forEach((m) => {
        const held = mrows.filter((c) => c.protocol_id === m.id && c.held).length
        const pct = Math.round((held / 90) * 100)
        if (weakestLabel === '' || pct < weakestPct) {
          weakestLabel = m.label
          weakestPct = pct
        }
      })
      const lastSlipDay = slipList[0]?.occurred_at?.slice(0, 10)
      // Calendar-day difference on YYYY-MM-DD strings, parsed as UTC on both
      // sides so a same-day slip reads 0, never -1 (date-only strings parse
      // as UTC midnight; mixing that with a local-noon Date broke this).
      const daysBetweenISO = (a: string, b: string): number =>
        Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
      const daysSinceSlip = lastSlipDay ? daysBetweenISO(lastSlipDay, todayISO()) : null
      setSummary({
        daysSinceSlip,
        mandatoryCount: mandatory.length,
        heldTotal,
        weakestLabel,
        weakestPct,
      })
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
        {summary && (
          <div className="card">
            {summary.daysSinceSlip === null ? (
              <p className="text-sm font-bold">No slips logged yet.</p>
            ) : (
              <p className="text-sm font-bold">
                {summary.daysSinceSlip} {summary.daysSinceSlip === 1 ? 'day' : 'days'} since last slip
              </p>
            )}
            {summary.mandatoryCount === 0 ? (
              <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>
                Mark routines as mandatory on the Protocol page to track your 90-day target.
              </p>
            ) : (
              <>
                <p className="text-sm mt-1 tabular-nums" style={{ color: '#9aa0ae' }}>
                  {summary.heldTotal} held across {summary.mandatoryCount} mandatory{' '}
                  {summary.mandatoryCount === 1 ? 'routine' : 'routines'}
                </p>
                <p className="text-sm tabular-nums" style={{ color: '#9aa0ae' }}>
                  Weakest: {summary.weakestLabel} at {summary.weakestPct}% of 90
                </p>
              </>
            )}
          </div>
        )}
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
