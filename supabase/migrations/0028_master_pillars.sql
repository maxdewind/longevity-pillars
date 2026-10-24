-- 0028: master 9 pillars (2026-10-24, user-approved draft).
-- Widen the protocols pillar check to the master list. 'social' is kept
-- for backwards compatibility; the new display name is Family
-- relationships and social connections, stored as 'family'.
-- No rows are changed here. Seeding of the master daily routines happens
-- in the app on first load after this migration, and old classic routines
-- are retired there (not deleted), so history is preserved.

alter table public.protocols drop constraint if exists protocols_pillar_check;

alter table public.protocols
  add constraint protocols_pillar_check
  check (pillar in ('nutrition', 'movement', 'sleep', 'mind', 'social',
                    'cardio', 'family', 'supplements', 'preventive',
                    'accountability'));
