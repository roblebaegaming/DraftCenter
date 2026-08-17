-- Reduce the 2026 VGC Masters entry from 16 picks to 10 before anyone enters.
-- The release fails closed if a VGC entry appears after the owner verified the
-- public leaderboard at zero. Legacy ace_* database names remain internal for
-- backward compatibility; the player-facing label is Your Champion.

begin;

lock table public.worlds_pick_entries in access exclusive mode;

do $guard_and_update$
declare
  v_picks_required integer;
  v_status text;
  v_locks_at timestamptz;
begin
  if exists (
    select 1
    from public.worlds_pick_entries
    where event_id = '2026-vgc-masters'
  ) then
    raise exception 'Cannot change the 2026 VGC Masters format after an entry has been saved.';
  end if;

  select picks_required, status, locks_at
  into v_picks_required, v_status, v_locks_at
  from public.worlds_pick_events
  where id = '2026-vgc-masters'
    and division = 'Masters'
  for update;

  if not found then
    raise exception 'The 2026 VGC Masters event is missing.';
  end if;

  if v_picks_required <> 16 then
    raise exception 'Expected the 2026 VGC Masters event to require 16 picks, found %.', v_picks_required;
  end if;

  if v_status <> 'open' or now() >= v_locks_at then
    raise exception 'The 2026 VGC Masters event is no longer open for a format change.';
  end if;

  update public.worlds_pick_events
  set display_name = '2026 VGC Worlds Pick 10',
      picks_required = 10,
      scoring_rules = scoring_rules || jsonb_build_object(
        'maximum_raw_score', 140,
        'selection_label', 'Your Champion',
        'selection_multiplier', 2
      ),
      updated_at = now()
  where id = '2026-vgc-masters';
end;
$guard_and_update$;

alter table public.worlds_pick_entries
  drop constraint if exists worlds_pick_entries_pick_slugs_check;

alter table public.worlds_pick_entries
  add constraint worlds_pick_entries_pick_slugs_cardinality_check
  check (cardinality(pick_slugs) between 1 and 64);

comment on column public.worlds_pick_entries.ace_slug is
  'Internal legacy name for the competitor shown to entrants as Your Champion.';

create or replace function public.save_worlds_pick_entry(
  p_event_id text,
  p_pick_slugs text[],
  p_ace_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.worlds_pick_events%rowtype;
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_valid_pick_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to save a Worlds entry.' using errcode = '42501';
  end if;

  select * into v_event
  from public.worlds_pick_events
  where id = p_event_id;

  if not found then
    raise exception 'That Worlds competition was not found.' using errcode = 'P0002';
  end if;

  if v_event.status <> 'open' or now() < v_event.opens_at or now() >= v_event.locks_at then
    raise exception 'Entries for this Worlds competition are locked.' using errcode = '22023';
  end if;

  if v_event.division <> 'Masters' then
    raise exception 'Only Masters Division Worlds entries are supported.' using errcode = '22023';
  end if;

  if p_pick_slugs is null or cardinality(p_pick_slugs) <> v_event.picks_required then
    raise exception 'Choose exactly % competitors.', v_event.picks_required using errcode = '22023';
  end if;

  if (select count(distinct slug) from unnest(p_pick_slugs) selected(slug)) <> v_event.picks_required then
    raise exception 'Each competitor can be chosen only once.' using errcode = '22023';
  end if;

  if p_ace_slug is null or not (p_ace_slug = any(p_pick_slugs)) then
    raise exception 'Choose Your Champion from your % selected competitors.', v_event.picks_required using errcode = '22023';
  end if;

  select count(*) into v_valid_pick_count
  from public.worlds_pick_competitors competitor
  where competitor.event_id = p_event_id
    and competitor.is_selectable
    and competitor.attendance_status not in ('withdrawn', 'declined')
    and competitor.slug = any(p_pick_slugs);

  if v_valid_pick_count <> v_event.picks_required then
    raise exception 'One or more picks are not in the current selectable roster.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Trainer')
    into v_display_name
  from public.profiles profile
  where profile.id = v_user_id;

  v_display_name := case
    when char_length(coalesce(v_display_name, '')) between 2 and 60 then v_display_name
    else 'Trainer'
  end;

  insert into public.worlds_pick_entries (event_id, user_id, display_name, pick_slugs, ace_slug)
  values (p_event_id, v_user_id, v_display_name, p_pick_slugs, p_ace_slug)
  on conflict (event_id, user_id) do update
    set display_name = excluded.display_name,
        pick_slugs = excluded.pick_slugs,
        ace_slug = excluded.ace_slug,
        updated_at = now();

  return jsonb_build_object('ok', true, 'picks', p_pick_slugs, 'ace_slug', p_ace_slug, 'display_name', v_display_name);
end;
$$;

revoke all on function public.save_worlds_pick_entry(text, text[], text) from public, anon, authenticated;
grant execute on function public.save_worlds_pick_entry(text, text[], text) to authenticated;

commit;
