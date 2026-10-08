-- Longevity Pillars: mandatory vs optional routines for the Rung 1 90-day journey.
--
-- Mandatory routines are daily and each needs 90 cumulative holds to graduate.
-- Optional routines (e.g. gym, HIIT) are tracked for evidence but carry no gate.
-- Users pick their mandatory set at the start of the journey; three ship as
-- mandatory by default (no fast food, no added sugar, daily movement).

alter table public.protocols
  add column if not exists is_mandatory boolean not null default false;

-- Update the signup seed: 9 routines, "No fast food" added, the steps routine
-- becomes modality-flexible "Daily movement" (plantar fasciitis can't do steps
-- but can bike/elliptical), three marked mandatory by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory) values
    (new.id, 'nutrition', 'Keep the 11:30–19:30 eating window', 'Finish eating by 7:30 PM; first meal at or after 11:30 AM.', 1, false),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes', 'Two clear meals instead of all-day grazing.', 2, false),
    (new.id, 'nutrition', 'No added sugar', 'Keep today free of foods with added sugar.', 3, true),
    (new.id, 'nutrition', 'No white rice or white flour', 'Choose foods outside the refined white-rice and white-flour pattern.', 4, false),
    (new.id, 'nutrition', 'Stay gluten-free', 'Keep both meals gluten-free.', 5, false),
    (new.id, 'nutrition', 'No fast food', 'Cook or choose clean. No fast food today.', 6, true),
    (new.id, 'movement', 'Daily movement', '8,000+ steps or 30 min of activity: walk, bike, or elliptical. Any modality that moves you.', 1, true),
    (new.id, 'movement', 'Gym workout (weightlifting)', 'A strength session. Any split, any duration that counts.', 2, false),
    (new.id, 'movement', 'Micro bodyweight set', 'A few push-ups, pull-ups and squats. Any duration.', 3, false);
  insert into public.attempts (user_id) values (new.id);
  return new;
end;
$$;

-- Existing users: rename the steps routine to the flexible "Daily movement".
update public.protocols
  set label = 'Daily movement',
      detail = '8,000+ steps or 30 min of activity: walk, bike, or elliptical. Any modality that moves you.'
  where label = 'Walk 8,000+ steps';

-- Existing users: apply the mandatory defaults (users can toggle any of these).
update public.protocols
  set is_mandatory = true
  where label in ('No added sugar', 'Daily movement');

-- Existing users: add the "No fast food" routine they never had.
insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory)
select u.id, 'nutrition', 'No fast food', 'Cook or choose clean. No fast food today.', 6, true
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'No fast food'
);
