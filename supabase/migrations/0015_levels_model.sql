-- Levels experiment model ("pre-primary care" new flow): metric entries, goals,
-- safety screening, protocol library, experiment templates, plus hardening of
-- the experiments table (pre-registration lock, window/observed-day columns,
-- mode/track columns, stability gate). The existing /app flows and all
-- existing rows are untouched: new columns carry defaults, new tables are
-- empty except for the library/template seeds.

-- ---------------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------------

create table if not exists public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  metric_key text not null,
  value numeric not null,
  source text not null default 'manual',
  created_at timestamptz default now(),
  unique (user_id, entry_date, metric_key, source)
);
-- metric_key values: weight_lb, sleep_hours, deep_sleep_min,
-- overnight_hr_bpm, overnight_hrv_ms, vo2max

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null,
  band text not null check (band in ('population', 'aspirational')),
  target_label text not null,
  created_at timestamptz default now(),
  unique (user_id, metric_key)
);

create table if not exists public.safety_screenings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'placeholder',
  answers jsonb not null default '{}',
  updated_at timestamptz default now()
);
-- answers keys: diabetes_meds, pregnancy, ed_history (booleans)

create table if not exists public.protocol_library (
  key text primary key,
  label text not null,
  detail text not null,
  pillar text not null,
  evidence_tier text not null check (evidence_tier in ('A', 'B', 'C')),
  contraindications text[] not null default '{}',
  starter boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.experiment_templates (
  level_number int primary key,
  title text not null,
  detail text not null,
  primary_metric text not null,
  threshold_label text not null,
  threshold_value numeric,
  threshold_direction text not null check (threshold_direction in ('down', 'up')),
  evidence_tier text not null check (evidence_tier in ('A', 'B', 'C')),
  contraindications text[] not null default '{}',
  verdict_driver boolean not null default true,
  baseline_required boolean not null default true
);

-- ---------------------------------------------------------------------------
-- 2. Seeds
-- ---------------------------------------------------------------------------

insert into public.protocol_library
  (key, label, detail, pillar, evidence_tier, contraindications, starter, sort_order)
values
  ('no-added-sugar', 'No added sugar',
   'No foods or drinks with added sugar. Fruit is fine.',
   'nutrition', 'B', '{}', true, 1),
  ('no-fast-food', 'No fast food',
   'No fast-food restaurants, takeout chains, or drive-throughs.',
   'nutrition', 'B', '{}', true, 2),
  ('no-upf', 'No ultra-processed foods',
   'If it has ingredients you would not find in a home kitchen, skip it.',
   'nutrition', 'B', '{}', true, 3),
  ('move-8000-or-500', '8000 steps or 500 active calories',
   'Hit either target each day, tracked by your phone or watch.',
   'movement', 'A', '{}', true, 4)
on conflict (key) do nothing;

insert into public.experiment_templates
  (level_number, title, detail, primary_metric, threshold_label, threshold_value,
   threshold_direction, evidence_tier, contraindications, verdict_driver)
values
  (1, 'Eating window 11:30 to 19:30',
   'First calories at or after 11:30, kitchen closed by 19:30.',
   'overnight_hr_bpm', '10-day average at least 2 bpm below your baseline',
   -2, 'down', 'B', array['diabetes_meds', 'pregnancy', 'ed_history'], true),
  (2, 'Move 15 minutes after each meal',
   'A short walk after every meal, within 30 minutes of finishing.',
   'overnight_hr_bpm', '10-day average at least 2 bpm below your baseline',
   -2, 'down', 'B', '{}', true),
  (3, 'Strength training 3 times a week',
   'Three full-body sessions per week. Track your push-up max as a secondary signal.',
   'weight_lb', 'Median weight at least 1 lb below baseline with consistent direction',
   -1, 'down', 'A', '{}', true),
  (4, 'Pair starches with protein and fiber',
   'White rice, spaghetti and other refined starches are fine, but only alongside meat or fish and vegetables. Never naked.',
   'weight_lb', 'Median weight at least 1 lb below baseline',
   -1, 'down', 'B', '{}', true),
  (5, 'Screens off 60 minutes before bed',
   'No phone, TV, or laptop in the last hour before bed.',
   'sleep_hours', 'Average at least 20 minutes more sleep per night',
   0.33, 'up', 'B', '{}', true),
  (6, 'Last meal 4 hours before bed',
   'Finish eating at least 4 hours before you plan to sleep.',
   'overnight_hr_bpm', '10-day average at least 2 bpm below your baseline',
   -2, 'down', 'C', array['diabetes_meds', 'pregnancy', 'ed_history'], true),
  (7, 'Morning light within 30 minutes of waking',
   'Get outside or to a bright window within 30 minutes of waking.',
   'sleep_hours', 'Average at least 20 minutes more sleep per night',
   0.33, 'up', 'B', '{}', true),
  (8, 'In bed by 23:00',
   'Lights out by 11 pm every night of the run.',
   'sleep_hours', 'Average at least 30 minutes more sleep per night',
   0.5, 'up', 'B', '{}', true),
  (9, 'No tea with dessert after the 2nd meal',
   'Dessert is fine. Tea with it after the second meal is the variable under test.',
   'weight_lb', 'Median weight at least 1 lb below baseline',
   -1, 'down', 'C', '{}', true),
  (10, 'Protein first at each meal',
   'About 30 g of protein before anything else on the plate.',
   'weight_lb', 'Median weight at least 1 lb below baseline',
   -1, 'down', 'B', '{}', true),
  (11, '5-minute evening wind-down',
   'Slow breathing for 5 minutes before bed. Informational only in v1: HRV is too noisy to drive verdicts.',
   'overnight_hrv_ms', 'Average at least 10 percent above baseline',
   10, 'up', 'B', '{}', false),
  (12, 'No snacking between meals',
   'Meals only. Nothing caloric between them.',
   'weight_lb', 'Median weight at least 1 lb below baseline',
   -1, 'down', 'C', array['diabetes_meds', 'pregnancy'], true)
on conflict (level_number) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Columns on existing tables (defaults keep every existing row untouched)
-- ---------------------------------------------------------------------------

-- New-flow experiment = 12-day window with 10 observed days required
-- (observed = window minus 2; the extend verdict makes it 17 / 15).
alter table public.experiments add column if not exists mode text not null default 'classic';
alter table public.experiments add column if not exists window_days int not null default 12;
alter table public.experiments add column if not exists observed_days_required int not null default 10;
alter table public.experiments add column if not exists template_level int references public.experiment_templates(level_number);

alter table public.protocols add column if not exists track text not null default 'classic';

alter table public.profiles add column if not exists stability_gate_pct int not null default 90;

-- Enforce the mode vocabulary and the window-minus-2 rule at the DB level.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'experiments_mode_check'
  ) then
    alter table public.experiments
      add constraint experiments_mode_check check (mode in ('classic', 'levels'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'experiments_window_observed_check'
  ) then
    alter table public.experiments
      add constraint experiments_window_observed_check
      check (observed_days_required = window_days - 2);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Pre-registration lock: freeze hypothesis, title, start_date, protocol_id
--    once an experiment is active. end_date stays mutable (the extend verdict
--    changes it); status may still move active -> done.
--    Real column names verified against 0012_experiments.sql: title,
--    hypothesis, start_date, protocol_id, end_date, status all exist.
-- ---------------------------------------------------------------------------

create or replace function public.freeze_experiment_prereg()
returns trigger language plpgsql as $$
begin
  if old.status = 'active' and new.status = 'active' then
    if new.hypothesis is distinct from old.hypothesis
       or new.title is distinct from old.title
       or new.start_date is distinct from old.start_date
       or new.protocol_id is distinct from old.protocol_id then
      raise exception 'Pre-registration is locked once an experiment is active';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_freeze_experiment_prereg on public.experiments;
create trigger trg_freeze_experiment_prereg
before update on public.experiments
for each row execute function public.freeze_experiment_prereg();

-- ---------------------------------------------------------------------------
-- 5. RLS + GRANTS (explicit grants are required - RLS policies alone do not
--    grant access to the anon/authenticated roles)
-- ---------------------------------------------------------------------------

alter table public.metric_entries enable row level security;
alter table public.goals enable row level security;
alter table public.safety_screenings enable row level security;
alter table public.protocol_library enable row level security;
alter table public.experiment_templates enable row level security;

-- Owner-only access to personal tables (drop-first keeps re-runs safe)
drop policy if exists "metric_entries owner all" on public.metric_entries;
create policy "metric_entries owner all" on public.metric_entries
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals owner all" on public.goals;
create policy "goals owner all" on public.goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "safety_screenings owner all" on public.safety_screenings;
create policy "safety_screenings owner all" on public.safety_screenings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public read for the library / templates (everyone sees the same catalogue)
drop policy if exists "protocol_library public read" on public.protocol_library;
create policy "protocol_library public read" on public.protocol_library
  for select using (true);

drop policy if exists "experiment_templates public read" on public.experiment_templates;
create policy "experiment_templates public read" on public.experiment_templates
  for select using (true);

-- Explicit grants
grant select, insert, update, delete on public.metric_entries to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.safety_screenings to authenticated;
grant select on public.protocol_library to anon, authenticated;
grant select on public.experiment_templates to anon, authenticated;
