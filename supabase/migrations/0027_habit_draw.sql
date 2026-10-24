-- 0027: daily habit draw (classic app only, /app/protocol).
-- The classic pool is the user's existing classic protocols. Each day the
-- app draws 3 per pillar. Small actions need three new protocol fields:
--   retired: out of the daily draw, kept on a retired list (restorable).
--   focus_until: a Needs focus habit is pinned into the daily 3 until
--     this date (tapping Needs focus sets it to today + 6 days, so the
--     habit stays in the draw for the next week, today included).
--   paused_on: a Pause skips the habit for that date only. Tomorrow the
--     date no longer matches, so the habit is eligible again with no
--     cleanup step.
-- Also adds the 'social' pillar (shown as Social connections) so every
-- pillar has a section even when it starts empty. Existing RLS grants
-- already cover the protocols table; new columns need no new grants.

alter table public.protocols
  add column if not exists retired boolean not null default false;

alter table public.protocols
  add column if not exists focus_until date;

alter table public.protocols
  add column if not exists paused_on date;

alter table public.protocols drop constraint if exists protocols_pillar_check;

alter table public.protocols
  add constraint protocols_pillar_check
  check (pillar in ('nutrition', 'movement', 'sleep', 'mind', 'social'));
