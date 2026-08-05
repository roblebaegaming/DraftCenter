-- Keep the public directory's claimed-team total aligned with Setup and
-- Operations. New claims use the durable account id; legacy snapshots may
-- still have only the manager display name.

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
        where nullif(btrim(team ->> 'claimedBy'), '') is not null
           or nullif(btrim(team ->> 'claimedByUserId'), '') is not null
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

revoke execute on function public.get_public_league_cards() from public;
grant execute on function public.get_public_league_cards() to anon, authenticated;

commit;
