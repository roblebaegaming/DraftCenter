-- Open the reviewed 2026 TCG Worlds Meta Picks competition after the official
-- event-specific competitor packet confirmed Standard Format with regulation
-- marks H and onward. Migrations 378-380 must be applied first.

begin;

lock table public.worlds_meta_events in row exclusive mode;
lock table public.worlds_meta_options in share row exclusive mode;
lock table public.worlds_meta_entries in share row exclusive mode;
lock table public.worlds_meta_result_snapshots in share row exclusive mode;

do $preflight$
declare
  v_event public.worlds_meta_events%rowtype;
begin
  select * into v_event
  from public.worlds_meta_events
  where id = '2026-tcg-champion-decks';

  if not found
    or v_event.discipline is distinct from 'tcg'
    or v_event.prediction_type is distinct from 'deck_archetype'
    or v_event.status is distinct from 'draft'
    or v_event.picks_required is distinct from 5
    or v_event.result_size is distinct from 64
    or v_event.requires_featured_pick is distinct from true
    or v_event.opens_at is distinct from '2026-08-12T07:00:00Z'::timestamptz
    or v_event.locks_at is distinct from '2026-08-28T07:00:00Z'::timestamptz
    or v_event.starts_at is distinct from '2026-08-28T07:00:00Z'::timestamptz
    or v_event.current_result_snapshot_id is not null
    or v_event.option_source_url is distinct from 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1'
    or v_event.source_checked_at is distinct from '2026-08-11'::date
    or (v_event.scoring_rules ->> 'taxonomy_option_count')::integer is distinct from 49
    or v_event.scoring_rules ->> 'taxonomy_source_sha256' is distinct from '1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8'
    or v_event.scoring_rules ->> 'opening_gate' is distinct from 'awaiting-exact-official-worlds-format-confirmation' then
    raise exception 'Migration 381 requires the exact zero-entry TCG draft created by migrations 378 and 380.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = v_event.id) <> 49
     or (select count(*) from public.worlds_meta_options where event_id = v_event.id and is_selectable) <> 49
     or (select count(*) from public.worlds_meta_options where event_id = v_event.id and metadata ? 'community_trend_rank') <> 12
     or exists (
       select 1 from public.worlds_meta_options
       where event_id = v_event.id
         and (source_url <> v_event.option_source_url or source_checked_at <> '2026-08-11'::date)
     )
     or exists (
       select 1 from public.worlds_meta_options
       where event_id = v_event.id and metadata ->> 'taxonomy_key' = 'other'
     ) then
    raise exception 'Migration 381 requires the unchanged 49-archetype Pitch Black taxonomy with 12 trend labels and no broad Other option.';
  end if;

  if exists (select 1 from public.worlds_meta_entries where event_id = v_event.id)
     or exists (select 1 from public.worlds_meta_result_snapshots where event_id = v_event.id) then
    raise exception 'Migration 381 opens only a zero-entry, zero-result TCG Meta Picks event.';
  end if;

  if not exists (select 1 from public.worlds_meta_events where id = '2026-vgc-champion-team' and status = 'open')
     or not exists (select 1 from public.worlds_meta_events where id = '2026-go-champion-team' and status = 'draft') then
    raise exception 'Migration 381 requires the reviewed VGC-open and GO-draft discipline boundaries.';
  end if;
end;
$preflight$;

update public.worlds_meta_options
set source_checked_at = '2026-08-12'::date,
    updated_at = now()
where event_id = '2026-tcg-champion-decks';

update public.worlds_meta_events
set status = 'open',
    source_checked_at = '2026-08-12'::date,
    scoring_rules = scoring_rules || '{
      "opening_gate":"satisfied-official-worlds-standard-format-confirmed",
      "official_format_status":"confirmed",
      "official_format":"standard",
      "official_minimum_regulation_mark":"H",
      "official_format_checked_at":"2026-08-12",
      "official_worlds_competitor_url":"https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo",
      "official_worlds_hub_url":"https://worlds.pokemon.com/en-us/competitors/",
      "official_product_legality_url":"https://community.pokemon.com/en-us/discussion/22216/pokemon-tcg-product-legality-update",
      "pitch_black_release_date":"2026-07-17",
      "pitch_black_tournament_legal_date":"2026-07-31",
      "taxonomy_rechecked_at":"2026-08-12"
    }'::jsonb,
    updated_at = now()
where id = '2026-tcg-champion-decks';

do $verify_open$
begin
  if not exists (
    select 1
    from public.worlds_meta_events
    where id = '2026-tcg-champion-decks'
      and status = 'open'
      and source_checked_at = '2026-08-12'::date
      and scoring_rules ->> 'opening_gate' = 'satisfied-official-worlds-standard-format-confirmed'
      and scoring_rules ->> 'official_format' = 'standard'
      and scoring_rules ->> 'official_minimum_regulation_mark' = 'H'
      and scoring_rules ->> 'official_format_checked_at' = '2026-08-12'
      and scoring_rules ->> 'official_worlds_competitor_url' = 'https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo'
      and scoring_rules ->> 'pitch_black_tournament_legal_date' = '2026-07-31'
      and (scoring_rules ->> 'taxonomy_option_count')::integer = 49
      and scoring_rules ->> 'taxonomy_source_sha256' = '1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8'
  ) then
    raise exception 'The official format gate did not open the reviewed TCG Meta Picks event.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and source_checked_at = '2026-08-12'::date) <> 49
     or exists (select 1 from public.worlds_meta_entries where event_id = '2026-tcg-champion-decks')
     or exists (select 1 from public.worlds_meta_result_snapshots where event_id = '2026-tcg-champion-decks')
     or not exists (select 1 from public.worlds_meta_events where id = '2026-vgc-champion-team' and status = 'open')
     or not exists (select 1 from public.worlds_meta_events where id = '2026-go-champion-team' and status = 'draft') then
    raise exception 'Opening TCG changed its reviewed pool, created user/result data, or crossed a discipline boundary.';
  end if;

  if has_table_privilege('anon', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_options', 'select')
     or has_table_privilege('authenticated', 'public.worlds_meta_entries', 'select')
     or not has_function_privilege('anon', 'public.get_worlds_meta_hub(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_worlds_meta_entry(text,text[],text)', 'execute')
     or has_function_privilege('authenticated', 'public.finalize_worlds_meta_result(text,text,jsonb,text)', 'execute')
     or not has_function_privilege('service_role', 'public.finalize_worlds_meta_result(text,text,jsonb,text)', 'execute') then
    raise exception 'Opening TCG changed the private-table or RPC privilege boundary.';
  end if;
end;
$verify_open$;

commit;
