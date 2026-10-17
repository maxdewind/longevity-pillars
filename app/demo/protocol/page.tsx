'use client'

import { useState } from 'react'
import { useDemo, DemoGate, fmtPub } from '../DemoProvider'
import { toCards, statePill, shortHalfName, fmtTime, type DemoCard } from '../shared'

function ProtocolBody() {
  const { snap, publishedAt } = useDemo()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (!snap) return null

  const nutrition = toCards(snap.routines.filter((r) => r.pillar === 'nutrition'))
  const movement = toCards(snap.routines.filter((r) => r.pillar === 'movement'))
  const mind = toCards(snap.routines.filter((r) => r.pillar === 'mind'))

  const renderCard = (card: DemoCard) => {
    const rows = card.rows
    const split = rows.length > 1
    const committedOn = rows.every((r) => r.committed)
    return (
      <div key={card.key} className="card">
        <button
          type="button"
          onClick={() => setExpanded((e) => ({ ...e, [card.key]: !e[card.key] }))}
          className="w-full text-left flex items-start justify-between gap-2"
          style={{ background: 'none' }}
        >
          <span className="font-bold">
            {card.title}
            {rows.some((r) => r.is_experimental) && (
              <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: '#2a2d36', color: '#9aa0ae' }}>
                Experimental
              </span>
            )}
          </span>
          <span style={{ color: '#9aa0ae' }}>{expanded[card.key] ? '▾' : '▸'}</span>
        </button>
        {expanded[card.key] && (
          <p className="text-sm mt-1" style={{ color: '#9aa0ae' }}>{card.detail}</p>
        )}
        <div className="flex gap-2 mt-3 flex-wrap">
          {statePill(committedOn, 'Committed')}
          {rows.map((r) => {
            const label = r.held_at ? `Ended ${fmtTime(r.held_at)}` : shortHalfName(r.label)
            return <span key={r.id}>{statePill(r.held, split ? label : 'Held')}</span>
          })}
        </div>
        {!split && (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
            Held {rows[0].held14}/{rows[0].days14} days · Committed {rows[0].committed14}/{rows[0].days14} mornings
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Today&apos;s protocol</h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        His actual check-ins, as published{publishedAt ? ` ${fmtPub(publishedAt)}` : ''}. Read-only.
      </p>
      {mind.length > 0 && (
        <>
          <h2 className="text-base font-bold pt-2">Mind</h2>
          {mind.map(renderCard)}
        </>
      )}
      <h2 className="text-base font-bold pt-2">Nutrition</h2>
      {nutrition.map(renderCard)}
      <h2 className="text-base font-bold pt-2">Movement</h2>
      {movement.map(renderCard)}
    </div>
  )
}

export default function DemoProtocolPage() {
  return (
    <DemoGate>
      <ProtocolBody />
    </DemoGate>
  )
}
