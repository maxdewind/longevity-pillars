'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO, fmtSleepHM, parseSleepHM } from '@/lib/format'
import { errMsg } from '@/lib/levels'
import { SHEET_ID, fetchSheetRows } from '@/lib/sheetSync'
import { REFERENCE_RANGES, METRIC_ORDER, type MetricKey } from '@/lib/referenceRanges'

interface Props {
  /** Existing values for today, keyed by metric_key, shown as placeholders. */
  initialValues?: Record<string, number>
  onSaved?: () => void
}

const PLACEHOLDERS: Record<MetricKey, string> = {
  weight_lb: 'e.g. 217',
  sleep_hours: '7:30',
  deep_sleep_min: 'e.g. 65',
  overnight_hr_bpm: 'e.g. 52',
  overnight_hrv_ms: 'e.g. 48',
  vo2max: 'Optional, e.g. 41',
  bedtime: 'e.g. 10:30 PM',
}

/** Metrics entered as a rolling 7-day average rather than a point in time. */
const AVG_7D: MetricKey[] = ['weight_lb', 'sleep_hours', 'deep_sleep_min', 'overnight_hr_bpm', 'overnight_hrv_ms']

function fieldTag(k: MetricKey): string {
  if (k === 'vo2max') return 'latest result (optional)'
  if (AVG_7D.includes(k)) return '7-day average'
  return REFERENCE_RANGES[k].unit
}

export default function MetricEntryForm({ initialValues = {}, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ahNote, setAhNote] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const seed: Record<string, string> = {}
    METRIC_ORDER.forEach((k) => {
      if (initialValues[k] != null) {
        seed[k] = k === 'sleep_hours' ? fmtSleepHM(Number(initialValues[k])) : String(initialValues[k])
      }
    })
    setValues(seed)
  }, [initialValues])

  const syncNow = async () => {
    if (!SHEET_ID) {
      setAhNote('Apple Health sync turns on after the one-time setup. For now, enter your numbers manually below.')
      return
    }
    setSyncing(true)
    try {
      const rows = await fetchSheetRows(SHEET_ID)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const payload = rows.map((r) => ({ user_id: user.id, entry_date: r.date, metric_key: r.metric_key, value: r.value, source: 'apple_health' }))
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('metric_entries').upsert(payload.slice(i, i + 200), { onConflict: 'user_id,entry_date,metric_key,source' })
        if (error) throw error
      }
      setAhNote(`Synced ${rows.length} daily readings from Apple Health.`)
      onSaved?.()
    } catch (e) {
      setAhNote(errMsg(e))
    }
    setSyncing(false)
  }

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
        let v: number | null
        if (k === 'sleep_hours') {
          v = parseSleepHM(raw)
          if (v == null) throw new Error('"Sleep" needs hours and minutes, like 7:30 or 730.')
        } else {
          v = Number(raw)
          if (!Number.isFinite(v) || v <= 0) throw new Error(`"${REFERENCE_RANGES[k].label}" needs a positive number.`)
        }
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
      <div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="btn w-full"
        >
          {syncing ? 'Syncing…' : 'Sync from Apple Health'}
        </button>
        {ahNote && (
          <p className="text-xs text-muted mt-2">
            {ahNote}
          </p>
        )}
      </div>
      {METRIC_ORDER.map((k) => {
        const def = REFERENCE_RANGES[k]
        return (
          <div key={k} className="card">
            <label className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{def.label}</span>
              <span className="text-xs text-muted">{fieldTag(k)}{k !== 'vo2max' && AVG_7D.includes(k) ? ` · ${def.unit}` : ''}</span>
            </label>
            <input
              type={k === 'sleep_hours' ? 'text' : 'number'}
              inputMode={k === 'sleep_hours' ? 'numeric' : 'decimal'}
              step="any"
              min="0"
              placeholder={PLACEHOLDERS[k]}
              value={values[k] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              className="mt-2 w-full bg-ink border border-white/10 rounded-lg px-3 py-2 text-white"
            />
            {k === 'sleep_hours' && (
              <p className="text-xs text-muted mt-1">Colon or just digits: 7:30 or 730.</p>
            )}
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
        {saving ? 'Saving…' : 'Save metrics'}
      </button>
    </div>
  )
}
