begin;

alter table public.pokemon_game_pokedex_entries
  drop constraint if exists pokemon_game_pokedex_entries_entry_number_check;

alter table public.pokemon_game_pokedex_entries
  add constraint pokemon_game_pokedex_entries_entry_number_check
  check (entry_number >= 0);

commit;
