'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import { REFERENCE_RANGES, METRIC_ORDER, type MetricKey } from '@/lib/referenceRanges'

interface Props {
  /** Existing values for today, keyed by metric_key, shown as placeholders. */
  initialValues?: Record<string, number>
  onSaved?: () => void
}

const PLACEHOLDERS: Record<MetricKey, string> = {
  weight_lb: 'e.g. 217',
  sleep_hours: 'e.g. 7.5',
  deep_sleep_min: 'e.g. 65',
  overnight_hr_bpm: 'e.g. 52',
  overnight_hrv_ms: 'e.g. 48',
  vo2max: 'Optional, e.g. 41',
}

export default function MetricEntryForm({ initialValues = {}, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const seed: Record<string, string> = {}
    METRIC_ORDER.forEach((k) => {
      if (initialValues[k] != null) seed[k] = String(initialValues[k])
    })
    setValues(seed)
  }, [initialValues])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const rows: { user_id: string; entry_date: string; metric_key: string; value: number; source: string }[] = []
      METRIC_ORDER.forEach((k) => {
        const raw = (values[k] ?? '').trim()
        if (!raw) return
        const v = Number(raw)
        if (!Number.isFinite(v) || v <= 0) throw new Error(`"${REFERENCE_RANGES[k].label}" needs a positive number.`)
        rows.push({ user_id: user.id, entry_date: todayISO(), metric_key: k, value: v, source: 'manual' })
      })
      if (rows.length > 0) {
        const { error } = await supabase
          .from('metric_entries')
          .upsert(rows, { onConflict: 'user_id,entry_date,metric_key,source' })
        if (error) throw error
      }
      setSavedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      {METRIC_ORDER.map((k) => {
        const def = REFERENCE_RANGES[k]
        return (
          <div key={k} className="card">
            <label className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{def.label}</span>
              <span className="text-xs text-muted">{def.unit}{k === 'vo2max' ? ' (optional)' : ''}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder={PLACEHOLDERS[k]}
              value={values[k] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              className="mt-2 w-full bg-ink border border-white/10 rounded-lg px-3 py-2 text-white"
            />
          </div>
        )
      })}
      {error && <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>}
      {savedAt && <p className="text-sm text-accent">Saved at {savedAt}.</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-primary w-full"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : 'Save today\'s metrics'}
      </button>
    </div>
  )
}
