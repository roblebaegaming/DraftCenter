-- Return a bounded verified-game summary without scanning encounter rows in the API.
begin;

create or replace function public.list_verified_nuzlocke_games()
returns table(
  game_key text,
  display_name text,
  generation smallint,
  family text,
  coverage_note text,
  methods text[]
)
language sql stable security invoker set search_path = public
as $$
  select
    g.game_key,
    g.display_name,
    g.generation,
    g.family,
    g.coverage_note,
    coalesce(
      array_agg(distinct e.method order by e.method) filter (where e.method is not null),
      '{}'::text[]
    ) as methods
  from public.pokemon_games g
  left join public.pokemon_game_encounters e on e.game_key = g.game_key
  where g.encounter_status='verified'
  group by g.game_key, g.display_name, g.generation, g.family, g.coverage_note, g.release_order
  order by g.release_order
  limit 100;
$$;

revoke all on function public.list_verified_nuzlocke_games() from public, anon, authenticated;
grant execute on function public.list_verified_nuzlocke_games() to anon, authenticated;

commit;
