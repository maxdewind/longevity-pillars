'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/format'
import type { Protocol } from '@/lib/types'

interface CheckState {
  committed: boolean
  held: boolean
}

const UNCHECKED: CheckState = { committed: false, held: false }

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [checks, setChecks] = useState<Record<string, CheckState>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: protos } = await supabase
        .from('protocols')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      const { data: rows } = await supabase
        .from('protocol_checks')
        .select('protocol_id, committed, held')
        .eq('user_id', user.id)
        .eq('log_date', todayISO())

      setProtocols(((protos as Protocol[] | null) ?? []).filter((p) => p.enabled))
      const map: Record<string, CheckState> = {}
      ;(rows ?? []).forEach((r) => {
        map[r.protocol_id] = { committed: !!r.committed, held: !!r.held }
      })
      setChecks(map)
      setLoading(false)
    }
    load()
  }, [])

  const toggle = async (p: Protocol, key: 'committed' | 'held') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const current = checks[p.id] ?? UNCHECKED
    const next = { ...current, [key]: !current[key] }
    setChecks((c) => ({ ...c, [p.id]: next }))
    await supabase.from('protocol_checks').upsert(
      {
        user_id: user.id,
        protocol_id: p.id,
        log_date: todayISO(),
        committed: next.committed,
        held: next.held,
      },
      { onConflict: 'user_id,protocol_id,log_date' }
    )
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const nutrition = protocols.filter((p) => p.pillar === 'nutrition')
  const movement = protocols.filter((p) => p.pillar === 'movement')

  const renderItem = (p: Protocol) => {
    const state = checks[p.id] ?? UNCHECKED
    return (
      <div key={p.id} className="card">
        <div className="font-bold">{p.label}</div>
        <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{p.detail}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={() => toggle(p, 'committed')}
            className={state.committed ? 'btn-primary' : 'btn-ghost'}
          >
            Committed
          </button>
          <button
            type="button"
            onClick={() => toggle(p, 'held')}
            className={state.held ? 'btn-primary' : 'btn-ghost'}
          >
            Held
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">Today&apos;s protocol · {dateLabel}</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        Committed is the promise you make each morning. Held is what you record
        each night. Both start unchecked every day.
      </p>

      {loading && <p className="text-sm" style={{ color: '#9aa0ae' }}>Loading...</p>}

      {!loading && nutrition.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">Nutrition</h2>
          {nutrition.map(renderItem)}
        </section>
      )}

      {!loading && movement.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">Movement</h2>
          {movement.map(renderItem)}
        </section>
      )}
    </main>
  )
}
