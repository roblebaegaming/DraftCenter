-- Run only after migration 378 on an isolated Supabase Preview branch.
-- Every fixture is transactional and removed by the final rollback.

begin;

do $$
declare
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_picks text[] := array['preview-one','preview-two','preview-three','preview-four','preview-five','preview-six'];
  v_hub jsonb;
  v_overall jsonb;
  v_error text;
begin
  if (select count(*) from public.worlds_meta_events) <> 3 then
    raise exception 'Expected three staged Worlds Meta Picks events.';
  end if;

  if exists (
    select 1 from public.worlds_meta_events
    where status <> 'draft' or current_result_snapshot_id is not null
  ) then
    raise exception 'Every migration 378 event must start closed with no result.';
  end if;

  if exists (select 1 from public.worlds_meta_options)
     or exists (select 1 from public.worlds_meta_entries)
     or exists (select 1 from public.worlds_meta_result_snapshots) then
    raise exception 'Migration 378 must not invent options, entries, or results.';
  end if;

  if has_table_privilege('anon', 'public.worlds_meta_events', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_entries', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_result_snapshots', 'select') then
    raise exception 'Direct browser access to Worlds Meta Picks tables must remain revoked.';
  end if;

  if not has_function_privilege('anon', 'public.get_worlds_meta_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_meta_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_meta_entry(text,text[],text)', 'execute')
     or has_function_privilege('authenticated', 'public.finalize_worlds_meta_result(text,text,jsonb,text)', 'execute') then
    raise exception 'Worlds Meta Picks RPC grants do not match the public/private contract.';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.save_worlds_meta_entry('2026-vgc-champion-team', v_picks, null);
    raise exception 'staged_event_rejected_entry: staged event accepted an entry';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Entries for this Worlds Meta Picks competition are locked.' then
      raise;
    end if;
  end;

  insert into auth.users(id, aud, role)
  values
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');

  insert into public.worlds_meta_options (
    event_id, option_key, display_name, source_order, source_url, source_checked_at
  )
  select
    '2026-vgc-champion-team',
    option_key,
    initcap(replace(option_key, '-', ' ')),
    source_order,
    'https://worlds.pokemon.com/en-us/',
    '2026-08-11'
  from unnest(v_picks) with ordinality option(option_key, source_order);

  update public.worlds_meta_events
  set status = 'open',
      opens_at = now() - interval '1 hour',
      locks_at = now() + interval '1 hour',
      starts_at = now() + interval '1 hour',
      ends_at = now() + interval '4 days'
  where id = '2026-vgc-champion-team';

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.save_worlds_meta_entry('2026-vgc-champion-team', v_picks, null);

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  select public.get_worlds_meta_hub('2026-vgc-champion-team') into v_hub;
  if jsonb_array_length(v_hub -> 'standings') <> 1
     or v_hub #> '{standings,0,picks}' <> 'null'::jsonb
     or position(v_user_one::text in v_hub::text) > 0 then
    raise exception 'other_entry_private_before_lock: another member saw private picks or a user identifier';
  end if;

  update public.worlds_meta_events
  set status = 'locked',
      opens_at = now() - interval '2 hours',
      locks_at = now() - interval '1 hour',
      starts_at = now() - interval '1 hour'
  where id = '2026-vgc-champion-team';

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.finalize_worlds_meta_result(
    '2026-vgc-champion-team',
    'https://worlds.pokemon.com/en-us/',
    jsonb_build_object('winning_option_keys', to_jsonb(v_picks)),
    'FINALIZE WORLDS META'
  );

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.get_worlds_meta_hub('2026-vgc-champion-team') into v_hub;
  if (v_hub #>> '{my_entry,score}')::numeric is distinct from 100
     or v_hub #>> '{event,results_status}' <> 'final'
     or jsonb_array_length(v_hub #> '{standings,0,picks}') <> 6 then
    raise exception 'exact_roster_scores_100: exact roster scoring or post-lock visibility failed';
  end if;

  begin
    update public.worlds_meta_result_snapshots
    set official_source_url = 'https://example.com/unsafe-replacement'
    where event_id = '2026-vgc-champion-team';
    raise exception 'Immutable final result snapshot unexpectedly accepted an update.';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Worlds Meta Picks final snapshots are immutable.' then
      raise;
    end if;
  end;

  select public.get_worlds_meta_overall_leaderboard() into v_overall;
  if coalesce((v_overall ->> 'is_open')::boolean, true)
     or (v_overall ->> 'final_discipline_count')::integer <> 1 then
    raise exception 'The Meta Overall leaderboard must wait for two finalized disciplines.';
  end if;

  insert into public.worlds_meta_options (
    event_id, option_key, display_name, source_order, source_url, source_checked_at
  )
  select
    '2026-tcg-champion-decks',
    option_key,
    initcap(replace(option_key, '-', ' ')),
    source_order,
    'https://worlds.pokemon.com/en-us/',
    '2026-08-11'
  from unnest(v_picks[1:5]) with ordinality option(option_key, source_order);

  update public.worlds_meta_events
  set status = 'open',
      opens_at = now() - interval '2 hours',
      locks_at = now() + interval '1 hour',
      starts_at = now() + interval '1 hour',
      ends_at = now() + interval '4 days'
  where id = '2026-tcg-champion-decks';

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.save_worlds_meta_entry('2026-tcg-champion-decks', v_picks[1:5], v_picks[1]);

  update public.worlds_meta_events
  set status = 'locked',
      opens_at = now() - interval '2 hours',
      locks_at = now() - interval '1 hour',
      starts_at = now() - interval '1 hour'
  where id = '2026-tcg-champion-decks';

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  begin
    perform public.finalize_worlds_meta_result(
      '2026-tcg-champion-decks',
      'https://worlds.pokemon.com/en-us/',
      jsonb_build_object(
        'unlisted_champion', 'Preview Rogue Deck',
        'placements', jsonb_build_object(v_picks[1], 1, v_picks[2], 2)
      ),
      'FINALIZE WORLDS META'
    );
    raise exception 'unlisted_champion_exclusive: an unlisted champion also assigned first place';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'An unlisted World Champion cannot also assign first place to a reviewed archetype.' then
      raise;
    end if;
  end;

  perform public.finalize_worlds_meta_result(
    '2026-tcg-champion-decks',
    'https://worlds.pokemon.com/en-us/',
    jsonb_build_object(
      'unlisted_champion', 'Preview Rogue Deck',
      'placements', jsonb_build_object(
        v_picks[1], 2,
        v_picks[2], 3,
        v_picks[3], 4,
        v_picks[4], 5,
        v_picks[5], 6
      )
    ),
    'FINALIZE WORLDS META'
  );

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.get_worlds_meta_hub('2026-tcg-champion-decks') into v_hub;
  if (v_hub #>> '{my_entry,score}')::numeric is distinct from 70.3
     or v_hub #>> '{event,results_status}' <> 'final' then
    raise exception 'unlisted_champion_scores_known_placements: the rogue fallback did not preserve listed deck scoring';
  end if;

  select public.get_worlds_meta_overall_leaderboard() into v_overall;
  if not coalesce((v_overall ->> 'is_open')::boolean, false)
     or (v_overall ->> 'final_discipline_count')::integer <> 2 then
    raise exception 'The Meta Overall leaderboard must open after two finalized disciplines.';
  end if;
end;
$$;

-- fixtures_removed: the Preview users, options, entry, and result are removed here.
rollback;
