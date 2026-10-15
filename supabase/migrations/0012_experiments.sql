-- Self-experiment module: pre-registered single-change experiments.
create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  title text not null,
  hypothesis text,
  start_date date not null,
  end_date date not null,
  duration_days int not null,
  baseline_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'done')),
  verdict text check (verdict in ('keep', 'another_week', 'drop')),
  created_at timestamptz not null default now(),
  unique(user_id, protocol_id, start_date)
);

alter table public.experiments enable row level security;
create policy "own_rows" on public.experiments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
