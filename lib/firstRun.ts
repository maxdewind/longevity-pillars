// First-run flow state: the experiment picked on the "First experiment" step,
// carried to the "Ground rules" step via sessionStorage.
import type { MetricKey } from './referenceRanges'

export type FirstRunSelection =
  | { kind: 'template'; level_number: number }
  | {
      kind: 'custom'
      title: string
      detail: string
      primary_metric: MetricKey
      pillar: string
      hypothesis: string
    }

const KEY = 'lp_first_run'

export function saveFirstRunSelection(s: FirstRunSelection): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

export function loadFirstRunSelection(): FirstRunSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FirstRunSelection) : null
  } catch {
    return null
  }
}

export function clearFirstRunSelection(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

const METRIC_SHORT: Record<MetricKey, string> = {
  weight_lb: 'weight',
  sleep_hours: 'sleep',
  deep_sleep_min: 'deep sleep',
  overnight_hr_bpm: 'overnight heart rate',
  overnight_hrv_ms: 'HRV',
  vo2max: 'VO2max',
  bedtime: 'bedtime',
}

const METRIC_MINE: Record<MetricKey, string> = {
  weight_lb: 'my weight',
  sleep_hours: 'my sleep',
  deep_sleep_min: 'my deep sleep',
  overnight_hr_bpm: 'my overnight heart rate',
  overnight_hrv_ms: 'my overnight HRV',
  vo2max: 'my VO2max',
  bedtime: 'my bedtime',
}

const METRIC_UNIT: Record<MetricKey, string> = {
  weight_lb: 'lb',
  sleep_hours: 'min',
  deep_sleep_min: 'min',
  overnight_hr_bpm: 'bpm',
  overnight_hrv_ms: 'ms',
  vo2max: '',
  bedtime: '',
}

function amountFor(primary_metric: MetricKey, threshold_value: number | null): { amt: string; unit: string } {
  const abs = Math.abs(threshold_value ?? 0)
  if (primary_metric === 'sleep_hours') {
    return { amt: String(Math.round(abs * 60)), unit: 'min' }
  }
  const rounded = Math.round(abs * 10) / 10
  return { amt: String(rounded), unit: METRIC_UNIT[primary_metric] }
}

/** "Tests: overnight heart rate down 2+ bpm" for the experiment picker cards. */
export function testsLine(t: {
  primary_metric: MetricKey
  threshold_value: number | null
  threshold_direction: string
}): string {
  const dir = t.threshold_direction === 'down' ? 'down' : 'up'
  const { amt, unit } = amountFor(t.primary_metric, t.threshold_value)
  return `Tests: ${METRIC_SHORT[t.primary_metric]} ${dir} ${amt}+${unit ? ` ${unit}` : ''}`
}

/** Default hypothesis for a template, e.g. "Eating window 11:30 to 19:30 will
 *  lower my overnight heart rate by 2+ bpm." */
export function hypothesisFor(
  title: string,
  t: { primary_metric: MetricKey; threshold_value: number | null; threshold_direction: string },
): string {
  const verb = t.threshold_direction === 'down' ? 'lower' : 'raise'
  const { amt, unit } = amountFor(t.primary_metric, t.threshold_value)
  return `${title} will ${verb} ${METRIC_MINE[t.primary_metric]} by ${amt}+${unit ? ` ${unit}` : ''}.`
}

/** "overnight heart rate, down 2+ bpm" — the value half of the Primary line. */
export function primaryPhrase(t: {
  primary_metric: MetricKey
  threshold_value: number | null
  threshold_direction: string
}): string {
  return testsLine(t).replace(/^Tests: /, '')
}

export type EvidenceWord = 'Strong' | 'Moderate' | 'Early'

/** A -> Strong, B -> Moderate, C -> Early. */
export function evidenceWord(tier: string): EvidenceWord {
  if (tier === 'A') return 'Strong'
  if (tier === 'B') return 'Moderate'
  return 'Early'
}

/** Number of filled dots for the evidence pill. */
export function evidenceDots(tier: string): number {
  if (tier === 'A') return 3
  if (tier === 'B') return 2
  return 1
}

export const EVIDENCE_DESCRIPTIONS: Record<EvidenceWord, string> = {
  Strong: 'Multiple large human trials agree. This is the best-supported tier.',
  Moderate:
    "Some human studies point the same way, but they're smaller, shorter or mixed in quality.",
  Early: 'Early or mixed evidence: small studies, expert opinion, or promising but unproven.',
}

export const EVIDENCE_DISCLAIMER =
  'Evidence shows how likely this works for people in general. Your verdict shows whether it works for you.'

const METRIC_WATCH_LABEL: Record<MetricKey, string> = {
  weight_lb: 'weight',
  sleep_hours: 'sleep',
  deep_sleep_min: 'deep sleep',
  overnight_hr_bpm: 'overnight heart rate',
  overnight_hrv_ms: 'HRV',
  vo2max: 'VO2max',
  bedtime: 'bedtime',
}

/** Short display label for the "Also watching" line. */
export function watchLabel(metricKey: string): string {
  return METRIC_WATCH_LABEL[metricKey as MetricKey] ?? metricKey
}
