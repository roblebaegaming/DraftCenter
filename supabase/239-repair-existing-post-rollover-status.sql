-- Migration 230 corrected future season rollovers. Repair only historical
-- rows whose saved snapshot unambiguously describes an unlocked later season
-- with an existing archive, while the relational league row still says that
-- a draft is active.

begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    to_regprocedure('public.transition_league_to_new_season(uuid,jsonb)')
  ) into v_definition;

  if v_definition is null or position('status = ''setup''' in v_definition) = 0 then
    raise exception 'The corrected season-rollover function is missing; run migrations 229 and 230 first.';
  end if;
end;
$$;

update public.leagues league
set status = 'setup',
    draft_starts_at = null,
    updated_at = now()
from public.league_state_snapshots snapshot
where snapshot.league_id = league.id
  and league.status = 'drafting'
  and coalesce(snapshot.state ->> 'locked', 'false') = 'false'
  and case
        when coalesce(snapshot.state ->> 'seasonNumber', '') ~ '^[0-9]+$'
          then (snapshot.state ->> 'seasonNumber')::integer
        else 1
      end > 1
  and jsonb_typeof(snapshot.state -> 'seasonHistory') = 'array'
  and jsonb_array_length(snapshot.state -> 'seasonHistory') > 0
  and coalesce(snapshot.state #>> '{liveDraft,status}', '') not in ('active', 'paused')
  and not exists (
    select 1
    from public.draft_sessions session
    where session.league_id = league.id
      and session.status in ('active', 'paused')
  );

commit;

notify pgrst, 'reload schema';
