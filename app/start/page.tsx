'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { syncAppleHealthFromSheet } from '@/lib/appleHealthSync'

const STEPS = [
  { title: 'Pick one change', sub: 'From 25 experiments, or write your own' },
  { title: 'Run it for 12 days', sub: 'Hold it on 10 of 12 days. Apple Health tracks the rest' },
  { title: 'Get your verdict', sub: 'Keep it, extend it or drop it' },
]

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
        Test one change at a time against your own Apple Health data.
      </p>

      <p className="text-xs text-muted uppercase tracking-widest mt-8 mb-4">How it works · 3 steps</p>
      <div>
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className="w-9 h-9 rounded-full border flex items-center justify-center font-bold shrink-0"
                style={{ borderColor: '#f0506e', color: '#f0506e' }}
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className="w-px flex-1" style={{ background: 'rgba(240,80,110,0.35)', minHeight: 28 }} />
              )}
            </div>
            <div className="pb-7">
              <p className="font-semibold text-lg">{s.title}</p>
              <p className="text-sm text-muted">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted uppercase tracking-widest">Example verdict</p>
          <span className="text-xs text-muted border border-white/15 rounded-full px-3 py-1">Example</span>
        </div>
        <p className="font-semibold text-xl mt-3">Intermittent fasting (11:30 to 19:30)</p>
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                background: i < 11 ? '#7ee2a8' : 'transparent',
                border: `1px solid ${i < 11 ? '#7ee2a8' : '#4a5160'}`,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-muted mt-2">Held 11 of 12 days (10 needed)</p>
        <p className="text-sm mt-3">
          <span className="font-bold">Primary:</span>{' '}
          <span className="text-muted">overnight heart rate down 2.4 bpm</span>
        </p>
        <p className="text-sm text-muted">Also moved: weight down 3.1 lb, deep sleep up 9 min</p>
        <p className="font-semibold text-lg mt-3" style={{ color: '#e8c468' }}>Verdict: Works, hard to keep</p>
        <p className="text-sm text-muted mt-1">
          You rated it hard to sustain. Try a gentler version: 10:30 to 20:30.
        </p>
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
