-- Optional height for BMI-based weight bands in the goal sliders.
-- RLS on profiles already scopes rows to the owner; grants exist.

alter table public.profiles add column if not exists height_cm numeric;
