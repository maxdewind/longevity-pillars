-- Longevity Pillars: routine framework v2 (2026-10-10).
--
-- 1. Split the single eating-window routine into two independently-scored
--    mandatory lines: "First meal at or after 11:30" and "Eating closed by
--    19:30". A missed start never cancels the closure.
-- 2. Promote to mandatory: 2 meals, no white rice/flour, gluten-free.
--    "Optional" as a permanent category is retired.
-- 3. Fold "Micro bodyweight set" into Daily movement as the never-zero fallback.
-- 4. "Gym workout (weightlifting)" becomes "Strength training 3×/week":
--    mandatory, weekly cadence (3 sessions Mon-Sun).
-- 5. Add two pre-registered experimental routines (Exp #1 Morning fuel cap,
--    Exp #2 Changeroom shake). Experiment verdict machinery is phase 2;
--    here they tick daily like any other routine, tagged experimental.
-- 6. Canonical eating-window close is 19:30 everywhere.

alter table public.protocols
  add column if not exists cadence text not null default 'daily',
  add column if not exists is_experimental boolean not null default false;

-- ---------------------------------------------------------------------------
-- Existing users
-- ---------------------------------------------------------------------------

-- Retire the old composite window routine (history preserved, no longer shown).
update public.protocols
  set enabled = false
  where label like 'Keep the 11:30%eating window';

-- Renumber the remaining nutrition routines to make room for the two new
-- window lines at positions 1 and 2.
update public.protocols set position = 3 where label = 'Eat 2 meals, each within 30 minutes';
update public.protocols set position = 4 where label = 'No added sugar';
update public.protocols set position = 5 where label = 'No white rice or white flour';
update public.protocols set position = 6 where label = 'Stay gluten-free';
update public.protocols set position = 7 where label = 'No fast food';

-- Promote the three to mandatory (users can still toggle). Backfill
-- mandatory_since from the user's first logged check, else today.
update public.protocols p
  set is_mandatory = true,
      mandatory_since = coalesce(
        p.mandatory_since,
        (select min(c.log_date) from public.protocol_checks c where c.user_id = p.user_id),
        current_date
      )
  where label in ('Eat 2 meals, each within 30 minutes', 'No white rice or white flour', 'Stay gluten-free');

-- The two new window lines: fresh hold counts from today, mandatory.
insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select u.id, 'nutrition', 'First meal at or after 11:30',
  'First MEAL at or after 11:30 AM. Fuel (morning fuel cap, changeroom shake) is governed by its own line and is not a meal.',
  1, true, current_date, 'daily', false
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'First meal at or after 11:30'
);

insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select u.id, 'nutrition', 'Eating closed by 19:30',
  'All eating done by 19:30. Scored independently - a missed start never cancels the closure.',
  2, true, current_date, 'daily', false
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'Eating closed by 19:30'
);

-- The two pre-registered experiments (tick daily; verdict machinery is phase 2).
insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select u.id, 'nutrition', 'Morning fuel cap',
  'Before 11:30, the only intake permitted is fuel within a pre-logged 175 kcal cap. At ~7:30: IF today''s pre-11:30 fuel is already weighed and logged at or under 175 kcal, THEN cream goes in the coffee; otherwise black.',
  8, false, null, 'daily', true
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'Morning fuel cap'
);

insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select u.id, 'nutrition', 'Changeroom shake',
  'IF in the gym changeroom before a training session, THEN: 15g pea protein + 15g collagen + 250mg vitamin C in water. Before 11:30 it counts inside the 175 kcal cap; after 11:30 it''s window intake. Rest days / anywhere else: the rule doesn''t fire.',
  9, false, null, 'daily', true
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'Changeroom shake'
);

-- Daily movement absorbs the micro bodyweight set as its never-zero fallback.
update public.protocols
  set detail = '8,000+ steps or 30 minutes of walking, cycling, elliptical or equivalent activity. Never-zero fallback: a micro bodyweight set (a few push-ups, pull-ups and squats) counts when nothing else is possible.'
  where label = 'Daily movement';

-- The standalone micro bodyweight row is retired (history preserved).
update public.protocols
  set enabled = false
  where label = 'Micro bodyweight set';

-- Gym workout becomes weekly-cadence Strength training, mandatory.
update public.protocols p
  set label = 'Strength training 3×/week',
      detail = 'Three strength sessions per week. Any split, any duration that counts.',
      cadence = 'weekly',
      is_mandatory = true,
      mandatory_since = coalesce(
        p.mandatory_since,
        (select min(c.log_date) from public.protocol_checks c where c.user_id = p.user_id),
        current_date
      )
  where label = 'Gym workout (weightlifting)';

-- ---------------------------------------------------------------------------
-- New-user seed
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.protocols
    (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
  values
    (new.id, 'nutrition', 'First meal at or after 11:30',
      'First MEAL at or after 11:30 AM. Fuel (morning fuel cap, changeroom shake) is governed by its own line and is not a meal.',
      1, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'Eating closed by 19:30',
      'All eating done by 19:30. Scored independently - a missed start never cancels the closure.',
      2, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes',
      'Two clear meals instead of all-day grazing.',
      3, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'No added sugar',
      'Keep today free of foods with added sugar.',
      4, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'No white rice or white flour',
      'Choose foods outside the refined white-rice and white-flour pattern.',
      5, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'Stay gluten-free',
      'Keep both meals gluten-free.',
      6, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'No fast food',
      'Cook or choose clean. No fast food today.',
      7, true, current_date, 'daily', false),
    (new.id, 'nutrition', 'Morning fuel cap',
      'Before 11:30, the only intake permitted is fuel within a pre-logged 175 kcal cap. At ~7:30: IF today''s pre-11:30 fuel is already weighed and logged at or under 175 kcal, THEN cream goes in the coffee; otherwise black.',
      8, false, null, 'daily', true),
    (new.id, 'nutrition', 'Changeroom shake',
      'IF in the gym changeroom before a training session, THEN: 15g pea protein + 15g collagen + 250mg vitamin C in water. Before 11:30 it counts inside the 175 kcal cap; after 11:30 it''s window intake. Rest days / anywhere else: the rule doesn''t fire.',
      9, false, null, 'daily', true),
    (new.id, 'movement', 'Daily movement',
      '8,000+ steps or 30 minutes of walking, cycling, elliptical or equivalent activity. Never-zero fallback: a micro bodyweight set (a few push-ups, pull-ups and squats) counts when nothing else is possible.',
      1, true, current_date, 'daily', false),
    (new.id, 'movement', 'Strength training 3×/week',
      'Three strength sessions per week. Any split, any duration that counts.',
      2, true, current_date, 'weekly', false);
  insert into public.attempts (user_id) values (new.id);
  return new;
end;
$$;
