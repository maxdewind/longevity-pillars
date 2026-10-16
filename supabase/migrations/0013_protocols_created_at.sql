-- Track when each protocol routine was added so per-routine counts can start
-- at the right date instead of the journey start.
alter table public.protocols
  add column if not exists created_at timestamptz not null default now();

-- Backfill: earliest per-routine evidence first (its first check, or the day
-- it became mandatory), falling back to the user's first check day.
-- NOTE: an earlier version of this backfill wrongly put the user's global
-- first check date inside least(), which pulled every routine back to the
-- journey start. This corrected version only uses it as a fallback.
update public.protocols p
set created_at = coalesce(
  least(
    (select min(c.log_date)::timestamptz from public.protocol_checks c where c.protocol_id = p.id),
    p.mandatory_since::timestamptz
  ),
  (select min(c2.log_date)::timestamptz from public.protocol_checks c2 where c2.user_id = p.user_id),
  now()
);

-- The Morning fuel cap / Changeroom shake routines were recreated on Oct 15
-- after an over-broad cleanup; they were originally added Oct 10.
update public.protocols
set created_at = '2026-10-10T12:00:00'
where user_id = 'd9409fba-fedc-48bb-b457-1c9e9dc91ad3'
  and label in ('Morning fuel cap', 'Changeroom shake');
