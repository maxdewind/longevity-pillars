-- Experiment templates carry pillar tags so the onboarding pillar picker can
-- show the right options. Templates can span pillars (e.g. exercise helps
-- movement and sleep).

alter table public.experiment_templates
  add column if not exists pillars text[] not null default '{}';

update public.experiment_templates set pillars = array['nutrition'] where level_number = 1;
update public.experiment_templates set pillars = array['movement','nutrition'] where level_number = 2;
update public.experiment_templates set pillars = array['movement','sleep'] where level_number = 3;
update public.experiment_templates set pillars = array['nutrition'] where level_number = 4;
update public.experiment_templates set pillars = array['sleep'] where level_number = 5;
update public.experiment_templates set pillars = array['nutrition','sleep'] where level_number = 6;
update public.experiment_templates set pillars = array['sleep'] where level_number = 7;
update public.experiment_templates set pillars = array['sleep'] where level_number = 8;
update public.experiment_templates set pillars = array['nutrition'] where level_number = 9;
update public.experiment_templates set pillars = array['nutrition'] where level_number = 10;
update public.experiment_templates set pillars = array['sleep','mind'] where level_number = 11;
update public.experiment_templates set pillars = array['nutrition'] where level_number = 12;
