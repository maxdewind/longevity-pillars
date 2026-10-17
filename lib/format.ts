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

/** "H:MM" -> decimal hours. Also accepts plain digits (713 -> 7:13),
 *  because the iOS numeric keyboard has no colon. Returns null when invalid. */
export function parseSleepHM(raw: string): number | null {
  const t = raw.trim()
  let h: number, min: number
  const colon = t.match(/^(\d{1,2}):([0-5]\d)$/)
  if (colon) {
    h = Number(colon[1])
    min = Number(colon[2])
  } else {
    const digits = t.match(/^(\d{1,4})$/)
    if (!digits) return null
    const d = digits[1]
    if (d.length <= 2) {
      h = Number(d)
      min = 0
    } else {
      h = Number(d.slice(0, -2))
      min = Number(d.slice(-2))
    }
    if (min > 59) return null
  }
  const v = h + min / 60
  return v > 0 && v <= 24 ? v : null
}
