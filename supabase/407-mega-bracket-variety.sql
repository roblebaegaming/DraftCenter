-- Replayable Mega Brackets by Full Dex, type, generation, or Mega Evolution,
-- with favorite and worst-pick objectives plus an optional randomized Top 64.

begin;

alter table public.mega_bracket_attempts
  add column bracket_scope text not null default 'full_dex',
  add column bracket_filter text,
  add column selection_mode text not null default 'favorite',
  add column source_pool_size integer not null default 1162,
  add column entry_limit integer;

alter table public.mega_bracket_attempts
  drop constraint mega_bracket_attempts_catalog_snapshot_check,
  drop constraint mega_bracket_attempts_winners_check,
  drop constraint mega_bracket_attempts_top_64_check,
  drop constraint mega_bracket_completion_check;

alter table public.mega_bracket_attempts
  add constraint mega_bracket_scope_check check (bracket_scope in ('full_dex', 'type', 'generation', 'mega')),
  add constraint mega_bracket_filter_check check (
    (bracket_scope in ('full_dex', 'mega') and bracket_filter is null)
    or (bracket_scope = 'generation' and bracket_filter in ('1','2','3','4','5','6','7','8','9'))
    or (bracket_scope = 'type' and bracket_filter in (
      'bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost',
      'grass','ground','ice','normal','poison','psychic','rock','steel','water'
    ))
  ),
  add constraint mega_bracket_selection_mode_check check (selection_mode in ('favorite', 'worst')),
  add constraint mega_bracket_entry_limit_check check (entry_limit is null or entry_limit = 64),
  add constraint mega_bracket_catalog_snapshot_check check (
    jsonb_typeof(catalog_snapshot) = 'array'
    and jsonb_array_length(catalog_snapshot) between 2 and 1162
  ),
  add constraint mega_bracket_source_pool_size_check check (
    source_pool_size between jsonb_array_length(catalog_snapshot) and 1162
  ),
  add constraint mega_bracket_winners_check check (
    jsonb_typeof(winners) = 'array'
    and jsonb_array_length(winners) <= jsonb_array_length(catalog_snapshot) - 1
  ),
  add constraint mega_bracket_top_64_check check (
    jsonb_typeof(top_64) = 'array'
    and (
      jsonb_array_length(top_64) = 0
      or jsonb_array_length(top_64) = least(64, jsonb_array_length(catalog_snapshot))
    )
  ),
  add constraint mega_bracket_completion_check check (
    (
      status = 'completed'
      and champion is not null
      and completed_at is not null
      and jsonb_array_length(winners) = jsonb_array_length(catalog_snapshot) - 1
      and jsonb_array_length(top_64) = least(64, jsonb_array_length(catalog_snapshot))
    )
    or (status <> 'completed' and champion is null and completed_at is null)
  );

comment on column public.mega_bracket_attempts.bracket_scope is
  'Private bracket field: full_dex, type, generation, or mega.';
comment on column public.mega_bracket_attempts.bracket_filter is
  'Private type or generation value when the selected scope requires one.';
comment on column public.mega_bracket_attempts.selection_mode is
  'Whether the owner advances a favorite or the worse choice in each matchup.';
comment on column public.mega_bracket_attempts.source_pool_size is
  'Eligible entries before an optional deterministic 64-entry draw.';

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
  v_entrant_count integer;
  v_total_choices integer;
  v_total integer;
  v_cursor integer := 0;
  v_opening_size integer := 1;
  v_play_in_matches integer;
  v_match_count integer;
  v_index integer;
  v_left text;
  v_right text;
  v_winner text;
  v_round_label text;
  v_phase text;
begin
  if jsonb_typeof(p_entrants) <> 'array'
     or jsonb_array_length(p_entrants) < 2
     or jsonb_array_length(p_entrants) > 1162 then
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

  v_entrant_count := cardinality(v_current);
  v_total_choices := v_entrant_count - 1;
  v_total := cardinality(v_choices);
  if v_total > v_total_choices then
    raise exception 'Mega Bracket choices exceed this bracket.' using errcode = '22023';
  end if;
  if v_entrant_count <= 64 then
    v_top_64 := v_current;
  end if;
  while v_opening_size * 2 <= v_entrant_count loop
    v_opening_size := v_opening_size * 2;
  end loop;
  v_play_in_matches := v_entrant_count - v_opening_size;
  v_next := coalesce(v_current[(v_play_in_matches * 2 + 1):v_entrant_count], array[]::text[]);

  if v_play_in_matches > 0 then
    for v_index in 1..v_play_in_matches loop
      v_left := v_current[v_index * 2 - 1];
      v_right := v_current[v_index * 2];
      if v_cursor >= v_total then
        return jsonb_build_object(
          'entrant_count', v_entrant_count,
          'choices_completed', v_cursor,
          'total_choices', v_total_choices,
          'choices_remaining', v_total_choices - v_cursor,
          'survivors', v_entrant_count - v_cursor,
          'phase', case when v_entrant_count < 64 then 'compact' else 'road_to_64' end,
          'round_label', 'Play-in round',
          'round_size', v_entrant_count,
          'match_number', v_index,
          'match_count', v_play_in_matches,
          'next_match', jsonb_build_object('left', v_left, 'right', v_right),
          'top_64', to_jsonb(v_top_64),
          'has_visual_top_64', v_entrant_count = 64,
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
  end if;
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
    v_phase := case
      when cardinality(v_top_64) = 64 then 'top_64'
      when v_entrant_count < 64 then 'compact'
      else 'road_to_64'
    end;
    for v_index in 1..v_match_count loop
      v_left := v_current[v_index * 2 - 1];
      v_right := v_current[v_index * 2];
      if v_cursor >= v_total then
        return jsonb_build_object(
          'entrant_count', v_entrant_count,
          'choices_completed', v_cursor,
          'total_choices', v_total_choices,
          'choices_remaining', v_total_choices - v_cursor,
          'survivors', v_entrant_count - v_cursor,
          'phase', v_phase,
          'round_label', v_round_label,
          'round_size', cardinality(v_current),
          'match_number', v_index,
          'match_count', v_match_count,
          'next_match', jsonb_build_object('left', v_left, 'right', v_right),
          'top_64', to_jsonb(v_top_64),
          'has_visual_top_64', cardinality(v_top_64) = 64,
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
    'entrant_count', v_entrant_count,
    'choices_completed', v_cursor,
    'total_choices', v_total_choices,
    'choices_remaining', 0,
    'survivors', 1,
    'phase', case when cardinality(v_top_64) = 64 then 'top_64' else 'compact' end,
    'round_label', 'Complete',
    'round_size', 1,
    'match_number', null,
    'match_count', null,
    'next_match', null,
    'top_64', to_jsonb(v_top_64),
    'has_visual_top_64', cardinality(v_top_64) = 64,
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
    'bracket_scope', attempt.bracket_scope,
    'bracket_filter', attempt.bracket_filter,
    'selection_mode', attempt.selection_mode,
    'source_pool_size', attempt.source_pool_size,
    'entry_limit', attempt.entry_limit,
    'entrant_count', jsonb_array_length(attempt.catalog_snapshot),
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

drop function public.create_mega_bracket_attempt(jsonb, text);

create function public.create_mega_bracket_attempt(
  p_catalog jsonb,
  p_catalog_version text default 'draftcenter-full-dex-2026-08-13',
  p_pool jsonb default null,
  p_bracket_scope text default 'full_dex',
  p_bracket_filter text default null,
  p_selection_mode text default 'favorite',
  p_entry_limit integer default null
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
  v_pool jsonb := coalesce(p_pool, p_catalog);
  v_pool_total integer;
  v_pool_unique integer;
  v_pool_text text;
  v_pool_hash text;
  v_expected_pool text;
  v_seed text;
  v_snapshot jsonb;
  v_snapshot_text text;
  v_snapshot_hash text;
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
  v_catalog_hash := encode(digest(v_catalog_text, 'sha256'), 'hex');
  if v_total <> 1162 or v_unique <> 1162
     or p_catalog_version <> 'draftcenter-full-dex-2026-08-13'
     or v_catalog_hash <> 'acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36' then
    raise exception 'The Mega Bracket catalogue changed. Refresh before starting.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_pool) <> 'array' then
    raise exception 'The selected Mega Bracket field is malformed.' using errcode = '22023';
  end if;
  select count(*), count(distinct entry.value), string_agg(entry.value, E'\n' order by entry.ordinality)
    into v_pool_total, v_pool_unique, v_pool_text
  from jsonb_array_elements_text(v_pool) with ordinality entry(value, ordinality);
  if v_pool_total < 2 or v_pool_total > 1162 or v_pool_unique <> v_pool_total then
    raise exception 'The selected Mega Bracket field contains a missing or duplicate Pokémon.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_pool) pool(value)
    where not exists (
      select 1 from jsonb_array_elements_text(p_catalog) catalog(value)
      where catalog.value = pool.value
    )
  ) then
    raise exception 'The selected Mega Bracket field contains an unsupported Pokémon.' using errcode = '22023';
  end if;
  v_pool_hash := encode(digest(v_pool_text, 'sha256'), 'hex');
  if p_bracket_scope is null or p_bracket_scope not in ('full_dex', 'type', 'generation', 'mega')
     or p_selection_mode is null or p_selection_mode not in ('favorite', 'worst')
     or (p_entry_limit is not null and p_entry_limit <> 64)
     or (p_entry_limit = 64 and v_pool_total < 64)
     or (p_bracket_scope = 'full_dex' and (p_bracket_filter is not null or v_pool_total <> 1162))
     or (p_bracket_scope = 'mega' and p_bracket_filter is not null)
     or (p_bracket_scope = 'generation' and (p_bracket_filter is null or p_bracket_filter not in ('1','2','3','4','5','6','7','8','9')))
     or (p_bracket_scope = 'type' and (p_bracket_filter is null or p_bracket_filter not in (
       'bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost',
       'grass','ground','ice','normal','poison','psychic','rock','steel','water'
     ))) then
    raise exception 'The selected Mega Bracket options are invalid.' using errcode = '22023';
  end if;
  v_expected_pool := case p_bracket_scope || ':' || coalesce(p_bracket_filter, '')
    when 'full_dex:' then '1162:acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36'
    when 'mega:' then '75:6172607eadd34ee252fc4f69e443853797da07a2ab616b49de92ad0e7529bee3'
    when 'type:bug' then '97:5244917fd08ec63976cc3fc62462e456dcba4e47beb49db656acc2faefdd5d8e'
    when 'type:dark' then '87:1a827bac80016656fd509a5e9788e6ed0e4d30cc1e2d8ac20d72f056e870e8f3'
    when 'type:dragon' then '83:7b07ed48139b27e76cb3594341b65b008151e7547e63aa0efbfa77897e12dac9'
    when 'type:electric' then '86:ff0a2676a4964c81f669baf73541630b9aee13715e42e6debab0983a3252c4d5'
    when 'type:fairy' then '74:cc5e59e06a0d6a7cef9be363e6601e9c3cb9c059cf0d8322ec95e969442ce18c'
    when 'type:fighting' then '95:1ccb960c1ece817d03c2645b91654187259ecdd790815a7cb97a316e276881b9'
    when 'type:fire' then '98:24cb99a19382638d0de71c6fd533ff9bd85aa1b46f62352c82f77ac3280ddac6'
    when 'type:flying' then '123:6b0304a044b4d9ac17a48587aad2be02e62dc546a535511f4779d53e2f73c020'
    when 'type:ghost' then '78:5f81f45389c21517bd4557c9d7aa510ff71618a9a643c5a7ad4b3c2a561ad418'
    when 'type:grass' then '140:bd7b4efc9fe039a7c47df4dbd626ed9f8398c53a1e37037802f536b1e8eac82e'
    when 'type:ground' then '84:b1b115c4df6a5bffbb7351264755737ced4baafc737f133640371667b12ffa19'
    when 'type:ice' then '59:02c13ec511af11835c3cce265dcdcfc70a9a138e023fa7ae6a76991e38894568'
    when 'type:normal' then '140:a37565064931202bd59a70d9df0c4b51f810ebff8e6a966d208a42759ea23f73'
    when 'type:poison' then '98:017b9d00370af2b3554d1b7faa481908077d316f1dd1f1bca4be4c3eb3c14443'
    when 'type:psychic' then '121:5b3f16773e1842f3330030909feaa66461b41fbcaabc2b7df63e4f9f5ce82859'
    when 'type:rock' then '86:2cb63ef5456b07291dd1734d33963eba17ce32b7fd0664fbe4812b207f8ece38'
    when 'type:steel' then '82:b06474399e1e3d2ef036c29ab1b9c4f15f2d34e10440f9e17c86ea146f079955'
    when 'type:water' then '168:3213e179ec4334569167d75e94ba5827cb0a73e7620242c5acf3e9e56474c7c4'
    when 'generation:1' then '151:5fd81f5d9a7610041bd1041b1165315f85c12aff9672fb56ea487030b1c432e3'
    when 'generation:2' then '100:2e8a1fd76646d24c0ad3293d2cb7e49fb6e50d8d7638e1cf1d7fbe654db6460f'
    when 'generation:3' then '135:16256f13d204c659822e3e086a5ccf26ac10374e6e6a37accba9e1638426313b'
    when 'generation:4' then '112:6b5644e35637e2b68895671e3de226127ac2bffd6a06693310de4a2d15f1affc'
    when 'generation:5' then '157:695f44f25fb9b4a37033b2f61d528f808510b6012956a4efaa05a66d47e8c9ba'
    when 'generation:6' then '114:c1e4043871a04e3b12f583ba1fcbec7582b95daf52007fa8c884b8a5214d5e07'
    when 'generation:7' then '108:9be8df2112c6448fff69c56083ef6fb4e4125161c0dbd3ad2784cee95b411401'
    when 'generation:8' then '127:98af72cc251b1143a0679bd1c506f3ad78f91694d9e6ff5f3b4095b2a37664f6'
    when 'generation:9' then '158:1d134d920ee54ab0d16fed48adbc09518cacc1c054a324f43d8b67378444c542'
    else null
  end;
  if v_expected_pool is null or v_expected_pool <> (v_pool_total::text || ':' || v_pool_hash) then
    raise exception 'The selected Mega Bracket field changed. Refresh before starting.' using errcode = '22023';
  end if;

  v_seed := encode(gen_random_bytes(16), 'hex');
  if p_entry_limit = 64 then
    select jsonb_agg(entry.value order by entry.ordinality)
      into v_snapshot
    from jsonb_array_elements_text(public.mega_bracket_seeded_entrants(v_pool, v_seed))
      with ordinality entry(value, ordinality)
    where entry.ordinality <= 64;
  else
    v_snapshot := v_pool;
  end if;
  select string_agg(entry.value, E'\n' order by entry.ordinality)
    into v_snapshot_text
  from jsonb_array_elements_text(v_snapshot) with ordinality entry(value, ordinality);
  v_snapshot_hash := encode(digest(v_snapshot_text, 'sha256'), 'hex');

  insert into public.mega_bracket_attempts(
    user_id, catalog_version, catalog_hash, catalog_snapshot, seed,
    bracket_scope, bracket_filter, selection_mode, source_pool_size, entry_limit
  ) values (
    v_user_id, p_catalog_version, v_snapshot_hash, v_snapshot, v_seed,
    p_bracket_scope, p_bracket_filter, p_selection_mode, v_pool_total, p_entry_limit
  )
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
        'bracket_scope', history.bracket_scope,
        'bracket_filter', history.bracket_filter,
        'selection_mode', history.selection_mode,
        'source_pool_size', history.source_pool_size,
        'entry_limit', history.entry_limit,
        'entrant_count', jsonb_array_length(history.catalog_snapshot),
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

revoke all on function public.mega_bracket_progress(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mega_bracket_attempt_payload(uuid) from public, anon, authenticated;
revoke all on function public.create_mega_bracket_attempt(jsonb, text, jsonb, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.get_my_mega_brackets() from public, anon, authenticated;
revoke all on function public.save_mega_bracket_progress(uuid, integer, jsonb) from public, anon, authenticated;

grant execute on function public.create_mega_bracket_attempt(jsonb, text, jsonb, text, text, text, integer) to authenticated, service_role;
grant execute on function public.get_my_mega_brackets() to authenticated, service_role;
grant execute on function public.get_my_mega_bracket_attempt(uuid) to authenticated, service_role;
grant execute on function public.save_mega_bracket_progress(uuid, integer, jsonb) to authenticated, service_role;
grant execute on function public.abandon_mega_bracket_attempt(uuid, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
