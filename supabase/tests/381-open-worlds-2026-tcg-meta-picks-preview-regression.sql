-- Run only after migrations 378-381 on an isolated Supabase Preview branch.
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
    where id = '2026-tcg-champion-decks'
      and discipline = 'tcg'
      and prediction_type = 'deck_archetype'
      and status = 'open'
      and picks_required = 5
      and result_size = 64
      and requires_featured_pick
      and current_result_snapshot_id is null
      and source_checked_at = '2026-08-12'::date
      and (scoring_rules ->> 'taxonomy_option_count')::integer = 49
      and scoring_rules ->> 'taxonomy_source_sha256' = '1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8'
      and scoring_rules ->> 'opening_gate' = 'satisfied-official-worlds-standard-format-confirmed'
      and scoring_rules ->> 'official_format' = 'standard'
      and scoring_rules ->> 'official_minimum_regulation_mark' = 'H'
      and scoring_rules ->> 'official_worlds_competitor_url' = 'https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo'
      and scoring_rules ->> 'pitch_black_tournament_legal_date' = '2026-07-31'
  ) then
    raise exception 'Migration 381 did not open the exact officially confirmed TCG Meta Picks event.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks') <> 49
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and is_selectable) <> 49
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and metadata ? 'community_trend_rank') <> 12
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and source_checked_at = '2026-08-12'::date) <> 49
     or exists (select 1 from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and metadata ->> 'taxonomy_key' = 'other') then
    raise exception 'Migration 381 must preserve 49 concrete archetypes, 12 trend labels, the recheck date, and no broad Other option.';
  end if;

  if not exists (select 1 from public.worlds_meta_events where id = '2026-vgc-champion-team' and status = 'open')
     or not exists (select 1 from public.worlds_meta_events where id = '2026-go-champion-team' and status = 'draft') then
    raise exception 'tcg_only_open: migration 381 crossed the VGC or GO event boundary';
  end if;

  if has_table_privilege('anon', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_entries', 'select')
     or not has_function_privilege('anon', 'public.get_worlds_meta_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_meta_entry(text,text[],text)', 'execute')
     or has_function_privilege('authenticated', 'public.finalize_worlds_meta_result(text,text,jsonb,text)', 'execute')
     or not has_function_privilege('service_role', 'public.finalize_worlds_meta_result(text,text,jsonb,text)', 'execute') then
    raise exception 'rpc_privileges_preserved: opening TCG changed table or function access';
  end if;

  if public.worlds_meta_placement_points(1) <> 30
     or public.worlds_meta_placement_points(2) <> 20
     or public.worlds_meta_placement_points(3) <> 12
     or public.worlds_meta_placement_points(8) <> 7
     or public.worlds_meta_placement_points(16) <> 4
     or public.worlds_meta_placement_points(32) <> 2
     or public.worlds_meta_placement_points(64) <> 1
     or public.worlds_meta_placement_points(65) <> 0 then
    raise exception 'placement_scoring_preserved: the published TCG scoring curve changed';
  end if;

  select array_agg(option_key order by source_order)
    into v_picks
  from (
    select option_key, source_order
    from public.worlds_meta_options
    where event_id = '2026-tcg-champion-decks' and is_selectable
    order by source_order
    limit 5
  ) first_five;

  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');

  update public.worlds_meta_events
  set opens_at = now() - interval '1 hour',
      locks_at = now() + interval '1 hour',
      starts_at = now() + interval '1 hour'
  where id = '2026-tcg-champion-decks';

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.save_worlds_meta_entry('2026-tcg-champion-decks', v_picks, v_picks[1]);

  select public.get_worlds_meta_hub('2026-tcg-champion-decks') into v_hub;
  if jsonb_array_length(v_hub -> 'options') <> 49
     or (v_hub #>> '{event,is_locked}')::boolean
     or v_hub #> '{my_entry,picks}' <> to_jsonb(v_picks)
     or v_hub #>> '{my_entry,featured_key}' <> v_picks[1]
     or v_hub #>> '{event,status}' <> 'open' then
    raise exception 'own_entry_round_trip: the signed-in five-deck workflow did not round-trip exactly';
  end if;

  begin
    perform public.save_worlds_meta_entry('2026-tcg-champion-decks', v_picks, null);
    raise exception 'champion_deck_required: TCG accepted an entry without a Champion Deck';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Choose the Champion Deck from your selected archetypes.' then
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_meta_entry(
      '2026-tcg-champion-decks',
      array[v_picks[1], v_picks[2], v_picks[3], v_picks[4], 'not-reviewed'],
      v_picks[1]
    );
    raise exception 'unreviewed_pick_rejected: TCG accepted an archetype outside the frozen pool';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'One or more picks are not in the reviewed option pool.' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.get_worlds_meta_hub('2026-tcg-champion-decks') into v_hub;
  if jsonb_array_length(v_hub -> 'standings') <> 1
     or v_hub #> '{standings,0,picks}' <> 'null'::jsonb
     or v_hub #> '{standings,0,featured_key}' <> 'null'::jsonb
     or position(v_user_one::text in v_hub::text) > 0 then
    raise exception 'other_entry_private_before_lock: another member saw private TCG picks or a user identifier';
  end if;
end;
$$;

-- fixtures_removed: Preview users, the entry, and event timing changes are removed here.
rollback;
