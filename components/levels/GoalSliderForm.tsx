'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtSleepHM } from '@/lib/format'
import { REFERENCE_RANGES, REFERENCE_DISCLAIMER, METRIC_ORDER, type MetricKey, type BandChoice } from '@/lib/referenceRanges'

interface Props {
  /** Where to go after saving. */
  nextHref: string
  nextLabel: string
  /** Optional: called after a successful save. */
  onSaved?: () => void
}

interface SliderDef {
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  /** Numeric band edges for the bar shading, when the bands are numeric. */
  bands?: { pop: [number, number]; asp: [number, number] }
}

const SLIDER: Record<MetricKey, SliderDef> = {
  weight_lb: { min: 140, max: 280, step: 0.5, fmt: (v) => `${v.toFixed(1)} lb` },
  sleep_hours: { min: 4, max: 10, step: 0.25, fmt: (v) => fmtSleepHM(v), bands: { pop: [7, 9], asp: [8, 10] } },
  deep_sleep_min: { min: 0, max: 180, step: 5, fmt: (v) => `${Math.round(v)} min`, bands: { pop: [60, 120], asp: [90, 150] } },
  overnight_hr_bpm: { min: 35, max: 100, step: 1, fmt: (v) => `${Math.round(v)} bpm`, bands: { pop: [60, 100], asp: [40, 55] } },
  overnight_hrv_ms: { min: 10, max: 150, step: 1, fmt: (v) => `${Math.round(v)} ms`, bands: { pop: [20, 70], asp: [70, 110] } },
  vo2max: { min: 20, max: 70, step: 0.5, fmt: (v) => v.toFixed(1) },
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function bandForTarget(k: MetricKey, v: number): BandChoice {
  switch (k) {
    case 'sleep_hours': return v >= 8 ? 'aspirational' : 'population'
    case 'deep_sleep_min': return v >= 90 ? 'aspirational' : 'population'
    case 'overnight_hr_bpm': return v < 55 ? 'aspirational' : 'population'
    case 'overnight_hrv_ms': return v > 70 ? 'aspirational' : 'population'
    default: return 'population'
  }
}

function bandCaption(k: MetricKey, v: number): string | null {
  const b = SLIDER[k].bands
  if (!b) return null
  const [p0, p1] = b.pop
  const [a0, a1] = b.asp
  const inAsp = v >= a0 && v <= a1
  const inPop = v >= p0 && v <= p1
  if (inAsp) return 'In the aspirational band'
  if (inPop) return 'In the population band'
  return 'Outside the bands'
}

export default function GoalSliderForm({ nextHref, nextLabel, onSaved }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState<Record<string, number>>({})
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [targets, setTargets] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 6)
      const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
      const [{ data: entries }, { data: goals }] = await Promise.all([
        supabase.from('metric_entries').select('metric_key,entry_date,value').eq('user_id', user.id).gte('entry_date', iso),
        supabase.from('goals').select('metric_key,target_value').eq('user_id', user.id),
      ])
      const byKey: Record<string, number[]> = {}
      ;((entries as { metric_key: string; entry_date: string; value: number }[] | null) ?? []).forEach((r) => {
        const v = Number(r.value)
        if (!Number.isFinite(v)) return
        ;(byKey[r.metric_key] = byKey[r.metric_key] ?? []).push(v)
      })
      const cur: Record<string, number> = {}
      const tgt: Record<string, number> = {}
      const en: Record<string, boolean> = {}
      METRIC_ORDER.forEach((k) => {
        const vals = byKey[k] ?? []
        if (k === 'vo2max') {
          // VO2max is point-in-time: take the latest entry regardless of window.
          if (vals.length > 0) cur[k] = vals[vals.length - 1]
        } else {
          const m = median(vals)
          if (m != null) cur[k] = m
        }
      })
      ;((goals as { metric_key: string; target_value: number | null }[] | null) ?? []).forEach((g) => {
        if (g.target_value != null && Number.isFinite(Number(g.target_value))) {
          en[g.metric_key] = true
          tgt[g.metric_key] = Number(g.target_value)
        }
      })
      // Default a fresh target at the current value so the slider starts at "you".
      METRIC_ORDER.forEach((k) => {
        if (tgt[k] == null && cur[k] != null) tgt[k] = cur[k]
      })
      setCurrent(cur)
      setTargets(tgt)
      setEnabled(en)
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      await supabase.from('goals').delete().eq('user_id', user.id)
      const rows = METRIC_ORDER.filter((k) => enabled[k]).map((k) => {
        const v = targets[k] ?? current[k]
        if (v == null) throw new Error(`Pick a target for ${REFERENCE_RANGES[k].label}.`)
        return {
          user_id: user.id,
          metric_key: k,
          band: bandForTarget(k, v),
          target_value: v,
          target_label: `${REFERENCE_RANGES[k].label} ${SLIDER[k].fmt(v)}`,
        }
      })
      if (rows.length > 0) {
        const { error } = await supabase.from('goals').insert(rows)
        if (error) throw error
      }
      onSaved?.()
      router.push(nextHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed.')
    }
    setSaving(false)
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div className="space-y-3">
      {METRIC_ORDER.map((k) => {
        const def = REFERENCE_RANGES[k]
        const cfg = SLIDER[k]
        const cur = current[k]
        const isOn = !!enabled[k]
        const target = targets[k] ?? cur ?? cfg.min
        const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - cfg.min) / (cfg.max - cfg.min)) * 100)))}%`
        const caption = isOn ? bandCaption(k, target) : null
        return (
          <div key={k} className="card">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="font-semibold">{def.label}</span>
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted tabular-nums">
                  {cur == null ? 'No data yet' : <>You: {cfg.fmt(cur)}</>}
                </span>
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={cur == null}
                  onChange={(e) => setEnabled((s) => ({ ...s, [k]: e.target.checked }))}
                  className="w-5 h-5 accent-teal-400"
                />
              </span>
            </label>
            {cur == null && (
              <p className="text-xs text-muted mt-2">Log this metric first to set a goal for it.</p>
            )}
            {isOn && cur != null && (
              <div className="mt-3">
                <div className="relative h-3 rounded-full bg-white/10">
                  {cfg.bands && (
                    <>
                      <div
                        className="absolute top-0 bottom-0 rounded-full bg-white/25"
                        style={{ left: pct(cfg.bands.pop[0]), width: `calc(${pct(cfg.bands.pop[1])} - ${pct(cfg.bands.pop[0])})` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 rounded-full bg-accent/30"
                        style={{ left: pct(cfg.bands.asp[0]), width: `calc(${pct(cfg.bands.asp[1])} - ${pct(cfg.bands.asp[0])})` }}
                      />
                    </>
                  )}
                  <div
                    className="absolute w-3 h-3 rounded-full bg-white top-0"
                    style={{ left: `calc(${pct(cur)} - 6px)` }}
                    title="You are here"
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full top-0"
                    style={{ left: `calc(${pct(target)} - 6px)`, background: '#7ee2a8' }}
                    title="Your target"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted mt-1">
                  <span>Population</span>
                  <span>Aspirational</span>
                </div>
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={target}
                  onChange={(e) => setTargets((s) => ({ ...s, [k]: Number(e.target.value) }))}
                  className="w-full mt-2"
                  aria-label={`${def.label} target`}
                />
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-sm">
                    Target: <span className="font-semibold tabular-nums" style={{ color: '#7ee2a8' }}>{cfg.fmt(target)}</span>
                  </p>
                  {caption && <p className="text-xs text-muted">{caption}</p>}
                </div>
              </div>
            )}
          </div>
        )
      })}
      <p className="text-[11px] text-muted">{REFERENCE_DISCLAIMER}</p>
      {error && <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-primary w-full"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : nextLabel}
      </button>
      <p className="text-xs text-muted text-center">Setting no goals is fine. You can always come back here later.</p>
    </div>
  )
}
