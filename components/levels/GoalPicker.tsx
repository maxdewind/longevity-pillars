'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { REFERENCE_RANGES, METRIC_ORDER, REFERENCE_DISCLAIMER, type BandChoice } from '@/lib/referenceRanges'

interface Props {
  /** Where to go after saving. */
  nextHref: string
  nextLabel: string
  /** Optional: called after a successful save (useful when nextHref is the current page). */
  onSaved?: () => void
}

export default function GoalPicker({ nextHref, nextLabel, onSaved }: Props) {
  const router = useRouter()
  const [picked, setPicked] = useState<Record<string, BandChoice>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('goals').select('metric_key,band').eq('user_id', user.id)
      const map: Record<string, BandChoice> = {}
      ;((data as { metric_key: string; band: BandChoice }[] | null) ?? []).forEach((g) => {
        map[g.metric_key] = g.band
      })
      setPicked(map)
      setLoading(false)
    }
    load()
  }, [])

  const count = Object.keys(picked).length

  const save = async () => {
    if (count === 0) { setError('Pick at least one goal to continue.'); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      await supabase.from('goals').delete().eq('user_id', user.id)
      const rows = Object.entries(picked).map(([metric_key, band]) => ({
        user_id: user.id,
        metric_key,
        band,
        target_label: band === 'population'
          ? REFERENCE_RANGES[metric_key as keyof typeof REFERENCE_RANGES].population.label
          : REFERENCE_RANGES[metric_key as keyof typeof REFERENCE_RANGES].aspirational.label,
      }))
      const { error } = await supabase.from('goals').insert(rows)
      if (error) throw error
      onSaved?.()
      router.push(nextHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed.')
    }
    setSaving(false)
  }

  if (loading) return <p className="text-muted">Loading…</p>

  return (
    <div className="space-y-3">
      {METRIC_ORDER.map((k) => {
        const def = REFERENCE_RANGES[k]
        const sel = picked[k]
        return (
          <div key={k} className="card">
            <p className="font-semibold mb-2">{def.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['population', 'aspirational'] as BandChoice[]).map((b) => {
                const band = b === 'population' ? def.population : def.aspirational
                const active = sel === b
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() =>
                      setPicked((p) => {
                        const next = { ...p }
                        if (next[k] === b) delete next[k]
                        else next[k] = b
                        return next
                      })
                    }
                    className={`rounded-lg border px-3 py-2 text-left ${active ? 'border-accent bg-accent/10' : 'border-white/10'}`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {b === 'population' ? 'Population' : 'Aspirational'}
                    </p>
                    <p className="text-sm mt-1">{band.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{band.source}</p>
                  </button>
                )
              })}
            </div>
            {def.soft && (
              <p className="text-[11px] text-muted mt-2">
                HRV is device-specific and noisy. Shown for context, never a verdict driver.
              </p>
            )}
          </div>
        )
      })}
      <p className="text-[11px] text-muted">{REFERENCE_DISCLAIMER}</p>
      {error && <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-primary w-full"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : nextLabel}
      </button>
      {count > 0 && <p className="text-xs text-muted text-center">{count} {count === 1 ? 'goal' : 'goals'} picked.</p>}
    </div>
  )
}
