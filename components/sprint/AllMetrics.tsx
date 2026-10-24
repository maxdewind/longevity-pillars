'use client'

import { useState } from 'react'
import {
  METRIC_GROUPS,
  METRIC_DRAWER_LABELS,
  fmtMetricValue,
  fmtChangeVsUsual,
  evidenceBlurb,
  type EvidenceTier,
} from '@/lib/sprint'

/**
 * Evidence tag (Early / Moderate / Strong). Opens a short explanation sheet.
 * The full tier sheet is still to design; this is a minimal explainer.
 */
export function EvidenceTag({ tier }: { tier: EvidenceTier }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full text-left"
      >
        <span>Evidence</span>
        <span
          className="text-xs font-bold rounded-full px-3 py-1"
          style={{ background: 'rgba(232,196,104,0.15)', color: '#e8c468', border: '1px solid rgba(232,196,104,0.4)' }}
        >
          {tier}
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-6 pb-10"
            style={{ background: '#f1f5f9' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-muted uppercase tracking-widest">Evidence: {tier}</p>
            <p className="mt-3 leading-relaxed">{evidenceBlurb(tier)}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary w-full mt-6"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export interface DrawerMetric {
  key: string
  value: number | null
  usual: number | null
  valueDate?: string | null
}

/**
 * Collapsed "All metrics (7)" row; expands to grouped metrics with pinning.
 * Pinning changes only what is displayed, never the verdict. Max 3 pinned.
 */
export function AllMetrics({
  metrics,
  primaryKey,
  pinned,
  onTogglePin,
  totalCount,
  compact,
  today,
}: {
  metrics: DrawerMetric[]
  primaryKey: string
  pinned: string[]
  onTogglePin: (key: string) => void
  totalCount: number
  compact?: boolean
  today?: string
}) {
  const [open, setOpen] = useState(false)
  const byKey = new Map(metrics.map((m) => [m.key, m]))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between mt-4 pt-4 border-t border-slate-200"
      >
        <span className="font-semibold" style={{ color: '#f0506e' }}>
          All metrics ({totalCount})
        </span>
        <span className="text-muted text-xl leading-none">⌄</span>
      </button>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <p className="text-sm text-muted">
        Change vs your usual. Exploratory: only {METRIC_DRAWER_LABELS[primaryKey]?.toLowerCase() ?? 'the primary metric'} decides the verdict.
      </p>
      {METRIC_GROUPS.map((g) => {
        const rows = g.keys.map((k) => byKey.get(k)).filter((m): m is DrawerMetric => !!m && m.value != null)
        if (rows.length === 0) return null
        return (
          <div key={g.title} className={compact ? 'mt-4' : 'mt-5'}>
            <p className="text-xs text-muted uppercase tracking-widest mb-2">{g.title}</p>
            <div className="card !p-0 overflow-hidden">
              {rows.map((m, i) => {
                const isPrimary = m.key === primaryKey
                const isPinned = pinned.includes(m.key)
                const stale = today != null && m.valueDate != null && m.valueDate !== today
                const change = !stale && m.usual != null ? fmtChangeVsUsual(m.key, m.value!, m.usual) : null
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                    style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.08)' } : undefined}
                  >
                    <p>{METRIC_DRAWER_LABELS[m.key] ?? m.key}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {stale ? (
                          <p className="font-bold text-lg tabular-nums text-muted" title={`Last synced ${m.valueDate}`}>?</p>
                        ) : (
                          <>
                            <p className="font-bold text-lg tabular-nums">{fmtMetricValue(m.key, m.value!)}</p>
                            {change && <p className="text-xs text-muted tabular-nums">{change}</p>}
                          </>
                        )}
                      </div>
                      {isPrimary ? (
                        <span
                          className="text-xs font-bold rounded-full px-3 py-1.5"
                          style={{ background: '#f0506e', color: '#fff' }}
                        >
                          Primary
                        </span>
                      ) : isPinned ? (
                        <button
                          type="button"
                          onClick={() => onTogglePin(m.key)}
                          className="text-xs font-bold rounded-full px-3 py-1.5"
                          style={{ background: 'rgba(240,80,110,0.15)', color: '#f0506e', border: '1px solid rgba(240,80,110,0.4)' }}
                        >
                          Pinned
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onTogglePin(m.key)}
                          disabled={pinned.length >= 3}
                          className="text-xs font-bold rounded-full px-3 py-1.5 border"
                          style={{
                            borderColor: '#4a5160',
                            color: pinned.length >= 3 ? '#4a5160' : '#64748b',
                          }}
                        >
                          Pin
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-sm text-muted mt-4">
        Pin up to 3. Pinned metrics appear as Also moved.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn w-full mt-4"
      >
        Collapse ⌃
      </button>
    </div>
  )
}
