# Longevity Pillars — Web MVP

A real, deployable web app: the "quitter app for ultra-processed food."
Day-one craving support, a phased 12-milestone journey, and a slip-resilient
restart model. Built with Next.js 14 (App Router, TypeScript) + Supabase
(auth + Postgres), styled mobile-first in the app's dark theme.

## What was built

**Screens:**

Public (no auth required):
- `/` — Landing page: hero with a live ticking demo counter, "Start your day
  1" (→ `/signup`) and "Peek inside the app" (→ `/demo`) CTAs, a "How it
  works" section, the milestone philosophy, and a footer. Logged-in users are
  redirected to `/app`.
- `/demo` — Guest demo mode: a day-1 attempt starting at page load with a
  live ticking counter, milestone 1 of 12 card, the 8 real protocol items
  with working Committed/Held toggles (local state only, nothing saved),
  sample weight card, live savings ticker, a working 20-minute craving
  timer, and a persistent demo banner with a signup CTA. No Supabase calls.

Protected (under `/app`, require auth; unauthenticated users redirect to `/login`):
- `/app` — Progress: live clean-eating counter (days + ticking hh:mm:ss), upcoming
  milestone card directly under the counter (X of 12, progress bar,
  "in Xh Ym"), weight card (starting → editable current → weight plan link),
  stat cards (live savings ticker at $22.50/day over 16 waking hours,
  total clean days, craving waves ridden), a 20-minute "Ride out a wave"
  craving timer, and "Log a slip" (ends the current attempt, starts a new
  one; history is kept).
- `/app/protocol` — Today's checklist grouped by pillar (Nutrition, Movement).
  Each item has two daily toggles, both starting unchecked every morning:
  **Committed** (the promise you re-affirm each morning) and **Held** (what you
  record each night). Both are stored per day in `protocol_checks`.
- `/app/diary` — Meal 1 / Meal 2 free-text fields for today (no calorie counting),
  slip history below.
- `/app/weight` — Log-today input (lb), SVG weight-trend chart, phase targets
  derived from starting weight (2–4% / 4–7% / 6–10% / 10–18% at 1/2/3/6 mo).
- `/app/achievements` — Milestones achieved list from the 12-milestone journey,
  plus "Routine records": per-protocol hold-count milestones at 7, 30, 100.
- `/app/record` — Track record: lifetime committed/held totals, per-routine
  breakdown with hold rate, and a 12-week heatmap of held days. Framed as a
  body of evidence that grows and can never reset to zero.
- `/login`, `/signup` — email/password auth. After sign-in, users land on `/app`.

**Also included:** Supabase SSR auth with middleware session refresh
(unauthenticated users redirect to `/login`), PWA manifest + icons
(installable from a phone home screen), the 12-milestone journey defined in
`lib/milestones.ts` (milestone 1 matches the private app; 2–12 are marked
proposed), and the full database schema in
`supabase/migrations/0001_init.sql`.

**Signup seeding:** handled by a Postgres trigger (`on_auth_user_created`
→ `handle_new_user()`), chosen over app-side setup so *any* signup path
(profile, 8 protocols, first attempt) is seeded atomically, even if the app
code changes.

## 1. Database — run the SQL (2 min)

In the Supabase Dashboard, open **SQL Editor**, paste the entire contents of
`supabase/migrations/0001_init.sql`, and press **Run**. This creates all
tables, enables Row Level Security (users touch only their own rows), adds
explicit grants, and installs the signup seeding trigger.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in (Supabase Dashboard →
**Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

The repo ships with placeholder values so `npm run build` passes without
real credentials. Never commit real keys.

Optional: in Supabase Dashboard → **Authentication → Settings**, turn off
"Confirm email" for frictionless signup during testing.

## 3. Local dev

```
npm install
npm run dev
```

Open http://localhost:3000 — sign up, and the trigger seeds your profile,
protocols, and first attempt automatically.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project → Import** the repo.
3. Add the two environment variables above (same values as `.env.local`).
4. Deploy. Every push to `main` redeploys automatically.

Then update the waitlist page / X bio link to point at the live app.

## Notes / known stubs

- Auth is email/password only (no OAuth providers wired yet).
- "Craving waves ridden" counts completed 20-min timers (`wave_logs`).
- The savings ticker accrues from the current attempt start; a slip ends the
  attempt and the ticker restarts with the new one (history preserved in DB).
- Phase weight targets are estimates, labeled as such in the UI.
- Milestones 2–12 timings/titles are proposed (`proposed: true` in
  `lib/milestones.ts`) — confirm against the private app's journey map.
