'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const QUESTIONS = [
  { key: 'diabetes_meds', label: 'I have diabetes or take glucose-lowering medication' },
  { key: 'pregnancy', label: 'I am pregnant' },
  { key: 'ed_history', label: 'I have a history of an eating disorder' },
]

export default function SafetyPage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('safety_screenings').upsert(
          {
            user_id: user.id,
            status: 'placeholder',
            answers: {
              diabetes_meds: !!answers.diabetes_meds,
              pregnancy: !!answers.pregnancy,
              ed_history: !!answers.ed_history,
            },
          },
          { onConflict: 'user_id' }
        )
      }
    } finally {
      setSaving(false)
      router.push('/experiment/lookback')
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Before we begin</p>
      <h1 className="text-2xl font-bold mt-2 mb-1">A quick safety check</h1>
      <p className="text-sm text-muted mb-6">
        Longevity Pillars offers general wellness information, not medical advice. A full
        safety screen is coming. For now these answers gate fasting-related levels, and we
        will always suggest talking to your clinician first.
      </p>
      <div className="space-y-2">
        {QUESTIONS.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => setAnswers((a) => ({ ...a, [q.key]: !a[q.key] }))}
            className={`card w-full text-left flex items-center gap-3 ${answers[q.key] ? '!border-accent bg-accent/10' : ''}`}
          >
            <span
              className={`w-5 h-5 rounded border flex items-center justify-center text-sm shrink-0 ${answers[q.key] ? 'border-accent text-accent' : 'border-white/20 text-transparent'}`}
            >
              ✓
            </span>
            <span className="text-sm">{q.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-primary w-full mt-6"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : 'Save and continue'}
      </button>
      <p className="text-center text-xs text-muted mt-3">
        <Link href="/experiment/lookback" className="underline underline-offset-2">Skip for now</Link>
      </p>
    </main>
  )
}
