'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { DemoPayload } from '@/lib/demoSnapshot'

// The public demo mirrors this account's published snapshot.
const FEATURED_USER_ID = 'd9409fba-fedc-48bb-b457-1c9e9dc91ad3'

interface DemoCtx {
  snap: DemoPayload | null
  publishedAt: string | null
  loaded: boolean
}

const Ctx = createContext<DemoCtx>({ snap: null, publishedAt: null, loaded: false })

export const useDemo = () => useContext(Ctx)

export function fmtPub(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DemoGate({ children }: { children: ReactNode }) {
  const { snap, loaded } = useDemo()
  if (!loaded) {
    return <p className="text-sm" style={{ color: '#9aa0ae' }}>Loading the demo…</p>
  }
  if (!snap) {
    return (
      <div className="card text-center">
        <p className="font-semibold">The live demo hasn&apos;t been published yet.</p>
        <p className="text-sm mt-2" style={{ color: '#9aa0ae' }}>
          Check back soon, or start your own day 1 now.
        </p>
        <Link href="/signup" className="btn-primary w-full block text-center mt-4">
          Start my real day 1
        </Link>
      </div>
    )
  }
  return <>{children}</>
}

export default function DemoProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<DemoPayload | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('demo_snapshot')
        .select('payload, updated_at')
        .eq('user_id', FEATURED_USER_ID)
        .limit(1)
      const row = (data as { payload: DemoPayload; updated_at: string }[] | null)?.[0]
      if (row) {
        setSnap(row.payload)
        setPublishedAt(row.updated_at)
      }
      setLoaded(true)
    }
    load()
  }, [])

  return <Ctx.Provider value={{ snap, publishedAt, loaded }}>{children}</Ctx.Provider>
}
