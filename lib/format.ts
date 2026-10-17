export function pad(n: number): string { return n.toString().padStart(2, '0') }
export function formatHMS(ms: number): string { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` }
export function formatRemaining(ms: number): string { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); if (h >= 48) return `in ${Math.floor(h / 24)}d ${h % 24}h`; return `in ${h}h ${m}m` }
export function todayISO(d: Date = new Date()): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function formatMoney(n: number): string { return '$' + n.toFixed(2) }

/** Decimal hours -> "H:MM" (e.g. 7.5 -> "7:30"). Used for sleep entry/display. */
export function fmtSleepHM(hours: number): string {
  const totalMin = Math.round(hours * 60)
  return `${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`
}

/** "H:MM" -> decimal hours. Returns null when the text is not valid hours:minutes. */
export function parseSleepHM(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2}):([0-5]\d)$/)
  if (!m) return null
  const v = Number(m[1]) + Number(m[2]) / 60
  return v > 0 && v <= 24 ? v : null
}
