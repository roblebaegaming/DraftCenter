-- Repair Daily Three answer validation and bracket variety.

begin;

-- Keep today's scheduled quiz Pokemon-focused. Do not rewrite a live quiz
-- after somebody has answered it.
update public.daily_quizzes
set prompt = 'Which Pokemon is #001 in the National Pokedex?',
    hint = 'The original Grass/Poison starter',
    difficulty = 'easy',
    accepted_answers = '["bulbasaur"]'::jsonb
where quiz_date = date '2026-07-29'
  and not exists (
    select 1
    from public.daily_quiz_answers answer
    where answer.quiz_id = daily_quizzes.id
  );

-- Replace the repeating 32-Pokemon rotation. Each stored future day gets
-- eight catalogue entries in a deterministic random order, excluding every
-- Pokemon used during the preceding 30 days. Completed brackets are preserved
-- so a player's saved result can never be invalidated.
do $$
declare
  v_date date;
  v_pokemon jsonb;
begin
  for v_date in
    select bracket.game_date
    from public.daily_draft_brackets bracket
    where bracket.game_date >= current_date
      and not exists (
        select 1
        from public.daily_bracket_matchups matchup
        where matchup.bracket_id = bracket.id
      )
    order by bracket.game_date
  loop
    select jsonb_agg(candidate.display_name order by candidate.random_rank)
    into v_pokemon
    from (
      select catalogue.display_name,
             md5(v_date::text || ':' || catalogue.id::text) as random_rank
      from public.pokemon_catalogue catalogue
      where catalogue.display_name is not null
        and not exists (
          select 1
          from public.daily_draft_brackets recent
          cross join lateral jsonb_array_elements_text(recent.pokemon) used(name)
          where recent.game_date >= v_date - 30
            and recent.game_date < v_date
            and lower(used.name) = lower(catalogue.display_name)
        )
      order by random_rank
      limit 8
    ) candidate;

    if jsonb_array_length(coalesce(v_pokemon, '[]'::jsonb)) < 8 then
      select jsonb_agg(candidate.display_name order by candidate.random_rank)
      into v_pokemon
      from (
        select catalogue.display_name,
               md5(v_date::text || ':' || catalogue.id::text) as random_rank
        from public.pokemon_catalogue catalogue
        where catalogue.display_name is not null
        order by random_rank
        limit 8
      ) candidate;
    end if;

    if jsonb_array_length(coalesce(v_pokemon, '[]'::jsonb)) = 8 then
      update public.daily_draft_brackets
      set pokemon = v_pokemon
      where game_date = v_date;
    end if;
  end loop;
end;
$$;

commit;
