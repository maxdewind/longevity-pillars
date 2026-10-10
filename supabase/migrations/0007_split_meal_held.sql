-- Longevity Pillars: split Held on "Eat 2 meals, each within 30 minutes" (2026-10-10).
--
-- Same decoupling principle as the window split: each meal is scored
-- independently, so partial adherence counts. Implemented as two routine rows
-- ("... (Meal 1)" / "... (Meal 2)") sharing a card_group, rendered as ONE
-- card with two half-width Held buttons. Committed stays single: one tap
-- commits both rows. Tripwires, the diary summary and the 90-day target all
-- operate per row with no changes.
--
-- The pre-existing row keeps its history and becomes Meal 1; Meal 2 starts
-- fresh today.

alter table public.protocols
  add column if not exists card_group text;

-- Existing users: tag and rename the current row as Meal 1.
update public.protocols
  set card_group = 'two-meals',
      label = 'Eat 2 meals, each within 30 minutes (Meal 1)'
  where label = 'Eat 2 meals, each within 30 minutes';

-- Existing users: add the Meal 2 row, mirroring Meal 1's flags (fresh counts).
insert into public.protocols
  (user_id, pillar, label, detail, position, enabled, is_mandatory, mandatory_since, cadence, is_experimental, card_group)
select user_id, pillar,
      'Eat 2 meals, each within 30 minutes (Meal 2)',
      detail, position, enabled, is_mandatory, current_date, cadence, false, 'two-meals'
from public.protocols
where label = 'Eat 2 meals, each within 30 minutes (Meal 1)'
  and not exists (
    select 1 from public.protocols q
    where q.user_id = public.protocols.user_id
      and q.label = 'Eat 2 meals, each within 30 minutes (Meal 2)'
  );

-- New-user seed: both meal rows from day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.protocols
    (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental, card_group)
  values
    (new.id, 'nutrition', 'First meal at or after 11:30',
      'First MEAL at or after 11:30 AM. Fuel (morning fuel cap, changeroom shake) is governed by its own line and is not a meal.',
      1, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'Eating closed by 19:30',
      'All eating done by 19:30. Scored independently - a missed start never cancels the closure.',
      2, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes (Meal 1)',
      'Two clear meals instead of all-day grazing. Each meal held independently - one tap per 30-minute meal.',
      3, true, current_date, 'daily', false, 'two-meals'),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes (Meal 2)',
      'Two clear meals instead of all-day grazing. Each meal held independently - one tap per 30-minute meal.',
      3, true, current_date, 'daily', false, 'two-meals'),
    (new.id, 'nutrition', 'No added sugar',
      'Keep today free of foods with added sugar.',
      4, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'No white rice or white flour',
      'Choose foods outside the refined white-rice and white-flour pattern.',
      5, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'Stay gluten-free',
      'Keep both meals gluten-free.',
      6, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'No fast food',
      'Cook or choose clean. No fast food today.',
      7, true, current_date, 'daily', false, null),
    (new.id, 'nutrition', 'Morning fuel cap',
      'Before 11:30, the only intake permitted is fuel within a pre-logged 175 kcal cap. At ~7:30: IF today''s pre-11:30 fuel is already weighed and logged at or under 175 kcal, THEN cream goes in the coffee; otherwise black.',
      8, false, null, 'daily', true, null),
    (new.id, 'nutrition', 'Changeroom shake',
      'IF in the gym changeroom before a training session, THEN: 15g pea protein + 15g collagen + 250mg vitamin C in water. Before 11:30 it counts inside the 175 kcal cap; after 11:30 it''s window intake. Rest days / anywhere else: the rule doesn''t fire.',
      9, false, null, 'daily', true, null),
    (new.id, 'movement', 'Daily movement',
      '8,000+ steps or 30 minutes of walking, cycling, elliptical or equivalent activity. Never-zero fallback: a micro bodyweight set (a few push-ups, pull-ups and squats) counts when nothing else is possible.',
      1, true, current_date, 'daily', false, null),
    (new.id, 'movement', 'Strength training 3×/week',
      'Three strength sessions per week. Any split, any duration that counts.',
      2, true, current_date, 'weekly', false, null);
  insert into public.attempts (user_id) values (new.id);
  return new;
end;
$$;
