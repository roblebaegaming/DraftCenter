-- Make every unvoted poll from July 24 through August 31 a searchable
-- Pokemon-answer poll. Preserve the displaced general questions by moving
-- copies to September and early October in their original order.

begin;

with displaced as (
  select
    p.question,
    p.options,
    p.answer_type,
    row_number() over (order by p.poll_date) - 1 as offset_days
  from public.daily_polls p
  where p.poll_date between date '2026-07-24' and date '2026-08-31'
    and p.answer_type <> 'pokemon'
    and not exists (
      select 1
      from public.daily_poll_answers a
      where a.poll_id = p.id
    )
)
insert into public.daily_polls (
  poll_date,
  question,
  options,
  answer_type
)
select
  date '2026-09-01' + offset_days::integer,
  question,
  options,
  answer_type
from displaced
on conflict (poll_date) do nothing;

with pokemon_polls(poll_date, question) as (
  values
    (date '2026-07-24', 'Which Pokémon deserves the biggest animation upgrade?'),
    (date '2026-07-25', 'Which Pokémon best represents the Kanto region?'),
    (date '2026-07-26', 'Which Pokémon would be the most reliable comeback specialist?'),
    (date '2026-07-27', 'Which Pokémon has the coolest overall design?'),
    (date '2026-07-28', 'Which Pokémon would be the most helpful companion in real life?'),
    (date '2026-07-29', 'Which Pokémon is the most exciting to watch in competitive play?'),
    (date '2026-07-30', 'Which Pokémon feels the most iconic?'),
    (date '2026-07-31', 'Which Pokémon deserves a new regional form?'),
    (date '2026-08-01', 'Which Pokémon has the best color palette?'),
    (date '2026-08-02', 'Which Pokémon is the strongest representative of its generation?'),
    (date '2026-08-03', 'Which Pokémon is the most fun weather-team centerpiece?'),
    (date '2026-08-04', 'Which Pokémon deserves a new evolution most?'),
    (date '2026-08-05', 'Which Pokémon is the most frustrating status-condition user?'),
    (date '2026-08-06', 'Which underrated Pokémon would you build a team around?'),
    (date '2026-08-07', 'Which champion’s signature Pokémon is the most memorable?'),
    (date '2026-08-08', 'Which Pokémon has the most entertaining ability?'),
    (date '2026-08-09', 'Which Pokémon should star in the next game remake?'),
    (date '2026-08-10', 'Which Pokémon were you happiest to discover for the first time?'),
    (date '2026-08-11', 'Which Pokémon has the most exciting type combination?'),
    (date '2026-08-12', 'Which Pokémon is the best user of non-damaging moves?'),
    (date '2026-08-13', 'Which Pokémon would make the best DraftCenter mascot?'),
    (date '2026-08-14', 'Which Pokémon has the best battle theme or musical association?'),
    (date '2026-08-15', 'Which Pokémon is the ideal first-round draft pick?'),
    (date '2026-08-16', 'Which Pokémon has the best shiny form?'),
    (date '2026-08-17', 'Which Pokémon is the greatest value steal in a draft?'),
    (date '2026-08-18', 'Which Pokémon fills the hardest draft role best?'),
    (date '2026-08-19', 'Which Pokémon has the most memorable story role?'),
    (date '2026-08-20', 'Which Pokémon benefits most from its special battle gimmick?'),
    (date '2026-08-21', 'Which legendary Pokémon is your favorite?'),
    (date '2026-08-22', 'Which Pokémon would you take with the first overall pick?'),
    (date '2026-08-23', 'Which Pokémon has the most interesting collection of forms?'),
    (date '2026-08-24', 'Which Pokémon has the coolest signature move?'),
    (date '2026-08-25', 'Which Pokémon best represents a well-run draft league?'),
    (date '2026-08-26', 'Which fully evolved starter Pokémon is your favorite?'),
    (date '2026-08-27', 'Which Pokémon would you trust most to help with everyday errands?'),
    (date '2026-08-28', 'Which Pokémon rewards skilled play the most?'),
    (date '2026-08-29', 'Which professor’s partner Pokémon is your favorite?'),
    (date '2026-08-30', 'Which Pokémon deserves a regional form next?'),
    (date '2026-08-31', 'Which Pokémon should be featured in more community polls?')
)
update public.daily_polls p
set
  question = pokemon_polls.question,
  options = '[]'::jsonb,
  answer_type = 'pokemon'
from pokemon_polls
where p.poll_date = pokemon_polls.poll_date
  and not exists (
    select 1
    from public.daily_poll_answers a
    where a.poll_id = p.id
  );

commit;
