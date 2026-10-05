'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setBusy(false)
    } else {
      setDone(true)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-5">Start day one</h1>
        {done ? (
          <p className="text-sm">Check your inbox to confirm your email, then sign in.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-accent">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm text-muted text-center">
          <Link href="/login" className="underline">
            Already have an account? Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
