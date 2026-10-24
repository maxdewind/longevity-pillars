'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

const NAV = [
  { href: '/experiment/app/today', label: 'Today' },
  { href: '/experiment/app/protocol', label: 'Protocol' },
  { href: '/experiment/app/metrics', label: 'Metrics' },
  { href: '/experiment/app/goals', label: 'Goals' },
  { href: '/experiment/app/more', label: 'More' },
]

export default function StartAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">Longevity Pillars · Levels</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-ink/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/')
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
