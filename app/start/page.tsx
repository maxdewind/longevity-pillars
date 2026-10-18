'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { syncAppleHealthFromSheet } from '@/lib/appleHealthSync'

const STEPS = ['Pick one change', 'Run it for 12 days', 'Get your verdict']

export default function StartPage() {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)

  const connect = async () => {
    setConnecting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          await syncAppleHealthFromSheet(supabase, user.id)
        } catch {
          /* lookback screen handles the empty state gracefully */
        }
      }
    } finally {
      setConnecting(false)
      router.push('/start/safety')
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-10 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Longevity Pillars</p>
      <h1 className="text-4xl font-bold mt-3 leading-tight">Find what actually works for your body.</h1>
      <p className="text-muted mt-3">
        Test one small change at a time against your own Apple Health data. Keep what
        works. Drop what doesn&apos;t.
      </p>

      <div className="card mt-6 space-y-3">
        {STEPS.map((s, i) => (
          <p key={s} className="text-lg">
            <span className="text-accent font-bold mr-3">{i + 1}</span>
            {s}
          </p>
        ))}
      </div>

      <div className="card mt-4">
        <p className="text-xs text-muted uppercase tracking-widest">Sample verdict</p>
        <p className="font-semibold text-lg mt-2">Eating window 11:30 to 19:30</p>
        <p className="text-sm text-muted mt-1">
          12 days. Overnight heart rate down 2.4 bpm vs your normal.
        </p>
        <p className="font-semibold mt-2" style={{ color: '#7ee2a8' }}>Verdict: Keep</p>
      </div>

      <button
        type="button"
        onClick={connect}
        disabled={connecting}
        className="btn-primary w-full mt-8 !py-4 text-lg"
        style={{ opacity: connecting ? 0.6 : 1 }}
      >
        {connecting ? 'Connecting…' : 'Connect Apple Health'}
      </button>
      <p className="text-center mt-4">
        <Link href="/start/normal?manual=1" className="text-sm text-muted underline underline-offset-4">
          Enter my numbers manually
        </Link>
      </p>
    </main>
  )
}
