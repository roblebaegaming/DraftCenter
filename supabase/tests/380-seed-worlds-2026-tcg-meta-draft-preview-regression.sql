-- Run only after migrations 378-380 on an isolated Supabase Preview branch.
-- The transaction verifies the reviewed taxonomy remains fail-closed.

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
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
      and status = 'draft'
      and picks_required = 5
      and requires_featured_pick
      and current_result_snapshot_id is null
      and option_source_url = 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1'
      and source_checked_at = '2026-08-11'::date
      and (scoring_rules ->> 'taxonomy_option_count')::integer = 49
      and scoring_rules ->> 'taxonomy_source_sha256' = '1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8'
      and scoring_rules ->> 'opening_gate' = 'awaiting-exact-official-worlds-format-confirmation'
  ) then
    raise exception 'Migration 380 did not preserve the reviewed TCG taxonomy as a draft event.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks') <> 49
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and is_selectable) <> 49
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and metadata ? 'community_trend_rank') <> 12
     or exists (select 1 from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and metadata ->> 'taxonomy_key' = 'other') then
    raise exception 'Migration 380 must expose 49 concrete archetypes, 12 trend labels, and no broad Other option.';
  end if;

  if not exists (
    select 1 from public.worlds_meta_options
    where event_id = '2026-tcg-champion-decks'
      and option_key = 'tcg-dragapult-ex'
      and display_name = 'Dragapult'
      and source_order = 1
      and (metadata ->> 'community_trend_rank')::integer = 1
  ) or not exists (
    select 1 from public.worlds_meta_options
    where event_id = '2026-tcg-champion-decks'
      and option_key = 'tcg-doublade-por'
      and display_name = 'Doublade'
      and source_order = 49
  ) then
    raise exception 'The TCG taxonomy boundary records or ordering changed.';
  end if;

  if has_table_privilege('anon', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_entries', 'select') then
    raise exception 'Seeding the TCG taxonomy must not grant direct browser table access.';
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

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select public.get_worlds_meta_hub('2026-tcg-champion-decks') into v_hub;
  if jsonb_array_length(v_hub -> 'options') <> 49
     or not (v_hub #>> '{event,is_locked}')::boolean
     or v_hub #>> '{event,status}' <> 'draft'
     or v_hub -> 'my_entry' <> 'null'::jsonb then
    raise exception 'draft_taxonomy_hub: the reviewed TCG draft was not readable and locked';
  end if;

  begin
    perform public.save_worlds_meta_entry('2026-tcg-champion-decks', v_picks, v_picks[1]);
    raise exception 'draft_event_rejected_entry: the draft TCG event accepted an entry';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Entries for this Worlds Meta Picks competition are locked.' then
      raise;
    end if;
  end;

  if exists (select 1 from public.worlds_meta_entries where event_id = '2026-tcg-champion-decks') then
    raise exception 'The draft TCG taxonomy created an entry.';
  end if;
end;
$$;

-- fixtures_removed: no persistent identities or entries were created.
rollback;
