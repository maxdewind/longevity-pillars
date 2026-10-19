'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { todayISO, fmtMD } from '@/lib/format'
import { addDays, diffDays, errMsg, type ExperimentTemplate, type LevelsExperiment } from '@/lib/levels'
import { startLevelExperiment } from '@/lib/levelStart'
import { fmtHeldXofY } from '@/lib/sprint'
import { METRIC_LABELS } from '@/lib/levels'

const PROTOCOL_CEILING = 8

interface MaintainedRow {
  exp: LevelsExperiment
  detail: string
  watchAuto: boolean
  heldLast7: number
}

export default function MyProtocolPage() {
  const router = useRouter()
  const [activeExp, setActiveExp] = useState<LevelsExperiment | null>(null)
  const [maintained, setMaintained] = useState<MaintainedRow[]>([])
  const [retired, setRetired] = useState<LevelsExperiment[]>([])
  const [suggestions, setSuggestions] = useState<ExperimentTemplate[]>([])
  const [allTemplates, setAllTemplates] = useState<ExperimentTemplate[]>([])
  const [catalogueCount, setCatalogueCount] = useState(0)
  const [customOpen, setCustomOpen] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDetail, setCustomDetail] = useState('')
  const [customMetric, setCustomMetric] = useState('sleep_hours')
  const [loaded, setLoaded] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickThree = (tpls: ExperimentTemplate[], excludeLevels: (number | null)[]) => {
    const pool = tpls.filter(
      (t) => t.primary_metric !== 'weight_lb' && !excludeLevels.includes(t.level_number),
    )
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setSuggestions(shuffled.slice(0, 3))
  }

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }

        const { data: tpl } = await supabase
          .from('experiment_templates').select('*').order('level_number')
        const tpls = ((tpl as ExperimentTemplate[] | null) ?? [])
        setAllTemplates(tpls)
        setCatalogueCount(tpls.length)

        const { data: exps } = await supabase
          .from('experiments').select('*')
          .eq('user_id', user.id).eq('mode', 'levels')
          .order('created_at', { ascending: false })
        const rows = ((exps as LevelsExperiment[] | null) ?? [])

        const active = rows.find((e) => e.status === 'active') ?? null
        setActiveExp(active)

        const tplByLevel = new Map(tpls.map((t) => [t.level_number, t]))
        const kept = rows.filter((e) => e.status === 'maintained')
        const since = addDays(todayISO(), -6)
        const mrows: MaintainedRow[] = await Promise.all(kept.map(async (e) => {
          const t = e.template_level != null ? tplByLevel.get(e.template_level) : undefined
          const { data: checks } = await supabase
            .from('protocol_checks').select('log_date, held')
            .eq('user_id', user.id).eq('protocol_id', e.protocol_id)
            .gte('log_date', since)
          const tapHeld = new Set(
            ((checks as { log_date: string; held: boolean }[] | null) ?? [])
              .filter((c) => c.held).map((c) => c.log_date),
          )
          const watchAuto = !!t?.watch_verifiable
          let heldLast7 = tapHeld.size
          if (watchAuto) {
            // Watch-verifiable bedtime rule: night N held when bedtime on wake date N+1 <= 22:30.
            const { data: bt } = await supabase
              .from('metric_entries').select('entry_date, value')
              .eq('user_id', user.id).eq('metric_key', 'bedtime')
              .gte('entry_date', since).lte('entry_date', addDays(todayISO(), 1))
            const byWake = new Map(
              ((bt as { entry_date: string; value: number }[] | null) ?? []).map((r) => [r.entry_date, Number(r.value)]),
            )
            let n = 0
            for (let i = 0; i < 7; i++) {
              const night = addDays(since, i)
              if (tapHeld.has(night)) { n++; continue }
              const v = byWake.get(addDays(night, 1))
              if (v != null && Number.isFinite(v) && v <= 22.5) n++
            }
            heldLast7 = n
          }
          const { data: proto } = await supabase
            .from('protocols').select('detail').eq('id', e.protocol_id).maybeSingle()
          return {
            exp: e,
            detail: ((proto as { detail?: string } | null)?.detail) ?? t?.detail ?? '',
            watchAuto,
            heldLast7,
          }
        }))
        setMaintained(mrows)
        setRetired(rows.filter((e) => e.status === 'retired'))

        if (!active) {
          const usedLevels = rows
            .filter((e) => e.status === 'maintained' || e.status === 'active')
            .map((e) => e.template_level)
          pickThree(tpls, usedLevels)
        }
      } catch (e) {
        setError(errMsg(e))
      }
      setLoaded(true)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startTemplate = async (t: ExperimentTemplate) => {
    if (acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const id = await startLevelExperiment(
        supabase, user.id,
        { level_number: t.level_number, title: t.title, detail: t.detail, pillars: t.pillars ?? [], primary_metric: t.primary_metric },
        t.detail,
      )
      router.push(`/experiment/started/${id}`)
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const startCustom = async () => {
    const title = customTitle.trim()
    if (!title || acting) return
    setActing(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')
      const id = await startLevelExperiment(
        supabase, user.id,
        {
          level_number: null, title,
          detail: customDetail.trim() || title,
          pillars: ['mind'], primary_metric: customMetric,
        },
        customDetail.trim() || title,
      )
      router.push(`/experiment/started/${id}`)
    } catch (e) {
      setError(errMsg(e))
      setActing(false)
    }
  }

  const retire = async (e: LevelsExperiment) => {
    if (!confirm(`Retire "${e.title}"? It stays archived and can be restored.`)) return
    const supabase = createClient()
    await supabase.from('experiments').update({ status: 'retired' }).eq('id', e.id)
    await supabase.from('protocols').update({ enabled: false }).eq('id', e.protocol_id)
    window.location.reload()
  }

  const restore = async (e: LevelsExperiment) => {
    const supabase = createClient()
    await supabase.from('experiments').update({
      status: 'maintained',
      reread_date: addDays(todayISO(), 28),
    }).eq('id', e.id)
    await supabase.from('protocols').update({ enabled: true }).eq('id', e.protocol_id)
    window.location.reload()
  }

  if (!loaded) return <main className="p-6 text-muted">Loading…</main>

  const atCeiling = maintained.length >= PROTOCOL_CEILING

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-28">
      <h1 className="text-4xl font-bold">My protocol</h1>
      <p className="text-muted mt-2">
        {maintained.length === 0
          ? 'No rules maintained yet'
          : `${maintained.length} ${maintained.length === 1 ? 'rule' : 'rules'} maintained`}
      </p>

      {activeExp && (
        <Link
          href={`/experiment/app/levels/${activeExp.id}`}
          className="card mt-6 block"
          style={{ textDecoration: 'none', borderColor: '#f0506e', borderWidth: 1.5 }}
        >
          <p className="text-xs text-muted uppercase tracking-widest">
            Active experiment · Day {Math.max(diffDays(activeExp.start_date, todayISO()) + 1, 1)} of {activeExp.window_days ?? 7}
          </p>
          <p className="font-bold text-xl mt-1">{activeExp.title}</p>
          <p className="text-sm mt-2" style={{ color: '#f0506e' }}>Open today →</p>
        </Link>
      )}

      {maintained.map((m) => (
        <div key={m.exp.id} className="card mt-4">
          <p className="text-xs uppercase tracking-widest" style={{ color: '#f0506e' }}>Maintained</p>
          <p className="font-bold text-xl mt-1">{m.exp.title}</p>
          <p className="text-sm text-muted mt-1">
            {m.detail}{m.watchAuto ? ' · auto-checked by your watch' : ''}
          </p>
          <div className="flex items-baseline justify-between mt-3">
            <p className="text-muted">Held</p>
            <p className="font-bold">{fmtHeldXofY(m.heldLast7, 7).replace('Held ', '')}</p>
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-muted">4-week re-read</p>
            <p className="font-bold">{m.exp.reread_date ? fmtMD(m.exp.reread_date) : '—'}</p>
          </div>
          <p className="text-right mt-3">
            <button
              type="button"
              onClick={() => retire(m.exp)}
              className="text-sm text-muted underline underline-offset-4"
            >
              Retire
            </button>
          </p>
        </div>
      ))}

      {!activeExp && (
        <>
          <p className="font-semibold mt-8 mb-3" style={{ color: '#f0506e' }}>
            {atCeiling ? 'Protocol ceiling' : 'Next experiment unlocked'}
          </p>
          {atCeiling ? (
            <div className="card">
              <p>
                You are maintaining {maintained.length} rules. Retire or merge one before
                unlocking another experiment.
              </p>
            </div>
          ) : (
            <>
              {suggestions.map((t) => (
                <button
                  key={t.level_number}
                  type="button"
                  onClick={() => startTemplate(t)}
                  disabled={acting}
                  className="card w-full text-left mt-3"
                >
                  <p className="font-semibold text-lg">{t.title}</p>
                  <p className="text-sm text-muted mt-1">{t.detail}</p>
                </button>
              ))}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const used = maintained.map((m) => m.exp.template_level)
                    pickThree(allTemplates, used)
                  }}
                  className="btn"
                >
                  Shuffle
                </button>
                <button
                  type="button"
                  onClick={() => setCustomOpen((v) => !v)}
                  className="btn"
                >
                  Write my own
                </button>
              </div>
              <p className="text-xs text-muted mt-3 text-center">
                {catalogueCount} experiments in the catalogue
              </p>
              {customOpen && (
                <div className="card mt-4">
                  <p className="font-semibold text-lg">Your own experiment</p>
                  <input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Name it (e.g. Fixed bedtime)"
                    className="input w-full mt-3"
                  />
                  <input
                    value={customDetail}
                    onChange={(e) => setCustomDetail(e.target.value)}
                    placeholder="The rule (e.g. Lights out by 10:30 PM)"
                    className="input w-full mt-3"
                  />
                  <select
                    value={customMetric}
                    onChange={(e) => setCustomMetric(e.target.value)}
                    className="input w-full mt-3"
                  >
                    {(Object.keys(METRIC_LABELS) as string[]).map((k) => (
                      <option key={k} value={k}>{METRIC_LABELS[k as keyof typeof METRIC_LABELS].label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={startCustom}
                    disabled={acting || !customTitle.trim()}
                    className="btn-primary w-full mt-4"
                  >
                    Start 7-day sprint
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {retired.length > 0 && (
        <>
          <p className="text-xs text-muted uppercase tracking-widest mt-10 mb-3">
            Retired ({retired.length})
          </p>
          {retired.map((e) => (
            <div key={e.id} className="card mt-3" style={{ opacity: 0.75 }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {e.verdict === 'held' ? 'Held' : e.verdict === 'held_no_signal' ? 'Held, no signal yet' : e.verdict === 'not_held' ? 'Not held' : e.verdict ?? ''}
                    {e.sustainability ? ` · ${e.sustainability}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restore(e)}
                  className="btn !py-2 !px-4 text-sm shrink-0"
                >
                  Restore
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <p className="text-center text-sm text-muted mt-10">Sample data</p>
      {error && <p className="text-sm mt-3" style={{ color: '#e0607e' }}>{error}</p>}
    </main>
  )
}
