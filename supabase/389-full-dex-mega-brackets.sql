-- Private, resumable Full Dex Mega Brackets. Each attempt freezes the exact
-- 1,162-entry DraftCenter catalogue and records the validated 1,161-winner path.

begin;

create extension if not exists pgcrypto with schema extensions;

create table public.mega_bracket_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  revision integer not null default 0 check (revision >= 0),
  catalog_version text not null check (char_length(catalog_version) between 3 and 80),
  catalog_hash text not null check (catalog_hash ~ '^[0-9a-f]{64}$'),
  catalog_snapshot jsonb not null check (
    jsonb_typeof(catalog_snapshot) = 'array'
    and jsonb_array_length(catalog_snapshot) = 1162
  ),
  seed text not null check (seed ~ '^[0-9a-f]{32}$'),
  winners jsonb not null default '[]'::jsonb check (
    jsonb_typeof(winners) = 'array'
    and jsonb_array_length(winners) <= 1161
  ),
  top_64 jsonb not null default '[]'::jsonb check (
    jsonb_typeof(top_64) = 'array'
    and jsonb_array_length(top_64) in (0, 64)
  ),
  champion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint mega_bracket_completion_check check (
    (status = 'completed' and champion is not null and completed_at is not null and jsonb_array_length(winners) = 1161 and jsonb_array_length(top_64) = 64)
    or (status <> 'completed' and champion is null and completed_at is null)
  )
);

create unique index mega_bracket_one_active_attempt_idx
  on public.mega_bracket_attempts(user_id)
  where status = 'active';

create index mega_bracket_attempt_history_idx
  on public.mega_bracket_attempts(user_id, completed_at desc)
  where status = 'completed';

alter table public.mega_bracket_attempts enable row level security;

revoke all on table public.mega_bracket_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.mega_bracket_attempts to service_role;

comment on table public.mega_bracket_attempts is
  'Private Full Dex Mega Bracket progress. Client roles use owner-scoped RPCs and never read rows directly.';

create or replace function public.mega_bracket_seeded_entrants(p_catalog jsonb, p_seed text)
returns jsonb
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    jsonb_agg(entry.value order by encode(digest(p_seed || ':' || entry.value, 'sha256'), 'hex'), entry.ordinality),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(p_catalog) with ordinality entry(value, ordinality);
$$;

create or replace function public.mega_bracket_progress(p_entrants jsonb, p_winners jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_current text[];
  v_choices text[];
  v_next text[];
  v_top_64 text[] := array[]::text[];
  v_total integer;
  v_cursor integer := 0;
  v_play_in_matches integer;
  v_match_count integer;
  v_index integer;
  v_left text;
  v_right text;
  v_winner text;
  v_round_label text;
begin
  if jsonb_typeof(p_entrants) <> 'array' or jsonb_array_length(p_entrants) <> 1162 then
    raise exception 'Mega Bracket entrants are incomplete.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_winners) <> 'array' then
    raise exception 'Mega Bracket choices are malformed.' using errcode = '22023';
  end if;

  select array_agg(entry.value order by entry.ordinality)
    into v_current
  from jsonb_array_elements_text(p_entrants) with ordinality entry(value, ordinality);
  select coalesce(array_agg(choice.value order by choice.ordinality), array[]::text[])
    into v_choices
  from jsonb_array_elements_text(p_winners) with ordinality choice(value, ordinality);

  v_total := cardinality(v_choices);
  if v_total > 1161 then
    raise exception 'Mega Bracket choices exceed the full bracket.' using errcode = '22023';
  end if;

  -- 1,162 entrants need 138 play-in matches so exactly 1,024 advance.
  v_play_in_matches := cardinality(v_current) - 1024;
  v_next := v_current[(v_play_in_matches * 2 + 1):cardinality(v_current)];
  for v_index in 1..v_play_in_matches loop
    v_left := v_current[v_index * 2 - 1];
    v_right := v_current[v_index * 2];
    if v_cursor >= v_total then
      return jsonb_build_object(
        'choices_completed', v_cursor,
        'total_choices', 1161,
        'choices_remaining', 1161 - v_cursor,
        'survivors', 1162 - v_cursor,
        'phase', 'road_to_64',
        'round_label', 'Play-in round',
        'round_size', 1162,
        'match_number', v_index,
        'match_count', v_play_in_matches,
        'next_match', jsonb_build_object('left', v_left, 'right', v_right),
        'top_64', '[]'::jsonb,
        'champion', null,
        'complete', false
      );
    end if;
    v_winner := v_choices[v_cursor + 1];
    if v_winner is distinct from v_left and v_winner is distinct from v_right then
      raise exception 'Choice % does not belong to its Mega Bracket matchup.', v_cursor + 1 using errcode = '22023';
    end if;
    v_next := array_append(v_next, v_winner);
    v_cursor := v_cursor + 1;
  end loop;
  v_current := v_next;

  while cardinality(v_current) > 1 loop
    if cardinality(v_current) = 64 then
      v_top_64 := v_current;
    end if;
    v_match_count := cardinality(v_current) / 2;
    v_next := array[]::text[];
    v_round_label := case cardinality(v_current)
      when 1024 then 'Round of 1,024'
      when 512 then 'Round of 512'
      when 256 then 'Round of 256'
      when 128 then 'Road to the Top 64'
      when 64 then 'Round of 64'
      when 32 then 'Round of 32'
      when 16 then 'Sweet 16'
      when 8 then 'Elite Eight'
      when 4 then 'Final Four'
      when 2 then 'Championship'
      else 'Mega Bracket round'
    end;
    for v_index in 1..v_match_count loop
      v_left := v_current[v_index * 2 - 1];
      v_right := v_current[v_index * 2];
      if v_cursor >= v_total then
        return jsonb_build_object(
          'choices_completed', v_cursor,
          'total_choices', 1161,
          'choices_remaining', 1161 - v_cursor,
          'survivors', 1162 - v_cursor,
          'phase', case when v_cursor >= 1098 then 'top_64' else 'road_to_64' end,
          'round_label', v_round_label,
          'round_size', cardinality(v_current),
          'match_number', v_index,
          'match_count', v_match_count,
          'next_match', jsonb_build_object('left', v_left, 'right', v_right),
          'top_64', to_jsonb(v_top_64),
          'champion', null,
          'complete', false
        );
      end if;
      v_winner := v_choices[v_cursor + 1];
      if v_winner is distinct from v_left and v_winner is distinct from v_right then
        raise exception 'Choice % does not belong to its Mega Bracket matchup.', v_cursor + 1 using errcode = '22023';
      end if;
      v_next := array_append(v_next, v_winner);
      v_cursor := v_cursor + 1;
    end loop;
    v_current := v_next;
  end loop;

  if v_cursor <> v_total then
    raise exception 'Mega Bracket choices continue after the champion.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'choices_completed', v_cursor,
    'total_choices', 1161,
    'choices_remaining', 0,
    'survivors', 1,
    'phase', 'top_64',
    'round_label', 'Complete',
    'round_size', 1,
    'match_number', null,
    'match_count', null,
    'next_match', null,
    'top_64', to_jsonb(v_top_64),
    'champion', v_current[1],
    'complete', true
  );
end;
$$;

create or replace function public.mega_bracket_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', attempt.id,
    'status', attempt.status,
    'revision', attempt.revision,
    'catalog_version', attempt.catalog_version,
    'catalog_hash', attempt.catalog_hash,
    'catalog', attempt.catalog_snapshot,
    'seed', attempt.seed,
    'entrants', public.mega_bracket_seeded_entrants(attempt.catalog_snapshot, attempt.seed),
    'winners', attempt.winners,
    'top_64', attempt.top_64,
    'champion', attempt.champion,
    'created_at', attempt.created_at,
    'updated_at', attempt.updated_at,
    'completed_at', attempt.completed_at,
    'progress', public.mega_bracket_progress(
      public.mega_bracket_seeded_entrants(attempt.catalog_snapshot, attempt.seed),
      attempt.winners
    )
  )
  from public.mega_bracket_attempts attempt
  where attempt.id = p_attempt_id;
$$;

create or replace function public.create_mega_bracket_attempt(
  p_catalog jsonb,
  p_catalog_version text default 'draftcenter-full-dex-2026-08-13'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_catalog_text text;
  v_catalog_hash text;
  v_total integer;
  v_unique integer;
  v_seed text;
begin
  if v_user_id is null then
    raise exception 'Sign in to start a Mega Bracket.' using errcode = '42501';
  end if;
  select attempt.id into v_attempt_id
  from public.mega_bracket_attempts attempt
  where attempt.user_id = v_user_id and attempt.status = 'active';
  if v_attempt_id is not null then
    return public.mega_bracket_attempt_payload(v_attempt_id);
  end if;

  if jsonb_typeof(p_catalog) <> 'array' or jsonb_array_length(p_catalog) <> 1162 then
    raise exception 'The current Mega Bracket catalogue requires exactly 1,162 Pokémon and forms.' using errcode = '22023';
  end if;
  select count(*), count(distinct entry.value), string_agg(entry.value, E'\n' order by entry.ordinality)
    into v_total, v_unique, v_catalog_text
  from jsonb_array_elements_text(p_catalog) with ordinality entry(value, ordinality);
  if v_total <> 1162 or v_unique <> 1162 then
    raise exception 'The Mega Bracket catalogue contains a missing or duplicate Pokémon.' using errcode = '22023';
  end if;
  v_catalog_hash := encode(digest(v_catalog_text, 'sha256'), 'hex');
  if p_catalog_version <> 'draftcenter-full-dex-2026-08-13'
     or v_catalog_hash <> 'acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36' then
    raise exception 'The Mega Bracket catalogue changed. Refresh before starting.' using errcode = '22023';
  end if;

  v_seed := encode(gen_random_bytes(16), 'hex');
  insert into public.mega_bracket_attempts(user_id, catalog_version, catalog_hash, catalog_snapshot, seed)
  values(v_user_id, p_catalog_version, v_catalog_hash, p_catalog, v_seed)
  on conflict (user_id) where status = 'active' do nothing
  returning id into v_attempt_id;
  if v_attempt_id is null then
    select attempt.id into v_attempt_id
    from public.mega_bracket_attempts attempt
    where attempt.user_id = v_user_id and attempt.status = 'active';
  end if;
  return public.mega_bracket_attempt_payload(v_attempt_id);
end;
$$;

create or replace function public.get_my_mega_brackets()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then jsonb_build_object('active', null, 'completed', '[]'::jsonb) else jsonb_build_object(
    'active', (
      select public.mega_bracket_attempt_payload(attempt.id)
      from public.mega_bracket_attempts attempt
      where attempt.user_id = auth.uid() and attempt.status = 'active'
      limit 1
    ),
    'completed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', history.id,
        'catalog_version', history.catalog_version,
        'catalog_hash', history.catalog_hash,
        'champion', history.champion,
        'top_64', history.top_64,
        'created_at', history.created_at,
        'completed_at', history.completed_at
      ) order by history.completed_at desc)
      from (
        select * from public.mega_bracket_attempts
        where user_id = auth.uid() and status = 'completed'
        order by completed_at desc
        limit 50
      ) history
    ), '[]'::jsonb)
  ) end;
$$;

create or replace function public.get_my_mega_bracket_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to open a saved Mega Bracket.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.mega_bracket_attempts
    where id = p_attempt_id and user_id = v_user_id and status in ('active', 'completed')
  ) then
    raise exception 'That Mega Bracket was not found.' using errcode = 'P0002';
  end if;
  return public.mega_bracket_attempt_payload(p_attempt_id);
end;
$$;

create or replace function public.save_mega_bracket_progress(
  p_attempt_id uuid,
  p_expected_revision integer,
  p_winners jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.mega_bracket_attempts%rowtype;
  v_entrants jsonb;
  v_progress jsonb;
  v_winners text[];
begin
  if v_user_id is null then
    raise exception 'Sign in to save Mega Bracket progress.' using errcode = '42501';
  end if;
  select * into v_attempt
  from public.mega_bracket_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'That Mega Bracket was not found.' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'active' then
    raise exception 'That Mega Bracket is already complete.' using errcode = '22023';
  end if;
  if v_attempt.revision <> p_expected_revision then
    raise exception 'That Mega Bracket changed in another session. Refresh before saving again.' using errcode = '40001';
  end if;
  if jsonb_typeof(p_winners) <> 'array' then
    raise exception 'Mega Bracket choices are malformed.' using errcode = '22023';
  end if;
  select coalesce(array_agg(choice.value order by choice.ordinality), array[]::text[])
    into v_winners
  from jsonb_array_elements_text(p_winners) with ordinality choice(value, ordinality);
  if cardinality(v_winners) > 1161 then
    raise exception 'Mega Bracket choices exceed the full bracket.' using errcode = '22023';
  end if;

  v_entrants := public.mega_bracket_seeded_entrants(v_attempt.catalog_snapshot, v_attempt.seed);
  v_progress := public.mega_bracket_progress(v_entrants, p_winners);
  update public.mega_bracket_attempts
  set
    winners = p_winners,
    revision = revision + 1,
    status = case when (v_progress ->> 'complete')::boolean then 'completed' else 'active' end,
    top_64 = coalesce(v_progress -> 'top_64', '[]'::jsonb),
    champion = case when (v_progress ->> 'complete')::boolean then v_progress ->> 'champion' else null end,
    completed_at = case when (v_progress ->> 'complete')::boolean then now() else null end,
    updated_at = now()
  where id = v_attempt.id;
  return public.mega_bracket_attempt_payload(v_attempt.id);
end;
$$;

create or replace function public.abandon_mega_bracket_attempt(
  p_attempt_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.mega_bracket_attempts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign in to restart a Mega Bracket.' using errcode = '42501';
  end if;
  select * into v_attempt
  from public.mega_bracket_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;
  if not found or v_attempt.status <> 'active' then
    raise exception 'That active Mega Bracket was not found.' using errcode = 'P0002';
  end if;
  if v_attempt.revision <> p_expected_revision then
    raise exception 'That Mega Bracket changed in another session. Refresh before restarting.' using errcode = '40001';
  end if;
  update public.mega_bracket_attempts
  set status = 'abandoned', updated_at = now()
  where id = v_attempt.id;
  return jsonb_build_object('status', 'abandoned', 'id', v_attempt.id);
end;
$$;

revoke all on function public.mega_bracket_seeded_entrants(jsonb, text) from public, anon, authenticated;
revoke all on function public.mega_bracket_progress(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mega_bracket_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function public.create_mega_bracket_attempt(jsonb, text) from public, anon, authenticated;
revoke all on function public.get_my_mega_brackets() from public, anon, authenticated;
revoke all on function public.get_my_mega_bracket_attempt(uuid) from public, anon, authenticated;
revoke all on function public.save_mega_bracket_progress(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.abandon_mega_bracket_attempt(uuid, integer) from public, anon, authenticated;

grant execute on function public.create_mega_bracket_attempt(jsonb, text) to authenticated;
grant execute on function public.get_my_mega_brackets() to authenticated;
grant execute on function public.get_my_mega_bracket_attempt(uuid) to authenticated;
grant execute on function public.save_mega_bracket_progress(uuid, integer, jsonb) to authenticated;
grant execute on function public.abandon_mega_bracket_attempt(uuid, integer) to authenticated;
grant execute on function public.create_mega_bracket_attempt(jsonb, text) to service_role;
grant execute on function public.get_my_mega_brackets() to service_role;
grant execute on function public.get_my_mega_bracket_attempt(uuid) to service_role;
grant execute on function public.save_mega_bracket_progress(uuid, integer, jsonb) to service_role;
grant execute on function public.abandon_mega_bracket_attempt(uuid, integer) to service_role;

notify pgrst, 'reload schema';

commit;
