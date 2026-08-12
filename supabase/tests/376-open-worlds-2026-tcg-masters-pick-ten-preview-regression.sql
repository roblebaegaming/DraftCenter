-- Run only after migration 376 on an isolated Supabase Preview branch.
-- The transaction rolls back the temporary accounts and prediction entry.

begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_observer uuid := gen_random_uuid();
  v_picks text[];
  v_hub jsonb;
  v_error text;
begin
  if not exists (
    select 1 from public.worlds_pick_events
    where id = '2026-tcg-masters'
      and status = 'open'
      and picks_required = 10
      and discipline = 'tcg'
      and entry_unit = 'individual'
      and division = 'Masters'
      and roster_source_url = 'https://worlds.pokemon.com/en-us/about/qualified/'
  ) then
    raise exception 'The reviewed TCG Pick 10 event is not open.';
  end if;

  if (select count(*) from public.worlds_pick_competitors where event_id = '2026-tcg-masters') <> 880 then
    raise exception 'Expected the 880-person official TCG qualifier pool.';
  end if;

  if exists (
    select 1 from public.worlds_result_sources
    where event_id = '2026-tcg-masters'
      and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
  ) then
    raise exception 'TCG result polling must remain disabled and unconfigured.';
  end if;

  if has_table_privilege('anon', 'public.worlds_pick_competitors', 'select')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'select') then
    raise exception 'Direct Worlds table reads must remain revoked.';
  end if;

  if not has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_pick_entry(text,text[],text)', 'execute') then
    raise exception 'TCG Pick 10 RPC grants are incomplete.';
  end if;

  select array_agg(slug order by source_order)
  into v_picks
  from (
    select slug, source_order
    from public.worlds_pick_competitors
    where event_id = '2026-tcg-masters'
      and is_selectable
    order by source_order
    limit 10
  ) selected;

  if cardinality(v_picks) <> 10 then
    raise exception 'Could not build a complete TCG Pick 10 fixture.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_observer, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.save_worlds_pick_entry('2026-tcg-masters', v_picks, v_picks[1]);

  select public.get_worlds_pick_hub('2026-tcg-masters') into v_hub;
  if (v_hub ->> 'entry_count')::integer <> 1
     or v_hub #>> '{my_entry,ace_slug}' <> v_picks[1]
     or jsonb_array_length(v_hub #> '{my_entry,picks}') <> 10
     or (v_hub #>> '{event,is_locked}')::boolean then
    raise exception 'The saved TCG entry or open event state did not round-trip.';
  end if;

  begin
    perform public.save_worlds_pick_entry('2026-tcg-masters', v_picks[1:9], v_picks[1]);
    raise exception 'An incomplete TCG entry unexpectedly saved.';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Choose exactly 10 competitors.' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_observer::text, true);
  select public.get_worlds_pick_hub('2026-tcg-masters') into v_hub;
  if v_hub -> 'my_entry' <> 'null'::jsonb
     or v_hub #> '{standings,0,picks}' <> 'null'::jsonb
     or v_hub #> '{standings,0,ace_slug}' <> 'null'::jsonb then
    raise exception 'Another member could see a private TCG entry before lock.';
  end if;

  delete from auth.users where id in (v_owner, v_observer);

  if exists (select 1 from public.worlds_pick_entries where user_id in (v_owner, v_observer)) then
    raise exception 'Temporary TCG Preview entries did not clean up.';
  end if;
end;
$$;

rollback;
