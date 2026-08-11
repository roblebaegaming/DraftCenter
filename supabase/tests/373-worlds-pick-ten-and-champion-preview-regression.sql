-- Preview-only transactional matrix for the Pick 10 and Your Champion update.
-- Run only after migrations 369-373 on an isolated Supabase branch. This uses
-- one synthetic account, restores event times and scores, and removes every
-- fixture before returning its result row.

begin;

create temp table dc_worlds_pick_ten_preview_results (result jsonb not null)
on commit preserve rows;

do $validation$
declare
  v_user uuid := gen_random_uuid();
  v_picks text[];
  v_champion text;
  v_second_pick text;
  v_hub jsonb;
  v_original_opens_at timestamptz;
  v_original_locks_at timestamptz;
  v_short_entry_denied boolean := false;
  v_invalid_champion_denied boolean := false;
  v_own_entry_visible boolean;
  v_champion_score_ok boolean;
  v_public_after_lock boolean;
  v_cleanup_ok boolean;
begin
  select opens_at, locks_at
  into v_original_opens_at, v_original_locks_at
  from public.worlds_pick_events
  where id = '2026-vgc-masters'
    and division = 'Masters'
    and picks_required = 10
    and display_name = '2026 VGC Worlds Pick 10'
    and scoring_rules ->> 'selection_label' = 'Your Champion'
    and (scoring_rules ->> 'maximum_raw_score')::integer = 140;
  if not found then
    raise exception 'The Pick 10 event contract is missing.';
  end if;

  select array_agg(slug order by source_order)
  into v_picks
  from (
    select slug, source_order
    from public.worlds_pick_competitors
    where event_id = '2026-vgc-masters'
    order by source_order
    limit 10
  ) selected;
  v_champion := v_picks[1];
  v_second_pick := v_picks[2];

  insert into auth.users(id, aud, role)
  values (v_user, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values (v_user, 'Preview Pick Ten');

  update public.worlds_pick_events
  set opens_at = now() - interval '1 day',
      locks_at = now() + interval '1 day'
  where id = '2026-vgc-masters';

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.save_worlds_pick_entry('2026-vgc-masters', v_picks[1:9], v_champion);
  exception when others then
    if sqlerrm = 'Choose exactly 10 competitors.' then
      v_short_entry_denied := true;
    else
      raise;
    end if;
  end;

  begin
    perform public.save_worlds_pick_entry('2026-vgc-masters', v_picks, 'not-in-the-entry');
  exception when others then
    if sqlerrm = 'Choose Your Champion from your 10 selected competitors.' then
      v_invalid_champion_denied := true;
    else
      raise;
    end if;
  end;

  perform public.save_worlds_pick_entry('2026-vgc-masters', v_picks, v_champion);
  select public.get_worlds_pick_hub('2026-vgc-masters') into v_hub;
  v_own_entry_visible :=
    jsonb_array_length(v_hub #> '{my_entry,picks}') = 10
    and v_hub #>> '{my_entry,ace_slug}' = v_champion;

  update public.worlds_pick_competitors
  set score_points = case slug when v_champion then 30 when v_second_pick then 20 else score_points end
  where event_id = '2026-vgc-masters'
    and slug in (v_champion, v_second_pick);

  update public.worlds_pick_events
  set opens_at = now() - interval '2 days',
      locks_at = now() - interval '1 day'
  where id = '2026-vgc-masters';

  select public.get_worlds_pick_hub('2026-vgc-masters') into v_hub;
  v_champion_score_ok := (v_hub #>> '{standings,0,score}')::integer = 80;
  v_public_after_lock :=
    jsonb_array_length(v_hub #> '{standings,0,picks}') = 10
    and v_hub #>> '{standings,0,ace_slug}' = v_champion;

  if v_short_entry_denied is distinct from true
     or v_invalid_champion_denied is distinct from true
     or v_own_entry_visible is distinct from true
     or v_champion_score_ok is distinct from true
     or v_public_after_lock is distinct from true then
    raise exception 'One or more Pick 10 behavior assertions failed.';
  end if;

  delete from public.worlds_pick_entries
  where event_id = '2026-vgc-masters' and user_id = v_user;
  update public.worlds_pick_competitors
  set score_points = 0
  where event_id = '2026-vgc-masters'
    and slug in (v_champion, v_second_pick);
  update public.worlds_pick_events
  set opens_at = v_original_opens_at,
      locks_at = v_original_locks_at
  where id = '2026-vgc-masters';
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;

  select
    not exists (select 1 from public.worlds_pick_entries where user_id = v_user)
    and not exists (select 1 from public.profiles where id = v_user)
    and not exists (select 1 from auth.users where id = v_user)
    and exists (
      select 1 from public.worlds_pick_events
      where id = '2026-vgc-masters'
        and opens_at = v_original_opens_at
        and locks_at = v_original_locks_at
    )
    and not exists (
      select 1 from public.worlds_pick_competitors
      where event_id = '2026-vgc-masters'
        and slug in (v_champion, v_second_pick)
        and score_points <> 0
    )
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Pick 10 Preview fixtures were not completely removed.';
  end if;

  insert into dc_worlds_pick_ten_preview_results(result)
  values (jsonb_build_object(
    'picks_required', 10,
    'short_entry_denied', v_short_entry_denied,
    'invalid_champion_denied', v_invalid_champion_denied,
    'own_entry_visible_before_lock', v_own_entry_visible,
    'champion_scoring_doubled', v_champion_score_ok,
    'entries_public_after_lock', v_public_after_lock,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result
from dc_worlds_pick_ten_preview_results;
