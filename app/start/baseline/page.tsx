'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'

interface LibraryRule {
  key: string
  label: string
  detail: string
  pillar: string
  evidence_tier: string
  sort_order: number
}

const TIER_COPY: Record<string, string> = {
  A: 'Strong evidence',
  B: 'Moderate evidence',
  C: 'Early or mixed evidence',
}

export default function StartBaselinePage() {
  const router = useRouter()
  const [rules, setRules] = useState<LibraryRule[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [alreadyStarted, setAlreadyStarted] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)
      const [{ data: lib }, { data: existing }] = await Promise.all([
        supabase.from('protocol_library').select('*').eq('starter', true).order('sort_order', { ascending: true }),
        supabase.from('protocols').select('id').eq('user_id', user.id).eq('track', 'levels').limit(1),
      ])
      setRules(((lib as LibraryRule[] | null) ?? []))
      setAlreadyStarted((((existing as { id: string }[] | null) ?? []).length > 0))
      setLoading(false)
    }
    load()
  }, [])

  const start = async () => {
    setStarting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const rows = rules.map((r, i) => ({
        user_id: user.id,
        pillar: r.pillar,
        label: r.label,
        detail: r.detail,
        enabled: true,
        position: i,
        committed: false,
        is_mandatory: true,
        mandatory_since: todayISO(),
        cadence: 'daily',
        is_experimental: false,
        card_group: null,
        track: 'levels',
      }))
      const { error } = await supabase.from('protocols').insert(rows)
      if (error) throw error
      router.push('/start/position')
    } catch {
      setStarting(false)
    }
  }

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
      <p className="text-xs text-muted uppercase tracking-wide">Step 5 of 6 · Your baseline</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">Four rules to hold</h1>
      <p className="text-sm text-muted mb-6">
        New levels unlock when this baseline holds at 90% or better over 10 days.
        You can adjust that bar later between 80 and 100%.
      </p>
      {loading ? (
        <p className="text-muted">Loading starter rules…</p>
      ) : rules.length === 0 ? (
        <div className="card">
          <p className="text-muted">The starter rules are still being seeded. Check back shortly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.key} className="card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{r.label}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/15 text-muted shrink-0" title={TIER_COPY[r.evidence_tier] ?? ''}>
                  Evidence {r.evidence_tier}
                </span>
              </div>
              <p className="text-sm text-muted mt-1">{r.detail}</p>
            </div>
          ))}
          {alreadyStarted ? (
            <Link href="/start/app/today" className="btn-primary w-full block text-center mt-4">
              Your baseline is set. Enter your app
            </Link>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="btn-primary w-full mt-4"
              style={{ opacity: starting ? 0.5 : 1 }}
            >
              {starting ? 'Starting…' : 'Start my baseline'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
