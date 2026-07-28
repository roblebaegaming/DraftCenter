-- MUTATING: reset only the named disposable rehearsal league.
-- Expected restored state:
--   Surat Swalots -> OmniSports
--   Artazon Smolivs -> MyFriendMalamar
--   all remaining teams -> open
--
-- The guard raises an error unless the exact disposable league and expected
-- test accounts exist. Run verify-rehearsal-ownership.sql immediately after.
begin;

do $$
declare
  v_league_id uuid;
  v_omni_id uuid;
  v_commissioner_id uuid;
begin
  select id into v_league_id
  from public.leagues
  where slug = 'concurrency-rehearsal-jul-27-9nnn5'
    and name = 'Concurrency Rehearsal Jul 27';

  select id into v_omni_id
  from public.profiles
  where lower(username) = 'omnisports';

  select id into v_commissioner_id
  from public.profiles
  where lower(username) = 'myfriendmalamar';

  if v_league_id is null or v_omni_id is null or v_commissioner_id is null then
    raise exception 'Disposable rehearsal guard failed; no changes were made.';
  end if;

  insert into public.league_memberships(league_id, user_id, role)
  values
    (v_league_id, v_omni_id, 'coach'),
    (v_league_id, v_commissioner_id, 'commissioner')
  on conflict (league_id, user_id) do update
  set role = excluded.role, archived_at = null;

  update public.teams team
  set owner_membership_id = case team.source_key
    when '0' then (
      select id from public.league_memberships
      where league_id = v_league_id and user_id = v_omni_id
    )
    when '1' then (
      select id from public.league_memberships
      where league_id = v_league_id and user_id = v_commissioner_id
    )
    else null
  end
  where team.league_id = v_league_id;

  update public.league_state_snapshots snapshot
  set state = jsonb_set(
        snapshot.state,
        '{teams}',
        (
          select jsonb_agg(
            case entry.ordinality - 1
              when 0 then entry.team || jsonb_build_object(
                'claimedBy', 'OmniSports',
                'claimedByUserId', v_omni_id::text
              )
              when 1 then entry.team || jsonb_build_object(
                'claimedBy', 'MyFriendMalamar',
                'claimedByUserId', v_commissioner_id::text
              )
              else (entry.team - 'claimedBy' - 'claimedByUserId')
                || jsonb_build_object('claimedBy', null, 'claimedByUserId', null)
            end
            order by entry.ordinality
          )
          from jsonb_array_elements(snapshot.state -> 'teams')
            with ordinality as entry(team, ordinality)
        ),
        true
      ),
      revision = snapshot.revision + 1,
      updated_at = now()
  where snapshot.league_id = v_league_id;

  delete from public.league_memberships membership
  using public.profiles profile
  where membership.league_id = v_league_id
    and membership.user_id = profile.id
    and lower(profile.username) = 'draftcenter'
    and not exists (
      select 1 from public.teams team
      where team.owner_membership_id = membership.id
    );
end
$$;

commit;
