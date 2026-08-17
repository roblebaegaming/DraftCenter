-- Preserve the pre-auction tier price beside the winning bid so recap awards
-- can compare actual market spend with expected value without using BST.

begin;

do $$
declare
  v_signature regprocedure;
  v_definition text;
  v_old text :=
    'v_mon := jsonb_set(v_nominee -> ''mon'', ''{cost}'', to_jsonb(v_bid), true);';
  v_new text :=
    'v_mon := jsonb_set(v_nominee -> ''mon'', ''{listedCost}'', to_jsonb(coalesce((v_nominee #>> ''{mon,listedCost}'')::integer, (v_nominee #>> ''{mon,cost}'')::integer, 1)), true);'
    || chr(10)
    || '    v_mon := jsonb_set(v_mon, ''{cost}'', to_jsonb(v_bid), true);';
begin
  foreach v_signature in array array[
    'public.mutate_live_auction(uuid,text,jsonb)'::regprocedure,
    'public.reconcile_autonomous_live_auctions()'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    if position(v_old in v_definition) = 0 then
      if position('{listedCost}' in v_definition) = 0 then
        raise exception 'The auction price assignment could not be located in %.', v_signature;
      end if;
    else
      execute replace(v_definition, v_old, v_new);
    end if;
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
