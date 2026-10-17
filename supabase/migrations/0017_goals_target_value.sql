-- Goals now carry a numeric target set with the slider UI (in addition to
-- the band label). Existing rows are untouched; target_value starts null.

alter table public.goals add column if not exists target_value numeric;
