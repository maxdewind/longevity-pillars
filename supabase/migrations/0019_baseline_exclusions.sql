-- Per-day baseline exclusions (illness, travel, etc.). Excluded days are
-- omitted from baseline avg/SD/median computations in the app.

create table if not exists public.baseline_exclusions (
  user_id uuid not null references auth.users(id) on delete cascade,
  excluded_date date not null,
  note text not null default '',
  created_at timestamptz default now(),
  primary key (user_id, excluded_date)
);

alter table public.baseline_exclusions enable row level security;

drop policy if exists "baseline_exclusions owner all" on public.baseline_exclusions;
create policy "baseline_exclusions owner all" on public.baseline_exclusions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.baseline_exclusions to authenticated;
