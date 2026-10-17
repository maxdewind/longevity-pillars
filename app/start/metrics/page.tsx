'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MetricEntryForm from '@/components/levels/MetricEntryForm'

export default function StartMetricsPage() {
  const [initialValues, setInitialValues] = useState<Record<string, number>>({})
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      const today = new Date()
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const { data } = await supabase
        .from('metric_entries')
        .select('metric_key,value')
        .eq('user_id', user.id)
        .eq('entry_date', iso)
      const map: Record<string, number> = {}
      ;((data as { metric_key: string; value: number }[] | null) ?? []).forEach((r) => {
        map[r.metric_key] = Number(r.value)
      })
      setInitialValues(map)
    }
    load()
  }, [])

  if (signedIn === false) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-wide">Step 3 of 6 · Baseline metrics</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Log what you have</h1>
      <p className="text-sm text-muted mb-6">
        Enter your 7-day averages (Apple Health shows these per metric). Leave blank
        anything you do not track yet.
      </p>
      <MetricEntryForm initialValues={initialValues} />
      <Link href="/start/goals" className="btn-primary w-full mt-6 block text-center">
        Continue
      </Link>
    </main>
  )
}
