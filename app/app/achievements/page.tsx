'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MILESTONES } from '@/lib/milestones'
import { buildDemoSnapshot } from '@/lib/demoSnapshot'
import type { Attempt, Protocol } from '@/lib/types'

const RECORD_MILESTONES = [7, 30, 100]

interface RoutineRecord {
  id: string
  label: string
  holds: number
}

export default function AchievementsPage() {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [records, setRecords] = useState<RoutineRecord[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

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

      const [{ data: protos }, { data: checkRows }] = await Promise.all([
        supabase
          .from('protocols')
          .select('id,label,position')
          .eq('user_id', uid)
          .eq('track', 'classic')
          .eq('enabled', true)
          .order('position', { ascending: true }),
        supabase
          .from('protocol_checks')
          .select('protocol_id,held')
          .eq('user_id', uid)
          .eq('held', true),
      ])
      const holdsByProto: Record<string, number> = {}
      ;(checkRows ?? []).forEach((r) => {
        holdsByProto[r.protocol_id] = (holdsByProto[r.protocol_id] ?? 0) + 1
      })
      setRecords(
        ((protos as Protocol[] | null) ?? []).map((p) => ({
          id: p.id,
          label: p.label,
          holds: holdsByProto[p.id] ?? 0,
        }))
      )

      const { data: snap } = await supabase
        .from('demo_snapshot')
        .select('updated_at')
        .eq('user_id', uid)
        .limit(1)
      setPublishedAt(((snap as { updated_at: string }[] | null)?.[0]?.updated_at) ?? null)
      setLoading(false)
    }
    init()
  }, [])

  const publishDemo = async () => {
    if (publishing) return
    setPublishing(true)
    setPublishError(null)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      if (!uid) throw new Error('Not signed in.')
      const payload = await buildDemoSnapshot(supabase, uid)
      const { error } = await supabase
        .from('demo_snapshot')
        .upsert(
          { user_id: uid, payload, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      setPublishedAt(payload.published_at)
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publishing failed.')
    }
    setPublishing(false)
  }

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="card">
          <p className="text-[#64748b]">Loading my milestones...</p>
        </div>
      </main>
    )
  }

  if (!attempt) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Milestones</h1>
        <div className="card">
          <p className="text-[#64748b]">Your journey starts on the Progress tab.</p>
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
                  <p className="text-[#64748b] text-sm mt-1">{m.bodyState}</p>
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className="card opacity-60">
              <p className="text-[#64748b] text-sm">
                Milestone {m.id} &middot; in about {m.hours}h from start
              </p>
              <h2 className="font-semibold text-[#64748b] mt-1">{m.title}</h2>
            </div>
          )
        })}
      </div>
      <p className="text-[#64748b] text-xs mt-6 text-center">
        Milestones 2-12 are proposed timings. The journey is the point.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-1">Public demo</h2>
        <p className="text-sm mb-4" style={{ color: '#64748b' }}>
          The public &ldquo;Peek inside&rdquo; page shows a frozen copy of your
          real protocol, experiment and weight trend. Nothing goes public until
          you publish, and nothing updates until you publish again.
        </p>
        <div className="card">
          {publishedAt && (
            <p className="text-sm mb-3" style={{ color: '#64748b' }}>
              Last published{' '}
              {new Date(publishedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
          {publishError && (
            <p className="text-sm mb-3" style={{ color: '#e0607e' }}>{publishError}</p>
          )}
          <button
            type="button"
            onClick={publishDemo}
            disabled={publishing}
            className="btn-primary w-full"
            style={{ opacity: publishing ? 0.5 : 1 }}
          >
            {publishing ? 'Publishing…' : 'Publish demo snapshot'}
          </button>
        </div>
      </section>

      {records.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-1">Routine records</h2>
          <p className="text-sm mb-4" style={{ color: '#64748b' }}>
            Hold counts no slip can take away.
          </p>
          <div className="space-y-3">
            {records.map((r) => {
              const next = RECORD_MILESTONES.find((m) => r.holds < m) ?? null
              return (
                <div key={r.id} className="card">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{r.label}</p>
                    <p className="text-sm tabular-nums whitespace-nowrap" style={{ color: '#64748b' }}>
                      {r.holds} {r.holds === 1 ? 'hold' : 'holds'}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs">
                    {RECORD_MILESTONES.map((m) => (
                      <span
                        key={m}
                        className={`px-2 py-1 rounded-full border ${
                          r.holds >= m
                            ? 'text-accent border-accent/40'
                            : 'text-muted border-slate-200'
                        }`}
                      >
                        {r.holds >= m ? `✓ ${m}` : `${m}`}
                      </span>
                    ))}
                  </div>
                  {next && (
                    <p className="text-xs mt-2" style={{ color: '#64748b' }}>
                      Next record at {next} holds.
                    </p>
                  )}
                  {!next && (
                    <p className="text-xs mt-2 text-accent">
                      All records set. The bar is yours to raise.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

    </main>
  )
}
