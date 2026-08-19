-- Preview-only regression for participation-history foreign-key coverage.
-- Run only after the participant retirement migrations on an isolated branch.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_index
    where indexrelid = 'public.league_participation_events_actor_id_idx'::regclass
      and indisvalid
      and indisready
  ) then
    raise exception 'league participation actor foreign key is not indexed';
  end if;

  if not exists (
    select 1
    from pg_index
    where indexrelid = 'public.tournament_participation_events_actor_id_idx'::regclass
      and indisvalid
      and indisready
  ) then
    raise exception 'tournament participation actor foreign key is not indexed';
  end if;

  if not exists (
    select 1
    from pg_index
    where indexrelid = 'public.tournament_participation_events_entrant_id_tournament_id_idx'::regclass
      and indisvalid
      and indisready
  ) then
    raise exception 'tournament participation entrant foreign key is not indexed';
  end if;
end;
$$;

rollback;

select 'participant_retirement_foreign_key_indexes' as result;
