'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MILESTONES } from '@/lib/milestones'
import type { Attempt } from '@/lib/types'

export default function AchievementsPage() {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      if (!uid) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', uid)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
      setAttempt((data?.[0] ?? null) as Attempt | null)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="card">
          <p className="text-[#9aa0ae]">Loading my milestones...</p>
        </div>
      </main>
    )
  }

  if (!attempt) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Milestones</h1>
        <div className="card">
          <p className="text-[#9aa0ae]">Your journey starts on the Progress tab.</p>
        </div>
      </main>
    )
  }

  const elapsedHours = (now.getTime() - new Date(attempt.started_at).getTime()) / 3600000

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Milestones</h1>
      <div className="space-y-3">
        {MILESTONES.map((m) => {
          const achieved = elapsedHours >= m.hours
          if (achieved) {
            return (
              <div key={m.id} className="card flex gap-3">
                <span className="text-[#f0506e] font-bold shrink-0" aria-label="achieved">
                  ✓
                </span>
                <div>
                  <h2 className="font-semibold">{m.title}</h2>
                  <p className="text-[#9aa0ae] text-sm mt-1">{m.bodyState}</p>
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className="card opacity-60">
              <p className="text-[#9aa0ae] text-sm">
                Milestone {m.id} &middot; in about {m.hours}h from start
              </p>
              <h2 className="font-semibold text-[#9aa0ae] mt-1">{m.title}</h2>
            </div>
          )
        })}
      </div>
      <p className="text-[#9aa0ae] text-xs mt-6 text-center">
        Milestones 2-12 are proposed timings. The journey is the point.
      </p>
    </main>
  )
}
