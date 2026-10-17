// Reference bands for the Levels position view: population band plus an
// aspirational ("Bryan Johnson-like" percentile framing) band per metric.
// All bands are pending clinical review and are general wellness information,
// not medical advice. Qualitative bands (vo2max, HRV aspirational) carry no
// numeric low/high; the UI shows their text only.

export type MetricKey =
  | 'weight_lb'
  | 'sleep_hours'
  | 'deep_sleep_min'
  | 'overnight_hr_bpm'
  | 'overnight_hrv_ms'
  | 'vo2max'

export type BandChoice = 'population' | 'aspirational'

export interface RefBand {
  label: string
  source: string
  low?: number
  high?: number
  note?: string
}

export interface MetricRangeDef {
  key: MetricKey
  label: string
  unit: string
  population: RefBand
  aspirational: RefBand
  /** Marked when the number is the softest in the set. */
  soft?: boolean
}

export const pendingClinicalReview = true

export const REFERENCE_DISCLAIMER =
  'Reference bands, pending clinical review. General wellness information, not medical advice.'

export const METRIC_ORDER: MetricKey[] = [
  'weight_lb',
  'sleep_hours',
  'deep_sleep_min',
  'overnight_hr_bpm',
  'overnight_hrv_ms',
  'vo2max',
]

export const REFERENCE_RANGES: Record<MetricKey, MetricRangeDef> = {
  weight_lb: {
    key: 'weight_lb',
    label: 'Weight',
    unit: 'lb',
    population: {
      label: 'BMI 18.5 to 24.9',
      source: 'WHO',
      note: 'Healthy BMI band. Add your height to see your own BMI against this band.',
    },
    aspirational: {
      label: 'BMI 20 to 22',
      source: 'Aspirational percentile framing',
    },
  },
  sleep_hours: {
    key: 'sleep_hours',
    label: 'Sleep',
    unit: 'h',
    population: { label: '7 to 9 hours', source: 'AASM', low: 7, high: 9 },
    aspirational: { label: '8+ hours', source: 'Aspirational percentile framing', low: 8 },
  },
  deep_sleep_min: {
    key: 'deep_sleep_min',
    label: 'Deep sleep',
    unit: 'min',
    population: {
      label: '60 to 120 min',
      source: 'About 13 to 23% of a night',
      low: 60,
      high: 120,
    },
    aspirational: {
      label: '90+ min, or top quartile for age',
      source: 'Aspirational percentile framing',
      low: 90,
    },
  },
  overnight_hr_bpm: {
    key: 'overnight_hr_bpm',
    label: 'Overnight heart rate',
    unit: 'bpm',
    population: {
      label: '60 to 100 bpm, under 60 typical fit',
      source: 'Standard resting heart rate range',
      low: 60,
      high: 100,
    },
    aspirational: {
      label: 'Under 55 bpm',
      source: '"Elite athlete level" percentile framing',
      high: 55,
    },
  },
  overnight_hrv_ms: {
    key: 'overnight_hrv_ms',
    label: 'Overnight HRV',
    unit: 'ms',
    population: {
      label: '20 to 70 ms',
      source: 'Typical adult, highly device-specific',
      low: 20,
      high: 70,
    },
    aspirational: {
      label: 'Top quartile for age on your device',
      source: 'Aspirational percentile framing',
      note: 'Compare only against your own device history.',
    },
    soft: true,
  },
  vo2max: {
    key: 'vo2max',
    label: 'VO2max',
    unit: 'ml/kg/min',
    population: {
      label: '"Good" for your age and sex band',
      source: 'ACSM and Cooper (exact tables pending verification)',
    },
    aspirational: {
      label: 'Top 10% for your age and sex',
      source: 'Aspirational percentile framing',
    },
  },
}
