-- Store the catalogue display name for Trainer Dex discoveries made through
-- relational drafts. Older live-draft pools use numeric source keys, which are
-- stable identifiers but are not suitable player-facing Pokemon names.

begin;

create or replace function public.trainer_dex_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pokemon text;
begin
  if tg_op = 'DELETE' then
    select user_id
    into v_user
    from public.trainer_dex_events
    where source_type = 'draft'
      and source_id = old.id::text;

    delete from public.trainer_dex_events
    where source_type = 'draft'
      and source_id = old.id::text;

    if v_user is not null then
      perform public.refresh_trainer_dex_badges(v_user);
    end if;
    return old;
  end if;

  select membership.user_id,
    coalesce(
      nullif(catalogue.display_name, ''),
      nullif(to_jsonb(pokemon) ->> 'name', ''),
      nullif(to_jsonb(pokemon) ->> 'source_key', ''),
      nullif(to_jsonb(pokemon) ->> 'pokemon_id', '')
    )
  into v_user, v_pokemon
  from public.teams team
  join public.league_memberships membership
    on membership.id = team.owner_membership_id
  join public.league_pokemon pokemon
    on pokemon.id = new.league_pokemon_id
  left join public.pokemon_catalogue catalogue
    on catalogue.id = coalesce(
      nullif(to_jsonb(pokemon) ->> 'pokemon_id', ''),
      nullif(to_jsonb(pokemon) ->> 'source_key', '')
    )
  where team.id = new.team_id;

  if v_user is not null then
    perform public.record_trainer_dex_event(
      v_user,
      v_pokemon,
      'draft',
      new.id::text,
      new.created_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trainer_dex_draft_pick on public.draft_picks;
create trigger trainer_dex_draft_pick
after insert or delete on public.draft_picks
for each row execute function public.trainer_dex_draft_trigger();

-- Repair draft discoveries that migration 341 imported with a numeric pool
-- key. Shiny state and source identity remain unchanged.
with corrected as (
  select
    event.id as event_id,
    coalesce(
      nullif(catalogue.display_name, ''),
      nullif(to_jsonb(pokemon) ->> 'name', ''),
      nullif(to_jsonb(pokemon) ->> 'source_key', ''),
      nullif(to_jsonb(pokemon) ->> 'pokemon_id', '')
    ) as pokemon_name
  from public.trainer_dex_events event
  join public.draft_picks pick
    on pick.id::text = event.source_id
  join public.league_pokemon pokemon
    on pokemon.id = pick.league_pokemon_id
  left join public.pokemon_catalogue catalogue
    on catalogue.id = coalesce(
      nullif(to_jsonb(pokemon) ->> 'pokemon_id', ''),
      nullif(to_jsonb(pokemon) ->> 'source_key', '')
    )
  where event.source_type = 'draft'
)
update public.trainer_dex_events event
set pokemon_name = corrected.pokemon_name,
    pokemon_key = lower(regexp_replace(trim(corrected.pokemon_name), '[^a-zA-Z0-9]+', '', 'g'))
from corrected
where event.id = corrected.event_id
  and nullif(trim(corrected.pokemon_name), '') is not null
  and (
    event.pokemon_name is distinct from corrected.pokemon_name
    or event.pokemon_key is distinct from lower(regexp_replace(trim(corrected.pokemon_name), '[^a-zA-Z0-9]+', '', 'g'))
  );

do $$
declare
  v_user uuid;
begin
  for v_user in
    select distinct user_id
    from public.trainer_dex_events
    where source_type = 'draft'
  loop
    perform public.refresh_trainer_dex_badges(v_user);
  end loop;
end;
$$;

revoke all on function public.trainer_dex_draft_trigger()
from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
