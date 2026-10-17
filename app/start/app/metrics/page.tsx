'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import { REFERENCE_RANGES, METRIC_ORDER } from '@/lib/referenceRanges'
import MetricEntryForm from '@/components/levels/MetricEntryForm'

interface EntryRow {
  metric_key: string
  entry_date: string
  value: number
}

const HISTORY_LIMIT = 14

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AppMetricsPage() {
  const [initialValues, setInitialValues] = useState<Record<string, number>>({})
  const [history, setHistory] = useState<EntryRow[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      const { data } = await supabase
        .from('metric_entries')
        .select('metric_key,entry_date,value')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(400)
      const rows = ((data as EntryRow[] | null) ?? []).map((r) => ({ ...r, value: Number(r.value) }))
      setHistory(rows)
      const today = todayISO()
      const map: Record<string, number> = {}
      rows.forEach((r) => {
        if (r.entry_date === today && map[r.metric_key] == null) map[r.metric_key] = r.value
      })
      setInitialValues(map)
    }
    load()
  }, [refreshKey])

  if (signedIn === false) {
    return (
      <div className="card">
        <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Metrics</h1>
      <p className="text-sm text-muted mb-4">
        Log what you have. Apple Health sync is coming, for now manual entry keeps the
        instrument consistent.
      </p>
      <MetricEntryForm initialValues={initialValues} onSaved={() => setRefreshKey((k) => k + 1)} />

      <h2 className="text-lg font-bold mt-8 mb-2">Recent history</h2>
      <div className="space-y-3">
        {METRIC_ORDER.map((k) => {
          const def = REFERENCE_RANGES[k]
          const rows = history.filter((h) => h.metric_key === k).slice(0, HISTORY_LIMIT)
          if (rows.length === 0) return null
          return (
            <div key={k} className="card">
              <p className="font-semibold mb-2">{def.label} <span className="text-xs text-muted font-normal">({def.unit})</span></p>
              <ul className="text-sm space-y-1">
                {rows.map((r) => (
                  <li key={`${r.entry_date}-${r.metric_key}`} className="flex justify-between tabular-nums">
                    <span className="text-muted">{fmtDate(r.entry_date)}</span>
                    <span>{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {history.length === 0 && (
        <p className="text-sm text-muted">Nothing logged yet. Your entries will appear here.</p>
      )}
    </div>
  )
}
