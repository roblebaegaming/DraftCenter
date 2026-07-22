-- DraftCenter milestone 6: provision the existing prototype setup into a
-- server-authoritative live snake draft. Run once AFTER migrations 001-008.

alter table public.teams add column if not exists source_key text;
alter table public.league_pokemon add column if not exists source_key text;
create unique index if not exists teams_league_source_key_idx on public.teams(league_id, source_key) where source_key is not null;
create unique index if not exists league_pokemon_league_source_key_idx on public.league_pokemon(league_id, source_key) where source_key is not null;

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
  v_session_id uuid; v_team record; v_pokemon jsonb; v_team_ids uuid[]; v_source_key text;
  v_owner_name text; v_owner_id uuid; v_membership_id uuid; v_order_ids uuid[];
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can start a live draft.'; end if;
  if jsonb_array_length(coalesce(p_teams, '[]'::jsonb)) < 2 then raise exception 'A live draft needs at least two teams.'; end if;
  if jsonb_array_length(coalesce(p_pokemon, '[]'::jsonb)) = 0 then raise exception 'No eligible Pokémon were supplied.'; end if;
  if p_rounds < 1 or p_rounds > 30 then raise exception 'Choose between 1 and 30 rounds.'; end if;
  if exists (select 1 from public.draft_sessions where league_id = p_league_id and status in ('active', 'paused', 'complete')) then
    raise exception 'This league already has a live draft. Do not provision it again.';
  end if;

  -- The prototype has no durable team ids. source_key preserves its numeric
  -- team index so the existing UI and the relational draft use the same order.
  for v_team in select value as team, ordinality - 1 as team_index from jsonb_array_elements(p_teams) with ordinality loop
    v_source_key := v_team.team_index::text;
    insert into public.teams (league_id, source_key, name, color, logo_url, description)
    values (p_league_id, v_source_key, coalesce(nullif(trim(v_team.team ->> 'name'), ''), 'Team ' || (v_team.team_index + 1)),
            nullif(v_team.team ->> 'color', ''), nullif(v_team.team ->> 'logoUrl', ''), coalesce(v_team.team ->> 'description', ''))
    on conflict (league_id, source_key) where source_key is not null do update
      set name = excluded.name, color = excluded.color, logo_url = excluded.logo_url, description = excluded.description
    returning id into v_team_ids[v_team.team_index + 1];

    v_owner_name := nullif(trim(v_team.team ->> 'claimedBy'), '');
    if v_owner_name is not null then
      select id into v_owner_id from public.profiles
        where lower(username) = lower(v_owner_name) or lower(display_name) = lower(v_owner_name) limit 1;
      if v_owner_id is not null then
        insert into public.league_memberships (league_id, user_id, role) values (p_league_id, v_owner_id, 'coach')
          on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
          returning id into v_membership_id;
        update public.teams set owner_membership_id = v_membership_id where id = v_team_ids[v_team.team_index + 1];
      end if;
    end if;
  end loop;

  for v_pokemon in select value from jsonb_array_elements(p_pokemon) loop
    if nullif(v_pokemon ->> 'id', '') is null then raise exception 'Every Pokémon needs a stable source id.'; end if;
    insert into public.pokemon_catalogue (id, display_name, primary_type, secondary_type, base_stat_total, sprite_url)
    values (v_pokemon ->> 'id', coalesce(v_pokemon ->> 'name', v_pokemon ->> 'id'), coalesce(v_pokemon ->> 't1', 'normal'),
            nullif(v_pokemon ->> 't2', ''), nullif(v_pokemon ->> 'bst', '')::smallint, nullif(v_pokemon ->> 'spriteUrl', ''))
    on conflict (id) do update set display_name = excluded.display_name, primary_type = excluded.primary_type,
      secondary_type = excluded.secondary_type, base_stat_total = excluded.base_stat_total, sprite_url = coalesce(excluded.sprite_url, public.pokemon_catalogue.sprite_url);
    insert into public.league_pokemon (league_id, pokemon_id, source_key, cost, is_allowed, is_drafted)
    values (p_league_id, v_pokemon ->> 'id', v_pokemon ->> 'id', coalesce(nullif(v_pokemon ->> 'cost', '')::numeric, 0), true, false)
    on conflict (league_id, source_key) where source_key is not null do update set cost = excluded.cost, is_allowed = true, is_drafted = false;
  end loop;

  update public.leagues set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_settings, '{}'::jsonb) || jsonb_build_object('rosterMax', p_rounds), updated_at = now()
  where id = p_league_id;

  select array_agg(v_team_ids[s.position + 1] order by s.ordinality) into v_order_ids
    from generate_subscripts(p_team_order, 1) with ordinality as s(position, ordinality);
  if array_length(v_order_ids, 1) <> jsonb_array_length(p_teams) or exists (select 1 from unnest(v_order_ids) as id where id is null) then
    raise exception 'Draft order must contain every team exactly once.';
  end if;
  v_session_id := public.start_snake_draft(p_league_id, v_order_ids);
  return jsonb_build_object(
    'draft_session_id', v_session_id,
    'pokemon_ids', coalesce((select jsonb_object_agg(source_key, id) from public.league_pokemon where league_id = p_league_id), '{}'::jsonb)
  );
end;
$$;

-- A compact, member-readable view of the official current draft state.
create or replace function public.get_live_snake_draft(p_league_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'session', (select to_jsonb(d) from public.draft_sessions d where d.league_id = p_league_id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'source_key', t.source_key) order by t.source_key::int) from public.teams t where t.league_id = p_league_id), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(jsonb_build_object('pick_number', p.pick_number, 'team_id', p.team_id, 'league_pokemon_id', p.league_pokemon_id, 'pokemon_source_key', lp.source_key, 'team_source_key', t.source_key) order by p.pick_number)
      from public.draft_picks p join public.teams t on t.id = p.team_id join public.league_pokemon lp on lp.id = p.league_pokemon_id
      where p.draft_session_id = (select id from public.draft_sessions where league_id = p_league_id)), '[]'::jsonb)
  );
$$;

grant execute on function public.provision_live_snake_draft(uuid, jsonb, jsonb, integer[], integer, jsonb) to authenticated;
grant execute on function public.get_live_snake_draft(uuid) to authenticated;

-- During setup, managers claim their own prototype team through a locked
-- server update. This replaces the old browser-only name claim.
create or replace function public.claim_live_setup_team(p_league_id uuid, p_team_index integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_state jsonb; v_team jsonb; v_name text; v_username text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then raise exception 'Teams cannot be claimed after the live draft starts.'; end if;
  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(trim(v_team ->> 'claimedBy'), '') is not null then raise exception 'That team has already been claimed.'; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  if exists (select 1 from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) as team where lower(coalesce(team ->> 'claimedBy', '')) = lower(v_name)) then
    raise exception 'You already claimed a team in this league.';
  end if;
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end;
  v_state := jsonb_set(v_state, array['teams', p_team_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return v_state;
end;
$$;

grant execute on function public.claim_live_setup_team(uuid, integer) to authenticated;
