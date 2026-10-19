// Creates a levels-track experiment run for a template: reuses (or creates)
// the track='levels' protocol row, enforces one-active-run, inserts the
// experiment. Shared by the Levels tab prereg and the onboarding pillar picker.

import { addDays, SPRINT_DAYS } from './levels'
import { todayISO } from './format'

interface TemplateLike {
  level_number: number | null
  title: string
  detail: string
  pillars: string[] | null
  primary_metric?: string | null
}

export async function startLevelExperiment(
  supabase: { from: (t: string) => any },
  userId: string,
  t: TemplateLike,
  hypothesis: string,
): Promise<string> {
  const { data: activeNow, error: aErr } = await supabase
    .from('experiments')
    .select('id')
    .eq('user_id', userId)
    .eq('mode', 'levels')
    .eq('status', 'active')
    .limit(1)
  if (aErr) throw aErr
  if (activeNow && (activeNow as unknown[]).length > 0) {
    throw new Error('A level is already running. Finish it before starting another.')
  }

  let protocolId: string | null = null
  const { data: dup, error: dErr } = await supabase
    .from('protocols')
    .select('id')
    .eq('user_id', userId)
    .eq('track', 'levels')
    .eq('label', t.title)
    .limit(1)
  if (dErr) throw dErr
  protocolId = ((dup as { id: string }[] | null)?.[0]?.id) ?? null

  const pillar = t.pillars?.[0] ?? 'mind'
  if (!protocolId) {
    const { data: last } = await supabase
      .from('protocols')
      .select('position')
      .eq('user_id', userId)
      .eq('pillar', pillar)
      .order('position', { ascending: false })
      .limit(1)
    const pos = ((((last as { position: number }[] | null)?.[0]?.position) ?? -1) + 1)
    const { data: proto, error: pErr } = await supabase
      .from('protocols')
      .insert({
        user_id: userId,
        pillar,
        label: t.title,
        detail: t.detail,
        position: pos,
        track: 'levels',
        enabled: true,
      })
      .select('id')
      .single()
    if (pErr) throw pErr
    protocolId = (proto as { id: string }).id
  }

  const startDate = todayISO()
  const { data: exp, error: eErr } = await supabase
    .from('experiments')
    .insert({
      user_id: userId,
      protocol_id: protocolId,
      title: t.title,
      hypothesis: hypothesis.trim() || t.detail,
      start_date: startDate,
      end_date: addDays(startDate, SPRINT_DAYS - 1),
      duration_days: SPRINT_DAYS,
      baseline_snapshot: [],
      status: 'active',
      mode: 'levels',
      window_days: SPRINT_DAYS,
      observed_days_required: SPRINT_DAYS - 2,
      template_level: t.level_number,
      primary_metric: t.primary_metric ?? null,
    })
    .select('id')
    .single()
  if (eErr) throw eErr
  return (exp as { id: string }).id
}
