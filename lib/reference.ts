// Reference ranges for the "Compare my numbers" feature on the starting-point
// screen. Ranges are general adult guidance, not a diagnosis. VO2max norms are
// approximate anchors from published cardiorespiratory fitness tables.

export type CompareMode = 'off' | 'healthy' | 'top'

export const REFERENCE_DISCLAIMER =
  'Reference ranges, not a diagnosis. Where we lack a trusted range, we show your numbers only.'

export const DEEP_SLEEP_INFO =
  'Deep sleep matters for recovery. Healthy adults spend about 13 to 23% of the night in it. Wearables estimate sleep stages loosely, so treat this as a rough guide and watch your own trend.'

export const OVERNIGHT_HR_INFO =
  'Overnight heart rate varies with fitness, age, medication and device. Lower often reflects fitness, but not always. Compare mainly with your own trend.'

export const HRV_SELF_COMPARE =
  'Compared with you, not a population. Devices measure HRV differently.'

export const SLEEP_RANGE_NOTE = 'Guidelines suggest 7 to 9 hours for adults.'
export const DEEP_SLEEP_RANGE_NOTE = 'Healthy range: about 13 to 23%.'
export const OVERNIGHT_HR_RANGE_NOTE = 'Typical overnight range for adults: about 50 to 75 bpm.'

export const TOP_FALLBACK: Record<'sleep_hours' | 'deep_sleep_min' | 'overnight_hr_bpm', string> = {
  sleep_hours: 'No percentile for sleep duration, so the healthy range applies.',
  deep_sleep_min: 'No percentile available, so the healthy range applies.',
  overnight_hr_bpm: 'No percentile available, so the typical range applies.',
}

// --- VO2max norms (approximate anchors: p25 / p50 / p80) --------------------

interface Vo2Anchors {
  p25: number
  p50: number
  p80: number
}

const VO2_MALE: { minAge: number; a: Vo2Anchors }[] = [
  { minAge: 70, a: { p25: 24, p50: 28, p80: 35 } },
  { minAge: 60, a: { p25: 28, p50: 32, p80: 39 } },
  { minAge: 50, a: { p25: 31, p50: 36, p80: 43 } },
  { minAge: 40, a: { p25: 35, p50: 40, p80: 47 } },
  { minAge: 30, a: { p25: 39, p50: 44, p80: 51 } },
  { minAge: 0, a: { p25: 42, p50: 48, p80: 55 } },
]

const VO2_FEMALE: { minAge: number; a: Vo2Anchors }[] = [
  { minAge: 70, a: { p25: 20, p50: 25, p80: 30 } },
  { minAge: 60, a: { p25: 23, p50: 28, p80: 34 } },
  { minAge: 50, a: { p25: 26, p50: 31, p80: 37 } },
  { minAge: 40, a: { p25: 29, p50: 34, p80: 40 } },
  { minAge: 30, a: { p25: 32, p50: 37, p80: 44 } },
  { minAge: 0, a: { p25: 35, p50: 40, p80: 47 } },
]

export function vo2Anchors(age: number, sex: 'male' | 'female'): Vo2Anchors {
  const table = sex === 'male' ? VO2_MALE : VO2_FEMALE
  return (table.find((b) => age >= b.minAge) ?? table[table.length - 1]).a
}

/** Approximate percentile of a VO2max value for age/sex, 1-99. */
export function vo2Percentile(value: number, age: number, sex: 'male' | 'female'): number {
  const { p25, p50, p80 } = vo2Anchors(age, sex)
  let p: number
  if (value <= p25) p = 25 * Math.max(0, value / p25)
  else if (value <= p50) p = 25 + 25 * ((value - p25) / (p50 - p25))
  else if (value <= p80) p = 50 + 30 * ((value - p50) / (p80 - p50))
  else p = 80 + 19 * Math.min(1, (value - p80) / 12)
  return Math.max(1, Math.min(99, Math.round(p)))
}
