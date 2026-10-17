import type { DemoRoutineSnapshot } from '@/lib/demoSnapshot'

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export const shortHalfName = (label: string) => {
  const m = label.match(/ \((Meal \d)\)$/)
  return m ? m[1] : label
}

export const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function statePill(on: boolean, label: string) {
  return (
    <span
      className={`text-xs font-semibold px-3 py-2 rounded-lg border whitespace-nowrap ${
        on ? 'bg-[#f0506e] border-[#f0506e] text-white' : 'border-[#2c313d] text-[#9aa0ae]'
      }`}
    >
      {on ? `✓ ${label}` : label}
    </span>
  )
}

export interface DemoCard {
  key: string
  title: string
  detail: string
  rows: DemoRoutineSnapshot[]
}

export function toCards(routines: DemoRoutineSnapshot[]): DemoCard[] {
  const cards: DemoCard[] = []
  routines.forEach((r) => {
    if (r.card_group) {
      const existing = cards.find((c) => c.key === r.card_group)
      if (existing) {
        existing.rows.push(r)
        existing.rows.sort((a, b) => a.label.localeCompare(b.label))
        return
      }
      cards.push({
        key: r.card_group,
        title: r.label.replace(/ \(Meal \d\)$/, ''),
        detail: r.detail,
        rows: [r],
      })
      return
    }
    cards.push({ key: r.id, title: r.label, detail: r.detail, rows: [r] })
  })
  return cards
}

export function WeightChart({
  weights,
  height = 110,
}: {
  weights: { log_date: string; weight_lb: number }[]
  height?: number
}) {
  const pts = weights.slice(-60)
  if (pts.length < 2) return null
  const W = 320
  const H = height
  const P = 8
  const vals = pts.map((w) => w.weight_lb)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = Math.max((max - min) * 0.2, 0.5)
  const xFor = (i: number) => P + (i / Math.max(pts.length - 1, 1)) * (W - 2 * P)
  const yFor = (v: number) => P + (1 - (v - (min - pad)) / (max + pad - (min - pad))) * (H - 2 * P)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: height + 20 }}>
      <polyline
        points={pts.map((w, i) => `${xFor(i)},${yFor(w.weight_lb)}`).join(' ')}
        fill="none"
        stroke="#f0506e"
        strokeWidth={2}
      />
      {pts.map((w, i) => (
        <circle key={w.log_date} cx={xFor(i)} cy={yFor(w.weight_lb)} r={3} fill="#f0506e" />
      ))}
    </svg>
  )
}
