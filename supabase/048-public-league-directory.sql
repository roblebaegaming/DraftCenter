-- Public Leagues directory: publish joinable and watch-only leagues with a
-- deliberately limited season preview for directory filters and summaries.

begin;

create or replace function public.get_public_league_cards()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(card) order by card.updated_at desc), '[]'::jsonb)
  from (
    select l.id, l.name, l.slug, l.description, l.image_url, l.season_label, l.status,
      l.draft_starts_at, l.league_visibility, l.is_practice, l.updated_at,
      coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(s.state -> 'teams', '[]'::jsonb)) as team
        where nullif(trim(team ->> 'claimedBy'), '') is not null
      ), 0) as filled_spots,
      coalesce(
        nullif(s.state #>> '{settings,leagueSize}', '')::integer,
        jsonb_array_length(coalesce(s.state -> 'teams', '[]'::jsonb))
      ) as total_spots,
      coalesce(nullif(s.state #>> '{settings,draftType}', ''), 'snake') as draft_type,
      nullif(s.state #>> '{settings,rosterMin}', '')::integer as roster_min,
      nullif(s.state #>> '{settings,rosterMax}', '')::integer as roster_max,
      nullif(s.state #>> '{settings,budget}', '')::integer as draft_budget,
      nullif(s.state #>> '{settings,pickTimeLimitMinutes}', '')::integer as pick_minutes,
      coalesce((s.state #>> '{settings,keepersEnabled}')::boolean, false) as keepers_enabled,
      nullif(s.state #>> '{settings,maxKeepers}', '')::integer as max_keepers,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id,
      coalesce((s.state ->> 'locked')::boolean, false) as draft_started,
      jsonb_build_object(
        'seasonNumber', coalesce(s.state -> 'seasonNumber', '1'::jsonb),
        'week', coalesce(s.state -> 'week', '0'::jsonb),
        'settings', jsonb_build_object(
          'calendarMode', coalesce(s.state #> '{settings,calendarMode}', '"untimed"'::jsonb),
          'seasonStartsAt', s.state #> '{settings,seasonStartsAt}',
          'leagueTimeZone', coalesce(s.state #> '{settings,leagueTimeZone}', '"UTC"'::jsonb),
          'matchDayOfWeek', coalesce(s.state #> '{settings,matchDayOfWeek}', '6'::jsonb),
          'matchTime', coalesce(s.state #> '{settings,matchTime}', '"19:00"'::jsonb),
          'claimDayOfWeek', coalesce(s.state #> '{settings,claimDayOfWeek}', '3'::jsonb),
          'claimTime', coalesce(s.state #> '{settings,claimTime}', '"20:00"'::jsonb)
        ),
        'teams', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', team.ordinality - 1,
            'name', team.value ->> 'name',
            'logoUrl', team.value ->> 'logoUrl',
            'color', team.value ->> 'color'
          ) order by team.ordinality)
          from jsonb_array_elements(coalesce(s.state -> 'teams', '[]'::jsonb))
            with ordinality as team(value, ordinality)
        ), '[]'::jsonb),
        'schedule', coalesce(s.state -> 'schedule', '[]'::jsonb),
        'matchResults', coalesce(s.state -> 'matchResults', '{}'::jsonb)
      ) as public_state
    from public.leagues l
    left join public.league_state_snapshots s on s.league_id = l.id
    where l.league_visibility in ('open', 'watch')
      and (not l.is_practice or l.practice_expires_at is null or l.practice_expires_at > now())
    order by l.updated_at desc
    limit 100
  ) card;
$$;

create or replace function public.get_public_league(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with league_row as (
    select id, slug, name, description, season_label, image_url, league_visibility, draft_starts_at, updated_at
    from public.leagues
    where slug = p_slug and league_visibility in ('watch', 'open')
  ), snapshot as (
    select jsonb_build_object(
      'settings', jsonb_build_object(
        'calendarMode', s.state #> '{settings,calendarMode}',
        'seasonStartsAt', s.state #> '{settings,seasonStartsAt}',
        'leagueTimeZone', s.state #> '{settings,leagueTimeZone}',
        'matchDayOfWeek', s.state #> '{settings,matchDayOfWeek}',
        'matchTime', s.state #> '{settings,matchTime}',
        'claimDayOfWeek', s.state #> '{settings,claimDayOfWeek}',
        'claimTime', s.state #> '{settings,claimTime}',
        'regulationId', s.state #> '{settings,regulationId}'
      ),
      'teams', coalesce(s.state -> 'teams', '[]'::jsonb),
      'rosters', coalesce(s.state -> 'rosters', '[]'::jsonb),
      'schedule', coalesce(s.state -> 'schedule', '[]'::jsonb),
      'matchResults', coalesce(s.state -> 'matchResults', '{}'::jsonb),
      'playoffs', s.state -> 'playoffs',
      'seasonNumber', coalesce(s.state -> 'seasonNumber', '1'::jsonb)
    ) as state
    from public.league_state_snapshots s
    join league_row l on l.id = s.league_id
  )
  select jsonb_build_object(
    'league', (select to_jsonb(league_row) from league_row),
    'state', (select state from snapshot),
    'draft', (select jsonb_build_object('status', ds.status, 'current_pick_number', ds.current_pick_number)
              from public.draft_sessions ds join league_row l on l.id = ds.league_id
              order by ds.created_at desc limit 1),
    'picks', coalesce((select jsonb_agg(jsonb_build_object(
      'pick_number', dp.pick_number, 'round_number', dp.round_number,
      'pokemon', pc.display_name, 'team', t.name
    ) order by dp.pick_number)
    from public.draft_picks dp join public.draft_sessions ds on ds.id = dp.draft_session_id
    join league_row l on l.id = ds.league_id join public.teams t on t.id = dp.team_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id), '[]'::jsonb)
  );
$$;

create table if not exists public.public_match_predictions (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_key text not null,
  predicted_team_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, match_key)
);

alter table public.public_match_predictions enable row level security;

create or replace function public.save_public_match_prediction(p_slug text, p_match_key text, p_team_index integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_league_id uuid; v_state jsonb; v_week integer; v_match integer; v_pair jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to make a prediction.'; end if;
  select l.id, s.state into v_league_id, v_state
  from public.leagues l join public.league_state_snapshots s on s.league_id = l.id
  where l.slug = p_slug and l.league_visibility in ('watch', 'open');
  if v_league_id is null then raise exception 'That public league was not found.'; end if;
  if p_match_key !~ '^[0-9]+-[0-9]+$' then raise exception 'Invalid matchup.'; end if;
  v_week := split_part(p_match_key, '-', 1)::integer;
  v_match := split_part(p_match_key, '-', 2)::integer;
  v_pair := v_state #> array['schedule', v_week::text, v_match::text];
  if v_pair is null or p_team_index not in ((v_pair ->> 0)::integer, (v_pair ->> 1)::integer) then
    raise exception 'Choose a team in that matchup.';
  end if;
  if (v_state -> 'matchResults') ? p_match_key then raise exception 'Predictions close when a result is reported.'; end if;
  insert into public.public_match_predictions (league_id, user_id, match_key, predicted_team_index)
  values (v_league_id, auth.uid(), p_match_key, p_team_index)
  on conflict (league_id, user_id, match_key) do update
    set predicted_team_index = excluded.predicted_team_index, updated_at = now();
end;
$$;

revoke execute on function public.get_public_league_cards() from public;
revoke execute on function public.get_public_league(text) from public;
revoke execute on function public.save_public_match_prediction(text, text, integer) from public;
grant execute on function public.get_public_league_cards() to anon, authenticated;
grant execute on function public.get_public_league(text) to anon, authenticated;
grant execute on function public.save_public_match_prediction(text, text, integer) to authenticated;

commit;
