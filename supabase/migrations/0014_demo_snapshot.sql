-- Public demo snapshot: the app owner publishes a frozen copy of his own
-- protocol state for the public /demo page ("Peek inside"). Anonymous
-- visitors can only read snapshots; each signed-in user can write only
-- their own row. Nothing publishes itself - the owner taps Publish.
create table public.demo_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.demo_snapshot enable row level security;

create policy "demo_snapshot public read"
  on public.demo_snapshot for select
  using (true);

create policy "demo_snapshot owner write"
  on public.demo_snapshot for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.demo_snapshot to anon;
grant select, insert, update, delete on public.demo_snapshot to authenticated;
