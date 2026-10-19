-- Spec v0.1 (Experiment Card and Lifecycle): 7-day sprints, new verdict
-- vocabulary (Held / Not held / Held but no signal yet), sustainability
-- rating, blockers, pinned metrics, smaller-rule ramps, maintained/retired
-- states, watch-verifiable rules, per-template ramp steps.

-- ---------------------------------------------------------------------------
-- 1. Widen the verdict vocabulary (old values kept for history).
-- ---------------------------------------------------------------------------
alter table public.experiments drop constraint if exists experiments_verdict_check;
alter table public.experiments
  add constraint experiments_verdict_check
  check (verdict in ('keep', 'another_week', 'drop', 'inconclusive',
                    'held', 'not_held', 'held_no_signal'));

-- ---------------------------------------------------------------------------
-- 2. Widen the status vocabulary: active / done / maintained / retired.
--    (The original check was created inline in 0012, so find it by definition.)
-- ---------------------------------------------------------------------------
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.experiments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%''active''%'
    and pg_get_constraintdef(oid) like '%''done''%';

  if cname is not null then
    execute format('alter table public.experiments drop constraint %I', cname);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'experiments_status_check'
  ) then
    alter table public.experiments
      add constraint experiments_status_check
      check (status in ('active', 'done', 'maintained', 'retired'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. New columns on experiments.
-- ---------------------------------------------------------------------------
-- How hard the rule was to keep: easy | ok | hard (asked at the day-7 verdict).
alter table public.experiments
  add column if not exists sustainability text
  check (sustainability in ('easy', 'ok', 'hard'));

-- "What got in the way" chips on a not-held verdict.
alter table public.experiments
  add column if not exists blockers text[] not null default '{}';

-- Up to 3 pinned metric keys; pinned metrics appear as "Also moved" rows.
alter table public.experiments
  add column if not exists pinned_metrics text[] not null default '{}';

-- Smaller-rule ramp: [{ "label": "11:00 PM", "detail": "Lights out by 11:00 PM" }],
-- with ramp_step as the 0-based current step.
alter table public.experiments add column if not exists ramp_steps jsonb;
alter table public.experiments add column if not exists ramp_step int;

-- 4-week re-read date for maintained rules.
alter table public.experiments add column if not exists reread_date date;

-- Days added by the "Extend 3 days" action (informational; end_date is source of truth).
alter table public.experiments add column if not exists extended_days int not null default 0;

-- Primary metric for custom (non-catalogue) experiments. Catalogue runs
-- read it from their template; this covers write-your-own.
alter table public.experiments add column if not exists primary_metric text;

-- ---------------------------------------------------------------------------
-- 4. Template flags for the spec model.
-- ---------------------------------------------------------------------------
-- True when the watch can verify the rule (no manual taps; auto-checked).
alter table public.experiment_templates
  add column if not exists watch_verifiable boolean not null default false;

-- Smaller-rule ramp steps per catalogue experiment, e.g.
-- [{ "label": "11:00 PM", "detail": "Lights out by 11:00 PM" }].
-- Null for on/off rules (no smaller version offered).
alter table public.experiment_templates
  add column if not exists ramp_steps jsonb;

-- The fixed bedtime rule is watch-verifiable via the bedtime metric,
-- with a 3-step ramp back to 10:30 PM.
update public.experiment_templates
set watch_verifiable = true,
    ramp_steps = '[
      {"label": "11:00 PM", "detail": "Lights out by 11:00 PM"},
      {"label": "10:45 PM", "detail": "Lights out by 10:45 PM"},
      {"label": "10:30 PM", "detail": "Lights out by 10:30 PM"}
    ]'::jsonb
where level_number = 1;
