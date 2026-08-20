begin;

-- Brand-new leagues intentionally begin with an empty snapshot. SQL null
-- comparison made the original type guard fall through when OLD had no teams
-- key, so its numeric loop received a null upper bound and blocked first-time
-- setup initialization. Treat a missing teams array as a non-participation
-- transition while preserving every retirement freeze and playoff guard once
-- both snapshots contain teams.
-- Rollback-only coverage: tests/451-empty-league-setup-participation-guard-preview-regression.sql.
create or replace function public.guard_league_participation_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_index integer;
  v_old_team jsonb;
  v_new_team jsonb;
  v_effective_after integer;
  v_week record;
  v_match record;
  v_key text;
begin
  if current_setting('draftcenter.participant_status_write', true) = 'on'
     or coalesce((old.state ->> 'seasonNumber')::integer, 1)
        is distinct from coalesce((new.state ->> 'seasonNumber')::integer, 1) then
    return new;
  end if;

  if jsonb_typeof(old.state -> 'teams') is distinct from 'array'
     or jsonb_typeof(new.state -> 'teams') is distinct from 'array' then
    return new;
  end if;

  for v_index in 0..jsonb_array_length(old.state -> 'teams') - 1 loop
    v_old_team := old.state #> array['teams', v_index::text];
    v_new_team := new.state #> array['teams', v_index::text];
    if v_old_team -> 'seasonStatus' is distinct from v_new_team -> 'seasonStatus' then
      raise exception 'Season participation can only be changed from Commissioner Tools.';
    end if;
    if v_old_team #>> '{seasonStatus,status}' = 'retired' then
      if v_old_team is distinct from v_new_team
         or old.state #> array['rosters', v_index::text]
            is distinct from new.state #> array['rosters', v_index::text] then
        raise exception 'A retired team is frozen for the rest of this season.';
      end if;
      v_effective_after := coalesce((v_old_team #>> '{seasonStatus,effectiveAfter}')::integer, 0);
      for v_week in
        select week.value, (week.ordinality - 1)::integer as week_index
        from jsonb_array_elements(coalesce(old.state -> 'schedule', '[]'::jsonb)) with ordinality week(value, ordinality)
        where week.ordinality - 1 >= v_effective_after
      loop
        for v_match in
          select match.value, (match.ordinality - 1)::integer as match_index
          from jsonb_array_elements(case when jsonb_typeof(v_week.value) = 'array' then v_week.value else '[]'::jsonb end) with ordinality match(value, ordinality)
          where jsonb_typeof(match.value) = 'array'
            and jsonb_array_length(match.value) = 2
            and v_index in ((match.value ->> 0)::integer, (match.value ->> 1)::integer)
        loop
          v_key := v_week.week_index::text || '-' || v_match.match_index::text;
          if old.state -> 'matchResults' -> v_key is distinct from new.state -> 'matchResults' -> v_key then
            raise exception 'Future fixtures for a retired team are frozen. Reactivate the team before changing them.';
          end if;
        end loop;
      end loop;
    end if;
  end loop;

  if coalesce(jsonb_typeof(old.state -> 'playoffs'), 'null') = 'null'
     and coalesce(jsonb_typeof(new.state -> 'playoffs'), 'null') <> 'null' then
    for v_index in 0..jsonb_array_length(new.state -> 'teams') - 1 loop
      if new.state #>> array['teams', v_index::text, 'seasonStatus', 'status'] = 'retired'
         and (
           jsonb_path_exists(new.state -> 'playoffs', '$.seeds[*] ? (@ == $team)', jsonb_build_object('team', v_index))
           or jsonb_path_exists(new.state -> 'playoffs', '$.divisionBrackets[*].seeds[*] ? (@ == $team)', jsonb_build_object('team', v_index))
         ) then
        raise exception 'Retired teams cannot be seeded into playoffs.';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

commit;

