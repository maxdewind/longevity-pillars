-- 0022: catalogue display fields for the first-run experiment picker.
-- secondary_metrics powers the "Also watching" line; evidence_note and
-- sources_url power the expandable evidence panel (both nullable: only
-- curated templates show them).

alter table public.experiment_templates
  add column if not exists secondary_metrics text[] not null default '{}',
  add column if not exists evidence_note text,
  add column if not exists sources_url text;

update public.experiment_templates set secondary_metrics = array['overnight_hrv_ms','deep_sleep_min','weight_lb'] where level_number = 1;
update public.experiment_templates set secondary_metrics = array['overnight_hrv_ms','weight_lb'] where level_number = 2;
update public.experiment_templates set secondary_metrics = array['deep_sleep_min','overnight_hr_bpm'] where level_number = 3;
update public.experiment_templates set secondary_metrics = array['overnight_hr_bpm','deep_sleep_min'] where level_number = 4;
update public.experiment_templates set secondary_metrics = array['deep_sleep_min','overnight_hrv_ms'] where level_number = 5;
update public.experiment_templates set secondary_metrics = array['overnight_hrv_ms','deep_sleep_min','weight_lb'] where level_number = 6;
update public.experiment_templates set secondary_metrics = array['deep_sleep_min','overnight_hr_bpm'] where level_number = 7;
update public.experiment_templates set secondary_metrics = array['deep_sleep_min','overnight_hrv_ms'] where level_number = 8;
update public.experiment_templates set secondary_metrics = array['sleep_hours','overnight_hrv_ms'] where level_number = 9;
update public.experiment_templates set secondary_metrics = array['sleep_hours','deep_sleep_min'] where level_number = 10;
update public.experiment_templates set secondary_metrics = array['overnight_hr_bpm','sleep_hours'] where level_number = 11;
update public.experiment_templates set secondary_metrics = array['overnight_hr_bpm','sleep_hours'] where level_number = 12;

-- Curated evidence note for level 1 (from the first-run screens spec).
update public.experiment_templates
set evidence_note = 'Based on trials of time-restricted eating in adults. Heart rate results are mixed.',
    sources_url = 'https://pubmed.ncbi.nlm.nih.gov/?term=time-restricted+eating+overnight+heart+rate'
where level_number = 1;
