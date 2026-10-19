// Spec v0.1 sprint logic: 7-day sprints, held counts, verdicts, evidence tiers,
// and neutral (non-judgmental) change formatting. No em dashes in user strings.

import { SPRINT_HELD_TO_KEEP } from './levels'
import { fmtBedtime as fmtBedtimeLevels } from './levels'

export type SprintVerdict = 'held' | 'not_held'

/** Held on 6+ of 7 nights keeps the rule; fewer does not. */
export function sprintVerdict(heldCount: number, windowDays: number): SprintVerdict {
  const needed = windowDays >= 7 ? SPRINT_HELD_TO_KEEP : Math.ceil(windowDays * 0.85)
  return heldCount >= needed ? 'held' : 'not_held'
}

export type EvidenceTier = 'Early' | 'Moderate' | 'Strong'

/**
 * Early: a single 7-day sprint (direction only).
 * Moderate: verdict after a 3-day extension (10 days of data).
 * Strong: the 4-week re-read confirmed the direction.
 */
export function evidenceTier(args: {
  extendedDays: number
  rereadConfirmed: boolean
}): EvidenceTier {
  if (args.rereadConfirmed) return 'Strong'
  if (args.extendedDays > 0) return 'Moderate'
  return 'Early'
}

const TIER_BLURB: Record<EvidenceTier, string> = {
  Early: 'One 7-day sprint. Enough to see a direction, not enough to be sure. Treat the move as a hint.',
  Moderate: 'Ten days of data after an extension. More confidence than a single week, still short of proof.',
  Strong: 'The 4-week re-read confirmed the direction from your sprint. This is the strongest read the app gives.',
}

export function evidenceBlurb(tier: EvidenceTier): string {
  return TIER_BLURB[tier]
}

/** Bold value formatting per metric (shared by cards and the metrics drawer). */
export function fmtMetricValue(metric: string, v: number): string {
  switch (metric) {
    case 'weight_lb': return `${v.toFixed(1)} lb`
    case 'sleep_hours': return fmtSleepHm(v)
    case 'deep_sleep_min': return `${Math.round(v)} min`
    case 'overnight_hr_bpm': return `${Math.round(v)} bpm`
    case 'overnight_hrv_ms': return `${Math.round(v)} ms`
    case 'overnight_spo2': return `${Math.round(v)}%`
    case 'vo2max': return `${Math.round(v)}`
    case 'bedtime': return fmtBedtimeLevels(v)
    default: return `${v.toFixed(1)}`
  }
}

/** "6h 57m" format for sleep duration, matching Apple Health. */
export function fmtSleepHm(v: number): string {
  const totalMin = Math.round(v * 60)
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}

/**
 * Neutral change vs the user's usual. Never red/green, never "better/worse":
 * "+0.4 h vs usual 7.0 h". Returns null when there is no usual to compare to.
 */
export function fmtChangeVsUsual(metric: string, value: number, usual: number | null): string | null {
  if (usual == null) return null
  const d = value - usual
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const a = Math.abs(d)
  let delta: string
  switch (metric) {
    case 'weight_lb': delta = `${sign}${a.toFixed(1)} lb`; break
    case 'sleep_hours': delta = `${sign}${a.toFixed(1)} h`; break
    case 'deep_sleep_min': delta = `${sign}${Math.round(a)} min`; break
    case 'overnight_hr_bpm': delta = `${sign}${Math.round(a)} bpm`; break
    case 'overnight_hrv_ms': delta = `${sign}${Math.round(a)} ms`; break
    case 'overnight_spo2': delta = `${sign}${Math.round(a)}%`; break
    case 'vo2max': delta = `${sign}${Math.round(a)}`; break
    case 'bedtime': {
      const mins = Math.round(a * 60)
      delta = `${d > 0 ? '+' : d < 0 ? '−' : ''}${mins} min`
      break
    }
    default: delta = `${sign}${a.toFixed(1)}`
  }
  if (d === 0) delta = '±0'
  return `${delta} vs usual ${fmtMetricValue(metric, usual)}`
}

/** Compact delta only ("+5", "−1 bpm"), for the "Also moved" rows. */
export function fmtDeltaShort(metric: string, d: number): string {
  if (d === 0) return '±0'
  const sign = d > 0 ? '+' : '−'
  const a = Math.abs(d)
  switch (metric) {
    case 'weight_lb': return `${sign}${a.toFixed(1)}`
    case 'sleep_hours': return `${sign}${a.toFixed(1)} h`
    case 'deep_sleep_min': return `${sign}${Math.round(a)} min`
    case 'deep_sleep_min_unitless': return `${sign}${Math.round(a)}`
    case 'overnight_hr_bpm': return `${sign}${Math.round(a)}`
    case 'overnight_hrv_ms': return `${sign}${Math.round(a)}`
    case 'overnight_spo2': return `${sign}${Math.round(a)}`
    case 'vo2max': return `${sign}${Math.round(a)}`
    case 'bedtime': return `${sign}${Math.round(a * 60)} min`
    default: return `${sign}${a.toFixed(1)}`
  }
}

/** True when the move is smaller than the typical swing (SD of the starting point). */
export function withinUsualSwing(value: number, usual: number, swing: number | null): boolean | null {
  if (swing == null) return null
  return Math.abs(value - usual) <= swing
}

/** "Held 6 of the last 7" — never streak counters. */
export function fmtHeldXofY(held: number, total: number): string {
  return `Held ${held} of the last ${total}`
}

export function fmtHeldNights(held: number, total: number): string {
  return `Held ${held} of ${total} nights`
}

/** Metric groups for the All metrics drawer. */
export const METRIC_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Sleep', keys: ['sleep_hours', 'bedtime', 'deep_sleep_min'] },
  { title: 'Recovery', keys: ['overnight_hrv_ms', 'overnight_hr_bpm', 'overnight_spo2'] },
  { title: 'Body', keys: ['weight_lb', 'vo2max'] },
]

export const METRIC_DRAWER_LABELS: Record<string, string> = {
  sleep_hours: 'Duration',
  bedtime: 'Bedtime',
  deep_sleep_min: 'Deep sleep',
  overnight_hrv_ms: 'Overnight HRV',
  overnight_hr_bpm: 'Overnight HR',
  overnight_spo2: 'Overnight SpO2',
  weight_lb: 'Weight, 7-day avg',
  vo2max: 'VO2 max',
}

/** What-got-in-the-way chips for a not-held verdict. */
export const BLOCKER_CHIPS = ['Late evening', 'Family or social', 'Work', 'Forgot', 'Other']

export type SustainabilityKey = 'easy' | 'ok' | 'hard'
export const SUSTAINABILITY_LABELS: Record<SustainabilityKey, string> = {
  easy: 'Easy',
  ok: 'OK',
  hard: 'Hard',
}
