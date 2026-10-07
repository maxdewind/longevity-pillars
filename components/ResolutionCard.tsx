'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// The written resolution: the Rung 0 -> Rung 1 decision, formalized.
// Shown on the Record page; resurfaced every time an attempt restarts.
export default function ResolutionCard() {
  const [resolution, setResolution] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoaded(true)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('resolution')
        .eq('id', user.id)
        .single()
      const value = (data?.resolution as string | undefined) ?? ''
      setResolution(value)
      setDraft(value)
      setLoaded(true)
    }
    load()
  }, [])

  const save = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    const text = draft.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ resolution: text })
      .eq('id', user.id)
    setSaving(false)
    if (!error) {
      setResolution(text)
      setEditing(false)
    }
  }

  if (!loaded) return null

  return (
    <section className="card">
      <h2 className="font-semibold mb-1">My resolution</h2>
      {resolution && !editing ? (
        <>
          <p className="text-sm italic">&ldquo;{resolution}&rdquo;</p>
          <button
            type="button"
            onClick={() => {
              setDraft(resolution)
              setEditing(true)
            }}
            className="btn-ghost mt-3 text-sm"
          >
            Edit
          </button>
        </>
      ) : (
        <>
          <p className="text-sm mb-3" style={{ color: '#9aa0ae' }}>
            Why are you climbing? Write it in one or two sentences. This is
            your Rung 0 to Rung 1 decision, and it will be here waiting every
            time you restart.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="I am climbing because..."
            className="input text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? 'Saving...' : 'Save resolution'}
            </button>
            {resolution && (
              <button
                type="button"
                onClick={() => {
                  setDraft(resolution)
                  setEditing(false)
                }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
