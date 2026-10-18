'use client'

// A small band diagram: population/aspirational shading, the user's average
// with a subtle ±SD shaded region, and an optional target marker.

interface Props {
  min: number
  max: number
  pop?: [number, number]
  asp?: [number, number]
  /** 'lower' puts the aspirational legend on the left (weight, heart rate). */
  direction?: 'lower' | 'higher' | 'band'
  avg: number
  sd: number
  target?: number | null
  showLegend?: boolean
}

export default function BandBar({ min, max, pop, asp, direction = 'band', avg, sd, target = null, showLegend = true }: Props) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`
  const lo = Math.max(min, avg - sd)
  const hi = Math.min(max, avg + sd)
  const legendLeft = direction === 'lower' ? 'Aspirational' : 'Population'
  const legendRight = direction === 'lower' ? 'Population' : 'Aspirational'
  return (
    <div>
      <div className="relative h-3 rounded-full bg-white/10">
        {pop && (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-white/25"
            style={{ left: pct(pop[0]), width: `calc(${pct(pop[1])} - ${pct(pop[0])})` }}
          />
        )}
        {asp && (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-accent/30"
            style={{ left: pct(asp[0]), width: `calc(${pct(asp[1])} - ${pct(asp[0])})` }}
          />
        )}
        {sd > 0 && hi > lo && (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-white/40"
            style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
            title="Your usual range (± variation)"
          />
        )}
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-white top-[1px]"
          style={{ left: `calc(${pct(avg)} - 5px)` }}
          title="Your average"
        />
        {target != null && (
          <div
            className="absolute w-2.5 h-2.5 rounded-full top-[1px]"
            style={{ left: `calc(${pct(target)} - 5px)`, background: '#7ee2a8' }}
            title="Your target"
          />
        )}
      </div>
      {showLegend && (pop || asp) && (
        <div className="flex justify-between text-[11px] text-muted mt-1">
          <span>{legendLeft}</span>
          <span>{legendRight}</span>
        </div>
      )}
    </div>
  )
}
