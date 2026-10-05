export function pad(n: number): string { return n.toString().padStart(2, '0') }
export function formatHMS(ms: number): string { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` }
export function formatRemaining(ms: number): string { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); if (h >= 48) return `in ${Math.floor(h / 24)}d ${h % 24}h`; return `in ${h}h ${m}m` }
export function todayISO(d: Date = new Date()): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function formatMoney(n: number): string { return '$' + n.toFixed(2) }
