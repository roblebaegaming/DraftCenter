-- DraftCenter milestone 22: a small, public favorite-Pokemon team on profiles.

alter table public.profiles
  add column if not exists favorite_pokemon text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_favorite_pokemon_limit'
  ) then
    alter table public.profiles
      add constraint profiles_favorite_pokemon_limit
      check (coalesce(cardinality(favorite_pokemon), 0) <= 6);
  end if;
end $$;
