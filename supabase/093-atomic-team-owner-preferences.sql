-- Atomic team-owner settings used before, during, and after a hosted draft.

begin;

create or replace function public.mutate_league_team_preference(
  p_league_id uuid,
  p_action text,
  p_team_index integer,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_teams jsonb;
  v_team jsonb;
  v_team_count integer;
  v_value text;
  v_current jsonb;
  v_next jsonb;
  v_roster jsonb;
  v_max_keepers integer;
  v_identity text;
  v_member_role text;
  v_event_payload jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'The preference request is invalid.';
  end if;

  select role::text
  into v_member_role
  from public.league_memberships
  where league_id = p_league_id
    and user_id = auth.uid();
  if coalesce(v_member_role, '') = 'viewer' then
    raise exception 'Spectators cannot change team preferences.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_teams := coalesce(v_state -> 'teams', '[]'::jsonb);
  if jsonb_typeof(v_teams) <> 'array' then
    raise exception 'League team data is invalid.';
  end if;
  v_team_count := jsonb_array_length(v_teams);
  if p_team_index is null
     or p_team_index < 0
     or p_team_index >= v_team_count then
    raise exception 'Choose a valid team.';
  end if;

  if v_action = 'draft_hero_vote' then
    select coalesce(nullif(display_name, ''), nullif(username, ''), 'League member')
    into v_identity
    from public.profiles
    where id = auth.uid();
    if v_identity is null then
      raise exception 'Your profile identity was not found.';
    end if;
    if jsonb_typeof(v_state -> 'draftHeroVotes') <> 'object' then
      v_state := jsonb_set(v_state, '{draftHeroVotes}', '{}'::jsonb, true);
    end if;
    v_state := jsonb_set(
      v_state,
      array['draftHeroVotes', v_identity],
      to_jsonb(p_team_index),
      true
    );
    v_event_payload := jsonb_build_object('team_index', p_team_index);
  else
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      p_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can make this change.';
    end if;

    v_team := v_teams -> p_team_index;
    if v_action = 'toggle_auto_draft' then
      v_team := jsonb_set(
        v_team,
        '{autoDraft}',
        to_jsonb(not coalesce((v_team ->> 'autoDraft')::boolean, false)),
        true
      );

    elsif v_action = 'toggle_archetype' then
      v_value := nullif(btrim(p_payload ->> 'key'), '');
      if v_value is null or length(v_value) > 40 then
        raise exception 'Choose a valid draft strategy.';
      end if;
      v_current := coalesce(v_team -> 'archetypes', '[]'::jsonb);
      if jsonb_typeof(v_current) <> 'array' then
        v_current := '[]'::jsonb;
      end if;
      if exists (
        select 1
        from jsonb_array_elements_text(v_current) item(value)
        where item.value = v_value
      ) then
        select coalesce(jsonb_agg(to_jsonb(item.value)), '[]'::jsonb)
        into v_next
        from jsonb_array_elements_text(v_current) item(value)
        where item.value <> v_value;
      elsif jsonb_array_length(v_current) < 2 then
        v_next := v_current || jsonb_build_array(v_value);
      else
        raise exception 'A team can use at most two draft strategies.';
      end if;
      v_team := jsonb_set(v_team, '{archetypes}', v_next, true);

    elsif v_action = 'keeper_selection' then
      v_next := coalesce(p_payload -> 'names', '[]'::jsonb);
      if jsonb_typeof(v_next) <> 'array' then
        raise exception 'Keeper selections must be a list.';
      end if;
      if not coalesce(
        (v_state #>> '{settings,keepersEnabled}')::boolean,
        false
      ) then
        raise exception 'Keepers are not enabled for this league.';
      end if;
      v_max_keepers := greatest(
        0,
        coalesce((v_state #>> '{settings,maxKeepers}')::integer, 0)
      );
      if jsonb_array_length(v_next) > v_max_keepers then
        raise exception 'That team selected too many keepers.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements_text(v_next) keeper(name)
        group by lower(keeper.name)
        having count(*) > 1
      ) then
        raise exception 'A keeper cannot be selected twice.';
      end if;
      v_roster := coalesce(
        v_state #> array['rosters', p_team_index::text],
        '[]'::jsonb
      );
      if exists (
        select 1
        from jsonb_array_elements_text(v_next) keeper(name)
        where not exists (
          select 1
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(keeper.name)
        )
      ) then
        raise exception 'Every keeper must still be on that team''s roster.';
      end if;
      if jsonb_typeof(v_state -> 'keeperSelections') <> 'object' then
        v_state := jsonb_set(v_state, '{keeperSelections}', '{}'::jsonb, true);
      end if;
      v_state := jsonb_set(
        v_state,
        array['keeperSelections', p_team_index::text],
        v_next,
        true
      );

    elsif v_action = 'rename' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is null or length(v_value) > 80 then
        raise exception 'Team names must be between 1 and 80 characters.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(v_teams) with ordinality other(value, ordinality)
        where other.ordinality - 1 <> p_team_index
          and lower(btrim(coalesce(other.value ->> 'name', ''))) = lower(v_value)
      ) then
        raise exception 'Every team needs a unique name.';
      end if;
      v_team := jsonb_set(v_team, '{name}', to_jsonb(v_value), true);

    elsif v_action = 'logo' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is not null
         and (length(v_value) > 1000 or v_value !~* '^https://') then
        raise exception 'Team logos must use a secure HTTPS URL.';
      end if;
      v_team := jsonb_set(
        v_team,
        '{logoUrl}',
        case when v_value is null then 'null'::jsonb else to_jsonb(v_value) end,
        true
      );

    elsif v_action = 'color' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is null or v_value !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Choose a valid six-digit team color.';
      end if;
      v_team := jsonb_set(v_team, '{color}', to_jsonb(v_value), true);

    elsif v_action = 'description' then
      v_value := coalesce(p_payload ->> 'value', '');
      if length(v_value) > 500 then
        raise exception 'Team descriptions are limited to 500 characters.';
      end if;
      v_team := jsonb_set(v_team, '{description}', to_jsonb(v_value), true);
    else
      raise exception 'Unknown team preference action.';
    end if;

    if v_action <> 'keeper_selection' then
      v_teams := jsonb_set(
        v_teams,
        array[p_team_index::text],
        v_team,
        false
      );
      v_state := jsonb_set(v_state, '{teams}', v_teams, true);
    end if;
    v_event_payload := jsonb_build_object(
      'team_index', p_team_index,
      'action', v_action
    );
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when v_action = 'draft_hero_vote'
      then 'draft_hero_vote'
      else 'team_preference_changed' end,
    auth.uid(),
    v_event_payload
  );
  return v_state;
end;
$$;

revoke all on function public.mutate_league_team_preference(
  uuid, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.mutate_league_team_preference(
  uuid, text, integer, jsonb
) to authenticated;

commit;

notify pgrst, 'reload schema';
