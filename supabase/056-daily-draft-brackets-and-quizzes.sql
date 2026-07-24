-- Daily Community games: eight-Pokemon preference brackets and quizzes.

begin;

create table if not exists public.daily_draft_brackets (
  id uuid primary key default gen_random_uuid(),
  game_date date not null unique,
  pokemon jsonb not null check (jsonb_typeof(pokemon) = 'array' and jsonb_array_length(pokemon) = 8),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_bracket_matchups (
  bracket_id uuid not null references public.daily_draft_brackets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 3),
  match_number integer not null,
  winner text not null,
  loser text not null,
  created_at timestamptz not null default now(),
  primary key (bracket_id, user_id, round_number, match_number)
);

create table if not exists public.daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  quiz_date date not null unique,
  prompt text not null,
  hint text,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  accepted_answers jsonb not null check (jsonb_typeof(accepted_answers) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_quiz_answers (
  quiz_id uuid not null references public.daily_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_answer text not null,
  normalized_answer text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

create table if not exists public.daily_game_comments (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('bracket', 'quiz')),
  game_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.daily_game_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_game_comment_upvotes (
  comment_id uuid not null references public.daily_game_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.daily_draft_brackets enable row level security;
alter table public.daily_bracket_matchups enable row level security;
alter table public.daily_quizzes enable row level security;
alter table public.daily_quiz_answers enable row level security;
alter table public.daily_game_comments enable row level security;
alter table public.daily_game_comment_upvotes enable row level security;

with pokemon_pool as (
  select array[
    'Pikachu','Charizard','Gengar','Dragonite','Mewtwo','Umbreon','Scizor','Tyranitar',
    'Gardevoir','Flygon','Metagross','Garchomp','Lucario','Weavile','Rotom-Wash','Togekiss',
    'Chandelure','Volcarona','Greninja','Sylveon','Aegislash','Mimikyu','Corviknight','Dragapult',
    'Tinkaton','Clodsire','Ceruledge','Meowscarada','Incineroar','Whimsicott','Sneasler','Kingambit'
  ]::text[] mons
)
insert into public.daily_draft_brackets (game_date, pokemon)
select day::date,
  to_jsonb(array[
    mons[1 + (offset_value % 32)],
    mons[1 + ((offset_value + 9) % 32)],
    mons[1 + ((offset_value + 18) % 32)],
    mons[1 + ((offset_value + 27) % 32)],
    mons[1 + ((offset_value + 4) % 32)],
    mons[1 + ((offset_value + 13) % 32)],
    mons[1 + ((offset_value + 22) % 32)],
    mons[1 + ((offset_value + 31) % 32)]
  ])
from pokemon_pool
cross join lateral generate_series(date '2026-07-23', date '2027-12-31', interval '1 day') with ordinality dates(day, offset_value)
on conflict (game_date) do nothing;

insert into public.daily_quizzes (quiz_date, prompt, hint, difficulty, accepted_answers) values
('2026-07-23','Name one of the three original Kanto starter Pokémon.','Bulbasaur, Charmander, or Squirtle','easy','["bulbasaur","charmander","squirtle"]'),
('2026-07-24','Which Pokémon is #025 in the National Pokédex?','An Electric-type mascot','medium','["pikachu"]'),
('2026-07-25','Which Pokémon is described as the Genetic Pokémon?','It was created using Mew’s DNA','hard','["mewtwo"]'),
('2026-07-26','Which Pokémon has the Pokédex number 132?','It copies other Pokémon','expert','["ditto"]'),
('2026-07-27','Name an Eeveelution introduced in Generation 1.','There are three valid answers','easy','["vaporeon","jolteon","flareon"]'),
('2026-07-28','What does Magikarp evolve into?','A Water/Flying-type','easy','["gyarados"]'),
('2026-07-29','Which type is super effective against Water?','Two types are accepted','medium','["grass","electric"]'),
('2026-07-30','Which Pokémon is #448 in the National Pokédex?','An Aura Pokémon','medium','["lucario"]'),
('2026-07-31','Which Pokémon evolves when Inkay levels up while the system is held upside down?','A Dark/Psychic-type','hard','["malamar"]'),
('2026-08-01','Which Pokémon is known as the Land Spirit Pokémon?','A legendary from Hoenn','hard','["groudon"]'),
('2026-08-02','Which Pokémon has base forms named Altered Forme and Origin Forme?','It represents antimatter','expert','["giratina"]'),
('2026-08-03','Name one of Johto’s three starter Pokémon.','Grass, Fire, or Water','easy','["chikorita","cyndaquil","totodile"]'),
('2026-08-04','What does Eevee evolve into when exposed to a Thunder Stone?','An Electric-type','easy','["jolteon"]'),
('2026-08-05','Which Pokémon is #658 in the National Pokédex?','A Water/Dark ninja','medium','["greninja"]'),
('2026-08-06','Which Pokémon carries a leek and evolves after landing three critical hits in one battle?','A regional evolution method','medium','["farfetchd","galarian farfetchd","farfetch’d","farfetch''d"]'),
('2026-08-07','Which Pokémon is called the Disguise Pokémon?','It wears a familiar-looking cloth','hard','["mimikyu"]'),
('2026-08-08','Which Pokémon has the signature ability Schooling?','A small Water-type that forms a school','hard','["wishiwashi"]'),
('2026-08-09','Which Pokémon is #474 in the National Pokédex?','An artificial Normal-type evolution','expert','["porygon-z","porygon z","porygonz"]'),
('2026-08-10','Name one of Hoenn’s three starter Pokémon.','Grass, Fire, or Water','easy','["treecko","torchic","mudkip"]'),
('2026-08-11','What does Riolu evolve into?','The Aura Pokémon','easy','["lucario"]'),
('2026-08-12','Which Pokémon is #700 in the National Pokédex?','A Fairy-type Eeveelution','medium','["sylveon"]'),
('2026-08-13','Which Pokémon evolves from Charcadet using Auspicious Armor?','A Fire/Psychic-type','medium','["armarouge"]'),
('2026-08-14','Which Pokémon is called the Sword Blade Pokémon?','A powerful Dark/Steel evolution','hard','["kingambit"]'),
('2026-08-15','Which Pokémon changes form when holding the Griseous Core?','A legendary from Sinnoh','hard','["giratina"]'),
('2026-08-16','Which Pokémon has the National Pokédex number 772?','A synthetic Pokémon before evolution','expert','["type: null","type null","typenull"]'),
('2026-08-17','Name one of Sinnoh’s three starter Pokémon.','Grass, Fire, or Water','easy','["turtwig","chimchar","piplup"]'),
('2026-08-18','What does Rookidee ultimately evolve into?','A Flying/Steel-type','easy','["corviknight"]'),
('2026-08-19','Which Pokémon is #887 in the National Pokédex?','A Dragon/Ghost pseudo-legendary','medium','["dragapult"]'),
('2026-08-20','Which Pokémon evolves from Bisharp after defeating three Bisharp that hold Leader’s Crests?','A Generation 9 evolution','medium','["kingambit"]'),
('2026-08-21','Which Pokémon has the abilities Zero to Hero and changes form after switching out?','A dolphin Pokémon','hard','["palafin"]'),
('2026-08-22','Which Pokémon is known as the Ruinous Pokémon and resembles a snail?','One of Paldea’s Treasures of Ruin','hard','["wo-chien","wo chien","wochien"]'),
('2026-08-23','Which Pokémon is #1000 in the National Pokédex?','A golden evolution','expert','["gholdengo"]'),
('2026-08-24','Name one of Unova’s three starter Pokémon.','Grass, Fire, or Water','easy','["snivy","tepig","oshawott"]'),
('2026-08-25','What does Sneasel evolve into in its original form?','A Dark/Ice-type','easy','["weavile"]'),
('2026-08-26','Which Pokémon is #635 in the National Pokédex?','A Dark/Dragon pseudo-legendary','medium','["hydreigon"]'),
('2026-08-27','Which Pokémon evolves from Gimmighoul after collecting 999 coins?','A Ghost/Steel-type','medium','["gholdengo"]'),
('2026-08-28','Which Pokémon is called the EleSpider Pokémon?','An Electric/Bug Pokémon','hard','["galvantula"]'),
('2026-08-29','Which Pokémon has the signature move Population Bomb?','A family of mice','hard','["maushold"]'),
('2026-08-30','Which Pokémon has the National Pokédex number 486?','A colossal Normal-type legendary','expert','["regigigas"]'),
('2026-08-31','Which Pokémon’s three-segment form is an especially rare evolution result?','It evolves from Dunsparce','expert','["dudunsparce"]')
on conflict (quiz_date) do update set
  prompt = excluded.prompt,
  hint = excluded.hint,
  difficulty = excluded.difficulty,
  accepted_answers = excluded.accepted_answers;

create or replace function public.get_daily_community_games(p_local_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'bracket', (
      select jsonb_build_object(
        'id', b.id,
        'game_date', b.game_date,
        'pokemon', b.pokemon,
        'completed_brackets', (select count(distinct m.user_id)::integer from public.daily_bracket_matchups m where m.bracket_id = b.id and m.round_number = 3),
        'results_revealed', b.game_date < current_date or auth.uid() is not null,
        'champions', case when b.game_date >= current_date and auth.uid() is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('pokemon', winner, 'wins', total) order by total desc, winner)
          from (select min(winner) winner, count(*)::integer total from public.daily_bracket_matchups where bracket_id = b.id and round_number = 3 group by lower(winner)) champions
        ), '[]'::jsonb) end,
        'matchup_results', case when b.game_date >= current_date and auth.uid() is null then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('round', round_number, 'winner', winner, 'loser', loser, 'votes', total) order by round_number, total desc)
          from (select round_number, min(winner) winner, min(loser) loser, count(*)::integer total from public.daily_bracket_matchups where bracket_id = b.id group by round_number, lower(winner), lower(loser)) results
        ), '[]'::jsonb) end,
        'selected_winners', case when auth.uid() is null then '[]'::jsonb else coalesce((
          select jsonb_agg(m.winner order by m.round_number, m.match_number)
          from public.daily_bracket_matchups m
          where m.bracket_id = b.id and m.user_id = auth.uid()
        ), '[]'::jsonb) end
      )
      from public.daily_draft_brackets b where b.game_date = p_local_date
    ),
    'quiz', (
      select jsonb_build_object(
        'id', q.id,
        'quiz_date', q.quiz_date,
        'prompt', q.prompt,
        'hint', q.hint,
        'difficulty', q.difficulty,
        'answered', exists(select 1 from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid()),
        'selected_answer', (select a.display_answer from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid()),
        'selected_correct', (select a.is_correct from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid()),
        'correct_answers', case when q.quiz_date < current_date or exists(select 1 from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid()) then q.accepted_answers else '[]'::jsonb end,
        'total_answers', (select count(*)::integer from public.daily_quiz_answers a where a.quiz_id = q.id),
        'correct_percent', case when q.quiz_date >= current_date and (auth.uid() is null or not exists(select 1 from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid())) then null else coalesce((
          select round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*), 0))::integer
          from public.daily_quiz_answers a where a.quiz_id = q.id
        ), 0) end,
        'top_answers', case when q.quiz_date >= current_date and (auth.uid() is null or not exists(select 1 from public.daily_quiz_answers a where a.quiz_id = q.id and a.user_id = auth.uid())) then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('answer', ranked.display_answer, 'count', ranked.total) order by ranked.total desc, ranked.display_answer)
          from (
            select min(a.display_answer) display_answer, count(*)::integer total
            from public.daily_quiz_answers a where a.quiz_id = q.id
            group by a.normalized_answer order by total desc limit 5
          ) ranked
        ), '[]'::jsonb) end
      )
      from public.daily_quizzes q where q.quiz_date = p_local_date
    )
  );
$$;

create or replace function public.submit_daily_draft_bracket(p_bracket_id uuid, p_winners jsonb, p_local_date date, p_time_zone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bracket public.daily_draft_brackets;
  v_names text[];
  v_winners text[];
  v_left text;
  v_right text;
  v_winner text;
  v_i integer;
  v_round integer;
  v_match integer;
  v_verified_date date;
begin
  if auth.uid() is null then raise exception 'Sign in to complete today''s bracket.'; end if;
  begin v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then raise exception 'Your browser time zone was not recognized.'; end;
  if v_verified_date <> p_local_date then raise exception 'Your local game date changed. Refresh and try again.'; end if;
  select * into v_bracket from public.daily_draft_brackets where id = p_bracket_id for update;
  if v_bracket.id is null or v_bracket.game_date <> p_local_date then raise exception 'That daily bracket is not active.'; end if;
  if jsonb_typeof(p_winners) <> 'array' or jsonb_array_length(p_winners) <> 7 then raise exception 'Complete all seven bracket matchups.'; end if;
  select array_agg(value order by ordinality) into v_names from jsonb_array_elements_text(v_bracket.pokemon) with ordinality;
  select array_agg(value order by ordinality) into v_winners from jsonb_array_elements_text(p_winners) with ordinality;
  delete from public.daily_bracket_matchups where bracket_id = p_bracket_id and user_id = auth.uid();
  for v_i in 1..7 loop
    if v_i <= 4 then
      v_round := 1; v_match := v_i; v_left := v_names[(v_i - 1) * 2 + 1]; v_right := v_names[(v_i - 1) * 2 + 2];
    elsif v_i <= 6 then
      v_round := 2; v_match := v_i - 4; v_left := v_winners[(v_i - 5) * 2 + 1]; v_right := v_winners[(v_i - 5) * 2 + 2];
    else
      v_round := 3; v_match := 1; v_left := v_winners[5]; v_right := v_winners[6];
    end if;
    v_winner := v_winners[v_i];
    if v_winner not in (v_left, v_right) then raise exception 'Bracket choices do not follow the matchup winners.'; end if;
    insert into public.daily_bracket_matchups(bracket_id, user_id, round_number, match_number, winner, loser)
    values (p_bracket_id, auth.uid(), v_round, v_match, v_winner, case when v_winner = v_left then v_right else v_left end);
  end loop;
  return public.get_daily_community_games(p_local_date);
end;
$$;

create or replace function public.submit_daily_quiz_answer(p_quiz_id uuid, p_answer text, p_local_date date, p_time_zone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz public.daily_quizzes;
  v_display text;
  v_normalized text;
  v_correct boolean;
  v_verified_date date;
begin
  if auth.uid() is null then raise exception 'Sign in to answer today''s quiz.'; end if;
  begin v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then raise exception 'Your browser time zone was not recognized.'; end;
  if v_verified_date <> p_local_date then raise exception 'Your local quiz date changed. Refresh and try again.'; end if;
  select * into v_quiz from public.daily_quizzes where id = p_quiz_id for update;
  if v_quiz.id is null or v_quiz.quiz_date <> p_local_date then raise exception 'That daily quiz is not active.'; end if;
  v_display := nullif(trim(p_answer), '');
  if v_display is null or char_length(v_display) > 60 then raise exception 'Enter a Pokémon, type, or answer under 60 characters.'; end if;
  v_normalized := lower(regexp_replace(v_display, '[^a-zA-Z0-9]+', '', 'g'));
  select exists(
    select 1 from jsonb_array_elements_text(v_quiz.accepted_answers) accepted
    where lower(regexp_replace(accepted, '[^a-zA-Z0-9]+', '', 'g')) = v_normalized
  ) into v_correct;
  insert into public.daily_quiz_answers(quiz_id, user_id, display_answer, normalized_answer, is_correct)
  values(v_quiz.id, auth.uid(), v_display, v_normalized, v_correct)
  on conflict (quiz_id, user_id) do nothing;
  return public.get_daily_community_games(p_local_date);
end;
$$;

create or replace function public.get_pokemon_bracket_profile(p_pokemon text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pokemon', p_pokemon,
    'wins', (select count(*)::integer from public.daily_bracket_matchups where lower(winner) = lower(p_pokemon)),
    'losses', (select count(*)::integer from public.daily_bracket_matchups where lower(loser) = lower(p_pokemon)),
    'championships', (select count(*)::integer from public.daily_bracket_matchups where round_number = 3 and lower(winner) = lower(p_pokemon)),
    'most_defeated', coalesce((
      select jsonb_agg(jsonb_build_object('pokemon', opponent, 'wins', total) order by total desc, opponent)
      from (
        select min(loser) opponent, count(*)::integer total
        from public.daily_bracket_matchups
        where lower(winner) = lower(p_pokemon)
        group by lower(loser)
        order by total desc
        limit 5
      ) wins
    ), '[]'::jsonb),
    'toughest_opponents', coalesce((
      select jsonb_agg(jsonb_build_object('pokemon', opponent, 'losses', total) order by total desc, opponent)
      from (
        select min(winner) opponent, count(*)::integer total
        from public.daily_bracket_matchups
        where lower(loser) = lower(p_pokemon)
        group by lower(winner)
        order by total desc
        limit 5
      ) losses
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_daily_game_comments(p_game_type text, p_game_id uuid, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.parent_comment_id nulls first, rows.upvotes desc, rows.created_at asc), '[]'::jsonb)
  from (
    select c.id, c.body, c.created_at, c.parent_comment_id, p.username, p.display_name,
      (select count(*)::integer from public.daily_game_comment_upvotes u where u.comment_id = c.id) upvotes,
      exists(select 1 from public.daily_game_comment_upvotes u where u.comment_id = c.id and u.user_id = auth.uid()) upvoted_by_me
    from public.daily_game_comments c
    left join public.profiles p on p.id = c.user_id
    where c.game_type = p_game_type and c.game_id = p_game_id
    order by c.parent_comment_id nulls first, upvotes desc, c.created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) rows;
$$;

create or replace function public.create_daily_game_comment(p_game_type text, p_game_id uuid, p_body text, p_parent_comment_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to comment.'; end if;
  if p_game_type not in ('bracket', 'quiz') then raise exception 'Unknown Daily Three activity.'; end if;
  if p_game_type = 'bracket' and not exists(select 1 from public.daily_draft_brackets where id = p_game_id) then raise exception 'That bracket was not found.'; end if;
  if p_game_type = 'quiz' and not exists(select 1 from public.daily_quizzes where id = p_game_id) then raise exception 'That quiz was not found.'; end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 1000 then raise exception 'Comments must be between 1 and 1,000 characters.'; end if;
  if p_parent_comment_id is not null and not exists(
    select 1 from public.daily_game_comments where id = p_parent_comment_id and game_type = p_game_type and game_id = p_game_id and parent_comment_id is null
  ) then raise exception 'Replies must belong to a top-level comment on this activity.'; end if;
  insert into public.daily_game_comments(game_type, game_id, user_id, parent_comment_id, body)
  values(p_game_type, p_game_id, auth.uid(), p_parent_comment_id, trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.upvote_daily_game_comment(p_comment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to upvote.'; end if;
  if not exists(select 1 from public.daily_game_comments where id = p_comment_id) then raise exception 'That comment no longer exists.'; end if;
  insert into public.daily_game_comment_upvotes(comment_id, user_id)
  values(p_comment_id, auth.uid()) on conflict do nothing;
  select count(*)::integer into v_count from public.daily_game_comment_upvotes where comment_id = p_comment_id;
  return v_count;
end;
$$;

-- Poll comments now use the same one-way upvote rule. A second tap is a
-- harmless no-op; it never removes the existing vote or lowers the count.
create or replace function public.toggle_daily_poll_comment_upvote(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to upvote.'; end if;
  if not exists(select 1 from public.daily_poll_comments where id = p_comment_id) then raise exception 'That comment no longer exists.'; end if;
  insert into public.daily_poll_comment_upvotes(comment_id, user_id)
  values(p_comment_id, auth.uid()) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.get_daily_community_games(date) from public, anon, authenticated;
revoke all on function public.submit_daily_draft_bracket(uuid, jsonb, date, text) from public, anon, authenticated;
revoke all on function public.submit_daily_quiz_answer(uuid, text, date, text) from public, anon, authenticated;
revoke all on function public.get_pokemon_bracket_profile(text) from public, anon, authenticated;
revoke all on function public.get_daily_game_comments(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.create_daily_game_comment(text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.upvote_daily_game_comment(uuid) from public, anon, authenticated;
revoke all on function public.toggle_daily_poll_comment_upvote(uuid) from public, anon;
grant execute on function public.get_daily_community_games(date) to anon, authenticated;
grant execute on function public.submit_daily_draft_bracket(uuid, jsonb, date, text) to authenticated;
grant execute on function public.submit_daily_quiz_answer(uuid, text, date, text) to authenticated;
grant execute on function public.get_pokemon_bracket_profile(text) to anon, authenticated;
grant execute on function public.get_daily_game_comments(text, uuid, integer) to authenticated;
grant execute on function public.create_daily_game_comment(text, uuid, text, uuid) to authenticated;
grant execute on function public.upvote_daily_game_comment(uuid) to authenticated;
grant execute on function public.toggle_daily_poll_comment_upvote(uuid) to authenticated;

commit;
