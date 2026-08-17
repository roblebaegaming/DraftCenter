begin;

alter table public.pokemon_games
  drop constraint if exists pokemon_games_game_key_check;

alter table public.pokemon_games
  add constraint pokemon_games_game_key_check
  check (game_key ~ '^[a-z0-9-]{1,64}$');

commit;
