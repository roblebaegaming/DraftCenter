-- Keep the priority-round resolver aligned with the ordered-claims schema.
-- Migration 216 named the stored column claim_priority; migration 226
-- accidentally referenced a non-existent priority column in four places.

begin;

do $migration$
declare
  v_definition text;
  v_old_select text :=
    'coalesce(priority, 2147483647) as claim_priority';
  v_new_select text :=
    'coalesce(claim_priority, 2147483647) as claim_priority';
  v_old_group text :=
    'group by coalesce(priority, 2147483647), lower(add_name)';
  v_new_group text :=
    'group by coalesce(claim_priority, 2147483647), lower(add_name)';
  v_old_order text :=
    'order by coalesce(priority, 2147483647), min(submitted_at), lower(add_name)';
  v_new_order text :=
    'order by coalesce(claim_priority, 2147483647), min(submitted_at), lower(add_name)';
  v_old_claim_filter text :=
    'and coalesce(claim.priority, 2147483647) = v_group.claim_priority';
  v_new_claim_filter text :=
    'and coalesce(claim.claim_priority, 2147483647) = v_group.claim_priority';
begin
  select pg_get_functiondef(
    'public.process_private_free_agent_claims_internal(uuid,text,timestamp with time zone,uuid)'::regprocedure
  )
  into v_definition;

  if position(v_old_select in v_definition) = 0
     or position(v_old_group in v_definition) = 0
     or position(v_old_order in v_definition) = 0
     or position(v_old_claim_filter in v_definition) = 0 then
    raise exception
      'The priority-round claim processor does not match the expected migration 226 definition.';
  end if;

  v_definition := replace(v_definition, v_old_select, v_new_select);
  v_definition := replace(v_definition, v_old_group, v_new_group);
  v_definition := replace(v_definition, v_old_order, v_new_order);
  v_definition := replace(
    v_definition,
    v_old_claim_filter,
    v_new_claim_filter
  );
  execute v_definition;
end;
$migration$;

commit;

notify pgrst, 'reload schema';
