'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DemoProvider, { useDemo, fmtPub } from './DemoProvider'

const NAV = [
  { href: '/demo', label: 'Progress' },
  { href: '/demo/protocol', label: 'Protocol' },
  { href: '/demo/experiment', label: 'Experiment' },
  { href: '/demo/record', label: 'Record' },
  { href: '/demo/weight', label: 'Weight' },
  { href: '/demo/more', label: 'More' },
]

function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { publishedAt } = useDemo()
  return (
    <>
      <div className="sticky top-0 z-40 bg-[#f0506e]/15 backdrop-blur border-b border-[#f0506e]/30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">Demo mode.</span>{' '}
            <span className="text-[#64748b]">
              Max&apos;s real protocol{publishedAt ? `, published ${fmtPub(publishedAt)}` : ''}. Nothing here is saved.
            </span>
          </p>
          <Link href="/signup" className="btn-primary whitespace-nowrap !py-2 !px-4 text-sm">
            Start my real day 1
          </Link>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-ink/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-6">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/demo' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-3 text-center text-xs font-medium ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <DemoShell>{children}</DemoShell>
    </DemoProvider>
  )
}
