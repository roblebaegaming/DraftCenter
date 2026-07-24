-- Repair text that was stored with UTF-8 bytes interpreted as Windows-1252.
-- Safe to run more than once: after the first run, the broken sequences no longer exist.

update public.daily_quizzes
set
  prompt = replace(
    replace(
      replace(
        replace(prompt, 'PokÃ©mon', 'Pokémon'),
        'â€™', '’'
      ),
      'â€“', '–'
    ),
    'â€”', '—'
  ),
  hint = replace(
    replace(
      replace(
        replace(hint, 'PokÃ©mon', 'Pokémon'),
        'â€™', '’'
      ),
      'â€“', '–'
    ),
    'â€”', '—'
  )
where
  prompt like '%Ã%'
  or prompt like '%â%'
  or hint like '%Ã%'
  or hint like '%â%';
