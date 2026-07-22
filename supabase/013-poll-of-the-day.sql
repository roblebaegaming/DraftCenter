-- DraftCenter milestone 10: site-wide Pokémon Poll of the Day.
-- Run once AFTER migrations 001-012.

create table if not exists public.daily_polls (
  id uuid primary key default gen_random_uuid(),
  poll_date date not null unique,
  question text not null,
  options jsonb not null,
  answer_type text not null default 'choice' check (answer_type in ('choice', 'pokemon')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_poll_answers (
  poll_id uuid not null references public.daily_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer_key text not null,
  answered_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.daily_polls enable row level security;
alter table public.daily_poll_answers enable row level security;

drop policy if exists "signed-in users read daily polls" on public.daily_polls;
create policy "signed-in users read daily polls" on public.daily_polls for select to authenticated using (true);

create or replace function public.get_daily_poll(p_date date default current_date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_poll public.daily_polls;
begin
  select * into v_poll from public.daily_polls where poll_date = p_date;
  if v_poll.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_poll.id,
    'poll_date', v_poll.poll_date,
    'question', v_poll.question,
    'options', v_poll.options,
    'answer_type', v_poll.answer_type,
    'selected_key', (select answer_key from public.daily_poll_answers where poll_id = v_poll.id and user_id = auth.uid()),
    'counts', coalesce((select jsonb_object_agg(answer_key, total) from (select answer_key, count(*)::integer as total from public.daily_poll_answers where poll_id = v_poll.id group by answer_key) results), '{}'::jsonb),
    'total_votes', (select count(*)::integer from public.daily_poll_answers where poll_id = v_poll.id)
  );
end;
$$;

create or replace function public.submit_daily_poll_answer(p_poll_id uuid, p_answer_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_poll public.daily_polls;
begin
  if auth.uid() is null then raise exception 'You must be signed in to vote.'; end if;
  select * into v_poll from public.daily_polls where id = p_poll_id for update;
  if v_poll.id is null then raise exception 'That poll was not found.'; end if;
  if v_poll.poll_date > current_date then raise exception 'That poll is not open yet.'; end if;
  if v_poll.answer_type = 'choice' and not exists (select 1 from jsonb_array_elements(v_poll.options) option where option ->> 'key' = p_answer_key) then
    raise exception 'Choose one of the listed answers.';
  end if;
  if v_poll.answer_type = 'pokemon' and char_length(trim(p_answer_key)) not between 2 and 40 then
    raise exception 'Enter a Pokémon name.';
  end if;
  insert into public.daily_poll_answers(poll_id, user_id, answer_key) values(v_poll.id, auth.uid(), trim(p_answer_key))
  on conflict (poll_id, user_id) do update set answer_key = excluded.answer_key, answered_at = now();
  return public.get_daily_poll(v_poll.poll_date);
end;
$$;

grant execute on function public.get_daily_poll(date) to authenticated;
grant execute on function public.submit_daily_poll_answer(uuid, text) to authenticated;

insert into public.daily_polls (poll_date, question, options) values
('2026-07-22', 'Which Pokémon would be the best real-life roommate?', '[{"key":"snorlax","label":"Snorlax"},{"key":"rotom","label":"Rotom"},{"key":"chansey","label":"Chansey"},{"key":"meowth","label":"Meowth"}]'),
('2026-07-23', 'Which starter type do you choose most often?', '[{"key":"grass","label":"Grass"},{"key":"fire","label":"Fire"},{"key":"water","label":"Water"}]'),
('2026-07-24', 'Which move animation deserves a modern remake most?', '[{"key":"hyper-beam","label":"Hyper Beam"},{"key":"earthquake","label":"Earthquake"},{"key":"surf","label":"Surf"},{"key":"explosion","label":"Explosion"}]'),
('2026-07-25', 'Which region has the best overall atmosphere?', '[{"key":"kanto","label":"Kanto"},{"key":"johto","label":"Johto"},{"key":"hoenn","label":"Hoenn"},{"key":"sinnoh","label":"Sinnoh"}]'),
('2026-07-26', 'What is the most satisfying way to win a battle?', '[{"key":"sweep","label":"A clean sweep"},{"key":"comeback","label":"A comeback"},{"key":"prediction","label":"A huge prediction"},{"key":"crit","label":"A last-turn critical hit"}]'),
('2026-07-27', 'Which Pokémon type has the coolest designs overall?', '[{"key":"dragon","label":"Dragon"},{"key":"ghost","label":"Ghost"},{"key":"steel","label":"Steel"},{"key":"fairy","label":"Fairy"}]'),
('2026-07-28', 'Which item would you most want in real life?', '[{"key":"master-ball","label":"Master Ball"},{"key":"rare-candy","label":"Rare Candy"},{"key":"exp-share","label":"Exp. Share"},{"key":"lucky-egg","label":"Lucky Egg"}]'),
('2026-07-29', 'Which battle format is most fun to watch?', '[{"key":"singles","label":"Singles"},{"key":"doubles","label":"Doubles"},{"key":"draft","label":"Draft League"},{"key":"random","label":"Random Battles"}]'),
('2026-07-30', 'What makes a Pokémon feel truly iconic?', '[{"key":"design","label":"Great design"},{"key":"anime","label":"Anime moments"},{"key":"competitive","label":"Competitive history"},{"key":"story","label":"Story importance"}]'),
('2026-07-31', 'Which Eeveelution should get the next regional form?', '[{"key":"vaporeon","label":"Vaporeon"},{"key":"jolteon","label":"Jolteon"},{"key":"flareon","label":"Flareon"},{"key":"umbreon","label":"Umbreon"}]'),
('2026-08-01', 'Which Poké Ball has the best design?', '[{"key":"ultra","label":"Ultra Ball"},{"key":"luxury","label":"Luxury Ball"},{"key":"premier","label":"Premier Ball"},{"key":"dusk","label":"Dusk Ball"}]'),
('2026-08-02', 'Which generation introduced the strongest batch of new Pokémon?', '[{"key":"gen3","label":"Generation 3"},{"key":"gen4","label":"Generation 4"},{"key":"gen5","label":"Generation 5"},{"key":"gen9","label":"Generation 9"}]'),
('2026-08-03', 'Which weather is most fun to build around?', '[{"key":"rain","label":"Rain"},{"key":"sun","label":"Sun"},{"key":"sand","label":"Sand"},{"key":"snow","label":"Snow"}]'),
('2026-08-04', 'Which Pokémon deserves a new evolution most?', '[{"key":"dunsparce","label":"Dunsparce"},{"key":"flygon","label":"Flygon"},{"key":"lapras","label":"Lapras"},{"key":"absol","label":"Absol"}]'),
('2026-08-05', 'Which status condition is the most annoying?', '[{"key":"sleep","label":"Sleep"},{"key":"freeze","label":"Freeze"},{"key":"paralysis","label":"Paralysis"},{"key":"confusion","label":"Confusion"}]'),
('2026-08-06', 'Would you rather have a legendary or six favorite underdogs?', '[{"key":"legendary","label":"One legendary"},{"key":"underdogs","label":"Six underdogs"}]'),
('2026-08-07', 'Which champion had the best team?', '[{"key":"cynthia","label":"Cynthia"},{"key":"steven","label":"Steven"},{"key":"leon","label":"Leon"},{"key":"geeta","label":"Geeta"}]'),
('2026-08-08', 'Which ability is the most fun when it goes off?', '[{"key":"intimidate","label":"Intimidate"},{"key":"protea","label":"Protean"},{"key":"prankster","label":"Prankster"},{"key":"regenerator","label":"Regenerator"}]'),
('2026-08-09', 'Which Pokémon game deserves a full remake next?', '[{"key":"bw","label":"Black and White"},{"key":"xy","label":"X and Y"},{"key":"emerald","label":"Emerald"},{"key":"platinum","label":"Platinum"}]'),
('2026-08-10', 'What is your favorite way to discover a new Pokémon?', '[{"key":"story","label":"In the story"},{"key":"competitive","label":"Competitive play"},{"key":"anime","label":"Anime"},{"key":"tcg","label":"Trading Card Game"}]'),
('2026-08-11', 'Which type combination is always exciting?', '[{"key":"ghost-fairy","label":"Ghost/Fairy"},{"key":"water-ground","label":"Water/Ground"},{"key":"steel-fairy","label":"Steel/Fairy"},{"key":"fire-dragon","label":"Fire/Dragon"}]'),
('2026-08-12', 'Which non-damaging move changes a game the most?', '[{"key":"stealth-rock","label":"Stealth Rock"},{"key":"recover","label":"Recover"},{"key":"substitute","label":"Substitute"},{"key":"taunt","label":"Taunt"}]'),
('2026-08-13', 'Which Pokémon would make the best mascot for DraftCenter?', '[{"key":"pikachu","label":"Pikachu"},{"key":"eevee","label":"Eevee"},{"key":"rotom","label":"Rotom"},{"key":"porygon","label":"Porygon"}]'),
('2026-08-14', 'Which era had the best Pokémon music?', '[{"key":"gba","label":"Game Boy Advance"},{"key":"ds","label":"Nintendo DS"},{"key":"3ds","label":"Nintendo 3DS"},{"key":"switch","label":"Nintendo Switch"}]'),
('2026-08-15', 'Which draft pick is most valuable?', '[{"key":"ace","label":"A dominant ace"},{"key":"glue","label":"A reliable glue Pokémon"},{"key":"speed","label":"Speed control"},{"key":"utility","label":"Utility and hazards"}]'),
('2026-08-16', 'Which shiny color swap is the best?', '[{"key":"charizard","label":"Black Charizard"},{"key":"rayquaza","label":"Black Rayquaza"},{"key":"metagross","label":"Silver Metagross"},{"key":"umbreon","label":"Blue Umbreon"}]'),
('2026-08-17', 'What is the best feeling in a Pokémon draft?', '[{"key":"snipe","label":"Sniping a target"},{"key":"steal","label":"Getting a value steal"},{"key":"plan","label":"Completing a strategy"},{"key":"surprise","label":"Finding a surprise pick"}]'),
('2026-08-18', 'Which Pokémon role is hardest to draft well?', '[{"key":"hazards","label":"Hazard setter"},{"key":"removal","label":"Hazard removal"},{"key":"speed","label":"Speed control"},{"key":"wallbreaker","label":"Wallbreaker"}]'),
('2026-08-19', 'Which side character is the most memorable?', '[{"key":"n","label":"N"},{"key":"rival","label":"Blue"},{"key":"wally","label":"Wally"},{"key":"nemona","label":"Nemona"}]'),
('2026-08-20', 'Which gimmick was the most fun?', '[{"key":"mega","label":"Mega Evolution"},{"key":"zmove","label":"Z-Moves"},{"key":"dynamax","label":"Dynamax"},{"key":"tera","label":"Terastallization"}]'),
('2026-08-21', 'Which legendary trio is your favorite?', '[{"key":"birds","label":"Legendary Birds"},{"key":"beasts","label":"Legendary Beasts"},{"key":"weather","label":"Weather Trio"},{"key":"creation","label":"Creation Trio"}]'),
('2026-08-22', 'Would you rather draft first overall or pick at the turn?', '[{"key":"first","label":"First overall"},{"key":"turn","label":"At the turn"}]'),
('2026-08-23', 'Which Pokédex feature should return?', '[{"key":"habitat","label":"Habitat map"},{"key":"cry","label":"Pokémon cries"},{"key":"size","label":"Size comparison"},{"key":"forms","label":"Form gallery"}]'),
('2026-08-24', 'Which Pokémon move name is simply the coolest?', '[{"key":"draco-meteor","label":"Draco Meteor"},{"key":"moonblast","label":"Moonblast"},{"key":"gigaton","label":"Gigaton Hammer"},{"key":"fishious","label":"Fishious Rend"}]'),
('2026-08-25', 'What should a commissioner prioritize most?', '[{"key":"communication","label":"Communication"},{"key":"rules","label":"Clear rules"},{"key":"activity","label":"Manager activity"},{"key":"fun","label":"Keeping it fun"}]'),
('2026-08-26', 'Which starter trio has the best final evolutions?', '[{"key":"kanto","label":"Kanto"},{"key":"hoenn","label":"Hoenn"},{"key":"sinnoh","label":"Sinnoh"},{"key":"paldea","label":"Paldea"}]'),
('2026-08-27', 'Which Pokémon would you trust to carry your groceries?', '[{"key":"machamp","label":"Machamp"},{"key":"dragonite","label":"Dragonite"},{"key":"corviknight","label":"Corviknight"},{"key":"mudsdale","label":"Mudsdale"}]'),
('2026-08-28', 'Which battle mechanic needs the most skill?', '[{"key":"switching","label":"Switching"},{"key":"teambuilding","label":"Team building"},{"key":"prediction","label":"Prediction"},{"key":"endgame","label":"Endgame planning"}]'),
('2026-08-29', 'Which professor is your favorite?', '[{"key":"oak","label":"Professor Oak"},{"key":"rowan","label":"Professor Rowan"},{"key":"kukui","label":"Professor Kukui"},{"key":"sada","label":"Professor Sada"}]'),
('2026-08-30', 'Which Pokémon deserves a regional form next?', '[{"key":"dragonite","label":"Dragonite"},{"key":"milotic","label":"Milotic"},{"key":"lucario","label":"Lucario"},{"key":"zoroark","label":"Zoroark"}]'),
('2026-08-31', 'What should September Poll of the Day feature more often?', '[{"key":"draft","label":"Draft strategy"},{"key":"trivia","label":"Trivia"},{"key":"favorites","label":"Favorites"},{"key":"competitive","label":"Competitive debates"}]')
on conflict (poll_date) do nothing;
