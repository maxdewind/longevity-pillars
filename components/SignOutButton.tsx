'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button className="btn-ghost text-sm" disabled={busy} onClick={handleSignOut}>
      Sign out
    </button>
  )
}
