-- Longevity Pillars: written resolution for the Rung 0 -> Rung 1 transition.
-- One free-text resolution per user, shown on the Record page and resurfaced
-- every time an attempt restarts. RLS on profiles already covers own-row
-- updates, so no new policy is needed.

alter table public.profiles
  add column if not exists resolution text not null default '';
