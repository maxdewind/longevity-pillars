'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from './SignOutButton'

const NAV = [
  { href: '/app', label: 'Progress' },
  { href: '/app/protocol', label: 'Protocol' },
  { href: '/app/record', label: 'Record' },
  { href: '/app/diary', label: 'Diary' },
  { href: '/app/weight', label: 'Weight' },
  { href: '/app/achievements', label: 'More' },
]

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hidden =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/' ||
    pathname === '/demo'

  if (hidden) {
    return <main className="max-w-md mx-auto px-4 pt-4 pb-28">{children}</main>
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur border-b border-white/5">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">Longevity Pillars</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-ink/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-6">
          {NAV.map((item) => {
            const active = pathname === item.href
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
