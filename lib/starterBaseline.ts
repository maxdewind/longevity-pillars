// Seeds the 4 starter baseline rules (track='levels') for a user who does not
// have any yet. Idempotent: returns immediately when levels-track protocols exist.
import { todayISO } from './format'

export async function ensureStarterBaseline(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  const { data: existing, error: eErr } = await supabase
    .from('protocols')
    .select('id')
    .eq('user_id', userId)
    .eq('track', 'levels')
    .limit(1)
  if (eErr) throw eErr
  if (existing && (existing as unknown[]).length > 0) return

  const { data: lib, error: lErr } = await supabase
    .from('protocol_library')
    .select('*')
    .eq('starter', true)
    .order('sort_order', { ascending: true })
  if (lErr) throw lErr
  const rules = ((lib as Record<string, any>[] | null) ?? [])
  if (rules.length === 0) return

  const rows = rules.map((r, i) => ({
    user_id: userId,
    pillar: r.pillar,
    label: r.label,
    detail: r.detail,
    enabled: true,
    position: i,
    committed: false,
    is_mandatory: true,
    mandatory_since: todayISO(),
    cadence: 'daily',
    is_experimental: false,
    card_group: null,
    track: 'levels',
  }))
  const { error } = await supabase.from('protocols').insert(rows)
  if (error) throw error
}
