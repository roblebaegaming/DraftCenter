-- Public league capacity is based on persisted team claims, not memberships.
-- Opening a league to review its setup must not consume a competitive spot.

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
      nullif(s.state #>> '{settings,leagueSize}', '')::integer as total_spots,
      coalesce(nullif(s.state #>> '{settings,draftType}', ''), 'snake') as draft_type,
      nullif(s.state #>> '{settings,rosterMin}', '')::integer as roster_min,
      nullif(s.state #>> '{settings,rosterMax}', '')::integer as roster_max,
      nullif(s.state #>> '{settings,budget}', '')::integer as draft_budget,
      nullif(s.state #>> '{settings,pickTimeLimitMinutes}', '')::integer as pick_minutes,
      coalesce((s.state #>> '{settings,keepersEnabled}')::boolean, false) as keepers_enabled,
      nullif(s.state #>> '{settings,maxKeepers}', '')::integer as max_keepers,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id,
      coalesce((s.state ->> 'locked')::boolean, false) as draft_started
    from public.leagues l
    left join public.league_state_snapshots s on s.league_id = l.id
    where l.league_visibility = 'open'
    order by l.updated_at desc
    limit 24
  ) card;
$$;

revoke execute on function public.get_public_league_cards() from public;
grant execute on function public.get_public_league_cards() to anon, authenticated;

commit;
