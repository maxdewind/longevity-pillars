-- Longevity Pillars: record when a routine became mandatory.
--
-- Tripwires and the "one day only" nudge treat an unlogged day as a miss, but
-- only from the day the routine actually became mandatory. Toggling something
-- to mandatory today must not retro-fire "you missed 5 of the last 7 days".

alter table public.protocols
  add column if not exists mandatory_since date;

-- Backfill: routines already mandatory count from the user's first logged
-- check (the journey start); fall back to today when nothing is logged yet.
update public.protocols p
  set mandatory_since = coalesce(
    (select min(c.log_date) from public.protocol_checks c where c.user_id = p.user_id),
    current_date
  )
  where p.is_mandatory and p.mandatory_since is null;

-- New users: the three mandatory defaults start mandatory on signup day.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since) values
    (new.id, 'nutrition', 'Keep the 11:30–19:30 eating window', 'Finish eating by 7:30 PM; first meal at or after 11:30 AM.', 1, false, null),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes', 'Two clear meals instead of all-day grazing.', 2, false, null),
    (new.id, 'nutrition', 'No added sugar', 'Keep today free of foods with added sugar.', 3, true, current_date),
    (new.id, 'nutrition', 'No white rice or white flour', 'Choose foods outside the refined white-rice and white-flour pattern.', 4, false, null),
    (new.id, 'nutrition', 'Stay gluten-free', 'Keep both meals gluten-free.', 5, false, null),
    (new.id, 'nutrition', 'No fast food', 'Cook or choose clean. No fast food today.', 6, true, current_date),
    (new.id, 'movement', 'Daily movement', '8,000+ steps or 30 min of activity: walk, bike, or elliptical. Any modality that moves you.', 1, true, current_date),
    (new.id, 'movement', 'Gym workout (weightlifting)', 'A strength session. Any split, any duration that counts.', 2, false, null),
    (new.id, 'movement', 'Micro bodyweight set', 'A few push-ups, pull-ups and squats. Any duration.', 3, false, null);
  insert into public.attempts (user_id) values (new.id);
  return new;
end;
$$;
