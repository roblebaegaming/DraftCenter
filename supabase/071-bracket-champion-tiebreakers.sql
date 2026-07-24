-- Rank community bracket champions without replacing the larger Daily Three function.

begin;

create or replace function public.get_daily_bracket_champion_rankings(p_bracket_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bracket as (
    select id, game_date
    from public.daily_draft_brackets
    where id = p_bracket_id
  ),
  finalists as (
    select
      lower(m.winner) as pokemon_key,
      min(m.winner) as pokemon,
      count(*)::integer as final_wins
    from public.daily_bracket_matchups m
    where m.bracket_id = p_bracket_id
      and m.round_number = 3
    group by lower(m.winner)
  ),
  ranked as (
    select
      f.pokemon,
      f.final_wins,
      coalesce((
        select round(
          100.0 * count(*) filter (where lower(m.winner) = f.pokemon_key)
          / nullif(count(*), 0)
        )::integer
        from public.daily_bracket_matchups m
        where m.bracket_id = p_bracket_id
          and m.round_number = 2
          and (
            lower(m.winner) = f.pokemon_key
            or lower(m.loser) = f.pokemon_key
          )
      ), 0) as semifinal_percent,
      coalesce((
        select round(
          100.0 * count(*) filter (where lower(m.winner) = f.pokemon_key)
          / nullif(count(*), 0)
        )::integer
        from public.daily_bracket_matchups m
        where m.bracket_id = p_bracket_id
          and m.round_number = 1
          and (
            lower(m.winner) = f.pokemon_key
            or lower(m.loser) = f.pokemon_key
          )
      ), 0) as quarterfinal_percent
    from finalists f
  )
  select case
    when not exists (select 1 from bracket) then '[]'::jsonb
    when (
      select game_date >= current_date and auth.uid() is null
      from bracket
    ) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'pokemon', pokemon,
          'wins', final_wins,
          'semifinal_percent', semifinal_percent,
          'quarterfinal_percent', quarterfinal_percent
        )
        order by
          final_wins desc,
          semifinal_percent desc,
          quarterfinal_percent desc,
          pokemon
      )
      from ranked
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.get_daily_bracket_champion_rankings(uuid)
  from public, anon, authenticated;

grant execute on function public.get_daily_bracket_champion_rankings(uuid)
  to anon, authenticated;

commit;
