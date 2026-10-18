// Baseline statistics over Apple Health history (with day exclusions) and
// default-goal computation from population bands.
//
// Default goals answer: "given where I am and the population bands, what is a
// sensible first target?" Rules per metric are documented in defaultGoalFor.

import { median } from './levels'
import { fmtSleepHM } from './format'
import type { MetricKey, BandChoice } from './referenceRanges'

export const DEFAULT_LOOKBACK_DAYS = 28
export const LOOKBACK_OPTIONS = [14, 28, 60, 90] as const

export interface DayValue {
  date: string // YYYY-MM-DD
  value: number
}

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Population standard deviation. */
export function stddev(xs: number[], m?: number | null): number | null {
  if (xs.length < 2) return null
  const avg = m ?? mean(xs)
  if (avg == null) return null
  const v = xs.reduce((a, b) => a + (b - avg) * (b - avg), 0) / xs.length
  return Math.sqrt(v)
}

export interface BaselineStats {
  n: number
  avg: number
  sd: number
  med: number
  min: number
  max: number
}

export function baselineStats(values: DayValue[], excluded: Set<string>): BaselineStats | null {
  const xs = values.filter((r) => !excluded.has(r.date)).map((r) => r.value).filter((v) => Number.isFinite(v))
  if (xs.length === 0) return null
  const a = mean(xs)!
  const s = stddev(xs, a) ?? 0
  return { n: xs.length, avg: a, sd: s, med: median(xs)!, min: Math.min(...xs), max: Math.max(...xs) }
}

/** Load baseline day-values for a metric: lookback days before `beforeDate`
 * (exclusive), minus excluded days. Shared by the run screen, prereg preview,
 * and the onboarding pillar picker. */
export async function fetchBaselineValues(
  supabase: { from: (t: string) => any },
  userId: string,
  metricKey: string,
  beforeDate: string,
  lookbackDays: number,
): Promise<DayValue[]> {
  const from = addDaysIso(beforeDate, -(lookbackDays - 1))
  const [{ data: rows }, { data: excl }] = await Promise.all([
    supabase.from('metric_entries').select('entry_date,value,source')
      .eq('user_id', userId).eq('metric_key', metricKey)
      .gte('entry_date', from).lt('entry_date', beforeDate).order('entry_date'),
    supabase.from('baseline_exclusions').select('excluded_date').eq('user_id', userId),
  ])
  const all = ((rows as { entry_date: string; value: number; source: string }[] | null) ?? [])
  const useSource = all.some((r) => r.source === 'apple_health') ? 'apple_health' : null
  const excluded = new Set(((excl as { excluded_date: string }[] | null) ?? []).map((e) => e.excluded_date))
  return all
    .filter((r) => (useSource == null || r.source === useSource) && !excluded.has(r.entry_date))
    .map((r) => ({ date: r.entry_date, value: Number(r.value) }))
    .filter((r) => Number.isFinite(r.value))
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Profile extras with safe fallbacks (also tolerates the migration not
 * having landed yet). */
export async function fetchProfileExtras(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ lookback: number; heightCm: number | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('baseline_lookback_days,height_cm')
      .eq('id', userId)
      .single()
    if (error) throw error
    const p = data as { baseline_lookback_days?: number | null; height_cm?: number | null } | null
    return {
      lookback: typeof p?.baseline_lookback_days === 'number' ? p.baseline_lookback_days : DEFAULT_LOOKBACK_DAYS,
      heightCm: typeof p?.height_cm === 'number' ? p.height_cm : null,
    }
  } catch {
    return { lookback: DEFAULT_LOOKBACK_DAYS, heightCm: null }
  }
}

/** Band-bar geometry per metric for the diagrams (BandBar component). */
export const BAND_BAR: Record<MetricKey, {
  min: number; max: number;
  pop?: [number, number]; asp?: [number, number];
  direction: 'lower' | 'higher' | 'band';
}> = {
  weight_lb: { min: 140, max: 280, direction: 'lower' },
  sleep_hours: { min: 4, max: 10, pop: [7, 9], asp: [8, 10], direction: 'band' },
  deep_sleep_min: { min: 0, max: 180, pop: [60, 120], asp: [90, 150], direction: 'higher' },
  overnight_hr_bpm: { min: 35, max: 100, pop: [60, 100], asp: [40, 55], direction: 'lower' },
  overnight_hrv_ms: { min: 10, max: 150, pop: [20, 70], asp: [70, 110], direction: 'higher' },
  vo2max: { min: 20, max: 70, direction: 'higher' },
}

/** Band for a concrete target value (shared by the slider form and defaults). */
export function bandForTargetValue(k: MetricKey, v: number, heightCm: number | null): BandChoice {
  if (k === 'weight_lb' && heightCm != null) {
    const m = heightCm / 100
    const bmi = v / 2.20462 / (m * m)
    return bmi >= 20 && bmi <= 22 ? 'aspirational' : 'population'
  }
  switch (k) {
    case 'sleep_hours': return v >= 8 ? 'aspirational' : 'population'
    case 'deep_sleep_min': return v >= 90 ? 'aspirational' : 'population'
    case 'overnight_hr_bpm': return v < 55 ? 'aspirational' : 'population'
    case 'overnight_hrv_ms': return v > 70 ? 'aspirational' : 'population'
    default: return 'population'
  }
}

export interface DefaultGoal {
  metric_key: MetricKey
  target_value: number
  band: BandChoice
  target_label: string
  rationale: string
}

function lbForBmi(bmi: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.round(bmi * m * m * 2.20462 * 2) / 2
}

/** BMI 18.5-24.9 (population) and 20-22 (aspirational) as weight bands in lb. */
export function weightBandsLb(heightCm: number): { pop: [number, number]; asp: [number, number] } {
  return { pop: [lbForBmi(18.5, heightCm), lbForBmi(24.9, heightCm)], asp: [lbForBmi(20, heightCm), lbForBmi(22, heightCm)] }
}

/**
 * Sensible first target from the baseline average and the population bands.
 * - Below the population band -> nearest population edge ("into the band").
 * - Inside population but short of aspirational -> aspirational edge.
 * - Above the band (lower-is-better) or inside aspirational -> hold.
 * Weight without height: 5% below current (clinically meaningful step).
 * VO2max: hold current (slow-moving metric; experiments target faster ones).
 */
export function defaultGoalFor(k: MetricKey, avg: number, heightCm: number | null): DefaultGoal | null {
  const label: Record<MetricKey, string> = {
    weight_lb: 'Weight',
    sleep_hours: 'Sleep',
    deep_sleep_min: 'Deep sleep',
    overnight_hr_bpm: 'Overnight heart rate',
    overnight_hrv_ms: 'Overnight HRV',
    vo2max: 'VO2max',
  }
  const fmt = (v: number) =>
    k === 'sleep_hours' ? fmtSleepHM(v)
    : k === 'weight_lb' ? `${v.toFixed(1)} lb`
    : k === 'deep_sleep_min' ? `${Math.round(v)} min`
    : k === 'overnight_hr_bpm' ? `${Math.round(v)} bpm`
    : k === 'overnight_hrv_ms' ? `${Math.round(v)} ms`
    : v.toFixed(1)
  const goal = (target_value: number, rationale: string): DefaultGoal => ({
    metric_key: k,
    target_value,
    band: bandForTargetValue(k, target_value, heightCm),
    target_label: `${label[k]} ${fmt(target_value)}`,
    rationale,
  })

  switch (k) {
    case 'sleep_hours':
      if (avg < 7) return goal(7, 'Into the population band (7 to 9 hours).')
      if (avg < 8) return goal(8, 'Toward the aspirational band (8+ hours).')
      if (avg > 9) return goal(9, 'Back into the population band.')
      return goal(Math.round(avg * 4) / 4, 'Hold your current level.')
    case 'deep_sleep_min': {
      const t = Math.round(avg)
      if (avg < 60) return goal(60, 'Into the population band (60 to 120 min).')
      if (avg < 90) return goal(90, 'Toward the aspirational band (90+ min).')
      if (avg > 120) return goal(120, 'Back into the population band.')
      return goal(t, 'Hold your current level.')
    }
    case 'overnight_hr_bpm': {
      const t = Math.round(avg)
      if (avg > 100) return goal(100, 'Into the population band (at or under 100 bpm).')
      if (avg >= 55) return goal(55, 'Toward the aspirational band (under 55 bpm).')
      return goal(t, 'Hold your current level.')
    }
    case 'overnight_hrv_ms': {
      const t = Math.round(avg)
      if (avg < 20) return goal(20, 'Into the population band.')
      if (avg <= 70) return goal(70, 'Toward the top of the population band.')
      return goal(t, 'Hold your current level.')
    }
    case 'weight_lb': {
      if (heightCm != null) {
        const m = heightCm / 100
        const bmi = avg / 2.20462 / (m * m)
        if (bmi < 18.5) return goal(lbForBmi(18.5, heightCm), 'Into the healthy BMI band (18.5 to 24.9).')
        if (bmi > 24.9) return goal(lbForBmi(24.9, heightCm), 'Into the healthy BMI band (18.5 to 24.9).')
        if (bmi < 20) return goal(lbForBmi(20, heightCm), 'Toward the aspirational BMI band (20 to 22).')
        if (bmi > 22) return goal(lbForBmi(22, heightCm), 'Toward the aspirational BMI band (20 to 22).')
        return goal(Math.round(avg * 2) / 2, 'Hold your current level.')
      }
      return goal(Math.round(avg * 0.95 * 2) / 2, 'Five percent below current, a clinically meaningful step.')
    }
    case 'vo2max':
      return goal(Math.round(avg * 10) / 10, 'Hold your current level.')
  }
}
