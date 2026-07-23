-- DraftCenter milestone 9: save a scheduled start with a new league and
-- expose safe public league-card details (date and manager spots).

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_description text,
  p_season_label text,
  p_visibility text,
  p_is_practice boolean,
  p_draft_starts_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid; v_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to create a league.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.'; end if;
  v_visibility := coalesce(nullif(lower(trim(p_visibility)), ''), 'private');
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Invalid league visibility.'; end if;

  insert into public.profiles (id, display_name) values (auth.uid(), 'Coach') on conflict (id) do nothing;
  insert into public.leagues (name, slug, description, season_label, created_by, is_public, league_visibility, is_practice, practice_expires_at, draft_starts_at)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid(),
    v_visibility <> 'private', v_visibility, coalesce(p_is_practice, false),
    case when coalesce(p_is_practice, false) then now() + interval '30 days' else null end,
    p_draft_starts_at)
  returning id into v_league_id;
  insert into public.league_memberships (league_id, user_id, role) values (v_league_id, auth.uid(), 'commissioner');
  insert into public.league_state_snapshots (league_id) values (v_league_id);
  return v_league_id;
end;
$$;

create or replace function public.get_public_league_cards()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(card) order by card.updated_at desc), '[]'::jsonb)
  from (
    select l.id, l.name, l.slug, l.description, l.image_url, l.season_label, l.status,
      l.draft_starts_at, l.league_visibility, l.is_practice, l.updated_at,
      count(m.id) filter (where m.role in ('commissioner', 'co_commissioner', 'coach'))::integer as filled_spots,
      nullif(s.state #>> '{settings,leagueSize}', '')::integer as total_spots
    from public.leagues l
    left join public.league_memberships m on m.league_id = l.id
    left join public.league_state_snapshots s on s.league_id = l.id
    where l.league_visibility = 'open'
    group by l.id, s.state
    order by l.updated_at desc
    limit 24
  ) card;
$$;

grant execute on function public.create_league(text, text, text, text, text, boolean, timestamptz) to authenticated;
grant execute on function public.get_public_league_cards() to authenticated, anon;
