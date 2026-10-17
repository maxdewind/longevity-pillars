-- Widen the experiments.verdict check so the levels model can record
-- 'inconclusive' verdicts. Finds the existing check by its definition
-- (it was created inline in 0012 without an explicit name) and replaces it.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.experiments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%another_week%';

  if cname is not null then
    execute format('alter table public.experiments drop constraint %I', cname);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'experiments_verdict_check'
  ) then
    alter table public.experiments
      add constraint experiments_verdict_check
      check (verdict in ('keep', 'another_week', 'drop', 'inconclusive'));
  end if;
end $$;
