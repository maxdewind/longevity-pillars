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
}

const METRIC_MINE: Record<MetricKey, string> = {
  weight_lb: 'my weight',
  sleep_hours: 'my sleep',
  deep_sleep_min: 'my deep sleep',
  overnight_hr_bpm: 'my overnight heart rate',
  overnight_hrv_ms: 'my overnight HRV',
  vo2max: 'my VO2max',
}

const METRIC_UNIT: Record<MetricKey, string> = {
  weight_lb: 'lb',
  sleep_hours: 'min',
  deep_sleep_min: 'min',
  overnight_hr_bpm: 'bpm',
  overnight_hrv_ms: 'ms',
  vo2max: '',
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
