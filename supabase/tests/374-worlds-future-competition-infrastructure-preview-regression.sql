-- Run only after migration 374 on an isolated Supabase Preview branch.
-- The transaction rolls back its temporary authentication context.

begin;

do $$
declare
  v_overall jsonb;
  v_error text;
  v_user uuid := gen_random_uuid();
  v_vgc_picks text[];
  v_tcg_picks text[];
begin
  if (select count(*) from public.worlds_pick_events where id in ('2026-tcg-masters', '2026-pokemon-go')) <> 2 then
    raise exception 'Expected both future Pick 10 events.';
  end if;

  if exists (
    select 1 from public.worlds_pick_events
    where id in ('2026-tcg-masters', '2026-pokemon-go')
      and (status <> 'draft' or picks_required <> 10 or entry_unit <> 'individual')
  ) then
    raise exception 'Future Pick 10 events must remain closed and individual.';
  end if;

  if exists (
    select 1 from public.worlds_result_sources
    where event_id in ('2026-tcg-masters', '2026-pokemon-go')
      and (enabled or state <> 'disabled' or feed_url is not null or external_event_id is not null)
  ) then
    raise exception 'Future result sources must remain disabled and unconfigured.';
  end if;

  if exists (select 1 from public.worlds_pick_competitors where event_id in ('2026-tcg-masters', '2026-pokemon-go')) then
    raise exception 'Migration 374 must not publish competitor names.';
  end if;

  if exists (select 1 from public.worlds_pick_entries where event_id in ('2026-tcg-masters', '2026-pokemon-go')) then
    raise exception 'Migration 374 must not create prediction entries.';
  end if;

  if has_table_privilege('anon', 'public.worlds_pick_events', 'select')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'select') then
    raise exception 'Direct Worlds table reads must remain revoked.';
  end if;

  if not has_function_privilege('anon', 'public.get_worlds_overall_leaderboard()', 'execute')
     or not has_function_privilege('authenticated', 'public.get_worlds_overall_leaderboard()', 'execute') then
    raise exception 'The overall leaderboard RPC grants are incomplete.';
  end if;

  select public.get_worlds_overall_leaderboard() into v_overall;
  if coalesce((v_overall ->> 'is_open')::boolean, true) then
    raise exception 'The overall leaderboard must stay closed before two disciplines are final.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000374', true);
  begin
    perform public.save_worlds_pick_entry(
      '2026-tcg-masters',
      array['one','two','three','four','five','six','seven','eight','nine','ten'],
      'one'
    );
    raise exception 'The staged TCG event unexpectedly accepted an entry.';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Entries for this Worlds competition are locked.' then
      raise;
    end if;
  end;

  select array_agg(slug order by source_order)
  into v_vgc_picks
  from (
    select slug, source_order
    from public.worlds_pick_competitors
    where event_id = '2026-vgc-masters'
    order by source_order
    limit 10
  ) selected;
  if cardinality(v_vgc_picks) <> 10 then
    raise exception 'The Preview needs the reviewed VGC roster seed to test overall scoring.';
  end if;

  select array_agg('preview-tcg-' || slot_number order by slot_number)
  into v_tcg_picks
  from generate_series(1, 10) as slots(slot_number);

  insert into auth.users(id, aud, role)
  values (v_user, 'authenticated', 'authenticated');

  insert into public.worlds_pick_competitors (
    event_id, slug, display_name, country_code, qualification_region,
    qualification_path, source_order, source_url, source_checked_at, score_points
  )
  select
    '2026-tcg-masters',
    'preview-tcg-' || slot_number,
    'Preview TCG ' || slot_number,
    'USA',
    'Preview',
    'Transactional overall regression fixture',
    slot_number,
    'https://worlds.pokemon.com/en-us/competitors/',
    '2026-08-10',
    case slot_number when 1 then 30 when 2 then 20 else 0 end
  from generate_series(1, 10) as slots(slot_number);

  update public.worlds_pick_competitors
  set score_points = case slug when v_vgc_picks[1] then 30 when v_vgc_picks[2] then 20 else score_points end
  where event_id = '2026-vgc-masters'
    and slug in (v_vgc_picks[1], v_vgc_picks[2]);

  update public.worlds_pick_events
  set status = 'final'
  where id in ('2026-vgc-masters', '2026-tcg-masters');

  insert into public.worlds_pick_entries (event_id, user_id, display_name, pick_slugs, ace_slug)
  values
    ('2026-vgc-masters', v_user, 'Overall Preview Trainer', v_vgc_picks, v_vgc_picks[1]),
    ('2026-tcg-masters', v_user, 'Overall Preview Trainer', v_tcg_picks, v_tcg_picks[1]);

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.get_worlds_overall_leaderboard() into v_overall;

  if coalesce((v_overall ->> 'is_open')::boolean, false) is distinct from true
     or (v_overall ->> 'discipline_count')::integer is distinct from 2
     or jsonb_array_length(v_overall -> 'standings') is distinct from 1
     or (v_overall #>> '{standings,0,overall_points}')::numeric is distinct from 114.2
     or (v_overall #>> '{standings,0,discipline_points,tcg}')::numeric is distinct from 57.1
     or (v_overall #>> '{standings,0,discipline_points,vgc}')::numeric is distinct from 57.1
     or coalesce((v_overall #>> '{standings,0,is_me}')::boolean, false) is distinct from true
     or position(v_user::text in v_overall::text) > 0 then
    raise exception 'Overall scoring, privacy, or readiness did not match the two-discipline contract.';
  end if;
end;
$$;

rollback;
