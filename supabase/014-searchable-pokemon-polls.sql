-- DraftCenter milestone 11: searchable, validated Pokémon answers in daily polls.
-- Run once AFTER migration 013.

create or replace function public.submit_daily_poll_answer(p_poll_id uuid, p_answer_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_poll public.daily_polls; v_is_valid boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in to vote.'; end if;
  select * into v_poll from public.daily_polls where id = p_poll_id for update;
  if v_poll.id is null then raise exception 'That poll was not found.'; end if;
  if v_poll.poll_date > current_date then raise exception 'That poll is not open yet.'; end if;
  p_answer_key := trim(p_answer_key);
  if v_poll.answer_type = 'choice' and not exists (select 1 from jsonb_array_elements(v_poll.options) option where option ->> 'key' = p_answer_key) then
    raise exception 'Choose one of the listed answers.';
  end if;
  if v_poll.answer_type = 'pokemon' then
    if char_length(p_answer_key) not between 2 and 60 then raise exception 'Choose a Pokémon from the search list.'; end if;
    if to_regclass('public.pokemon_species') is not null then
      execute 'select exists (select 1 from public.pokemon_species where lower(name) = lower($1))' into v_is_valid using p_answer_key;
      if not v_is_valid then raise exception 'Choose a Pokémon from the search list.'; end if;
    end if;
  end if;
  insert into public.daily_poll_answers(poll_id, user_id, answer_key) values(v_poll.id, auth.uid(), p_answer_key)
  on conflict (poll_id, user_id) do update set answer_key = excluded.answer_key, answered_at = now();
  return public.get_daily_poll(v_poll.poll_date);
end;
$$;

-- Make today and one future day demonstrate the searchable selector.
update public.daily_polls
set question = 'Which Pokémon would be the best real-life roommate?', options = '[]'::jsonb, answer_type = 'pokemon'
where poll_date = '2026-07-22';

update public.daily_polls
set question = 'Which Pokémon deserves a regional form next?', options = '[]'::jsonb, answer_type = 'pokemon'
where poll_date = '2026-08-30';

grant execute on function public.submit_daily_poll_answer(uuid, text) to authenticated;
