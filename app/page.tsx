import type { Metadata } from 'next'
import Link from 'next/link'
import LandingCounter from '@/components/LandingCounter'

export const metadata: Metadata = {
  title: 'Longevity Pillars: a quitter app for ultra-processed food',
  description:
    'Day-one craving support, a 12-milestone journey, and restarts that cost you a day instead of your identity.',
}

const HOW_IT_WORKS = [
  {
    title: 'A counter that never lies',
    body: 'Days, hours, minutes, seconds since my last slip. It ticks. That is the point.',
  },
  {
    title: 'Twelve milestones, honestly timed',
    body: 'From the 4-hour first craving wave to month 6. Each one tells me what is happening in my body, on its own timescale.',
  },
  {
    title: 'A daily protocol with two toggles',
    body: 'Committed is who I am now. Held is just today. A bad day costs me a day, not the whole identity.',
  },
  {
    title: 'A wave rider',
    body: 'Cravings are waves. Twenty minutes. They peak, then they pass. The timer walks me through the worst of it.',
  },
  {
    title: 'A slip diary that forgives',
    body: 'I log a slip, the streak restarts, my history stays. Nothing is erased.',
  },
]

export default function LandingPage() {
  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between py-5">
        <span className="font-semibold tracking-tight">Longevity Pillars</span>
        <Link href="/login" className="text-sm text-[#9aa0ae] hover:text-slate-200">
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="pt-6 space-y-5">
        <h1 className="text-4xl font-bold tracking-tight">Longevity Pillars</h1>
        <p className="text-lg text-[#c3c8d4] leading-relaxed">
          I am building a quitter app for ultra-processed food. Craving support
          from day one, a 12-milestone journey, and restarts that cost you a day
          instead of your identity.
        </p>
        <p className="text-sm text-[#9aa0ae] leading-relaxed">
          Step one: quit ultra-processed food. This is{' '}
          <a
            href="https://x.com/HealthLadderX/status/2107293774506234247"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-slate-200"
          >
            Rung 1 of the Health Ladder
          </a>
          .
        </p>
        <LandingCounter />
        <div className="space-y-3 pt-1">
          <Link href="/signup" className="btn-primary w-full block text-center">
            Start your day 1
          </Link>
          <Link href="/demo" className="btn-ghost w-full block text-center">
            Peek inside the app
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="pt-12 space-y-4">
        <h2 className="text-xl font-bold">How it works</h2>
        {HOW_IT_WORKS.map((item) => (
          <div key={item.title} className="card">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-[#9aa0ae] mt-1 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </section>

      {/* Milestone philosophy */}
      <section className="pt-12">
        <p className="text-xl font-semibold leading-relaxed">
          Cravings are certain, not hypothetical. Hour 4 and month 4 are
          completely different animals. The milestones are built for both.
        </p>
      </section>

      {/* Why I am building this */}
      <section className="pt-12 space-y-4">
        <h2 className="text-xl font-bold">Why I am building this</h2>
        <p className="text-[#c3c8d4] leading-relaxed">
          I have restarted on enough Mondays to know willpower is not the
          problem. Cravings show up on a schedule, so I built something that
          shows up on one too.
        </p>
      </section>

      {/* Final CTA */}
      <section className="pt-12 space-y-3">
        <Link href="/signup" className="btn-primary w-full block text-center">
          Start your day 1
        </Link>
        <Link href="/demo" className="btn-ghost w-full block text-center">
          Peek inside first
        </Link>
      </section>

      {/* Footer */}
      <footer className="pt-12 text-center text-xs text-[#9aa0ae]">
        <p>Built in public by @HealthLadderX.</p>
        <p className="mt-1">Day 1 was October 4, 2026.</p>
      </footer>
    </div>
  )
}
