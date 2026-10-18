// One-shot Apple Health sync through the Google Sheet bridge.
// Throws when the bridge is not configured or the pull fails.
import { SHEET_ID, fetchSheetRows } from './sheetSync'

export async function syncAppleHealthFromSheet(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<number> {
  if (!SHEET_ID) throw new Error('Apple Health sync is not connected yet.')
  const rows = await fetchSheetRows(SHEET_ID)
  const payload = rows.map((r) => ({
    user_id: userId,
    entry_date: r.date,
    metric_key: r.metric_key,
    value: r.value,
    source: 'apple_health',
  }))
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await supabase.from('metric_entries').upsert(
      payload.slice(i, i + 200),
      { onConflict: 'user_id,entry_date,metric_key,source' },
    )
    if (error) throw error
  }
  return rows.length
}
