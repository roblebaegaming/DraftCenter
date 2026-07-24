-- Public coach cards plus profile identity and avatar fields in Daily Three comments.

begin;

create or replace function public.get_public_coach_profile(p_identity text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_identity text;
  v_wins integer := 0;
  v_losses integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to view coach profiles.'; end if;

  select p.* into v_profile
  from public.profiles p
  where lower(p.username) = lower(trim(p_identity))
     or lower(p.display_name) = lower(trim(p_identity))
  order by case when lower(p.username) = lower(trim(p_identity)) then 0 else 1 end
  limit 1;

  if v_profile.id is null then raise exception 'That coach profile was not found.'; end if;
  v_identity := coalesce(nullif(v_profile.display_name, ''), v_profile.username);

  with current_matches as (
    select
      case when result.value ->> 'gamesA' ~ '^[0-9]+$' then (result.value ->> 'gamesA')::integer else 0 end games_a,
      case when result.value ->> 'gamesB' ~ '^[0-9]+$' then (result.value ->> 'gamesB')::integer else 0 end games_b,
      lower(coalesce(s.state #>> array['teams', s.state #>> array['schedule', split_part(result.key,'-',1), split_part(result.key,'-',2), '0'], 'claimedBy'], '')) = lower(v_identity) is_a,
      lower(coalesce(s.state #>> array['teams', s.state #>> array['schedule', split_part(result.key,'-',1), split_part(result.key,'-',2), '1'], 'claimedBy'], '')) = lower(v_identity) is_b
    from public.league_state_snapshots s
    join public.league_memberships m on m.league_id=s.league_id and m.user_id=v_profile.id
    cross join lateral jsonb_each(case when jsonb_typeof(s.state->'matchResults')='object' then s.state->'matchResults' else '{}'::jsonb end) result
  ),
  current_record as (
    select
      count(*) filter(where (is_a and games_a>games_b) or (is_b and games_b>games_a))::integer wins,
      count(*) filter(where (is_a and games_a<games_b) or (is_b and games_b<games_a))::integer losses
    from current_matches where is_a or is_b
  ),
  archived_record as (
    select
      coalesce(sum(case when standing.value->>'w' ~ '^[0-9]+$' then (standing.value->>'w')::integer else 0 end),0)::integer wins,
      coalesce(sum(case when standing.value->>'l' ~ '^[0-9]+$' then (standing.value->>'l')::integer else 0 end),0)::integer losses
    from public.league_state_snapshots s
    join public.league_memberships m on m.league_id=s.league_id and m.user_id=v_profile.id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s.state->'seasonHistory')='array' then s.state->'seasonHistory' else '[]'::jsonb end) season
    cross join lateral jsonb_array_elements(case when jsonb_typeof(season.value->'standings')='array' then season.value->'standings' else '[]'::jsonb end) standing
    where lower(coalesce(season.value #>> array['teams',standing.value->>'id','claimedBy'],''))=lower(v_identity)
  )
  select coalesce(c.wins,0)+coalesce(a.wins,0), coalesce(c.losses,0)+coalesce(a.losses,0)
  into v_wins,v_losses from current_record c cross join archived_record a;

  return jsonb_build_object(
    'id',v_profile.id,
    'username',v_profile.username,
    'display_name',v_profile.display_name,
    'avatar_url',v_profile.avatar_url,
    'favorite_pokemon',to_jsonb(coalesce(v_profile.favorite_pokemon,'{}'::text[])),
    'record',jsonb_build_object(
      'wins',v_wins,'losses',v_losses,'games',v_wins+v_losses,
      'win_percentage',case when v_wins+v_losses=0 then 0 else round(100.0*v_wins/(v_wins+v_losses),1) end
    ),
    'badges',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',c.code,'name',c.name,'description',c.description,'icon',c.icon,
        'subject',coalesce(progress.subject,''),'tier',progress.tier
      ) order by progress.tier desc,c.name)
      from public.user_badge_progress progress
      join public.badge_catalog c on c.code=progress.badge_code
      where progress.user_id=v_profile.id and progress.tier>0
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_daily_game_comments(p_game_type text, p_game_id uuid, p_limit integer default 50)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.parent_comment_id nulls first,rows.upvotes desc,rows.created_at asc),'[]'::jsonb)
  from (
    select c.id,c.body,c.created_at,c.parent_comment_id,c.user_id,p.username,p.display_name,p.avatar_url,
      (select count(*)::integer from public.daily_game_comment_upvotes u where u.comment_id=c.id) upvotes,
      exists(select 1 from public.daily_game_comment_upvotes u where u.comment_id=c.id and u.user_id=auth.uid()) upvoted_by_me
    from public.daily_game_comments c left join public.profiles p on p.id=c.user_id
    where c.game_type=p_game_type and c.game_id=p_game_id
    order by c.parent_comment_id nulls first,upvotes desc,c.created_at asc
    limit greatest(1,least(coalesce(p_limit,50),200))
  ) rows;
$$;

create or replace function public.get_daily_poll_comments(p_poll_id uuid,p_limit integer default 5)
returns jsonb language sql stable security definer set search_path=public as $$
  with ranked_top as (
    select c.id,(select count(*)::integer from public.daily_poll_comment_upvotes u where u.comment_id=c.id) score
    from public.daily_poll_comments c where c.poll_id=p_poll_id and c.parent_comment_id is null
    order by score desc,c.created_at desc limit greatest(1,least(coalesce(p_limit,5),100))
  ), selected_comments as (
    select c.id,c.body,c.created_at,c.parent_comment_id,c.user_id,p.username,p.display_name,p.avatar_url,
      (select count(*)::integer from public.daily_poll_comment_upvotes u where u.comment_id=c.id) upvotes,
      exists(select 1 from public.daily_poll_comment_upvotes u where u.comment_id=c.id and u.user_id=auth.uid()) upvoted_by_me
    from public.daily_poll_comments c left join public.profiles p on p.id=c.user_id
    where c.id in(select id from ranked_top) or c.parent_comment_id in(select id from ranked_top)
  )
  select jsonb_build_object(
    'total',(select count(*)::integer from public.daily_poll_comments where poll_id=p_poll_id),
    'comments',coalesce((select jsonb_agg(to_jsonb(sc) order by case when sc.parent_comment_id is null then 0 else 1 end,sc.upvotes desc,sc.created_at desc) from selected_comments sc),'[]'::jsonb)
  );
$$;

revoke all on function public.get_public_coach_profile(text) from public,anon,authenticated;
revoke all on function public.get_daily_game_comments(text,uuid,integer) from public,anon,authenticated;
revoke all on function public.get_daily_poll_comments(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_public_coach_profile(text) to authenticated;
grant execute on function public.get_daily_game_comments(text,uuid,integer) to authenticated;
grant execute on function public.get_daily_poll_comments(uuid,integer) to authenticated;

commit;
notify pgrst,'reload schema';
