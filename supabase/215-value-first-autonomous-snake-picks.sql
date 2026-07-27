-- Server-only snake picks previously fell back to the snapshot pool's source
-- order. That pool is Pokédex-ordered, so an unattended bot could select the
-- lowest Pokédex number instead of the highest-value legal Pokémon.

begin;

-- Older production databases can have the live-draft tables without the
-- snapshot index used by the autonomous picker. Recover it from the canonical
-- team names before replacing the picker.
alter table public.teams
  add column if not exists source_key text;

with matches as (
  select distinct on (team.id)
    team.id,
    entry.ordinality - 1 as team_index
  from public.teams team
  join public.league_state_snapshots snapshot
    on snapshot.league_id = team.league_id
  cross join lateral jsonb_array_elements(
    coalesce(snapshot.state -> 'teams', '[]'::jsonb)
  ) with ordinality entry(value, ordinality)
  where team.source_key is null
    and lower(entry.value ->> 'name') = lower(team.name)
  order by team.id, entry.ordinality
)
update public.teams team
set source_key = matches.team_index::text
from matches
where matches.id = team.id;

with numbered as (
  select
    team.id,
    row_number() over (
      partition by team.league_id
      order by team.created_at, team.id
    ) - 1 as team_index
  from public.teams team
  where team.source_key is null
)
update public.teams team
set source_key = numbered.team_index::text
from numbered
where numbered.id = team.id;

create unique index if not exists teams_league_source_key_idx
  on public.teams (league_id, source_key);

do $$
declare
  v_definition text;
  v_old_order text := 'order by ranked.source_order, ranked.choice_order';
  v_new_order text := $replacement$
order by
          ranked.source_order,
          case when ranked.source_order = 0 then ranked.choice_order end,
          pokemon.cost desc nulls last,
          md5(
            pokemon.id::text
            || ':' || v_session.current_pick_number::text
            || ':' || v_team_index::text
          )$replacement$;
begin
  select pg_get_functiondef(
    'public.reconcile_autonomous_snake_drafts()'::regprocedure
  )
  into v_definition;

  if position(v_old_order in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_order, v_new_order);
    execute v_definition;
  elsif position('pokemon.cost DESC NULLS LAST' in v_definition) = 0
    and position('pokemon.cost desc nulls last' in v_definition) = 0 then
    raise exception
      'The autonomous snake candidate ordering could not be located.';
  end if;
end;
$$;

revoke all on function public.reconcile_autonomous_snake_drafts()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_snake_drafts()
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1 from cron.job
      where jobname = 'draftcenter-autonomous-snake-drafts'
    ) then
      perform cron.unschedule('draftcenter-autonomous-snake-drafts');
    end if;
    perform cron.schedule(
      'draftcenter-autonomous-snake-drafts',
      '* * * * *',
      'select public.reconcile_autonomous_snake_drafts()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_autonomous_snake_drafts every minute.';
  end if;
exception when others then
  raise notice 'Autonomous snake cron registration needs manual verification: %', sqlerrm;
end;
$$;

commit;

notify pgrst, 'reload schema';
