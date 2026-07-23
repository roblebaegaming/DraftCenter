-- DraftCenter milestone 10: fix the relational order mapping used when a
-- commissioner starts a live snake draft.
--
-- The prior migration validated the zero-based browser order correctly, but
-- accidentally read the PostgreSQL array position instead of that order's
-- value while converting it to newly-created team UUIDs. That always skipped
-- the first team and produced one null UUID, even for a valid random order.

create or replace function public.provision_live_snake_draft(
  p_league_id uuid,
  p_teams jsonb,
  p_pokemon jsonb,
  p_team_order integer[],
  p_rounds integer,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session_id uuid;
  v_team record;
  v_pokemon jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := array[]::uuid[];
  v_source_key text;
  v_owner_name text;
  v_owner_id uuid;
  v_membership_id uuid;
  v_order_ids uuid[];
  v_team_count integer;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a live draft.';
  end if;
  v_team_count := jsonb_array_length(coalesce(p_teams, '[]'::jsonb));
  if v_team_count < 2 then
    raise exception 'A live draft needs at least two teams.';
  end if;
  if jsonb_array_length(coalesce(p_pokemon, '[]'::jsonb)) = 0 then
    raise exception 'No eligible Pokemon were supplied.';
  end if;
  if p_rounds < 1 or p_rounds > 30 then
    raise exception 'Choose between 1 and 30 rounds.';
  end if;
  if coalesce(array_length(p_team_order, 1), 0) <> v_team_count
     or (select count(distinct item) from unnest(p_team_order) as item) <> v_team_count
     or exists (select 1 from unnest(p_team_order) as item where item < 0 or item >= v_team_count) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;
  if exists (select 1 from public.draft_sessions where league_id = p_league_id and status in ('active', 'paused', 'complete')) then
    raise exception 'This league already has a live draft. Do not provision it again.';
  end if;

  delete from public.roster_entries where team_id in (select id from public.teams where league_id = p_league_id);
  delete from public.league_pokemon where league_id = p_league_id;
  delete from public.teams where league_id = p_league_id;

  for v_team in select value as team, ordinality - 1 as team_index from jsonb_array_elements(p_teams) with ordinality loop
    v_source_key := v_team.team_index::text;
    insert into public.teams (league_id, source_key, name, color, logo_url, description)
    values (
      p_league_id, v_source_key,
      coalesce(nullif(trim(v_team.team ->> 'name'), ''), 'Team ' || (v_team.team_index + 1)),
      nullif(v_team.team ->> 'color', ''), nullif(v_team.team ->> 'logoUrl', ''),
      coalesce(v_team.team ->> 'description', '')
    ) returning id into v_team_id;
    v_team_ids := array_append(v_team_ids, v_team_id);

    v_owner_name := nullif(trim(v_team.team ->> 'claimedBy'), '');
    if v_owner_name is not null then
      select id into v_owner_id from public.profiles where lower(username) = lower(v_owner_name) or lower(display_name) = lower(v_owner_name) limit 1;
      if v_owner_id is not null then
        insert into public.league_memberships (league_id, user_id, role)
        values (p_league_id, v_owner_id, 'coach')
        on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
        returning id into v_membership_id;
        update public.teams set owner_membership_id = v_membership_id where id = v_team_id;
      end if;
    end if;
  end loop;

  for v_pokemon in select value from jsonb_array_elements(p_pokemon) loop
    if nullif(v_pokemon ->> 'id', '') is null then raise exception 'Every Pokemon needs a stable source id.'; end if;
    insert into public.pokemon_catalogue (id, display_name, primary_type, secondary_type, base_stat_total, sprite_url)
    values (v_pokemon ->> 'id', coalesce(v_pokemon ->> 'name', v_pokemon ->> 'id'), coalesce(v_pokemon ->> 't1', 'normal'), nullif(v_pokemon ->> 't2', ''), nullif(v_pokemon ->> 'bst', '')::smallint, nullif(v_pokemon ->> 'spriteUrl', ''))
    on conflict (id) do update set display_name = excluded.display_name, primary_type = excluded.primary_type, secondary_type = excluded.secondary_type, base_stat_total = excluded.base_stat_total, sprite_url = coalesce(excluded.sprite_url, public.pokemon_catalogue.sprite_url);
    insert into public.league_pokemon (league_id, pokemon_id, source_key, cost, is_allowed, is_drafted)
    values (p_league_id, v_pokemon ->> 'id', v_pokemon ->> 'id', coalesce(nullif(v_pokemon ->> 'cost', '')::numeric, 0), true, false);
  end loop;

  update public.leagues set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_settings, '{}'::jsonb) || jsonb_build_object('rosterMax', p_rounds), updated_at = now() where id = p_league_id;

  -- p_team_order contains zero-based team indexes. Read its value at each
  -- PostgreSQL position, then convert that zero-based value to the UUID array.
  select array_agg(v_team_ids[p_team_order[s.position] + 1] order by s.ordinality) into v_order_ids
  from generate_subscripts(p_team_order, 1) with ordinality as s(position, ordinality);
  if coalesce(array_length(v_order_ids, 1), 0) <> v_team_count or exists (select 1 from unnest(v_order_ids) as id where id is null) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;

  v_session_id := public.start_snake_draft(p_league_id, v_order_ids);
  return jsonb_build_object('draft_session_id', v_session_id, 'pokemon_ids', coalesce((select jsonb_object_agg(source_key, id) from public.league_pokemon where league_id = p_league_id), '{}'::jsonb));
end;
$$;

grant execute on function public.provision_live_snake_draft(uuid, jsonb, jsonb, integer[], integer, jsonb) to authenticated;
