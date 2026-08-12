-- Run only after migrations 378 and 379 on an isolated Supabase Preview branch.
-- Every fixture is transactional and removed by the final rollback.

begin;

do $$
declare
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_picks text[];
  v_hub jsonb;
  v_error text;
begin
  if not exists (
    select 1
    from public.worlds_meta_events
    where id = '2026-vgc-champion-team'
      and discipline = 'vgc'
      and prediction_type = 'champion_roster'
      and status = 'open'
      and picks_required = 6
      and not requires_featured_pick
      and current_result_snapshot_id is null
      and option_source_url = 'https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178066986988lmoqpm/en/pokemon.html'
      and source_checked_at = '2026-08-11'::date
      and (scoring_rules ->> 'option_pool_count')::integer = 235
      and scoring_rules ->> 'option_pool_sha256' = '642fed0034500c778894e10ca33418cb06eabf9403136e8acce277047bccf4f6'
  ) then
    raise exception 'Migration 379 did not open the pinned official VGC Meta Picks event.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = '2026-vgc-champion-team') <> 235
     or (select count(*) from public.worlds_meta_options where event_id = '2026-vgc-champion-team' and is_selectable) <> 235
     or (select count(*) from public.worlds_meta_options where event_id = '2026-vgc-champion-team' and metadata ? 'community_trend_rank') <> 24 then
    raise exception 'Migration 379 must expose 235 official options and exactly 24 community trend labels.';
  end if;

  if not exists (
    select 1 from public.worlds_meta_options
    where event_id = '2026-vgc-champion-team'
      and option_key = 'pc-0003-000'
      and display_name = 'Venusaur'
      and source_order = 1
  ) or not exists (
    select 1 from public.worlds_meta_options
    where event_id = '2026-vgc-champion-team'
      and option_key = 'pc-1019-000'
      and display_name = 'Hydrapple'
      and source_order = 235
  ) then
    raise exception 'The official VGC option ordering or boundary records changed.';
  end if;

  if has_table_privilege('anon', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_entries', 'select') then
    raise exception 'Opening VGC must not grant direct browser table access.';
  end if;

  select array_agg(option_key order by source_order)
    into v_picks
  from (
    select option_key, source_order
    from public.worlds_meta_options
    where event_id = '2026-vgc-champion-team' and is_selectable
    order by source_order
    limit 6
  ) first_six;

  if cardinality(v_picks) <> 6 then
    raise exception 'The preview could not select six reviewed VGC options.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');

  update public.worlds_meta_events
  set opens_at = now() - interval '1 hour',
      locks_at = now() + interval '1 hour',
      starts_at = now() + interval '1 hour'
  where id = '2026-vgc-champion-team';

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.save_worlds_meta_entry('2026-vgc-champion-team', v_picks, null);

  select public.get_worlds_meta_hub('2026-vgc-champion-team') into v_hub;
  if jsonb_array_length(v_hub -> 'options') <> 235
     or (v_hub #>> '{event,is_locked}')::boolean
     or v_hub #> '{my_entry,picks}' <> to_jsonb(v_picks)
     or v_hub #> '{my_entry,featured_key}' <> 'null'::jsonb then
    raise exception 'own_entry_round_trip: the signed-in six-pick workflow did not round-trip exactly';
  end if;

  begin
    perform public.save_worlds_meta_entry(
      '2026-vgc-champion-team',
      array[v_picks[1], v_picks[1], v_picks[3], v_picks[4], v_picks[5], v_picks[6]],
      null
    );
    raise exception 'duplicate_pick_rejected: duplicate picks were accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Each option can be chosen only once.' then
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_meta_entry(
      '2026-vgc-champion-team',
      array[v_picks[1], v_picks[2], v_picks[3], v_picks[4], v_picks[5], 'not-reviewed'],
      null
    );
    raise exception 'unreviewed_pick_rejected: an unreviewed pick was accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'One or more picks are not in the reviewed option pool.' then
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_meta_entry('2026-vgc-champion-team', v_picks, v_picks[1]);
    raise exception 'featured_pick_rejected: VGC accepted a featured pick';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'This competition does not use a featured pick.' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.get_worlds_meta_hub('2026-vgc-champion-team') into v_hub;
  if jsonb_array_length(v_hub -> 'standings') <> 1
     or v_hub #> '{standings,0,picks}' <> 'null'::jsonb
     or v_hub #> '{standings,0,featured_key}' <> 'null'::jsonb
     or position(v_user_one::text in v_hub::text) > 0 then
    raise exception 'other_entry_private_before_lock: another member saw private picks or a user identifier';
  end if;
end;
$$;

-- fixtures_removed: Preview users, the entry, and event timing changes are removed here.
rollback;
