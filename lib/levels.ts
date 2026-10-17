import { todayISO } from '@/lib/format'

// Shared logic for the Levels module (/start/app/levels).
// All rules below come from the approved design; keep them in sync with the
// rules stated there. No em dashes in any user-facing string.

export const WINDOW_DAYS = 12
export const OBSERVED_REQUIRED = 10
export const BASELINE_DAYS = 7
export const MIN_BASELINE_DAYS = 4
export const EXPERIMENT_ADHERENCE_MIN = 0.7
export const EXTEND_DAYS = 5

export type MetricKey =
  | 'weight_lb'
  | 'sleep_hours'
  | 'deep_sleep_min'
  | 'overnight_hr_bpm'
  | 'overnight_hrv_ms'
  | 'vo2max'

export interface ExperimentTemplate {
  level_number: number
  title: string
  detail: string
  primary_metric: MetricKey
  threshold_label: string
  threshold_value: number | null
  threshold_direction: 'down' | 'up'
  evidence_tier: 'A' | 'B' | 'C'
  contraindications: string[] | null
  verdict_driver: boolean
}

export interface LevelsExperiment {
  id: string
  user_id: string
  protocol_id: string
  title: string
  hypothesis: string | null
  start_date: string
  end_date: string
  duration_days: number
  status: 'active' | 'done'
  verdict: string | null
  mode: string | null
  window_days: number | null
  observed_days_required: number | null
  template_level: number | null
}

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: string; fmt: (v: number) => string }> = {
  weight_lb: { label: 'Weight', unit: 'lb', fmt: (v) => `${v.toFixed(1)} lb` },
  sleep_hours: { label: 'Sleep', unit: 'hours', fmt: (v) => `${v.toFixed(1)} h` },
  deep_sleep_min: { label: 'Deep sleep', unit: 'minutes', fmt: (v) => `${Math.round(v)} min` },
  overnight_hr_bpm: { label: 'Overnight heart rate', unit: 'bpm', fmt: (v) => `${Math.round(v)} bpm` },
  overnight_hrv_ms: { label: 'Overnight HRV', unit: 'ms', fmt: (v) => `${Math.round(v)} ms` },
  vo2max: { label: 'VO2max', unit: 'ml/kg/min', fmt: (v) => `${v.toFixed(1)}` },
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

export const fmtD = (iso: string): string =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

// --- Signal reading -------------------------------------------------------

export type SignalStrength = 'signal' | 'suggestive' | 'no_signal'

export interface SignalRead {
  strength: SignalStrength
  runMedian: number | null
  baselineMedian: number | null
  shift: number | null
  // Days moving in the threshold direction, relative to the baseline median.
  directionDays: number
  observedDays: number
  text: string
}

const shiftThreshold = (metric: MetricKey, baselineMedian: number | null): number | null => {
  switch (metric) {
    case 'weight_lb': return 1
    case 'overnight_hr_bpm': return 2
    case 'overnight_hrv_ms': return baselineMedian != null ? Math.abs(baselineMedian) * 0.1 : null
    case 'sleep_hours': return 1 / 3 // 20 minutes
    case 'deep_sleep_min': return 15
    case 'vo2max': return null
  }
}

/** Compare the observed window against the baseline median for one metric. */
export function readSignal(
  metric: MetricKey,
  direction: 'down' | 'up',
  baselineValues: number[],
  observedValues: number[],
): SignalRead {
  const baselineMedian = median(baselineValues)
  const runMedian = median(observedValues)
  const dirSign = direction === 'down' ? -1 : 1
  const empty: SignalRead = {
    strength: 'no_signal', runMedian, baselineMedian, shift: null,
    directionDays: 0, observedDays: observedValues.length,
    text: 'No data yet to read a signal.',
  }
  if (baselineMedian == null || runMedian == null || observedValues.length === 0) return empty
  const shift = runMedian - baselineMedian
  const signedShift = shift * dirSign
  const threshold = shiftThreshold(metric, baselineMedian)
  if (threshold == null) {
    return { ...empty, shift, text: 'This metric is tracked as a goal, not judged per level.' }
  }
  const directionDays = observedValues.filter((v) =>
    direction === 'down' ? v < baselineMedian : v > baselineMedian,
  ).length
  const consistent = observedValues.length >= 10
    ? directionDays >= 7
    : directionDays / observedValues.length >= 0.7
  let strength: SignalStrength = 'no_signal'
  let text = 'No signal yet. The numbers are within normal day to day noise.'
  if (signedShift >= threshold && consistent) {
    strength = 'signal'
    text = `Signal: the median moved ${dirSign < 0 ? 'down' : 'up'} by enough to clear daily noise, on most days.`
  } else if (signedShift >= threshold * 0.6 && signedShift > 0) {
    strength = 'suggestive'
    text = 'Suggestive: moving in the right direction, but short of a clear signal.'
  } else if (signedShift <= -threshold * 0.6 && signedShift < 0) {
    strength = 'suggestive'
    text = 'Suggestive: moving the wrong way, but not clearly past noise.'
  }
  return { strength, runMedian, baselineMedian, shift, directionDays, observedDays: observedValues.length, text }
}

// --- Verdict suggestion ----------------------------------------------------

export type VerdictKind = 'keep' | 'extend' | 'drop' | 'inconclusive'

export interface VerdictInput {
  template: ExperimentTemplate
  signal: SignalRead
  observedDays: number
  observedRequired: number
  baselineDays: number
  experimentAdherence: number | null
  baselineStability: number | null
  stabilityGatePct: number
}

export interface VerdictSuggestion {
  verdict: VerdictKind
  reasons: string[]
}

/**
 * The decision tree, in order. Caps first (data quality, adherence,
 * baseline stability, informational level), then the signal verdict.
 */
export function suggestVerdict(input: VerdictInput): VerdictSuggestion {
  const {
    template, signal, observedDays, observedRequired, baselineDays,
    experimentAdherence, baselineStability, stabilityGatePct,
  } = input
  const reasons: string[] = []
  const label = METRIC_LABELS[template.primary_metric].label

  if (!template.verdict_driver) {
    return {
      verdict: 'inconclusive',
      reasons: ['This level is informational only in v1, so the verdict is always inconclusive.'],
    }
  }
  if (baselineDays < MIN_BASELINE_DAYS) {
    return {
      verdict: 'inconclusive',
      reasons: [
        `Weak baseline: only ${baselineDays} of ${BASELINE_DAYS} pre-level days have ${label.toLowerCase()} logged. Verdict capped at inconclusive.`,
      ],
    }
  }
  reasons.push(`${observedDays} of ${observedRequired} observed days logged.`)
  if (observedDays < observedRequired) {
    return {
      verdict: 'inconclusive',
      reasons: [...reasons, `Low data: fewer than ${observedRequired} observed days, so no verdict can be read.`],
    }
  }
  if (experimentAdherence == null || experimentAdherence < EXPERIMENT_ADHERENCE_MIN) {
    const pct = experimentAdherence == null ? 0 : Math.round(experimentAdherence * 100)
    return {
      verdict: 'inconclusive',
      reasons: [...reasons, `Unreadable run: the level itself was held ${pct}% of days (needs ${Math.round(EXPERIMENT_ADHERENCE_MIN * 100)}%).`],
    }
  }
  reasons.push(`Level held ${Math.round((experimentAdherence ?? 0) * 100)}% of days.`)
  if (baselineStability != null && baselineStability * 100 < stabilityGatePct) {
    return {
      verdict: 'inconclusive',
      reasons: [
        ...reasons,
        `Baseline unstable: held ${Math.round(baselineStability * 100)}% over the last 10 days, below your ${stabilityGatePct}% gate. Verdict capped at inconclusive.`,
      ],
    }
  }
  if (baselineStability != null) {
    reasons.push(`Baseline held ${Math.round(baselineStability * 100)}% over the last 10 days (gate ${stabilityGatePct}%).`)
  }

  const threshold = shiftThreshold(template.primary_metric, signal.baselineMedian)
  const dirWord = template.threshold_direction === 'down' ? 'down' : 'up'
  if (signal.shift != null && threshold != null) {
    const signed = signal.shift * (template.threshold_direction === 'down' ? -1 : 1)
    reasons.push(
      `${label} median moved ${dirWord} by ${fmtShift(template.primary_metric, Math.abs(signal.shift))} vs baseline.`,
    )
    if (signal.strength === 'signal') {
      return { verdict: 'keep', reasons: [...reasons, `Threshold met: the move clears the ${fmtShift(template.primary_metric, threshold)} noise bar on most days.`] }
    }
    if (signed <= -threshold) {
      return { verdict: 'drop', reasons: [...reasons, `Moved the wrong way beyond noise: dropped past the ${fmtShift(template.primary_metric, threshold)} bar.`] }
    }
    if (signal.strength === 'suggestive' && signed > 0) {
      return { verdict: 'extend', reasons: [...reasons, 'Trending toward the threshold but short of it: extend 5 days to get a cleaner read.'] }
    }
  }
  return { verdict: 'inconclusive', reasons: [...reasons, 'Nothing decisive: within noise, so the default is inconclusive.'] }
}

const fmtShift = (metric: MetricKey, v: number): string => {
  switch (metric) {
    case 'weight_lb': return `${v.toFixed(1)} lb`
    case 'overnight_hr_bpm': return `${Math.round(v)} bpm`
    case 'overnight_hrv_ms': return `${Math.round(v)}%`
    case 'sleep_hours': return `${Math.round(v * 60)} min`
    case 'deep_sleep_min': return `${Math.round(v)} min`
    case 'vo2max': return `${v.toFixed(1)}`
  }
}

// --- Safety gate -----------------------------------------------------------

const SAFETY_KEYWORDS: { key: string; label: string; match: RegExp }[] = [
  { key: 'diabetes_meds', label: 'diabetes or blood sugar medication', match: /diabet|blood sugar|glucose|insulin|medication/i },
  { key: 'pregnancy', label: 'pregnancy', match: /pregnan/i },
  { key: 'ed_history', label: 'eating disorder history', match: /eating disorder|disordered eating|ed history/i },
]

/** Returns the matching safety flags (human labels) blocking this template. */
export function safetyConflicts(
  contraindications: string[] | null,
  answers: Record<string, boolean> | null,
): string[] {
  if (!contraindications?.length || !answers) return []
  const hits: string[] = []
  for (const c of contraindications) {
    for (const { key, label, match } of SAFETY_KEYWORDS) {
      if (match.test(c) && answers[key] === true && !hits.includes(label)) hits.push(label)
    }
  }
  return hits
}

// --- Unlock rule -----------------------------------------------------------

export interface LockState {
  unlocked: boolean
  reason: string | null
}

/**
 * Level 1 unlocks once the user has track='levels' baseline routines.
 * Level N+1 unlocks when level N has a recorded verdict (any verdict)
 * and the trailing-10-day baseline held rate meets the stability gate.
 */
export function lockStateForLevel(args: {
  level: number
  hasBaselineRoutines: boolean
  prevLevelDone: boolean
  prevLevelActive: boolean
  stabilityPct: number | null
  gatePct: number
}): LockState {
  const { level, hasBaselineRoutines, prevLevelDone, prevLevelActive, stabilityPct, gatePct } = args
  if (!hasBaselineRoutines) {
    return { unlocked: false, reason: 'Finish the onboarding baseline to unlock Level 1.' }
  }
  if (level === 1) return { unlocked: true, reason: null }
  if (!prevLevelDone) {
    return {
      unlocked: false,
      reason: prevLevelActive
        ? `Finish the Level ${level - 1} run first.`
        : `Complete Level ${level - 1} to unlock this level.`,
    }
  }
  if (stabilityPct == null || stabilityPct * 100 < gatePct) {
    const cur = stabilityPct == null ? 'no data' : `${Math.round(stabilityPct * 100)}%`
    return {
      unlocked: false,
      reason: `Baseline unstable: held ${cur} over the last 10 days, needs ${gatePct}%. Hold the baseline, then Level ${level} opens.`,
    }
  }
  return { unlocked: true, reason: null }
}

export const errMsg = (e: unknown): string =>
  e instanceof Error
    ? e.message
    : ((e as { message?: string } | null)?.message ?? JSON.stringify(e))
