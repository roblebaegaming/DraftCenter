-- DraftCenter milestone 11: restore the core live snake-draft starter.
--
-- Some remote projects received the later provisioning migrations without
-- retaining the start_snake_draft(uuid, uuid[]) function from migration 004.
-- provision_live_snake_draft depends on this exact signature.

create or replace function public.start_snake_draft(
  p_league_id uuid,
  p_team_order uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
  v_count integer;
  v_first uuid;
  v_rounds integer;
  v_full_order jsonb;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can start a draft.';
  end if;

  select count(*) into v_count
  from public.teams
  where league_id = p_league_id;

  if v_count < 2 or coalesce(array_length(p_team_order, 1), 0) <> v_count then
    raise exception 'Draft order must contain each team exactly once.';
  end if;

  if (select count(distinct supplied.team_id) from unnest(p_team_order) as supplied(team_id)) <> v_count
     or exists (
       select 1
       from unnest(p_team_order) as supplied(supplied_team_id)
       where not exists (
         select 1
         from public.teams t
         where t.id = supplied.supplied_team_id
           and t.league_id = p_league_id
       )
     ) then
    raise exception 'Draft order contains an invalid team.';
  end if;

  select greatest(1, coalesce((settings ->> 'rosterMax')::integer, 11))
  into v_rounds
  from public.leagues
  where id = p_league_id;

  if v_rounds is null then
    raise exception 'League not found.';
  end if;

  select jsonb_agg(team_id order by pick_number)
  into v_full_order
  from (
    select
      ((draft_round - 1) * v_count + round_position) as pick_number,
      case
        when draft_round % 2 = 1 then p_team_order[round_position]
        else p_team_order[v_count - round_position + 1]
      end as team_id
    from generate_series(1, v_rounds) as rounds(draft_round)
    cross join generate_series(1, v_count) as positions(round_position)
  ) ordered_picks;

  v_first := p_team_order[1];

  insert into public.draft_sessions (
    league_id,
    mode,
    status,
    current_pick_number,
    current_team_id,
    configuration
  )
  values (
    p_league_id,
    'snake',
    'active',
    0,
    v_first,
    jsonb_build_object('team_order', v_full_order)
  )
  on conflict (league_id) do update
  set
    mode = 'snake',
    status = 'active',
    current_pick_number = 0,
    current_team_id = v_first,
    configuration = excluded.configuration,
    updated_at = now()
  returning id into v_session;

  update public.leagues
  set status = 'drafting', updated_at = now()
  where id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_started',
    auth.uid(),
    jsonb_build_object('draft_session_id', v_session)
  );

  return v_session;
end;
$$;

grant execute on function public.start_snake_draft(uuid, uuid[]) to authenticated;
