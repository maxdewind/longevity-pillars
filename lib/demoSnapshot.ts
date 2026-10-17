import type { SupabaseClient } from '@supabase/supabase-js'
import { todayISO } from './format'

export interface DemoRoutineSnapshot {
  id: string
  label: string
  detail: string
  pillar: string
  card_group: string | null
  is_mandatory: boolean
  is_experimental: boolean
  committed: boolean
  held: boolean
  held_at: string | null
  held14: number
  committed14: number
  days14: number
}

export interface DemoExperimentSnapshot {
  title: string
  hypothesis: string | null
  pillar: string
  start_date: string
  end_date: string
  duration_days: number
  day_number: number
  dots: { date: string; held: boolean }[]
  held_count: number
  weight_anchor_lb: number | null
  weight_latest_lb: number | null
  weight_delta_lb: number | null
  baseline_labels: string[]
  baseline_held_pct: number | null
}

export interface DemoRecordSnapshot {
  total_committed: number
  total_held: number
  routine_stats: { id: string; label: string; committed: number; held: number; days: number; rate: number }[]
  heatmap: { log_date: string; held: number }[]
}

export interface DemoPayload {
  published_at: string
  journey_start: string
  routines: DemoRoutineSnapshot[]
  experiment: DemoExperimentSnapshot | null
  weights: { log_date: string; weight_lb: number }[]
  record: DemoRecordSnapshot
}

const diffDays = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

// Builds the frozen public-demo payload from the owner's live data.
// Called only from the owner's own session when he taps Publish.
export async function buildDemoSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<DemoPayload> {
  const today = todayISO()

  const { data: attemptRows } = await supabase
    .from('attempts')
    .select('started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
  let journeyStart = (attemptRows?.[0]?.started_at as string | undefined)?.slice(0, 10)
  if (!journeyStart) {
    const { data: firstCheck } = await supabase
      .from('protocol_checks')
      .select('log_date')
      .eq('user_id', userId)
      .order('log_date', { ascending: true })
      .limit(1)
    journeyStart = ((firstCheck?.[0]?.log_date as string | undefined) ?? today)
  }

  const { data: protos } = await supabase
    .from('protocols')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('position', { ascending: true })

  const { data: todayRows } = await supabase
    .from('protocol_checks')
    .select('protocol_id, committed, held, held_at')
    .eq('user_id', userId)
    .eq('log_date', today)
  const todayMap: Record<string, { committed: boolean; held: boolean; held_at: string | null }> = {}
  ;((todayRows as { protocol_id: string; committed: boolean; held: boolean; held_at: string | null }[] | null) ?? []).forEach((r) => {
    todayMap[r.protocol_id] = { committed: !!r.committed, held: !!r.held, held_at: r.held_at ?? null }
  })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 13)
  const { data: recent } = await supabase
    .from('protocol_checks')
    .select('protocol_id, committed, held, log_date')
    .eq('user_id', userId)
    .gte('log_date', todayISO(cutoff))
  const recentRows = ((recent as { protocol_id: string; committed: boolean; held: boolean; log_date: string }[] | null) ?? [])

  const routines: DemoRoutineSnapshot[] = (((protos as Record<string, unknown>[] | null) ?? [])).map((p) => {
    const t = todayMap[p.id as string] ?? { committed: false, held: false, held_at: null }
    const pr = recentRows.filter((r) => r.protocol_id === p.id)
    return {
      id: p.id as string,
      label: p.label as string,
      detail: p.detail as string,
      pillar: p.pillar as string,
      card_group: (p.card_group as string | null) ?? null,
      is_mandatory: !!p.is_mandatory,
      is_experimental: !!p.is_experimental,
      committed: t.committed,
      held: t.held,
      held_at: t.held_at,
      held14: pr.filter((r) => r.held).length,
      committed14: pr.filter((r) => r.committed).length,
      days14: 14,
    }
  })

  const { data: expRows } = await supabase
    .from('experiments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  const expRow = ((expRows as Record<string, unknown>[] | null) ?? [])[0] as
    | {
        protocol_id: string
        title: string
        hypothesis: string | null
        start_date: string
        end_date: string
        duration_days: number
        baseline_snapshot: { id: string; label: string }[]
      }
    | undefined

  let experiment: DemoExperimentSnapshot | null = null
  if (expRow) {
    const proto = (protos as Record<string, unknown>[] | null)?.find((p) => p.id === expRow.protocol_id)
    const end = today < expRow.end_date ? today : expRow.end_date
    const dayNumber = Math.min(Math.max(diffDays(expRow.start_date, end) + 1, 1), expRow.duration_days)
    const dayList = Array.from({ length: expRow.duration_days }, (_, i) => addDays(expRow.start_date, i))
    const { data: checkRows } = await supabase
      .from('protocol_checks')
      .select('log_date, held')
      .eq('user_id', userId)
      .eq('protocol_id', expRow.protocol_id)
      .gte('log_date', expRow.start_date)
      .lte('log_date', end)
    const heldByDay: Record<string, boolean> = {}
    ;((checkRows as { log_date: string; held: boolean }[] | null) ?? []).forEach((c) => {
      heldByDay[c.log_date] = !!c.held
    })
    const dots = dayList.map((d) => ({ date: d, held: !!heldByDay[d] }))

    const { data: wrows } = await supabase
      .from('weight_logs')
      .select('log_date, weight_lb')
      .eq('user_id', userId)
      .gte('log_date', expRow.start_date)
      .lte('log_date', end)
      .order('log_date', { ascending: true })
    const wlist = ((wrows as { log_date: string; weight_lb: number }[] | null) ?? [])
    const anchor = wlist[0] ?? null
    const latest = wlist[wlist.length - 1] ?? null

    const baseIds = (expRow.baseline_snapshot ?? []).map((b) => b.id)
    let baselineHeldPct: number | null = null
    if (baseIds.length > 0) {
      const { data: bchecks } = await supabase
        .from('protocol_checks')
        .select('protocol_id, held')
        .eq('user_id', userId)
        .in('protocol_id', baseIds)
        .gte('log_date', expRow.start_date)
        .lte('log_date', end)
      const list = ((bchecks as { protocol_id: string; held: boolean }[] | null) ?? [])
      const daysElapsed = diffDays(expRow.start_date, end) + 1
      const denom = baseIds.length * daysElapsed
      baselineHeldPct = denom > 0 ? list.filter((c) => c.held).length / denom : null
    }

    experiment = {
      title: expRow.title,
      hypothesis: expRow.hypothesis ?? null,
      pillar: (proto?.pillar as string | undefined) ?? 'nutrition',
      start_date: expRow.start_date,
      end_date: expRow.end_date,
      duration_days: expRow.duration_days,
      day_number: dayNumber,
      dots,
      held_count: dots.filter((d) => d.held).length,
      weight_anchor_lb: anchor ? anchor.weight_lb : null,
      weight_latest_lb: latest ? latest.weight_lb : null,
      weight_delta_lb: anchor && latest ? latest.weight_lb - anchor.weight_lb : null,
      baseline_labels: (expRow.baseline_snapshot ?? []).map((b) => b.label),
      baseline_held_pct: baselineHeldPct,
    }
  }

  const { data: allWeights } = await supabase
    .from('weight_logs')
    .select('log_date, weight_lb')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(60)
  const weights = (((allWeights as { log_date: string; weight_lb: number }[] | null) ?? []).reverse()).map((w) => ({
    log_date: w.log_date,
    weight_lb: w.weight_lb,
  }))

  // Record tab: all-time per-routine stats + per-day held totals for the heatmap.
  const { data: allChecks } = await supabase
    .from('protocol_checks')
    .select('protocol_id, log_date, committed, held')
    .eq('user_id', userId)
  const checkRows = ((allChecks as { protocol_id: string; log_date: string; committed: boolean; held: boolean }[] | null) ?? [])
  const routineStats = routines.map((r) => {
    const pr = checkRows.filter((c) => c.protocol_id === r.id)
    const days = new Set(pr.map((c) => c.log_date)).size
    const held = pr.filter((c) => c.held).length
    return {
      id: r.id,
      label: r.label,
      committed: pr.filter((c) => c.committed).length,
      held,
      days,
      rate: days > 0 ? Math.round((held / days) * 100) : 0,
    }
  })
  const heatByDate = new Map<string, number>()
  checkRows.forEach((c) => {
    if (c.held) heatByDate.set(c.log_date, (heatByDate.get(c.log_date) ?? 0) + 1)
    else if (!heatByDate.has(c.log_date)) heatByDate.set(c.log_date, 0)
  })
  const heatmap = Array.from(heatByDate.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([log_date, held]) => ({ log_date, held }))

  return {
    published_at: new Date().toISOString(),
    journey_start: journeyStart,
    routines,
    experiment,
    weights,
    record: {
      total_committed: checkRows.filter((c) => c.committed).length,
      total_held: checkRows.filter((c) => c.held).length,
      routine_stats: routineStats,
      heatmap,
    },
  }
}
