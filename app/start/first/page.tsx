'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { errMsg, METRIC_LABELS, type ExperimentTemplate } from '@/lib/levels'
import { type MetricKey } from '@/lib/referenceRanges'
import { saveFirstRunSelection, testsLine } from '@/lib/firstRun'

const PILLARS = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'movement', label: 'Movement' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'mind', label: 'Mind' },
]

function tierColor(tier: string): string {
  return tier === 'A' ? '#7ee2a8' : tier === 'B' ? '#e8c468' : '#9aa0ae'
}

export default function StartFirstPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [templates, setTemplates] = useState<ExperimentTemplate[]>([])
  const [selected, setSelected] = useState<ExperimentTemplate | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customMetric, setCustomMetric] = useState<MetricKey>('weight_lb')
  const [customPillar, setCustomPillar] = useState('nutrition')
  const [customHypothesis, setCustomHypothesis] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      const [{ data: t }, { data: a }] = await Promise.all([
        supabase.from('experiment_templates').select('*').order('level_number'),
        supabase.from('experiments').select('id').eq('user_id', user.id).eq('mode', 'levels').eq('status', 'active').limit(1),
      ])
      setTemplates(((t as ExperimentTemplate[] | null) ?? []).filter((x) => x.verdict_driver))
      setActiveId(((a as { id: string }[] | null)?.[0]?.id) ?? null)
    }
    load()
  }, [])

  const testSelected = () => {
    if (!selected) return
    saveFirstRunSelection({ kind: 'template', level_number: selected.level_number })
    router.push('/start/ground-rules')
  }

  const testCustom = () => {
    setError(null)
    const title = customTitle.trim()
    if (!title) { setError('Give your experiment a name.'); return }
    saveFirstRunSelection({
      kind: 'custom',
      title,
      detail: customHypothesis.trim() || title,
      primary_metric: customMetric,
      pillar: customPillar,
      hypothesis: customHypothesis.trim() || title,
    })
    router.push('/start/ground-rules')
  }

  if (signedIn === false) {
    return (
      <main className="max-w-md mx-auto px-4 pt-8 pb-28">
        <div className="card">
          <p className="text-muted">Please <Link href="/login" className="underline">sign in</Link> to continue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <p className="text-xs text-muted uppercase tracking-widest">Step 3 of 3 · First experiment</p>
      <h1 className="text-3xl font-bold mt-3 leading-tight">What do you want to test first?</h1>
      <p className="text-muted mt-3">Pick one. You&apos;ll have a clear answer in 12 days.</p>

      {activeId ? (
        <div className="card mt-6">
          <p className="text-sm text-muted mb-3">You already have a run going.</p>
          <Link href={`/start/app/levels/${activeId}`} className="btn-primary w-full block text-center">
            Open my current run
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {templates.map((t) => {
            const isSel = selected?.level_number === t.level_number
            return (
              <button
                key={t.level_number}
                type="button"
                onClick={() => { setSelected(t); setCustomOpen(false) }}
                className="card w-full text-left"
                style={isSel ? { borderColor: '#f0506e', borderWidth: 2 } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted uppercase tracking-widest">Level {t.level_number}</p>
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{
                      color: tierColor(t.evidence_tier),
                      border: '1px solid currentColor', borderRadius: 999, padding: '2px 8px',
                    }}
                  >
                    Evidence {t.evidence_tier}
                  </span>
                </div>
                <p className="font-semibold text-lg mt-1">{t.title}</p>
                <p className="text-sm text-muted mt-1">{testsLine(t)}</p>
              </button>
            )
          })}

          <button
            type="button"
            onClick={testSelected}
            disabled={!selected}
            className="btn-primary w-full !py-4 text-lg"
            style={{ opacity: selected ? 1 : 0.5 }}
          >
            Test this for 12 days
          </button>

          <p className="text-center">
            <button
              type="button"
              onClick={() => { setCustomOpen((v) => !v); setSelected(null) }}
              className="text-sm text-muted underline underline-offset-4"
            >
              Write my own experiment
            </button>
          </p>

          {customOpen && (
            <div className="card space-y-3">
              <div>
                <label className="text-xs text-muted">What will you change?</label>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. No coffee after 14:00"
                  className="input mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted">Measures</label>
                  <select
                    value={customMetric}
                    onChange={(e) => setCustomMetric(e.target.value as MetricKey)}
                    className="input mt-1"
                  >
                    {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
                      <option key={k} value={k}>{METRIC_LABELS[k]?.label ?? k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted">Pillar</label>
                  <select
                    value={customPillar}
                    onChange={(e) => setCustomPillar(e.target.value)}
                    className="input mt-1"
                  >
                    {PILLARS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">Your hypothesis</label>
                <textarea
                  value={customHypothesis}
                  onChange={(e) => setCustomHypothesis(e.target.value)}
                  rows={3}
                  placeholder="What do you expect to change, and by how much?"
                  className="input mt-1"
                />
              </div>
              {error && <p className="text-sm" style={{ color: '#e0607e' }}>{error}</p>}
              <button type="button" onClick={testCustom} className="btn-primary w-full">
                Continue with my experiment
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
