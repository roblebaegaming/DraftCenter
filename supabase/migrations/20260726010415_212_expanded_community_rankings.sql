-- Let the Community page offer Top 50 and Top 100 views. Community ADP
-- already returns up to 50 rows; expand both public trend lists from 20 to
-- 100 without changing their privacy-preserving aggregate shape.

begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.get_public_explore()'::regprocedure
  );
  v_definition := replace(v_definition, 'limit 50', 'limit 100');
  v_definition := replace(v_definition, 'LIMIT 50', 'LIMIT 100');
  execute v_definition;

  v_definition := pg_get_functiondef(
    'public.get_public_draft_trends()'::regprocedure
  );
  v_definition := replace(v_definition, 'limit 20', 'limit 100');
  v_definition := replace(v_definition, 'LIMIT 20', 'LIMIT 100');
  execute v_definition;
end;
$$;

revoke execute on function public.get_public_draft_trends() from public;
grant execute on function public.get_public_draft_trends() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
