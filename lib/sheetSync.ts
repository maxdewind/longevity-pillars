// Pulls the Apple Health daily mirror (a link-shared Google Sheet written by
// the daily sync job) and upserts it into metric_entries as source='apple_health'.
// Sheet tab "daily", columns: date | weight_lb | sleep_hours | deep_sleep_min |
// overnight_hr_bpm | overnight_hrv_ms | vo2max | bedtime. No identifiers, just numbers.

const METRIC_COLS = [
  'weight_lb',
  'sleep_hours',
  'deep_sleep_min',
  'overnight_hr_bpm',
  'overnight_hrv_ms',
  'vo2max',
  'bedtime',
] as const

export const SHEET_ID =
  typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_SHEET_ID as string | undefined) : undefined

interface SheetRow {
  date: string
  metric_key: string
  value: number
}

export async function fetchSheetRows(sheetId: string): Promise<SheetRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=daily`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status}).`)
  const text = await res.text()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Unexpected sheet response.')
  const payload = JSON.parse(text.slice(start, end + 1))
  const rows: SheetRow[] = []
  for (const r of payload.table?.rows ?? []) {
    const cells: { v?: string | number | null }[] = r.c ?? []
    const date = String(cells[0]?.v ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    METRIC_COLS.forEach((metric_key, i) => {
      const raw = cells[i + 1]?.v
      const value = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isFinite(value) && value !== 0) rows.push({ date, metric_key, value })
    })
  }
  return rows
}
