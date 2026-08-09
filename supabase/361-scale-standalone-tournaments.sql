-- Migration 361: raise standalone tournament capacity with format-specific
-- limits, set-based bracket construction, and bounded round-page projections.
-- Draft Tournament remains a separate 16-entrant product and is not changed.
begin;

alter table public.tournaments
  drop constraint if exists tournaments_entrant_limit_check;
alter table public.tournaments
  add constraint tournaments_entrant_limit_check check (
    (format = 'single-elimination' and entrant_limit between 2 and 512)
    or (format = 'double-elimination' and entrant_limit between 4 and 256)
  );

alter table public.tournament_entrants
  drop constraint if exists tournament_entrants_seed_check;
alter table public.tournament_entrants
  add constraint tournament_entrants_seed_check
  check (seed between 1 and 512);

alter table public.tournament_matches
  drop constraint if exists tournament_matches_match_number_check;
alter table public.tournament_matches
  add constraint tournament_matches_match_number_check
  check (match_number between 1 and 256);

alter table public.tournament_matches
  drop constraint if exists tournament_matches_bracket_round_check;
alter table public.tournament_matches
  add constraint tournament_matches_bracket_round_check
  check (bracket_round between 1 and 14);

create or replace function public.create_tournament(
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default '',
  p_format text default 'single-elimination'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_slug text;
  v_name text := btrim(p_name);
  v_slug_base text;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to create a tournament.'; end if;
  if nullif(v_name, '') is null
     or char_length(v_name) not between 2 and 120
     or p_visibility not in ('public', 'private')
     or p_format is null
     or p_format not in ('single-elimination', 'double-elimination')
     or p_best_of not in (1, 3)
     or p_entrant_limit is null
     or (p_format = 'single-elimination' and p_entrant_limit not between 2 and 512)
     or (p_format = 'double-elimination' and p_entrant_limit not between 4 and 256)
     or char_length(coalesce(p_description, '')) > 2000
     or char_length(coalesce(p_rules, '')) > 10000 then
    raise exception 'Tournament settings are invalid.';
  end if;

  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'tournament'; end if;
  v_slug := v_slug_base || '-' || left(replace(v_id::text, '-', ''), 8);

  insert into public.tournaments(
    id, slug, owner_id, name, description, visibility, format, best_of, entrant_limit, rules
  ) values (
    v_id, v_slug, auth.uid(), v_name, coalesce(p_description, ''), p_visibility,
    p_format, p_best_of, p_entrant_limit, coalesce(p_rules, '')
  );

  if p_visibility = 'private' then
    v_code := encode(gen_random_bytes(16), 'hex');
    insert into public.tournament_registration_codes(tournament_id, code_hash)
    values (v_id, encode(digest(v_code, 'sha256'), 'hex'));
  end if;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (v_id, auth.uid(), 'tournament_created', jsonb_build_object('format', p_format));
  return jsonb_build_object('slug', v_slug, 'registration_code', v_code);
end;
$$;

create or replace function public.create_single_elimination_tournament(
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default ''
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.create_tournament(
    p_name,
    p_description,
    p_visibility,
    p_best_of,
    p_entrant_limit,
    p_rules,
    'single-elimination'
  );
$$;

create or replace function public.set_tournament_seed(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_seed integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_old_seed integer;
  v_other uuid;
begin
  if auth.uid() is null then raise exception 'Only the tournament owner can seed registration.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration' then
    raise exception 'Only the tournament owner can seed registration.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if p_seed is null or p_seed not between 1 and v_count then
    raise exception 'Choose a valid seed.';
  end if;

  select seed into v_old_seed
  from public.tournament_entrants
  where id = p_entrant_id
    and tournament_id = p_tournament_id
    and status = 'registered';
  if not found then raise exception 'Entrant not found.'; end if;

  select id into v_other
  from public.tournament_entrants
  where tournament_id = p_tournament_id
    and status = 'registered'
    and seed = p_seed
    and id <> p_entrant_id;

  update public.tournament_entrants set seed = null where id = v_other;
  update public.tournament_entrants set seed = p_seed where id = p_entrant_id;
  if v_other is not null and v_old_seed is not null then
    update public.tournament_entrants set seed = v_old_seed where id = v_other;
  end if;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'seed_changed',
    jsonb_build_object('entrant_id', p_entrant_id, 'seed', p_seed)
  );
end;
$$;

create or replace function public.randomize_tournament_seeds(
  p_tournament_id uuid,
  p_random_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Only the tournament owner can shuffle seeds.'; end if;
  perform 1 from public.tournaments
  where id = p_tournament_id and owner_id = auth.uid() and status = 'registration'
  for update;
  if not found then raise exception 'Only the tournament owner can shuffle seeds.'; end if;
  if char_length(coalesce(p_random_key, '')) not between 8 and 120 then
    raise exception 'A valid shuffle key is required.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if v_count < 2 then raise exception 'At least two entrants are required.'; end if;

  update public.tournament_entrants
  set seed = null
  where tournament_id = p_tournament_id;

  with ranked as (
    select
      id,
      row_number() over (order by md5(p_random_key || ':' || id::text), id)::smallint as next_seed
    from public.tournament_entrants
    where tournament_id = p_tournament_id and status = 'registered'
  )
  update public.tournament_entrants entrant
  set seed = ranked.next_seed
  from ranked
  where entrant.id = ranked.id;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'seeds_randomized',
    jsonb_build_object('entrants', v_count)
  );
end;
$$;

create or replace function public.single_elimination_seed_order(p_size integer)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_order integer[] := array[1, 2];
  v_next integer[];
  v_size integer;
  v_seed integer;
begin
  if p_size < 2 or p_size > 512 or (p_size & (p_size - 1)) <> 0 then
    raise exception 'Bracket size must be a power of two.';
  end if;
  while array_length(v_order, 1) < p_size loop
    v_size := array_length(v_order, 1) * 2;
    v_next := '{}';
    foreach v_seed in array v_order loop
      v_next := v_next || v_seed || (v_size + 1 - v_seed);
    end loop;
    v_order := v_next;
  end loop;
  return v_order;
end;
$$;

create or replace function public.lock_single_elimination_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_size integer := 2;
  v_rounds integer := 1;
  v_order integer[];
  v_entrant_order uuid[];
  v_current public.tournament_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Only the owner can lock open registration.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.format <> 'single-elimination' then
    raise exception 'Only the owner can lock single-elimination registration.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if v_count < 2 then raise exception 'At least two entrants are required.'; end if;
  if v_count > 512 or v_count > v_tournament.entrant_limit then
    raise exception 'The single-elimination field exceeds its capacity.';
  end if;

  select array_agg(id order by seed nulls last, registered_at, id)
  into v_entrant_order
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  update public.tournament_entrants
  set seed = null
  where tournament_id = p_tournament_id;
  update public.tournament_entrants entrant
  set seed = ordered.seed_number::smallint
  from unnest(v_entrant_order) with ordinality as ordered(id, seed_number)
  where entrant.id = ordered.id;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_rounds := v_rounds + 1;
  end loop;
  v_order := public.single_elimination_seed_order(v_size);

  insert into public.tournament_matches(
    tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
  )
  select
    p_tournament_id,
    round_series.round_value,
    match_series.match_value,
    'single',
    round_series.round_value,
    v_tournament.best_of
  from generate_series(1, v_rounds) as round_series(round_value)
  cross join lateral generate_series(
    1,
    v_size / (power(2, round_series.round_value)::integer)
  ) as match_series(match_value);

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'single'
    and source.bracket_round < v_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'single'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = ceil(source.match_number / 2.0);

  with slots as (
    select
      match_series.match_value as match_number,
      v_order[(match_series.match_value - 1) * 2 + 1] as seed_a,
      v_order[(match_series.match_value - 1) * 2 + 2] as seed_b
    from generate_series(1, v_size / 2) as match_series(match_value)
  )
  update public.tournament_matches bracket_match
  set entrant_a_id = entrant_a.id,
      entrant_b_id = entrant_b.id,
      entrant_a_source_resolved = true,
      entrant_b_source_resolved = true,
      status = case when entrant_a.id is not null and entrant_b.id is not null then 'ready' else 'bye' end,
      winner_id = case when entrant_a.id is null or entrant_b.id is null then coalesce(entrant_a.id, entrant_b.id) else null end,
      completed_at = case when entrant_a.id is null or entrant_b.id is null then now() else null end
  from slots
  left join public.tournament_entrants entrant_a
    on entrant_a.tournament_id = p_tournament_id and entrant_a.seed = slots.seed_a
  left join public.tournament_entrants entrant_b
    on entrant_b.tournament_id = p_tournament_id and entrant_b.seed = slots.seed_b
  where bracket_match.tournament_id = p_tournament_id
    and bracket_match.bracket_stage = 'single'
    and bracket_match.bracket_round = 1
    and bracket_match.match_number = slots.match_number;

  update public.tournaments
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;

  for v_current in
    select * from public.tournament_matches
    where tournament_id = p_tournament_id
      and bracket_stage = 'single'
      and bracket_round = 1
      and status = 'bye'
    order by match_number
  loop
    perform public.advance_tournament_match_graph(v_current.id, v_current.winner_id, null, auth.uid());
  end loop;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'bracket_locked',
    jsonb_build_object(
      'format', 'single-elimination',
      'entrants', v_count,
      'bracket_size', v_size,
      'match_count', v_size - 1,
      'generation', 'set-based-v1'
    )
  );
end;
$$;

create or replace function public.lock_double_elimination_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_size integer := 2;
  v_winners_rounds integer := 1;
  v_losers_rounds integer;
  v_order integer[];
  v_entrant_order uuid[];
  v_current public.tournament_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Only the owner can lock open registration.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.format <> 'double-elimination' then
    raise exception 'Only the owner can lock double-elimination registration.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if v_count < 4 then raise exception 'Double elimination requires at least four entrants.'; end if;
  if v_count > 256 or v_count > v_tournament.entrant_limit then
    raise exception 'The double-elimination field exceeds its capacity.';
  end if;

  select array_agg(id order by seed nulls last, registered_at, id)
  into v_entrant_order
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  update public.tournament_entrants
  set seed = null
  where tournament_id = p_tournament_id;
  update public.tournament_entrants entrant
  set seed = ordered.seed_number::smallint
  from unnest(v_entrant_order) with ordinality as ordered(id, seed_number)
  where entrant.id = ordered.id;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_winners_rounds := v_winners_rounds + 1;
  end loop;
  v_losers_rounds := 2 * (v_winners_rounds - 1);
  v_order := public.single_elimination_seed_order(v_size);

  insert into public.tournament_matches(
    tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
  )
  select
    p_tournament_id,
    case when round_series.round_value = 1 then 1 else 3 * round_series.round_value - 3 end,
    match_series.match_value,
    'winners',
    round_series.round_value,
    v_tournament.best_of
  from generate_series(1, v_winners_rounds) as round_series(round_value)
  cross join lateral generate_series(
    1,
    v_size / (power(2, round_series.round_value)::integer)
  ) as match_series(match_value);

  insert into public.tournament_matches(
    tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
  )
  select
    p_tournament_id,
    case
      when round_series.round_value = 1 then 2
      when round_series.round_value % 2 = 0 then 3 * (round_series.round_value / 2) + 1
      else 3 * ((round_series.round_value - 1) / 2) + 2
    end,
    match_series.match_value,
    'losers',
    round_series.round_value,
    v_tournament.best_of
  from generate_series(1, v_losers_rounds) as round_series(round_value)
  cross join lateral generate_series(
    1,
    v_size / (power(2, floor((round_series.round_value + 1) / 2.0)::integer + 1)::integer)
  ) as match_series(match_value);

  insert into public.tournament_matches(
    tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
  ) values
    (p_tournament_id, 3 * v_winners_rounds - 1, 1, 'grand-final', 1, v_tournament.best_of),
    (p_tournament_id, 3 * v_winners_rounds, 1, 'grand-final', 2, v_tournament.best_of);

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round < v_winners_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'winners'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = ceil(source.match_number / 2.0);

  update public.tournament_matches source
  set winner_to_match_id = target.id, winner_to_slot = 'a'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round = v_winners_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 1;

  update public.tournament_matches source
  set loser_to_match_id = target.id,
      loser_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round = 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = 1
    and target.match_number = ceil(source.match_number / 2.0);

  update public.tournament_matches source
  set loser_to_match_id = target.id, loser_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round > 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = 2 * source.bracket_round - 2
    and target.match_number = source.match_number;

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case
        when source.bracket_round % 2 = 1 then 'a'
        when source.match_number % 2 = 1 then 'a'
        else 'b'
      end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'losers'
    and source.bracket_round < v_losers_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = case
      when source.bracket_round % 2 = 1 then source.match_number
      else ceil(source.match_number / 2.0)
    end;

  update public.tournament_matches source
  set winner_to_match_id = target.id, winner_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'losers'
    and source.bracket_round = v_losers_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 1;

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = 'a',
      loser_to_match_id = target.id,
      loser_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'grand-final'
    and source.bracket_round = 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 2;

  with slots as (
    select
      match_series.match_value as match_number,
      v_order[(match_series.match_value - 1) * 2 + 1] as seed_a,
      v_order[(match_series.match_value - 1) * 2 + 2] as seed_b
    from generate_series(1, v_size / 2) as match_series(match_value)
  )
  update public.tournament_matches bracket_match
  set entrant_a_id = entrant_a.id,
      entrant_b_id = entrant_b.id,
      entrant_a_source_resolved = true,
      entrant_b_source_resolved = true,
      status = case when entrant_a.id is not null and entrant_b.id is not null then 'ready' else 'bye' end,
      winner_id = case when entrant_a.id is null or entrant_b.id is null then coalesce(entrant_a.id, entrant_b.id) else null end,
      completed_at = case when entrant_a.id is null or entrant_b.id is null then now() else null end
  from slots
  left join public.tournament_entrants entrant_a
    on entrant_a.tournament_id = p_tournament_id and entrant_a.seed = slots.seed_a
  left join public.tournament_entrants entrant_b
    on entrant_b.tournament_id = p_tournament_id and entrant_b.seed = slots.seed_b
  where bracket_match.tournament_id = p_tournament_id
    and bracket_match.bracket_stage = 'winners'
    and bracket_match.bracket_round = 1
    and bracket_match.match_number = slots.match_number;

  update public.tournaments
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;

  for v_current in
    select * from public.tournament_matches
    where tournament_id = p_tournament_id
      and bracket_stage = 'winners'
      and bracket_round = 1
      and status = 'bye'
    order by match_number
  loop
    perform public.advance_tournament_match_graph(v_current.id, v_current.winner_id, null, auth.uid());
  end loop;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'bracket_locked',
    jsonb_build_object(
      'format', 'double-elimination',
      'entrants', v_count,
      'bracket_size', v_size,
      'match_count', 2 * v_size - 1,
      'generation', 'set-based-v1'
    )
  );
end;
$$;

create or replace function public.get_tournament_workspace_page(
  p_slug text,
  p_access_code text default null,
  p_bracket_stage text default null,
  p_bracket_round integer default null,
  p_match_page integer default null,
  p_match_page_size integer default 64
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_selected_stage text;
  v_selected_round integer;
  v_effective_page integer;
  v_match_offset integer;
  v_match_total integer := 0;
begin
  select * into v_tournament
  from public.tournaments
  where slug = p_slug;
  if not found or (
    not public.can_view_tournament(v_tournament.id)
    and not (
      v_tournament.status = 'registration'
      and coalesce(p_access_code, '') ~ '^[0-9a-f]{32}$'
      and exists (
        select 1 from public.tournament_registration_codes code
        where code.tournament_id = v_tournament.id
          and code.code_hash = encode(digest(p_access_code, 'sha256'), 'hex')
      )
    )
  ) then
    return null;
  end if;

  if (p_match_page is not null and p_match_page not between 1 and 256)
     or p_match_page_size not between 1 and 64 then
    raise exception 'Choose a valid bracket page.';
  end if;
  if (p_bracket_stage is null) <> (p_bracket_round is null)
     or (p_bracket_stage is not null and p_bracket_stage not in ('single', 'winners', 'losers', 'grand-final'))
     or (p_bracket_round is not null and p_bracket_round not between 1 and 14) then
    raise exception 'Choose a valid bracket round.';
  end if;

  if p_bracket_stage is not null then
    perform 1 from public.tournament_matches
    where tournament_id = v_tournament.id
      and bracket_stage = p_bracket_stage
      and bracket_round = p_bracket_round;
    if not found then raise exception 'Choose a valid bracket round.'; end if;
    v_selected_stage := p_bracket_stage;
    v_selected_round := p_bracket_round;
  else
    select summary.bracket_stage, summary.bracket_round
    into v_selected_stage, v_selected_round
    from (
      select
        bracket_match.bracket_stage,
        bracket_match.bracket_round,
        min(bracket_match.round_number) as global_round,
        bool_or(bracket_match.status in ('ready', 'reported')) as has_live_match,
        bool_or(
          bracket_match.status in ('ready', 'reported')
          and exists (
            select 1 from public.tournament_entrants entrant
            where entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
              and entrant.user_id = auth.uid()
          )
        ) as has_my_live_match
      from public.tournament_matches bracket_match
      where bracket_match.tournament_id = v_tournament.id
      group by bracket_match.bracket_stage, bracket_match.bracket_round
    ) summary
    order by
      summary.has_my_live_match desc,
      summary.has_live_match desc,
      case when summary.has_live_match then summary.global_round end asc nulls last,
      summary.global_round desc
    limit 1;
  end if;

  if v_selected_stage is not null then
    select count(*) into v_match_total
    from public.tournament_matches
    where tournament_id = v_tournament.id
      and bracket_stage = v_selected_stage
      and bracket_round = v_selected_round;
  end if;
  v_effective_page := p_match_page;
  if v_effective_page is null and v_selected_stage is not null and auth.uid() is not null then
    select ((bracket_match.match_number - 1) / p_match_page_size) + 1
    into v_effective_page
    from public.tournament_matches bracket_match
    where bracket_match.tournament_id = v_tournament.id
      and bracket_match.bracket_stage = v_selected_stage
      and bracket_match.bracket_round = v_selected_round
      and bracket_match.status in ('ready', 'reported')
      and exists (
        select 1 from public.tournament_entrants entrant
        where entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
          and entrant.user_id = auth.uid()
      )
    order by bracket_match.match_number
    limit 1;
  end if;
  v_effective_page := coalesce(v_effective_page, 1);
  v_match_offset := (v_effective_page - 1) * p_match_page_size;
  if v_match_total > 0 and v_match_offset >= v_match_total then
    raise exception 'That bracket page does not exist.';
  end if;

  return jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', v_tournament.id,
      'slug', v_tournament.slug,
      'name', v_tournament.name,
      'description', v_tournament.description,
      'visibility', v_tournament.visibility,
      'format', v_tournament.format,
      'status', v_tournament.status,
      'rules', v_tournament.rules,
      'best_of', v_tournament.best_of,
      'entrant_limit', v_tournament.entrant_limit,
      'revision', v_tournament.revision,
      'is_owner', v_tournament.owner_id = auth.uid()
    ),
    'entrants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entrant.id,
        'display_name', entrant.display_name,
        'seed', entrant.seed,
        'status', entrant.status,
        'is_me', entrant.user_id = auth.uid(),
        'replacement_pending', exists (
          select 1 from public.tournament_entrant_replacements replacement
          where replacement.replacement_entrant_id = entrant.id
            and replacement.claimed_at is null
            and replacement.expires_at > now()
        )
      ) order by entrant.seed nulls last, entrant.registered_at)
      from public.tournament_entrants entrant
      where entrant.tournament_id = v_tournament.id
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bracket_stage', round_summary.bracket_stage,
        'bracket_round', round_summary.bracket_round,
        'global_round', round_summary.global_round,
        'match_count', round_summary.match_count,
        'live_match_count', round_summary.live_match_count
      ) order by round_summary.global_round, round_summary.bracket_round)
      from (
        select
          bracket_match.bracket_stage,
          bracket_match.bracket_round,
          min(bracket_match.round_number) as global_round,
          count(*) as match_count,
          count(*) filter (where bracket_match.status in ('ready', 'reported')) as live_match_count
        from public.tournament_matches bracket_match
        where bracket_match.tournament_id = v_tournament.id
        group by bracket_match.bracket_stage, bracket_match.bracket_round
      ) round_summary
    ), '[]'::jsonb),
    'match_page', jsonb_build_object(
      'bracket_stage', v_selected_stage,
      'bracket_round', v_selected_round,
      'page', v_effective_page,
      'page_size', p_match_page_size,
      'total_matches', v_match_total,
      'total_pages', case
        when v_match_total = 0 then 0
        else ceil(v_match_total::numeric / p_match_page_size)::integer
      end
    ),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bracket_match.id,
        'round_number', bracket_match.round_number,
        'match_number', bracket_match.match_number,
        'bracket_stage', bracket_match.bracket_stage,
        'bracket_round', bracket_match.bracket_round,
        'entrant_a_id', bracket_match.entrant_a_id,
        'entrant_b_id', bracket_match.entrant_b_id,
        'winner_id', bracket_match.winner_id,
        'games_a', bracket_match.games_a,
        'games_b', bracket_match.games_b,
        'best_of', bracket_match.best_of,
        'status', bracket_match.status,
        'revision', bracket_match.revision,
        'replay_urls', bracket_match.replay_urls,
        'mvp', bracket_match.mvp
      ) order by bracket_match.match_number)
      from (
        select * from public.tournament_matches source
        where source.tournament_id = v_tournament.id
          and source.bracket_stage = v_selected_stage
          and source.bracket_round = v_selected_round
        order by source.match_number
        offset v_match_offset
        limit p_match_page_size
      ) bracket_match
    ), '[]'::jsonb),
    'submissions', case when auth.uid() is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', submission.id,
        'match_id', submission.match_id,
        'submitted_by_me', submission.submitted_by = auth.uid(),
        'games_a', submission.games_a,
        'games_b', submission.games_b,
        'replay_urls', submission.replay_urls,
        'mvp', submission.mvp,
        'status', submission.status,
        'expected_match_revision', submission.expected_match_revision
      ))
      from public.tournament_result_submissions submission
      join public.tournament_matches bracket_match on bracket_match.id = submission.match_id
      where submission.tournament_id = v_tournament.id
        and submission.status = 'pending'
        and bracket_match.bracket_stage = v_selected_stage
        and bracket_match.bracket_round = v_selected_round
        and bracket_match.match_number between v_match_offset + 1 and v_match_offset + p_match_page_size
        and (
          v_tournament.owner_id = auth.uid()
          or exists (
            select 1 from public.tournament_entrants entrant
            where entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
              and entrant.user_id = auth.uid()
          )
        )
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.get_tournament_workspace_page(text, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_tournament_workspace_page(text, text, text, integer, integer, integer)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
