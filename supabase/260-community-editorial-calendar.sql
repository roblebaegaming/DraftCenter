-- Separate Question of the Day from the Pokemon-only Daily Three calendar.

begin;

create table if not exists public.community_questions_of_the_day (
  question_date date primary key,
  question text not null check (char_length(trim(question)) between 5 and 300),
  topic text not null default 'human' check (topic in ('human', 'pokemon')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_questions_of_the_day enable row level security;
revoke all on table public.community_questions_of_the_day from public, anon, authenticated;
grant select, insert, update, delete on table public.community_questions_of_the_day to service_role;

insert into public.community_questions_of_the_day (question_date, question, topic) values
('2026-08-05', 'What is a small thing that made your day better recently?', 'human'),
('2026-08-06', 'If you could instantly become great at one hobby, which would you choose?', 'human'),
('2026-08-07', 'What food could you happily eat once a week forever?', 'human'),
('2026-08-08', 'Which Pokemon would make the best roommate, and why?', 'pokemon'),
('2026-08-09', 'What is the best compliment someone can receive?', 'human'),
('2026-08-10', 'What is one place you would love to revisit?', 'human'),
('2026-08-11', 'Are you more productive in the morning or at night?', 'human'),
('2026-08-12', 'What fictional world would you visit for one day?', 'human'),
('2026-08-13', 'What is a skill everyone should learn at least once?', 'human'),
('2026-08-14', 'Which Pokemon region would be the best place to take a vacation?', 'pokemon'),
('2026-08-15', 'What is your ideal way to spend a completely free afternoon?', 'human'),
('2026-08-16', 'What song always improves your mood?', 'human'),
('2026-08-17', 'What is something you believed as a kid that makes you laugh now?', 'human'),
('2026-08-18', 'Would you rather plan everything ahead or decide as you go?', 'human'),
('2026-08-19', 'What is the most useful gift you have ever received?', 'human'),
('2026-08-20', 'Which Pokemon would you trust to help you move to a new home?', 'pokemon'),
('2026-08-21', 'What is a tiny luxury that feels worth it to you?', 'human'),
('2026-08-22', 'What is your favorite way to meet new people?', 'human'),
('2026-08-23', 'What is one thing you wish more people asked you about?', 'human'),
('2026-08-24', 'Would you choose an extra hour in the morning or at night?', 'human'),
('2026-08-25', 'What is the best part of your hometown?', 'human'),
('2026-08-26', 'Which Pokemon would be the funniest to see working a normal job?', 'pokemon'),
('2026-08-27', 'What is something you are looking forward to this month?', 'human'),
('2026-08-28', 'What is your favorite low-effort meal?', 'human'),
('2026-08-29', 'What is a tradition you would like to start with friends?', 'human'),
('2026-08-30', 'What helps you reset after a stressful day?', 'human'),
('2026-08-31', 'What is one question that always starts a good conversation?', 'human')
on conflict (question_date) do nothing;

commit;

notify pgrst, 'reload schema';
