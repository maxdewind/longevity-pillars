-- Longevity Pillars initial schema. Run the whole file in Supabase Dashboard > SQL Editor.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  slip_count int not null default 0
);

create table public.protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar text not null check (pillar in ('nutrition','movement')),
  label text not null,
  detail text not null default '',
  enabled boolean not null default true,
  position int not null default 0,
  committed boolean not null default false
);

create table public.protocol_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid not null references public.protocols(id) on delete cascade,
  log_date date not null,
  held boolean not null default false,
  unique(user_id, protocol_id, log_date)
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_lb numeric not null,
  unique(user_id, log_date)
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_number int not null check (meal_number in (1,2)),
  description text not null default '',
  unique(user_id, log_date, meal_number)
);

create table public.slip_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  note text not null default ''
);

create table public.wave_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  duration_min int not null default 20
);

-- Row Level Security: on for every table; authenticated users touch only their own rows.
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.protocols enable row level security;
alter table public.protocol_checks enable row level security;
alter table public.weight_logs enable row level security;
alter table public.meal_logs enable row level security;
alter table public.slip_logs enable row level security;
alter table public.wave_logs enable row level security;

create policy "own_rows" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "own_rows" on public.attempts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.protocols for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.protocol_checks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.weight_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.meal_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.slip_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows" on public.wave_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Seed new users: profile + 8 protocols + first attempt, via trigger on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.protocols (user_id, pillar, label, detail, position) values
    (new.id, 'nutrition', 'Keep the 11:30–19:30 eating window', 'Finish eating by 7:30 PM; first meal at or after 11:30 AM.', 1),
    (new.id, 'nutrition', 'Eat 2 meals, each within 30 minutes', 'Two clear meals instead of all-day grazing.', 2),
    (new.id, 'nutrition', 'No added sugar', 'Keep today free of foods with added sugar.', 3),
    (new.id, 'nutrition', 'No white rice or white flour', 'Choose foods outside the refined white-rice and white-flour pattern.', 4),
    (new.id, 'nutrition', 'Stay gluten-free', 'Keep both meals gluten-free.', 5),
    (new.id, 'movement', 'Walk 8,000+ steps', 'Low-intensity base. Every step counts. Low impact by default.', 1),
    (new.id, 'movement', 'Gym workout (weightlifting)', 'A strength session. Any split, any duration that counts.', 2),
    (new.id, 'movement', 'Micro bodyweight set', 'A few push-ups, pull-ups and squats. Any duration.', 3);
  insert into public.attempts (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
