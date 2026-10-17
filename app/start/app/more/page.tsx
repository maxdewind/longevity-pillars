'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SignOutButton from '@/components/SignOutButton'

export default function StartAppMorePage() {
  const [gate, setGate] = useState(90)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); setLoading(false); return }
      setSignedIn(true)
      const { data } = await supabase.from('profiles').select('stability_gate_pct').eq('id', user.id).single()
      const g = (data as { stability_gate_pct?: number | null } | null)?.stability_gate_pct
      if (typeof g === 'number' && g >= 80 && g <= 100) setGate(g)
      setLoading(false)
    }
    load()
  }, [])

  const saveGate = async (v: number) => {
    setGate(v)
    setSavedNote(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({ stability_gate_pct: v }).eq('id', user.id)
    setSavedNote(error ? 'Could not save. Try again.' : `Saved at ${v}%.`)
  }

  if (signedIn === false) {
    return (
      <div className="card">
        <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">More</h1>

      <div className="card">
        <p className="font-semibold">Stability bar</p>
        <p className="text-sm text-muted mt-1 mb-4">
          Level N+1 unlocks when the previous level has a recorded verdict and your baseline
          holds at or above this bar over the trailing 10 days.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={80}
            max={100}
            step={1}
            value={gate}
            disabled={loading}
            onChange={(e) => saveGate(Number(e.target.value))}
            className="flex-1 accent-[#f0506e]"
            aria-label="Stability gate percent"
          />
          <span className="text-lg font-bold tabular-nums w-14 text-right">{gate}%</span>
        </div>
        <div className="flex justify-between text-[11px] text-muted mt-1">
          <span>80% (easier)</span>
          <span>100% (strict)</span>
        </div>
        {savedNote && <p className="text-xs text-accent mt-2">{savedNote}</p>}
      </div>

      <div className="card">
        <p className="font-semibold mb-1">Safety check</p>
        <p className="text-sm text-muted mb-3">
          Update your answers to the safety questions any time.
        </p>
        <Link href="/start/safety" className="text-sm text-accent underline underline-offset-2">
          Re-answer the safety questions
        </Link>
      </div>

      <div className="card">
        <p className="font-semibold mb-1">Classic app</p>
        <p className="text-sm text-muted mb-3">
          The original Longevity Pillars experience lives on, untouched.
        </p>
        <Link href="/app" className="text-sm text-accent underline underline-offset-2">
          Back to the classic app
        </Link>
      </div>

      <div className="card flex items-center justify-between">
        <p className="font-semibold">Sign out</p>
        <SignOutButton />
      </div>
    </div>
  )
}
