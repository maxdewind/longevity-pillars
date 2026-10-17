'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { REFERENCE_RANGES, REFERENCE_DISCLAIMER, type MetricKey, type BandChoice, type RefBand } from '@/lib/referenceRanges'

export interface GoalInput {
  metric_key: string
  band: BandChoice
  target_label: string
}

export interface EntryInput {
  metric_key: string
  entry_date: string
  value: number | string
}

interface Props {
  goals: GoalInput[]
  entries: EntryInput[]
  compact?: boolean
}

const MEDIAN_DAYS = 7

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function dayCutoff(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Current value: 7-day median for daily metrics, latest for VO2max. */
function currentValue(key: string, entries: EntryInput[]): number | null {
  const vals = entries
    .filter((e) => e.metric_key === key)
    .map((e) => ({ date: e.entry_date, v: Number(e.value) }))
    .filter((e) => Number.isFinite(e.v))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  if (vals.length === 0) return null
  if (key === 'vo2max') return vals[0].v
  const cutoff = dayCutoff(MEDIAN_DAYS)
  const recent = vals.filter((e) => e.date >= cutoff).map((e) => e.v)
  return median(recent)
}

type BandVerdict = 'met' | 'below' | 'above' | 'info'

function bandVerdict(band: RefBand, value: number): BandVerdict {
  const hasLow = band.low != null
  const hasHigh = band.high != null
  if (!hasLow && !hasHigh) return 'info'
  if (hasLow && !hasHigh) return value >= band.low! ? 'met' : 'below'
  if (hasHigh && !hasLow) return value <= band.high! ? 'met' : 'above'
  if (value < band.low!) return 'below'
  if (value > band.high!) return 'above'
  return 'met'
}

function verdictLabel(v: BandVerdict): string {
  if (v === 'met') return 'In band'
  if (v === 'below') return 'Below band'
  if (v === 'above') return 'Above band'
  return ''
}

function fmt(v: number): string {
  return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}

export function usePositionData() {
  const [goals, setGoals] = useState<GoalInput[]>([])
  const [entries, setEntries] = useState<EntryInput[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [{ data: g }, { data: e }] = await Promise.all([
        supabase.from('goals').select('metric_key,band,target_label').eq('user_id', user.id),
        supabase.from('metric_entries').select('metric_key,entry_date,value').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(500),
      ])
      setGoals(((g as GoalInput[] | null) ?? []).filter((x) => REFERENCE_RANGES[x.metric_key as MetricKey]))
      setEntries(((e as EntryInput[] | null) ?? []))
      setLoading(false)
    }
    load()
  }, [reloadKey])

  return { goals, entries, loading, reload: () => { setLoading(true); setReloadKey((k) => k + 1) } }
}

export default function PositionView({ goals, entries, compact = false }: Props) {
  if (goals.length === 0) {
    return (
      <div className="card">
        <p className="text-muted">No goals picked yet.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {goals.map((g) => {
        const def = REFERENCE_RANGES[g.metric_key as MetricKey]
        if (!def) return null
        const value = currentValue(g.metric_key, entries)
        const bands: { key: BandChoice; band: RefBand; chosen: boolean }[] = [
          { key: 'population', band: def.population, chosen: g.band === 'population' },
          { key: 'aspirational', band: def.aspirational, chosen: g.band === 'aspirational' },
        ]
        return (
          <div key={g.metric_key} className="card">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{def.label}</p>
              <p className="text-sm tabular-nums">
                {value == null ? (
                  <span className="text-muted">No data yet</span>
                ) : (
                  <span>{fmt(value)} <span className="text-muted text-xs">{def.unit}</span></span>
                )}
              </p>
            </div>
            {!compact && value != null && g.metric_key === 'weight_lb' && (
              <p className="text-xs text-muted mt-1">
                7-day median weight. Add your height to see your BMI against the bands below.
              </p>
            )}
            {def.soft && (
              <p className="text-xs text-muted mt-1">
                HRV is device-specific and noisy. Shown for context, never a verdict driver.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {bands.map(({ key, band, chosen }) => {
                const verdict = value == null ? 'info' as BandVerdict : bandVerdict(band, value)
                return (
                  <div
                    key={key}
                    className={`rounded-lg border px-3 py-2 ${chosen ? 'border-accent/60 bg-accent/5' : 'border-white/10'}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {key === 'population' ? 'Population' : 'Aspirational'}
                      {chosen && <span className="text-accent"> · your goal</span>}
                    </p>
                    <p className="text-sm mt-1">{band.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{band.source}</p>
                    {value != null && verdict !== 'info' && (
                      <p className={`text-xs mt-1 font-medium ${verdict === 'met' ? 'text-accent' : 'text-muted'}`}>
                        {verdict === 'met' ? '✓ ' : ''}{verdictLabel(verdict)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-[11px] text-muted">{REFERENCE_DISCLAIMER}</p>
    </div>
  )
}
