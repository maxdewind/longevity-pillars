-- 0024: profile fields for reference-range comparison + catalogue title tweak.
alter table public.profiles
  add column if not exists age int,
  add column if not exists sex text;

update public.experiment_templates
set title = 'Intermittent fasting (11:30 to 19:30)'
where level_number = 9;
