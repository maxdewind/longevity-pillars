'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errMsg, type ExperimentTemplate, type LevelsExperiment } from '@/lib/levels'
import { fetchBaselineValues, fetchProfileExtras } from '@/lib/baseline'
import { type MetricKey, REFERENCE_RANGES } from '@/lib/referenceRanges'
import { fmtMD } from '@/lib/format'
import { AllMetrics, type DrawerMetric } from '@/components/sprint/AllMetrics'
import { fmtMetricValue, METRIC_DRAWER_LABELS } from '@/lib/sprint'

type CompareMode = 'off' | 'healthy' | 'top'

export default function StartedPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [primaryUsual, setPrimaryUsual] = useState<number | null>(null)
  const [primarySwing, setPrimarySwing] = useState<number | null>(null)
  const [nightCount, setNightCount] = useState(0)
  const [excludedCount, setExcludedCount] = useState(0)
  const [rangeLabel, setRangeLabel] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [secondaries, setSecondaries] = useState<DrawerMetric[]>([])
  const [drawerMetrics, setDrawerMetrics] = useState<DrawerMetric[]>([])
  const [compare, setCompare] = useState<CompareMode>('off')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }
        const { data: eRow, error: eErr } = await supabase
          .from('experiments').select('*')
          .eq('id', params.id).eq('user_id', user.id).single()
        if (eErr) throw eErr
        const e = eRow as LevelsExperiment
        setExp(e)

        let t: ExperimentTemplate | null = null
        if (e.template_level != null) {
          const { data: tRow } = await supabase
            .from('experiment_templates').select('*')
            .eq('level_number', e.template_level).maybeSingle()
          t = (tRow as ExperimentTemplate | null) ?? null
          setTemplate(t)
        }
        const metricKey = (t?.primary_metric ?? 'sleep_hours') as MetricKey
        const profLb = await fetchProfileExtras(supabase, user.id)
        const lb = profLb.lookback

        const dayVals = await fetchBaselineValues(supabase, user.id, metricKey, e.start_date, lb)
        const vals = dayVals.map((r) => r.value)
        if (vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length
          const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length)
          setPrimaryUsual(avg)
          setPrimarySwing(sd)
        }
        setNightCount(vals.length)
        if (dayVals.length > 0) {
          const sorted = [...dayVals].map((r) => r.date).sort()
          setRangeStart(sorted[0])
          setRangeLabel(sorted[sorted.length - 1])
        }
        // Excluded = lookback window days minus valid nights (failed/implausible watch data).
        setExcludedCount(Math.max(0, lb - vals.length))

        const secKeys = (t?.secondary_metrics ?? []).filter((k) => k !== metricKey).slice(0, 3)
        const secReads = await Promise.all(secKeys.map(async (k) => {
          const bv = await fetchBaselineValues(supabase, user.id, k as MetricKey, e.start_date, lb)
          const vv = bv.map((r) => r.value)
          return {
            key: k,
            value: null,
            usual: vv.length > 0 ? vv.reduce((a, b) => a + b, 0) / vv.length : null,
          } as DrawerMetric
        }))
        setSecondaries(secReads.filter((s) => s.usual != null))

        const drawerKeys = ['sleep_hours', 'bedtime', 'deep_sleep_min', 'overnight_hrv_ms', 'overnight_hr_bpm', 'overnight_spo2', 'weight_lb', 'vo2max']
        const reads = await Promise.all(drawerKeys.map(async (k) => {
          const bv = await fetchBaselineValues(supabase, user.id, k as MetricKey, e.start_date, lb)
          const vv = bv.map((r) => r.value)
          return {
            key: k,
            value: null,
            usual: vv.length > 0 ? vv.reduce((a, b) => a + b, 0) / vv.length : null,
          } as DrawerMetric
        }))
        setDrawerMetrics(reads)
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
  }, [params.id])

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>
  if (error || !exp) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-sm" style={{ color: '#e0607e' }}>{error ?? 'Experiment not found.'}</p>
          <Link href="/experiment/app/protocol" className="btn-primary w-full block text-center mt-4">
            Back to My protocol
          </Link>
        </div>
      </main>
    )
  }

  const metricKey = (template?.primary_metric ?? 'sleep_hours') as string
  const primaryLabel = METRIC_DRAWER_LABELS[metricKey] ?? template?.primary_metric ?? 'Primary'
  const ref = REFERENCE_RANGES[metricKey as MetricKey]

  const compareCaption =
    compare === 'off' || !ref ? null
    : compare === 'healthy'
      ? `Healthy range: ${ref.population.label}`
      : `Top percentile: ${ref.aspirational.label}`

  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Longevity Pillars</p>
      <h1 className="text-4xl font-bold mt-3 leading-tight">This is your starting point</h1>
      {nightCount > 0 && (
        <p className="text-muted mt-2">
          Last {nightCount} valid nights, {fmtMD(rangeStart)} to {fmtMD(rangeLabel)}
        </p>
      )}

      <div className="card mt-6">
        <p className="text-xs uppercase tracking-widest" style={{ color: '#f0506e' }}>
          {primaryLabel} · primary metric
        </p>
        <p className="mt-2">
          <span className="text-5xl font-bold tabular-nums">
            {primaryUsual != null ? fmtMetricValue(metricKey, primaryUsual) : '—'}
          </span>{' '}
          <span className="text-muted text-xl">usual</span>
        </p>
        {primarySwing != null && (
          <p className="text-sm text-muted mt-1">
            typical swing ± {fmtMetricValue(metricKey, primarySwing).replace(/^[−+]?/, '')} · locked for the 7-day sprint
          </p>
        )}
        {compareCaption && (
          <p className="text-sm mt-2" style={{ color: '#e8c468' }}>{compareCaption}</p>
        )}
      </div>

      <div className="card mt-4">
        <p className="text-xs uppercase tracking-widest" style={{ color: '#f0506e' }}>Also tracked</p>
        <div className="mt-3 space-y-2.5">
          {secondaries.map((s) => (
            <div key={s.key} className="flex items-baseline justify-between gap-2">
              <p className="text-muted">{METRIC_DRAWER_LABELS[s.key] ?? s.key}</p>
              <p className="tabular-nums shrink-0">
                <span className="font-bold text-lg">{s.usual != null ? fmtMetricValue(s.key, s.usual) : '—'}</span>{' '}
                <span className="text-sm text-muted">usual</span>
              </p>
            </div>
          ))}
        </div>
        <AllMetrics
          metrics={drawerMetrics.map((m) => ({ ...m, value: m.usual }))}
          primaryKey={metricKey}
          pinned={[]}
          onTogglePin={() => {}}
          totalCount={drawerMetrics.filter((m) => m.usual != null).length}
        />
      </div>

      <p className="font-semibold mt-6 mb-3" style={{ color: '#f0506e' }}>Compare my numbers</p>
      <div className="grid grid-cols-3 rounded-xl overflow-hidden border" style={{ borderColor: '#4a5160' }}>
        {(['off', 'healthy', 'top'] as CompareMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setCompare(m)}
            className="py-3 font-semibold text-sm"
            style={compare === m
              ? { background: '#f0506e', color: '#fff' }
              : { background: 'transparent', color: '#64748b' }}
          >
            {m === 'off' ? 'Off' : m === 'healthy' ? 'Healthy range' : 'Top percentile'}
          </button>
        ))}
      </div>

      {excludedCount > 0 && (
        <p className="text-sm text-muted mt-4">
          {excludedCount} {excludedCount === 1 ? 'night' : 'nights'} excluded: watch data missing
        </p>
      )}

      <button
        type="button"
        onClick={() => router.push(`/experiment/app/levels/${exp.id}`)}
        className="btn-primary w-full mt-10 !py-4 text-lg"
      >
        Review the rule
      </button>
    </main>
  )
}
