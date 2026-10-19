'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// The Levels list is superseded by My protocol (spec v0.1).
export default function LevelsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/experiment/app/protocol')
  }, [router])
  return <main className="p-6 text-muted">Loading…</main>
}
