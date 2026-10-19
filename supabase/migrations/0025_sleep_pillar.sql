-- 0025: allow the sleep pillar on protocols (template catalogue and custom
-- experiments both use it) + move bedtime experiment to 22:30.
alter table public.protocols drop constraint protocols_pillar_check;
alter table public.protocols
  add constraint protocols_pillar_check
  check (pillar in ('nutrition', 'movement', 'sleep', 'mind'));

update public.experiment_templates
set title = 'In bed by 22:30',
    detail = 'Lights out by 10:30 pm every night of the run.'
where level_number = 1;
