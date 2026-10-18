-- User-chosen Apple Health baseline lookback in days (28 default; 14 short, 90 long).

alter table public.profiles
  add column if not exists baseline_lookback_days int not null default 28;
