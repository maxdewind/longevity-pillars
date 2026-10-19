'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayISO, fmtMD } from '@/lib/format'
import {
  SPRINT_DAYS, SPRINT_EXTEND_DAYS, SPRINT_HELD_TO_KEEP,
  addDays, diffDays, errMsg,
  METRIC_LABELS,
  type ExperimentTemplate, type LevelsExperiment,
} from '@/lib/levels'
import { fetchBaselineValues, fetchProfileExtras } from '@/lib/baseline'
import { loadRunPrefs } from '@/lib/runPrefs'
import { type MetricKey } from '@/lib/referenceRanges'
import DayDots from '@/components/sprint/DayDots'
import { AllMetrics, EvidenceTag, type DrawerMetric } from '@/components/sprint/AllMetrics'
import {
  sprintVerdict, evidenceTier,
  fmtMetricValue, fmtChangeVsUsual, fmtDeltaShort, withinUsualSwing,
  fmtHeldNights, BLOCKER_CHIPS, SUSTAINABILITY_LABELS,
  METRIC_DRAWER_LABELS, type SustainabilityKey,
} from '@/lib/sprint'
import { startLevelExperiment } from '@/lib/levelStart'

/** "10:30 PM" or "lights out by 10:30 pm" -> 22.5. Null when unparseable. */
function parseRuleHour(text: string): number | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i)
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toLowerCase() === 'p') h += 12
  return h + Number(m[2]) / 60
}

interface DayEntry { entry_date: string; value: number }

export default function LevelRunPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [exp, setExp] = useState<LevelsExperiment | null>(null)
  const [template, setTemplate] = useState<ExperimentTemplate | null>(null)
  const [dayHeldManual, setDayHeldManual] = useState<Record<string, boolean>>({})
  const [bedtimeByDate, setBedtimeByDate] = useState<DayEntry[]>([])
  const [heldToday, setHeldToday] = useState(false)
  const [committedToday, setCommittedToday] = useState(false)
  const [baselineAvg, setBaselineAvg] = useState<number | null>(null)
  const [baselineSd, setBaselineSd] = useState<number | null>(null)
  const [baselineCount, setBaselineCount] = useState(0)
  const [primaryEntries, setPrimaryEntries] = useState<DayEntry[]>([])
  const [drawerMetrics, setDrawerMetrics] = useState<DrawerMetric[]>([])
  const [alsoMoved, setAlsoMoved] = useState<DrawerMetric[]>([])
  const [pinned, setPinned] = useState<string[]>([])
  const [sustainability, setSustainability] = useState<SustainabilityKey | null>(null)
  const [blockers, setBlockers] = useState<string[]>([])
  const [morningCommitment, setMorningCommitment] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setPinned((e.pinned_metrics as string[] | null) ?? [])
      setSustainability((e.sustainability as SustainabilityKey | null) ?? null)
      setBlockers((e.blockers as string[] | null) ?? [])

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          await fetch('/api/apple-health-sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        }
      } catch { /* read what's in the DB */ }

      let t: ExperimentTemplate | null = null
      if (e.template_level != null) {
        const { data: tRow } = await supabase
          .from('experiment_templates').select('*')
          .eq('level_number', e.template_level).maybeSingle()
        t = (tRow as ExperimentTemplate | null) ?? null
      }
      setTemplate(t)

      const today = todayISO()
      const windowEnd = today < e.end_date ? today : e.end_date
      const metricKey = ((e.primary_metric as MetricKey | null) ?? t?.primary_metric ?? 'sleep_hours') as MetricKey
      const profLb = await fetchProfileExtras(supabase, user.id)
      const lb = profLb.lookback

      // Starting point (usual + swing + count).
      const baselineDayVals = await fetchBaselineValues(supabase, user.id, metricKey as MetricKey, e.start_date, lb)
      const bVals = baselineDayVals.map((r) => r.value)
      if (bVals.length > 0) {
        const avg = bVals.reduce((a, b) => a + b, 0) / bVals.length
        const sd = Math.sqrt(bVals.reduce((a, b) => a + (b - avg) ** 2, 0) / bVals.length)
        setBaselineAvg(avg)
        setBaselineSd(sd)
      }
      setBaselineCount(bVals.length)

      // In-window primary entries.
      const { data: entries } = await supabase
        .from('metric_entries').select('entry_date, value')
        .eq('user_id', user.id).eq('metric_key', metricKey)
        .gte('entry_date', e.start_date).lte('entry_date', windowEnd)
        .order('entry_date')
      const prim = ((entries as DayEntry[] | null) ?? []).map((r) => ({ entry_date: r.entry_date, value: Number(r.value) }))
      setPrimaryEntries(prim)

      // Bedtime entries for watch-verifiable derivation.
      if (t?.watch_verifiable) {
        const { data: bt } = await supabase
          .from('metric_entries').select('entry_date, value')
          .eq('user_id', user.id).eq('metric_key', 'bedtime')
          .gte('entry_date', e.start_date).lte('entry_date', addDays(e.end_date, 1))
          .order('entry_date')
        setBedtimeByDate(((bt as DayEntry[] | null) ?? []).map((r) => ({ entry_date: r.entry_date, value: Number(r.value) })))
      }

      // Manual checks.
      const { data: checks } = await supabase
        .from('protocol_checks').select('log_date, held, committed')
        .eq('user_id', user.id).eq('protocol_id', e.protocol_id)
        .gte('log_date', e.start_date).lte('log_date', windowEnd)
      const heldMap: Record<string, boolean> = {}
      let committed = false
      ;((checks as { log_date: string; held: boolean; committed: boolean }[] | null) ?? []).forEach((c) => {
        heldMap[c.log_date] = c.held
        if (c.log_date === today && c.committed) committed = true
      })
      setDayHeldManual(heldMap)
      setCommittedToday(committed)

      // Drawer + Also moved metrics.
      const drawerKeys = ['sleep_hours', 'bedtime', 'deep_sleep_min', 'overnight_hrv_ms', 'overnight_hr_bpm', 'overnight_spo2', 'weight_lb', 'vo2max']
      const reads = await Promise.all(drawerKeys.map(async (k) => {
        const [b, { data: sEntries }] = await Promise.all([
          fetchBaselineValues(supabase, user.id, k as MetricKey, e.start_date, lb),
          supabase.from('metric_entries').select('entry_date, value')
            .eq('user_id', user.id).eq('metric_key', k)
            .gte('entry_date', e.start_date).lte('entry_date', windowEnd).order('entry_date'),
        ])
        const bv = b.map((r) => r.value)
        const sv = ((sEntries as DayEntry[] | null) ?? []).map((r) => Number(r.value))
        return {
          key: k,
          value: sv.length > 0 ? sv[sv.length - 1] : null,
          usual: bv.length > 0 ? bv.reduce((a, x) => a + x, 0) / bv.length : null,
        } as DrawerMetric
      }))
      setDrawerMetrics(reads)
      const pinList = (e.pinned_metrics as string[] | null) ?? []
      const alsoKeys = pinList.length > 0
        ? pinList
        : (t?.secondary_metrics ?? []).filter((k) => k !== metricKey).slice(0, 3)
      setAlsoMoved(alsoKeys.map((k) => reads.find((r) => r.key === k)).filter((m): m is DrawerMetric => !!m && m.value != null))
    } catch (e) {
      setError(errMsg(e))
    }
    setLoaded(true)
  }

  useEffect(() => {
    setMorningCommitment(loadRunPrefs().morningCommitment)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>
  if (error && !exp) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>
        <Link href="/experiment/app/protocol" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to My protocol</Link>
      </main>
    )
  }
  if (!exp) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <p className="text-sm text-muted">Experiment not found.</p>
        <Link href="/experiment/app/protocol" className="btn mt-4 inline-block" style={{ textDecoration: 'none' }}>Back to My protocol</Link>
      </main>
    )
  }

  const today = todayISO()
  const windowDays = exp.window_days ?? SPRINT_DAYS
  const dayNum = Math.min(Math.max(diffDays(exp.start_date, today) + 1, 1), windowDays)
  const windowEnded = today > exp.end_date
  const metricKey = ((exp.primary_metric as MetricKey | null) ?? template?.primary_metric ?? 'sleep_hours') as MetricKey
  const metricMeta = METRIC_LABELS[metricKey]

  // Current ramp step rule (smaller-rule flow) or the template rule.
  const rampSteps = (exp.ramp_steps as { label: string; detail: string }[] | null) ?? null
  const rampStep = exp.ramp_step ?? null
  const stepDetail = rampSteps && rampStep != null && rampSteps[rampStep] ? rampSteps[rampStep].detail : null
  const ruleDetail = stepDetail ?? template?.detail ?? exp.hypothesis ?? ''
  const ruleHour = parseRuleHour(stepDetail ?? template?.detail ?? '')

  // Effective held: manual taps win; watch-verifiable rules fill gaps from the metric.
  const derivedHeld: Record<string, boolean> = {}
  if (template?.watch_verifiable && ruleHour != null) {
    const byWake = new Map(bedtimeByDate.map((r) => [r.entry_date, r.value]))
    for (let i = 0; i < windowDays; i++) {
      const night = addDays(exp.start_date, i)
      const wake = addDays(exp.start_date, i + 1)
      const bt = byWake.get(wake)
      if (bt != null && Number.isFinite(bt)) derivedHeld[night] = bt <= ruleHour
    }
  }
  const effectiveHeld: Record<string, boolean> = { ...derivedHeld }
  Object.entries(dayHeldManual).forEach(([d, v]) => { effectiveHeld[d] = v })
  const heldCount = Object.values(effectiveHeld).filter(Boolean).length

  const usual = baselineAvg
  const swing = baselineSd
  const values = primaryEntries.map((r) => r.value)
  const sprintAvg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
  const latestVal = values.length > 0 ? values[values.length - 1] : null
  const verdict = sprintVerdict(heldCount, windowDays)
  const hasSignal = sprintAvg != null && usual != null && swing != null
    ? Math.abs(sprintAvg - usual) > swing
    : null
  const outcome: 'held' | 'held_no_signal' | 'not_held' =
    verdict === 'not_held' ? 'not_held' : (hasSignal === false ? 'held_no_signal' : 'held')

  const mode: 'active' | 'early' | 'verdict' =
    windowEnded ? 'verdict' : dayNum < 3 ? 'active' : 'early'

  const upsertCheck = async (patch: { held?: boolean; committed?: boolean }) => {
    if (acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const { error } = await supabase.from('protocol_checks').upsert(
        { user_id: user.id, protocol_id: exp.protocol_id, log_date: today, ...patch },
        { onConflict: 'user_id,protocol_id,log_date' },
      )
      if (error) throw error
    } catch (e) {
      setError(errMsg(e))
    }
    setActing(false)
  }

  const markHeld = async (held: boolean) => {
    await upsertCheck({ held })
    setHeldToday(held)
    setDayHeldManual((prev) => ({ ...prev, [today]: held }))
  }

  const toggleCommitted = async () => {
    const next = !committedToday
    await upsertCheck({ committed: next })
    setCommittedToday(next)
  }

  const savePins = async (next: string[]) => {
    setPinned(next)
    const supabase = createClient()
    await supabase.from('experiments').update({ pinned_metrics: next }).eq('id', exp.id)
  }

  const togglePin = (key: string) => {
    const next = pinned.includes(key)
      ? pinned.filter((k) => k !== key)
      : pinned.length >= 3 ? pinned : [...pinned, key]
    savePins(next)
    // Refresh the Also moved rows.
    const reads = drawerMetrics
    const alsoKeys = next.length > 0 ? next : (template?.secondary_metrics ?? []).filter((k) => k !== metricKey).slice(0, 3)
    setAlsoMoved(alsoKeys.map((k) => reads.find((r) => r.key === k)).filter((m): m is DrawerMetric => !!m && m.value != null))
  }

  const saveBlockers = async (next: string[]) => {
    setBlockers(next)
    const supabase = createClient()
    await supabase.from('experiments').update({ blockers: next }).eq('id', exp.id)
  }

  const toggleBlocker = (b: string) => {
    const next = blockers.includes(b) ? blockers.filter((x) => x !== b) : [...blockers, b]
    saveBlockers(next)
  }

  const saveSustainability = async (s: SustainabilityKey) => {
    setSustainability(s)
    const supabase = createClient()
    await supabase.from('experiments').update({ sustainability: s }).eq('id', exp.id)
  }

  const doExtend = async () => {
    if (acting) return
    if (!confirm('Extend this sprint by 3 days?')) return
    setActing(true)
    try {
      const supabase = createClient()
      const newEnd = addDays(exp.end_date, SPRINT_EXTEND_DAYS)
      const newWindow = windowDays + SPRINT_EXTEND_DAYS
      const { error } = await supabase.from('experiments').update({
        end_date: newEnd,
        window_days: newWindow,
        observed_days_required: newWindow - 2,
        duration_days: (exp.duration_days ?? windowDays) + SPRINT_EXTEND_DAYS,
        extended_days: (exp.extended_days ?? 0) + SPRINT_EXTEND_DAYS,
      }).eq('id', exp.id)
      if (error) throw error
      window.location.reload()
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const doKeep = async () => {
    if (acting) return
    setActing(true)
    try {
      const supabase = createClient()
      // Ramp step advance: a new 7-day window at the next step.
      if (rampSteps && rampStep != null && rampStep < rampSteps.length - 1) {
        const nextStep = rampStep + 1
        const newStart = today
        const { error } = await supabase.from('experiments').update({
          start_date: newStart,
          end_date: addDays(newStart, SPRINT_DAYS - 1),
          duration_days: SPRINT_DAYS,
          window_days: SPRINT_DAYS,
          observed_days_required: SPRINT_DAYS - 2,
          ramp_step: nextStep,
          verdict: null,
          sustainability: null,
          blockers: [],
          extended_days: 0,
        }).eq('id', exp.id)
        if (error) throw error
        const { error: pErr } = await supabase.from('protocols').update({
          label: exp.title,
          detail: rampSteps[nextStep].detail,
        }).eq('id', exp.protocol_id)
        if (pErr) throw pErr
        window.location.reload()
        return
      }
      const { error } = await supabase.from('experiments').update({
        status: 'maintained',
        verdict: outcome,
        sustainability: sustainability,
        reread_date: addDays(today, 28),
      }).eq('id', exp.id)
      if (error) throw error
      router.push('/experiment/app/protocol')
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const finishAndGo = async (nextStatus: 'done', nextVerdict: string, go: string) => {
    if (acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('experiments').update({
        status: nextStatus,
        verdict: nextVerdict,
        sustainability: sustainability,
      }).eq('id', exp.id)
      if (error) throw error
      router.push(go)
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const doTryAgain = async () => {
    if (acting || !template) return
    setActing(true)
    try {
      const supabase = createClient()
      await supabase.from('experiments').update({
        status: 'done', verdict: 'not_held', sustainability: sustainability,
      }).eq('id', exp.id)
      const newId = await startLevelExperiment(
        supabase, exp.user_id,
        { level_number: template.level_number, title: template.title, detail: template.detail, pillars: template.pillars },
        exp.hypothesis ?? template.detail,
      )
      router.push(`/experiment/app/levels/${newId}`)
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const watchAuto = !!template?.watch_verifiable

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      {/* Experiment name on its own line, max two lines. */}
      <h1 className="text-xl font-bold leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {exp.title}
      </h1>
      {ruleDetail && <p className="text-sm text-muted mt-1">Rule: {ruleDetail}</p>}

      {mode === 'verdict' ? (
        <VerdictView
          exp={exp} heldCount={heldCount} windowDays={windowDays}
          sprintAvg={sprintAvg} usual={usual} swing={swing}
          outcome={outcome} metricKey={metricKey}
          primaryEntries={primaryEntries} effectiveHeld={effectiveHeld}
          sustainability={sustainability} onSustainability={saveSustainability}
          blockers={blockers} onToggleBlocker={toggleBlocker}
          drawerMetrics={drawerMetrics} pinned={pinned} onTogglePin={togglePin}
          alsoMoved={alsoMoved}
          rampSteps={rampSteps} rampStep={rampStep}
          acting={acting}
          onExtend={doExtend} onKeep={doKeep} onTryAgain={doTryAgain}
          onSmaller={() => router.push(`/experiment/app/levels/${exp.id}/smaller`)}
          onSetAside={() => finishAndGo('done', 'not_held', '/experiment/app/protocol')}
          tier={evidenceTier({ extendedDays: exp.extended_days ?? 0, rereadConfirmed: false })}
        />
      ) : (
        <>
          <h2 className="text-3xl font-bold mt-4">
            Day {dayNum} of {windowDays}{mode === 'early' ? ': on track' : ''}
          </h2>
          <DayDots startDate={exp.start_date} windowDays={windowDays} dayHeld={effectiveHeld} today={today} />
          <p className="text-sm text-muted mt-3">
            {fmtHeldNights(heldCount, Math.min(dayNum, windowDays))} so far
          </p>

          {mode === 'early' && (
            <div className="card mt-5">
              <p className="text-xs text-muted uppercase tracking-widest">{metricMeta.label} · primary</p>
              <p className="text-4xl font-bold tabular-nums mt-2">
                {latestVal != null ? fmtMetricValue(metricKey, latestVal) : '—'}
              </p>
              {usual != null && latestVal != null && (
                <p className="text-sm text-muted mt-1">
                  {fmtChangeVsUsual(metricKey, latestVal, usual)}
                  {withinUsualSwing(latestVal, usual, swing) ? ', within your usual swing' : ''}
                </p>
              )}
            </div>
          )}

          <div className="card mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted uppercase tracking-widest">Also moved</p>
            </div>
            {alsoMoved.length === 0 ? (
              <p className="text-sm text-muted mt-2">No secondary readings yet.</p>
            ) : (
              <div className="mt-2 space-y-2.5">
                {alsoMoved.map((m) => (
                  <div key={m.key} className="flex items-baseline justify-between gap-2">
                    <p>{METRIC_DRAWER_LABELS[m.key] ?? m.key}</p>
                    <p className="tabular-nums shrink-0">
                      <span className="font-bold text-lg">{fmtMetricValue(m.key, m.value!)}</span>
                      {m.usual != null && (
                        <span className="text-sm text-muted ml-2">{fmtDeltaShort(m.key, m.value! - m.usual)}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {mode === 'early' && (
              <p className="text-sm text-muted mt-3">
                Change vs your usual. Too noisy to judge at {dayNum} {dayNum === 1 ? 'night' : 'nights'}.
              </p>
            )}
            <AllMetrics
              metrics={drawerMetrics}
              primaryKey={metricKey}
              pinned={pinned}
              onTogglePin={togglePin}
              totalCount={drawerMetrics.filter((m) => m.value != null).length}
            />
          </div>

          {/* Tonight's log */}
          <div className="mt-8">
            {watchAuto ? (
              <p className="text-sm text-muted text-center">
                Checked automatically by your watch. No taps needed.
              </p>
            ) : (
              <>
                {morningCommitment && !committedToday && (
                  <button
                    type="button"
                    onClick={toggleCommitted}
                    disabled={acting}
                    className="btn w-full"
                  >
                    Commit to tonight
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markHeld(true)}
                  disabled={acting}
                  className="btn-primary w-full mt-3 !py-4 text-lg"
                >
                  Held tonight
                </button>
                <button
                  type="button"
                  onClick={() => markHeld(false)}
                  disabled={acting}
                  className="btn w-full mt-3 !py-4 text-lg"
                >
                  Not held
                </button>
              </>
            )}
          </div>
        </>
      )}
      {error && <p className="text-sm mt-3" style={{ color: '#e0607e' }}>{error}</p>}
    </main>
  )
}

/** Day-7 verdict screens (held and not-held). */
function VerdictView(args: {
  exp: LevelsExperiment
  heldCount: number
  windowDays: number
  sprintAvg: number | null
  usual: number | null
  swing: number | null
  outcome: 'held' | 'held_no_signal' | 'not_held'
  metricKey: string
  primaryEntries: DayEntry[]
  effectiveHeld: Record<string, boolean>
  sustainability: SustainabilityKey | null
  onSustainability: (s: SustainabilityKey) => void
  blockers: string[]
  onToggleBlocker: (b: string) => void
  drawerMetrics: DrawerMetric[]
  pinned: string[]
  onTogglePin: (k: string) => void
  alsoMoved: DrawerMetric[]
  rampSteps: { label: string; detail: string }[] | null
  rampStep: number | null
  acting: boolean
  onExtend: () => void
  onKeep: () => void
  onTryAgain: () => void
  onSmaller: () => void
  onSetAside: () => void
  tier: 'Early' | 'Moderate' | 'Strong'
}) {
  const {
    exp, heldCount, windowDays, sprintAvg, usual, swing, outcome, metricKey,
    primaryEntries, effectiveHeld, sustainability, onSustainability,
    blockers, onToggleBlocker, drawerMetrics, pinned, onTogglePin, alsoMoved,
    rampSteps, rampStep, acting, onExtend, onKeep, onTryAgain, onSmaller, onSetAside, tier,
  } = args
  const today = todayISO()
  const metricMeta = METRIC_LABELS[metricKey as keyof typeof METRIC_LABELS]
  const isRamp = rampSteps != null && rampStep != null
  const atFinalStep = !isRamp || rampStep === rampSteps.length - 1
  const nextStepLabel = isRamp && !atFinalStep ? rampSteps[rampStep + 1].label : null

  // Held vs not-held nightly comparison (needs 2+ nights with data in each group).
  let heldAvg: number | null = null
  let notHeldAvg: number | null = null
  if (outcome === 'not_held') {
    const byDate = new Map(primaryEntries.map((r) => [r.entry_date, r.value]))
    const hv: number[] = []
    const nv: number[] = []
    for (let i = 0; i < windowDays; i++) {
      const d = addDays(exp.start_date, i)
      const v = byDate.get(d)
      if (v == null) continue
      if (effectiveHeld[d]) hv.push(v)
      else nv.push(v)
    }
    if (hv.length >= 2 && nv.length >= 2) {
      heldAvg = hv.reduce((a, b) => a + b, 0) / hv.length
      notHeldAvg = nv.reduce((a, b) => a + b, 0) / nv.length
    }
  }

  if (outcome === 'not_held') {
    return (
      <div className="mt-6">
        <div className="card" style={{ background: '#262a35' }}>
          <div className="flex items-center gap-4">
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <span className="text-2xl text-muted">↻</span>
            </span>
            <div>
              <p className="text-2xl font-bold">Good data</p>
              <p className="text-sm text-muted mt-1">
                Day {windowDays} done. Held {heldCount} of {windowDays} nights. Nothing failed here, you learned something.
              </p>
            </div>
          </div>
        </div>

        <DayDots startDate={exp.start_date} windowDays={windowDays} dayHeld={effectiveHeld} today={today} />

        <div className="card mt-5">
          <p className="text-xs text-muted uppercase tracking-widest" style={{ color: '#f0506e' }}>What the data says</p>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-muted">{windowDays}-night average</p>
              <p className="font-bold tabular-nums">
                {sprintAvg != null ? fmtMetricValue(metricKey, sprintAvg) : '—'}
                {usual != null && <span className="font-normal text-muted"> (usual {fmtMetricValue(metricKey, usual)})</span>}
              </p>
            </div>
            {heldAvg != null && notHeldAvg != null && (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-muted">Nights held</p>
                  <p className="font-bold tabular-nums">{fmtMetricValue(metricKey, heldAvg)}</p>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-muted">Nights not held</p>
                  <p className="font-bold tabular-nums">{fmtMetricValue(metricKey, notHeldAvg)}</p>
                </div>
                <p className="text-sm text-muted">
                  You averaged {fmtMetricValue(metricKey, Math.abs(heldAvg - notHeldAvg))} {heldAvg >= notHeldAvg ? 'more' : 'less'} on the nights you held it.
                </p>
              </>
            )}
          </div>
        </div>

        <p className="font-semibold mt-6 mb-3" style={{ color: '#f0506e' }}>What got in the way?</p>
        <div className="flex flex-wrap gap-2">
          {BLOCKER_CHIPS.map((b) => {
            const on = blockers.includes(b)
            return (
              <button
                key={b}
                type="button"
                onClick={() => onToggleBlocker(b)}
                className="rounded-full px-4 py-2 text-sm font-semibold border"
                style={on
                  ? { background: '#f0506e', borderColor: '#f0506e', color: '#fff' }
                  : { borderColor: '#4a5160', color: '#9aa0ae' }}
              >
                {b}
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onTryAgain} disabled={acting} className="btn-primary w-full mt-4 !py-4 text-lg">
          Try again, same rule
        </button>
        <button type="button" onClick={onSmaller} disabled={acting} className="btn w-full mt-3 !py-4 text-lg">
          Make the rule smaller
        </button>
        <p className="text-center mt-5">
          <button type="button" onClick={onSetAside} disabled={acting} className="text-muted underline underline-offset-4">
            Set it aside
          </button>
        </p>
        <p className="text-sm text-muted text-center mt-4">
          No rule was added to My protocol. Pick one to move on.
        </p>
      </div>
    )
  }

  // Held (or held but no signal yet).
  return (
    <div className="mt-6">
      <div className="card" style={{ background: 'rgba(240,80,110,0.12)', borderColor: 'rgba(240,80,110,0.4)' }}>
        <div className="flex items-center gap-4">
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#f0506e' }}
          >
            <span className="text-2xl text-white">✓</span>
          </span>
          <div>
            <p className="text-2xl font-bold">Experiment complete</p>
            <p className="text-sm text-muted mt-1">
              Day {windowDays} done. You committed and held it. Nice work.
            </p>
          </div>
        </div>
      </div>

      <DayDots startDate={exp.start_date} windowDays={windowDays} dayHeld={effectiveHeld} today={today} />
      <p className="text-sm text-muted mt-3">{fmtHeldNights(heldCount, windowDays)}</p>

      <div className="card mt-5">
        <p className="text-xs text-muted uppercase tracking-widest" style={{ color: '#f0506e' }}>
          {metricMeta.label} · primary
        </p>
        <p className="text-4xl font-bold tabular-nums mt-2">
          {sprintAvg != null ? fmtMetricValue(metricKey, sprintAvg) : '—'}
        </p>
        {sprintAvg != null && usual != null && (
          <p className="text-sm text-muted mt-1">
            {windowDays}-night average, {fmtChangeVsUsual(metricKey, sprintAvg, usual)}
          </p>
        )}
        {outcome === 'held_no_signal' && (
          <p className="text-sm mt-2" style={{ color: '#e8c468' }}>
            Held, but no signal yet: the move stayed within your usual swing.
          </p>
        )}
      </div>

      <div className="card mt-4">
        <EvidenceTag tier={tier} />
      </div>

      <div className="card mt-4">
        <p className="text-xs text-muted uppercase tracking-widest" style={{ color: '#f0506e' }}>
          Also moved, change vs usual
        </p>
        {alsoMoved.length === 0 ? (
          <p className="text-sm text-muted mt-2">No secondary readings yet.</p>
        ) : (
          <div className="mt-2 space-y-2.5">
            {alsoMoved.map((m) => (
              <div key={m.key} className="flex items-baseline justify-between gap-2">
                <p>{METRIC_DRAWER_LABELS[m.key] ?? m.key}</p>
                <p className="tabular-nums shrink-0">
                  <span className="font-bold text-lg">{fmtMetricValue(m.key, m.value!)}</span>
                  {m.usual != null && (
                    <span className="text-sm text-muted ml-2">{fmtDeltaShort(m.key, m.value! - m.usual)}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
        <AllMetrics
          metrics={drawerMetrics}
          primaryKey={metricKey}
          pinned={pinned}
          onTogglePin={onTogglePin}
          totalCount={drawerMetrics.filter((m) => m.value != null).length}
        />
      </div>

      <p className="text-muted mt-6 mb-3">Was it easy to keep?</p>
      <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border" style={{ borderColor: '#4a5160' }}>
        {(Object.keys(SUSTAINABILITY_LABELS) as SustainabilityKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onSustainability(k)}
            className="py-3 font-semibold"
            style={sustainability === k
              ? { background: '#f0506e', color: '#fff' }
              : { background: 'transparent', color: '#9aa0ae' }}
          >
            {SUSTAINABILITY_LABELS[k]}
          </button>
        ))}
      </div>

      <button type="button" onClick={onKeep} disabled={acting} className="btn-primary w-full mt-6 !py-4 text-lg">
        {nextStepLabel ? `Move to ${nextStepLabel}` : 'Keep in My protocol'}
      </button>
      <button type="button" onClick={onExtend} disabled={acting} className="btn w-full mt-3 !py-4 text-lg">
        Extend 3 days
      </button>
    </div>
  )
}
