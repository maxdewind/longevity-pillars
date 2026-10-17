'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDemo, DemoGate, fmtPub } from '../DemoProvider'
import { toCards, statePill, shortHalfName, fmtTime, type DemoCard } from '../shared'

const WEEKLY_TARGET = 3

function ProtocolBody() {
  const { snap, publishedAt } = useDemo()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (!snap) return null

  const nutrition = toCards(snap.routines.filter((r) => r.pillar === 'nutrition'))
  const movement = toCards(snap.routines.filter((r) => r.pillar === 'movement'))
  const mind = toCards(snap.routines.filter((r) => r.pillar === 'mind'))
  const exp = snap.experiment

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  const renderCard = (card: DemoCard) => {
    const rows = card.rows
    const split = rows.length > 1
    const committedOn = rows.every((r) => r.committed)
    const mandatory = rows[0].is_mandatory
    const isWeekly = rows.length === 1 && rows[0].weekly_sessions !== null
    const missedYesterday = rows.some((r) => r.missed_yesterday)
    return (
      <div key={card.key} className="card">
        <button
          type="button"
          onClick={() => toggle(card.key)}
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
        <p className="text-xs mt-2" style={{ color: '#9aa0ae' }}>
          {mandatory ? 'Mandatory' : 'Not mandatory'}
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {statePill(committedOn, 'Committed')}
          {rows.map((r) => {
            const label = r.held_at ? `Ended ${fmtTime(r.held_at)}` : shortHalfName(r.label)
            return <span key={r.id}>{statePill(r.held, split ? label : 'Held')}</span>
          })}
        </div>
        {isWeekly ? (
          <p className="text-xs tabular-nums mt-2 font-medium" style={{ color: '#c9ccd4' }}>
            {rows[0].weekly_sessions} of {WEEKLY_TARGET} sessions this week (Mon-Sun)
          </p>
        ) : split ? (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
            {rows.map((r) => `${shortHalfName(r.label)} held ${r.held14}/${r.days14}`).join(' · ')}
            {' · '}Committed {rows[0].committed14}/{rows[0].days14} mornings
          </p>
        ) : (
          <p className="text-xs tabular-nums mt-2" style={{ color: '#9aa0ae' }}>
            Held {rows[0].held14}/{rows[0].days14} days · Committed {rows[0].committed14}/{rows[0].days14} mornings
          </p>
        )}
        {missedYesterday && (
          <p className="text-xs mt-2 font-medium" style={{ color: '#c9ccd4' }}>
            It was one day only - get back to routine!
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">
        Today&apos;s protocol{publishedAt ? ` · ${fmtPub(publishedAt)}` : ''}
      </h1>
      <p className="text-sm" style={{ color: '#9aa0ae' }}>
        Committed is the promise you make each morning. Held is what you record
        each night. His actual check-ins, read-only.
      </p>

      {exp && (
        <Link href="/demo/experiment" className="card block" style={{ textDecoration: 'none', borderColor: '#f0506e' }}>
          <p className="text-xs font-semibold tracking-wider" style={{ color: '#f0506e' }}>
            SELF-EXPERIMENT · DAY {exp.day_number} OF {exp.duration_days}
          </p>
          <p className="text-sm font-bold mt-1">{exp.title}</p>
          <p className="text-xs mt-1" style={{ color: '#9aa0ae' }}>Tap to view weight vs adherence →</p>
        </Link>
      )}

      {snap.banners.length > 0 && (
        <section className="space-y-3">
          {snap.banners.map((b) => (
            <div key={b.key} className="card">
              <button
                type="button"
                onClick={() => toggle(b.key)}
                className="w-full text-left flex items-start justify-between gap-2"
                style={{ background: 'none' }}
              >
                <span className="text-sm font-bold">{b.title}</span>
                <span style={{ color: '#9aa0ae' }}>{expanded[b.key] ? '▾' : '▸'}</span>
              </button>
              {expanded[b.key] && (
                <p className="text-sm mt-1 italic" style={{ color: '#9aa0ae' }}>{b.body}</p>
              )}
            </div>
          ))}
        </section>
      )}

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
