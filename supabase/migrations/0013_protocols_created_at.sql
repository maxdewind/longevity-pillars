-- Track when each protocol routine was added so per-routine counts can start
-- at the right date instead of the journey start.
alter table public.protocols
  add column if not exists created_at timestamptz not null default now();

-- Backfill: earliest evidence of the routine's existence — its first check,
-- the day it became mandatory, or the user's first check day (in that order).
update public.protocols p
set created_at = coalesce(
  nullif(least(
    coalesce((select min(c.log_date) from public.protocol_checks c where c.protocol_id = p.id), 'infinity'::date),
    coalesce(p.mandatory_since, 'infinity'::date),
    coalesce((select min(c2.log_date) from public.protocol_checks c2 where c2.user_id = p.user_id), 'infinity'::date)
  ), 'infinity'::date)::timestamptz,
  now()
);
