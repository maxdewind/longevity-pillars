'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addDays, errMsg, METRIC_LABELS, type ExperimentTemplate } from '@/lib/levels'
import { todayISO } from '@/lib/format'
import { type MetricKey } from '@/lib/referenceRanges'
import { DEFAULT_LOOKBACK_DAYS, LOOKBACK_OPTIONS, fetchProfileExtras } from '@/lib/baseline'
import {
  saveFirstRunSelection, primaryPhrase, evidenceWord, evidenceDots,
  EVIDENCE_DESCRIPTIONS, EVIDENCE_DISCLAIMER, watchLabel,
} from '@/lib/firstRun'

const PILLARS = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'movement', label: 'Movement' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'mind', label: 'Mind' },
]

const SHOWN_COUNT = 3

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function EvidencePill({ tier }: { tier: string }) {
  const dots = evidenceDots(tier)
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1"
    >
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: i < dots ? '#f0506e' : 'rgba(255,255,255,0.15)' }}
          />
        ))}
      </span>
      <span className="text-sm font-semibold">{evidenceWord(tier)}</span>
    </span>
  )
}

function EvidencePanel({ t }: { t: ExperimentTemplate }) {
  const word = evidenceWord(t.evidence_tier)
  const tiers: ('Strong' | 'Moderate' | 'Early')[] = ['Strong', 'Moderate', 'Early']
  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex justify-between text-sm mb-3">
        {tiers.map((x) => (
          <span key={x} className={x === word ? 'font-bold text-white' : 'text-muted'}>
            {x}
          </span>
        ))}
      </div>
      <p className="font-bold text-lg">{word} evidence</p>
      <p className="text-sm text-muted mt-1">{EVIDENCE_DESCRIPTIONS[word]}</p>
      {t.evidence_note && (
        <p className="text-sm text-muted mt-3">
          Rated for {watchLabel(t.primary_metric)}. {t.evidence_note}
        </p>
      )}
      <p className="text-sm text-muted mt-3">{EVIDENCE_DISCLAIMER}</p>
      {t.sources_url && (
        <a
          href={t.sources_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted underline underline-offset-4 mt-3 inline-block"
          onClick={(e) => e.stopPropagation()}
        >
          See sources
        </a>
      )}
    </div>
  )
}

export default function StartFirstPage() {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [usable, setUsable] = useState<ExperimentTemplate[]>([])
  const [shown, setShown] = useState<ExperimentTemplate[]>([])
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<ExperimentTemplate | null>(null)
  const [infoOpen, setInfoOpen] = useState<number | null>(null)
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
      try {
        const prof = await fetchProfileExtras(supabase, user.id)
        const lb = (LOOKBACK_OPTIONS as readonly number[]).includes(prof.lookback) ? prof.lookback : DEFAULT_LOOKBACK_DAYS
        const today = todayISO()
        const from = addDays(today, -(lb - 1))
        const [{ data: t }, { data: a }, { data: e }] = await Promise.all([
          supabase.from('experiment_templates').select('*').order('level_number'),
          supabase.from('experiments').select('id').eq('user_id', user.id).eq('mode', 'levels').eq('status', 'active').limit(1),
          supabase.from('metric_entries').select('metric_key').eq('user_id', user.id).gte('entry_date', from).lte('entry_date', today),
        ])
        const templates = ((t as ExperimentTemplate[] | null) ?? []).filter((x) => x.verdict_driver)
        const withData = new Set(((e as { metric_key: string }[] | null) ?? []).map((r) => r.metric_key))
        const ok = templates.filter((x) => withData.has(x.primary_metric))
        setUsable(ok)
        setShown(shuffle(ok).slice(0, SHOWN_COUNT))
        setActiveId(((a as { id: string }[] | null)?.[0]?.id) ?? null)
      } catch (err) {
        setError(errMsg(err))
      }
    }
    load()
  }, [])

  const doShuffle = () => {
    setShown(shuffle(usable).slice(0, SHOWN_COUNT))
    setShowAll(false)
    setSelected(null)
    setInfoOpen(null)
  }

  const visible = showAll ? usable : shown

  const testSelected = () => {
    if (!selected) return
    saveFirstRunSelection({ kind: 'template', level_number: selected.level_number })
    router.push('/experiment/ground-rules')
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
    router.push('/experiment/ground-rules')
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
      <p className="text-muted mt-3">
        Three ideas from our catalogue. Pick one, shuffle for new ones, or browse them all.
      </p>

      {error && <p className="text-sm mt-4" style={{ color: '#e0607e' }}>{error}</p>}

      {activeId ? (
        <div className="card mt-6">
          <p className="text-sm text-muted mb-3">You already have a run going.</p>
          <Link href={`/experiment/app/levels/${activeId}`} className="btn-primary w-full block text-center">
            Open my current run
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted uppercase tracking-widest">
              {visible.length} of {usable.length} experiments
            </p>
            <button type="button" onClick={doShuffle} className="text-accent font-semibold">
              Shuffle
            </button>
          </div>

          <div className="space-y-3">
            {visible.map((t) => {
              const isSel = selected?.level_number === t.level_number
              const info = infoOpen === t.level_number
              const secondaries = (t.secondary_metrics ?? [])
                .map(watchLabel)
                .filter((s) => s !== watchLabel(t.primary_metric))
              return (
                <div
                  key={t.level_number}
                  className="card"
                  style={isSel ? { borderColor: '#f0506e', borderWidth: 2 } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => { setSelected(t); setCustomOpen(false) }}
                    className="w-full text-left"
                  >
                    <p className="font-semibold text-xl leading-snug">{t.title}</p>
                  </button>
                  <div className="flex items-center gap-2 mt-2">
                    <EvidencePill tier={t.evidence_tier} />
                    <button
                      type="button"
                      aria-label="About the evidence"
                      onClick={() => setInfoOpen(info ? null : t.level_number)}
                      className="w-7 h-7 rounded-full border border-white/20 text-muted text-sm font-semibold"
                    >
                      i
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelected(t); setCustomOpen(false) }}
                    className="w-full text-left mt-3"
                  >
                    <p className="text-sm">
                      <span className="font-bold">Primary:</span>{' '}
                      <span className="text-muted">{primaryPhrase(t)}</span>
                    </p>
                    {secondaries.length > 0 && (
                      <p className="text-sm text-muted mt-0.5">
                        Also watching: {secondaries.join(', ')}
                      </p>
                    )}
                  </button>
                  {info && <EvidencePanel t={t} />}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-muted uppercase tracking-widest mt-8 mb-3">Optional</p>
          <div className="rounded-2xl border border-dashed border-white/20 p-4">
            <p className="font-semibold text-lg">Have your own idea?</p>
            <p className="text-sm text-muted mt-1">
              Write your own hypothesis and choose what to measure.
            </p>
            <button
              type="button"
              onClick={() => { setCustomOpen((v) => !v); setSelected(null) }}
              className="text-sm text-muted underline underline-offset-4 mt-2"
            >
              Write my own experiment
            </button>
            {customOpen && (
              <div className="space-y-3 mt-4">
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

          <button
            type="button"
            onClick={testSelected}
            disabled={!selected}
            className="btn-primary w-full mt-6 !py-4 text-lg"
            style={{ opacity: selected ? 1 : 0.5 }}
          >
            Test this for 12 days
          </button>
          {!showAll && usable.length > SHOWN_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full mt-3 rounded-xl border border-white/15 py-4 font-semibold"
            >
              See all {usable.length} experiments
            </button>
          )}
        </div>
      )}
    </main>
  )
}
