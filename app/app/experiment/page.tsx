'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Experiment, WeightLog, ProtocolCheck } from '@/lib/types'

const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}
const diffDays = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
const fmtD = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function ExperimentPage() {
  const [exp, setExp] = useState<Experiment | null>(null)
  const [heldByDay, setHeldByDay] = useState<Record<string, boolean>>({})
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [baselineHeldPct, setBaselineHeldPct] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoaded(true); return }
      const { data: rows } = await supabase
        .from('experiments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      const e = ((rows as Experiment[] | null) ?? [])[0]
      if (!e) { setLoaded(true); return }
      setExp(e)
      const today = todayISO()
      const end = today < e.end_date ? today : e.end_date

      const { data: checks } = await supabase
        .from('protocol_checks')
        .select('log_date, held')
        .eq('user_id', user.id)
        .eq('protocol_id', e.protocol_id)
        .gte('log_date', e.start_date)
        .lte('log_date', end)
      const held: Record<string, boolean> = {}
      ;((checks as Pick<ProtocolCheck, 'log_date' | 'held'>[] | null) ?? []).forEach((c) => {
        held[c.log_date] = c.held
      })
      setHeldByDay(held)

      const { data: wrows } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', addDays(e.start_date, -7))
        .lte('log_date', end)
        .order('log_date')
      setWeights((wrows as WeightLog[] | null) ?? [])

      const baseIds = e.baseline_snapshot.map((b) => b.id)
      if (baseIds.length > 0) {
        const { data: bchecks } = await supabase
          .from('protocol_checks')
          .select('protocol_id, held')
          .eq('user_id', user.id)
          .in('protocol_id', baseIds)
          .gte('log_date', e.start_date)
          .lte('log_date', end)
        const list = (bchecks as { protocol_id: string; held: boolean }[] | null) ?? []
        const daysElapsed = diffDays(e.start_date, end) + 1
        const denom = baseIds.length * daysElapsed
        setBaselineHeldPct(denom > 0 ? list.filter((c) => c.held).length / denom : null)
      } else {
        setBaselineHeldPct(null)
      }
      setLoaded(true)
    }
    load()
  }, [])

  const verdict = async (kind: 'keep' | 'another_week' | 'drop') => {
    if (!exp || acting) return
    setActing(true)
    const supabase = createClient()
    if (kind === 'keep') {
      await supabase.from('protocols').update({ is_mandatory: true, is_experimental: false, mandatory_since: todayISO() }).eq('id', exp.protocol_id)
      await supabase.from('experiments').update({ status: 'done', verdict: 'keep' }).eq('id', exp.id)
      window.location.href = '/app/protocol'
      return
    }
    if (kind === 'another_week') {
      await supabase.from('experiments').update({
        end_date: addDays(exp.end_date, 7),
        duration_days: exp.duration_days + 7,
        verdict: 'another_week',
      }).eq('id', exp.id)
      window.location.reload()
      return
    }
    await supabase.from('protocols').update({ enabled: false }).eq('id', exp.protocol_id)
    await supabase.from('experiments').update({ status: 'done', verdict: 'drop' }).eq('id', exp.id)
    window.location.href = '/app/protocol'
  }

  if (!loaded) return <main className="p-6" style={{ color: '#9aa0ae' }}>Loading…</main>

  if (!exp) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">Self-Experiment</h1>
        <div className="card mt-6 p-5">
          <p style={{ color: '#9aa0ae' }}>No active experiment. Pre-register one change and run it for a week against your baseline.</p>
          <Link href="/app/experiment/new" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>
            Start a self-experiment
          </Link>
        </div>
      </main>
    )
  }

  const today = todayISO()
  const dayNum = Math.min(Math.max(diffDays(exp.start_date, today < exp.end_date ? today : exp.end_date) + 1, 1), exp.duration_days)
  const unlocked = today >= exp.end_date
  const dayList = Array.from({ length: exp.duration_days }, (_, i) => addDays(exp.start_date, i))

  const thisWeek = weights.filter((w) => w.log_date >= exp.start_date).map((w) => w.weight_lb)
  const lastWeek = weights.filter((w) => w.log_date < exp.start_date).map((w) => w.weight_lb)
  const thisMed = median(thisWeek)
  const lastMed = median(lastWeek)
  const delta = thisMed != null && lastMed != null ? thisMed - lastMed : null

  const winStart = addDays(exp.start_date, -7)
  const winDays = diffDays(winStart, exp.end_date) + 1
  const wMin = Math.min(...weights.map((w) => w.weight_lb), ...(thisMed != null ? [thisMed] : []), ...(lastMed != null ? [lastMed] : []))
  const wMax = Math.max(...weights.map((w) => w.weight_lb), ...(thisMed != null ? [thisMed] : []), ...(lastMed != null ? [lastMed] : []))
  const pad = Math.max((wMax - wMin) * 0.2, 0.5)
  const W = 320, H = 130, P = 12
  const xFor = (iso: string) => P + (diffDays(winStart, iso) / Math.max(winDays - 1, 1)) * (W - 2 * P)
  const yFor = (v: number) => P + (1 - (v - (wMin - pad)) / ((wMax + pad) - (wMin - pad))) * (H - 2 * P)

  const heldCount = dayList.filter((d) => heldByDay[d]).length

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold">Self-Experiment</h1>

      <div className="card mt-4 p-5">
        <p className="text-xs" style={{ color: '#9aa0ae' }}>PRE-REGISTERED PROMISE</p>
        <p className="text-xl font-bold mt-1">{exp.title}</p>
        {exp.hypothesis && <p className="mt-2 italic text-sm" style={{ color: '#9aa0ae' }}>{exp.hypothesis}</p>}
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span>Day {dayNum} of {exp.duration_days}</span>
            <span style={{ color: '#e0607e', fontWeight: 700 }}>{Math.round((dayNum / exp.duration_days) * 100)}%</span>
          </div>
          <div className="mt-2" style={{ height: 10, borderRadius: 999, background: '#2c313d' }}>
            <div style={{ width: `${(dayNum / exp.duration_days) * 100}%`, height: '100%', borderRadius: 999, background: '#e0607e' }} />
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {dayList.map((d) => (
            <span key={d} title={fmtD(d)} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: heldByDay[d] ? '#e0607e' : 'transparent',
              border: `1px solid ${heldByDay[d] ? '#e0607e' : '#4a5160'}`,
            }} />
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: '#9aa0ae' }}>{heldCount} of {exp.duration_days} days held</p>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>WEIGHT CHANGE</p>
        {delta != null ? (
          <>
            <p className="mt-2 text-3xl font-bold">
              <span style={{ color: '#e0607e' }}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} lb</span>
              <span className="text-xl"> vs last week</span>
            </p>
            <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>Week median {thisMed!.toFixed(1)} lb vs prior week {lastMed!.toFixed(1)} lb. Signal check, not proof.</p>
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Weigh in daily on the Weight tab. The comparison fills in as you log.</p>
        )}
        {weights.length >= 2 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: 150 }}>
            {thisMed != null && (
              <line x1={0} x2={W} y1={yFor(thisMed)} y2={yFor(thisMed)} stroke="#e0607e" strokeWidth={1.5} />
            )}
            {lastMed != null && (
              <line x1={0} x2={W} y1={yFor(lastMed)} y2={yFor(lastMed)} stroke="#9aa0ae" strokeWidth={1.5} strokeDasharray="5 4" />
            )}
            {weights.map((w) => (
              <circle key={w.log_date} cx={xFor(w.log_date)} cy={yFor(w.weight_lb)} r={4} fill="#e0607e" />
            ))}
          </svg>
        )}
        {weights.length >= 2 && (
          <p className="mt-1 text-xs" style={{ color: '#9aa0ae' }}>
            <span style={{ color: '#e0607e' }}>—</span> this week median&nbsp;&nbsp;
            <span style={{ color: '#9aa0ae' }}>- -</span> last week median
          </p>
        )}
      </div>

      <div className="card mt-4 p-5">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>BASELINE – THE CONTROL</p>
          {baselineHeldPct != null && (
            <p className="text-sm font-bold" style={{ color: '#e0607e' }}>{Math.round(baselineHeldPct * 100)}% held</p>
          )}
        </div>
        <div className="mt-2">
          {exp.baseline_snapshot.map((b) => (
            <p key={b.id} className="text-sm py-1" style={{ borderBottom: '1px solid #2c313d' }}>🔒 {b.label}</p>
          ))}
        </div>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold tracking-wider" style={{ color: '#9aa0ae' }}>VERDICT</p>
        {unlocked ? (
          <div className="mt-3 flex gap-2">
            <button onClick={() => verdict('keep')} disabled={acting} className="btn flex-1">Keep it</button>
            <button onClick={() => verdict('another_week')} disabled={acting} className="btn flex-1" style={{ background: 'transparent', border: '1px solid #e0607e', color: '#e0607e' }}>Another week</button>
            <button onClick={() => verdict('drop')} disabled={acting} className="btn flex-1" style={{ background: 'transparent', border: '1px solid #4a5160', color: '#9aa0ae' }}>Drop it</button>
          </div>
        ) : (
          <p className="mt-2 text-sm" style={{ color: '#9aa0ae' }}>Verdict unlocks {fmtD(exp.end_date)} – decisions on Day {exp.duration_days}.</p>
        )}
      </div>
    </main>
  )
}
