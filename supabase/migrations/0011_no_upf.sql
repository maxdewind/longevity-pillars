-- "No ultra-processed foods" as a mandatory daily nutrition routine,
-- positioned immediately after "No fast food".
update public.protocols p
set position = p.position + 1
from public.protocols ff
where ff.user_id = p.user_id
  and ff.label = 'No fast food'
  and p.pillar = 'nutrition'
  and p.position > ff.position;

insert into public.protocols (user_id, pillar, label, detail, position, is_mandatory, mandatory_since, cadence, is_experimental)
select ff.user_id, 'nutrition', 'No ultra-processed foods',
  'Cook or choose clean. Nothing ultra-processed today.',
  ff.position + 1, true, current_date, 'daily', false
from public.protocols ff
where ff.label = 'No fast food'
  and not exists (
    select 1 from public.protocols q
    where q.user_id = ff.user_id and q.label = 'No ultra-processed foods'
  );
