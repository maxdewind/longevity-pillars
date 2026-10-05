'use client'

import { useEffect, useState } from 'react'
import { formatHMS } from '@/lib/format'

// Fixed demo offset so the counter visibly ticks from the moment the page loads.
const SEED_OFFSET_MS = (2 * 24 * 3600 + 14 * 3600 + 32 * 60) * 1000

export default function LandingCounter() {
  const [startedAt] = useState(() => new Date(Date.now() - SEED_OFFSET_MS))
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime())
  const days = Math.floor(elapsedMs / 86400000)

  return (
    <div className="card text-center">
      <p className="text-6xl font-bold tabular-nums">{days}</p>
      <p className="text-[#9aa0ae] text-sm mt-1">clean days</p>
      <p className="text-2xl font-semibold tabular-nums mt-3">{formatHMS(elapsedMs)}</p>
      <p className="text-[#9aa0ae] text-xs mt-2">
        Live demo. It started counting when you opened this page.
      </p>
    </div>
  )
}
