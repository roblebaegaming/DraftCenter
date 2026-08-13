-- Turn each Sunday Daily Draft Bracket into a weekly final built from the six
-- Monday-Saturday community champions and the strongest non-winners.

begin;

alter table public.daily_draft_brackets
  add column if not exists bracket_kind text not null default 'daily',
  add column if not exists qualification jsonb not null default '{}'::jsonb;

alter table public.daily_draft_brackets
  drop constraint if exists daily_draft_brackets_bracket_kind_check,
  add constraint daily_draft_brackets_bracket_kind_check
    check (bracket_kind in ('daily', 'weekly_final')),
  drop constraint if exists daily_draft_brackets_qualification_check,
  add constraint daily_draft_brackets_qualification_check
    check (jsonb_typeof(qualification) = 'object');

update public.daily_draft_brackets
set
  bracket_kind = 'weekly_final',
  qualification = case
    when qualification ->> 'status' = 'finalized' then qualification
    else jsonb_build_object('status', 'pending')
  end
where game_date >= date '2026-08-16'
  and extract(isodow from game_date) = 7;

create or replace function public.prepare_sunday_super_bracket_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_date >= date '2026-08-16'
     and extract(isodow from new.game_date) = 7 then
    new.bracket_kind := 'weekly_final';
    if coalesce(new.qualification ->> 'status', '') <> 'finalized' then
      new.qualification := jsonb_build_object('status', 'pending');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_sunday_super_bracket_row on public.daily_draft_brackets;
create trigger prepare_sunday_super_bracket_row
before insert or update of game_date on public.daily_draft_brackets
for each row execute function public.prepare_sunday_super_bracket_row();

create or replace function public.build_sunday_super_bracket_qualification(p_game_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with source_brackets as (
    select b.id, b.game_date
    from public.daily_draft_brackets b
    where b.game_date between p_game_date - 6 and p_game_date - 1
  ),
  completed_source_brackets as (
    select b.*
    from source_brackets b
    where exists (
      select 1 from public.daily_bracket_matchups m
      where m.bracket_id = b.id and m.round_number = 3
    )
  ),
  daily_entrants as (
    select b.id as bracket_id, b.game_date, lower(trim(p.value)) as pokemon_key, min(p.value) as pokemon
    from completed_source_brackets b
    cross join lateral jsonb_array_elements_text((select pokemon from public.daily_draft_brackets where id = b.id)) p(value)
    group by b.id, b.game_date, lower(trim(p.value))
  ),
  daily_metrics as (
    select
      e.*,
      (select count(*)::integer from public.daily_bracket_matchups m where m.bracket_id = e.bracket_id and m.round_number = 3 and lower(trim(m.winner)) = e.pokemon_key) as final_wins,
      (select count(*)::integer from public.daily_bracket_matchups m where m.bracket_id = e.bracket_id and m.round_number = 2 and lower(trim(m.winner)) = e.pokemon_key) as semifinal_wins,
      (select count(*)::integer from public.daily_bracket_matchups m where m.bracket_id = e.bracket_id and m.round_number = 2 and e.pokemon_key in (lower(trim(m.winner)), lower(trim(m.loser)))) as semifinal_appearances,
      (select count(*)::integer from public.daily_bracket_matchups m where m.bracket_id = e.bracket_id and m.round_number = 1 and lower(trim(m.winner)) = e.pokemon_key) as quarterfinal_wins,
      (select count(*)::integer from public.daily_bracket_matchups m where m.bracket_id = e.bracket_id and m.round_number = 1 and e.pokemon_key in (lower(trim(m.winner)), lower(trim(m.loser)))) as quarterfinal_appearances
    from daily_entrants e
  ),
  daily_ranked as (
    select
      d.*,
      row_number() over (
        partition by d.bracket_id
        order by
          d.final_wins desc,
          coalesce(d.semifinal_wins::numeric / nullif(d.semifinal_appearances, 0), 0) desc,
          coalesce(d.quarterfinal_wins::numeric / nullif(d.quarterfinal_appearances, 0), 0) desc,
          d.pokemon_key
      ) as champion_rank
    from daily_metrics d
  ),
  daily_champions as (
    select * from daily_ranked where champion_rank = 1
  ),
  weekly_entrants as (
    select lower(trim(p.value)) as pokemon_key, min(p.value) as pokemon
    from source_brackets b
    cross join lateral jsonb_array_elements_text((select pokemon from public.daily_draft_brackets where id = b.id)) p(value)
    group by lower(trim(p.value))
  ),
  weekly_metrics as (
    select
      e.*,
      (select count(*)::integer from public.daily_bracket_matchups m join source_brackets b on b.id = m.bracket_id where m.round_number = 3 and lower(trim(m.winner)) = e.pokemon_key) as final_wins,
      (select count(*)::integer from public.daily_bracket_matchups m join source_brackets b on b.id = m.bracket_id where m.round_number = 2 and lower(trim(m.winner)) = e.pokemon_key) as semifinal_wins,
      (select count(*)::integer from public.daily_bracket_matchups m join source_brackets b on b.id = m.bracket_id where m.round_number = 2 and e.pokemon_key in (lower(trim(m.winner)), lower(trim(m.loser)))) as semifinal_appearances,
      (select count(*)::integer from public.daily_bracket_matchups m join source_brackets b on b.id = m.bracket_id where m.round_number = 1 and lower(trim(m.winner)) = e.pokemon_key) as quarterfinal_wins,
      (select count(*)::integer from public.daily_bracket_matchups m join source_brackets b on b.id = m.bracket_id where m.round_number = 1 and e.pokemon_key in (lower(trim(m.winner)), lower(trim(m.loser)))) as quarterfinal_appearances
    from weekly_entrants e
  ),
  champion_sources as (
    select
      c.pokemon_key,
      min(c.pokemon) as pokemon,
      jsonb_agg(to_jsonb(c.game_date) order by c.game_date) as source_dates
    from daily_champions c
    group by c.pokemon_key
  ),
  champion_qualifiers as (
    select
      w.*,
      'daily_winner'::text as source,
      c.source_dates,
      0 as wildcard_rank
    from weekly_metrics w
    join champion_sources c using (pokemon_key)
  ),
  wildcard_ranked as (
    select
      w.*,
      'performance_wildcard'::text as source,
      '[]'::jsonb as source_dates,
      row_number() over (
        order by
          w.final_wins desc,
          coalesce(w.semifinal_wins::numeric / nullif(w.semifinal_appearances, 0), 0) desc,
          coalesce(w.quarterfinal_wins::numeric / nullif(w.quarterfinal_appearances, 0), 0) desc,
          w.pokemon_key
      ) as wildcard_rank
    from weekly_metrics w
    where not exists (select 1 from champion_sources c where c.pokemon_key = w.pokemon_key)
  ),
  selected_qualifiers as (
    select * from champion_qualifiers
    union all
    select * from wildcard_ranked
    where wildcard_rank <= 8 - (select count(*) from champion_qualifiers)
  ),
  seeded_qualifiers as (
    select
      q.*,
      row_number() over (
        order by
          q.final_wins desc,
          coalesce(q.semifinal_wins::numeric / nullif(q.semifinal_appearances, 0), 0) desc,
          coalesce(q.quarterfinal_wins::numeric / nullif(q.quarterfinal_appearances, 0), 0) desc,
          q.pokemon_key
      ) as seed
    from selected_qualifiers q
  ),
  readiness as (
    select
      (select count(*) from source_brackets) as source_days,
      (select count(*) from daily_champions) as completed_source_days,
      (select count(*) from seeded_qualifiers) as qualifier_count
  )
  select jsonb_build_object(
    'status', case when r.source_days = 6 and r.completed_source_days = 6 and r.qualifier_count = 8 then 'ready' else 'pending' end,
    'window_start', p_game_date - 6,
    'window_end', p_game_date - 1,
    'source_days_completed', r.completed_source_days,
    'source_days_required', 6,
    'pokemon', case when r.source_days = 6 and r.completed_source_days = 6 and r.qualifier_count = 8 then coalesce((
      select jsonb_agg(s.pokemon order by case s.seed when 1 then 1 when 8 then 2 when 4 then 3 when 5 then 4 when 2 then 5 when 7 then 6 when 3 then 7 when 6 then 8 end)
      from seeded_qualifiers s
    ), '[]'::jsonb) else '[]'::jsonb end,
    'qualifiers', case when r.source_days = 6 and r.completed_source_days = 6 and r.qualifier_count = 8 then coalesce((
      select jsonb_agg(jsonb_build_object(
        'pokemon', s.pokemon,
        'seed', s.seed,
        'source', s.source,
        'source_dates', s.source_dates,
        'final_wins', s.final_wins,
        'semifinal_percent', coalesce(round(100.0 * s.semifinal_wins / nullif(s.semifinal_appearances, 0))::integer, 0),
        'quarterfinal_percent', coalesce(round(100.0 * s.quarterfinal_wins / nullif(s.quarterfinal_appearances, 0))::integer, 0)
      ) order by s.seed)
      from seeded_qualifiers s
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from readiness r;
$$;

create or replace function public.finalize_sunday_super_bracket(p_game_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_date date := coalesce(p_game_date, (now() at time zone 'America/Los_Angeles')::date);
  v_bracket public.daily_draft_brackets;
  v_proposal jsonb;
  v_qualification jsonb;
begin
  if extract(isodow from v_game_date) <> 7 then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_sunday', 'game_date', v_game_date);
  end if;
  if v_game_date > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'A future Sunday bracket cannot be finalized.';
  end if;

  select * into v_bracket
  from public.daily_draft_brackets
  where game_date = v_game_date
  for update;

  if v_bracket.id is null then
    return jsonb_build_object('status', 'pending', 'reason', 'bracket_missing', 'game_date', v_game_date);
  end if;
  if v_bracket.bracket_kind <> 'weekly_final' then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_weekly_final', 'game_date', v_game_date);
  end if;
  if v_bracket.qualification ->> 'status' = 'finalized' then
    return v_bracket.qualification || jsonb_build_object('bracket_id', v_bracket.id, 'game_date', v_game_date);
  end if;
  if exists (select 1 from public.daily_bracket_matchups where bracket_id = v_bracket.id) then
    raise exception 'The Sunday Super Bracket already has submissions and cannot be reseeded.';
  end if;

  select public.build_sunday_super_bracket_qualification(v_game_date) into v_proposal;
  if v_proposal ->> 'status' <> 'ready' then
    return v_proposal || jsonb_build_object('bracket_id', v_bracket.id, 'game_date', v_game_date);
  end if;

  v_qualification := (v_proposal - 'pokemon') || jsonb_build_object(
    'status', 'finalized',
    'finalized_at', now()
  );
  update public.daily_draft_brackets
  set pokemon = v_proposal -> 'pokemon', qualification = v_qualification
  where id = v_bracket.id;

  return v_qualification || jsonb_build_object('bracket_id', v_bracket.id, 'game_date', v_game_date);
end;
$$;

create or replace function public.get_daily_bracket_context(p_bracket_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'kind', b.bracket_kind,
      'ready', b.bracket_kind = 'daily' or b.qualification ->> 'status' = 'finalized',
      'qualification', b.qualification
    )
    from public.daily_draft_brackets b
    where b.id = p_bracket_id
  ), '{}'::jsonb);
$$;

create or replace function public.require_ready_sunday_super_bracket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.daily_draft_brackets b
    where b.id = new.bracket_id
      and b.bracket_kind = 'weekly_final'
      and coalesce(b.qualification ->> 'status', '') <> 'finalized'
  ) then
    raise exception 'Sunday Super Bracket qualifiers are still being finalized. Refresh shortly.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_ready_sunday_super_bracket on public.daily_bracket_matchups;
create trigger require_ready_sunday_super_bracket
before insert on public.daily_bracket_matchups
for each row execute function public.require_ready_sunday_super_bracket();

revoke all on function public.prepare_sunday_super_bracket_row() from public, anon, authenticated;
revoke all on function public.build_sunday_super_bracket_qualification(date) from public, anon, authenticated;
revoke all on function public.finalize_sunday_super_bracket(date) from public, anon, authenticated;
revoke all on function public.get_daily_bracket_context(uuid) from public, anon, authenticated;
revoke all on function public.require_ready_sunday_super_bracket() from public, anon, authenticated;

grant execute on function public.finalize_sunday_super_bracket(date) to service_role;
grant execute on function public.get_daily_bracket_context(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
