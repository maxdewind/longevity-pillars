-- Mind pillar: allow 'mind' alongside 'nutrition' and 'movement'.
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.protocols'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%pillar%';
  if cname is not null then
    execute format('alter table public.protocols drop constraint %I', cname);
  end if;
end $$;

alter table public.protocols
  add constraint protocols_pillar_check
  check (pillar in ('nutrition', 'movement', 'mind'));

-- First mind routine: daily positive-thoughts check, mandatory, rendered at the very top.
insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select u.id, 'mind', 'Keep positive thoughts',
  'Stay with thoughts that move you forward.',
  0, true, current_date, 'daily', false
from auth.users u
where not exists (
  select 1 from public.protocols q
  where q.user_id = u.id and q.label = 'Keep positive thoughts'
);
