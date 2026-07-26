-- DraftCenter tournament preview follow-up:
-- - allow anonymous evaluation of public tournament visibility policies
-- - restore profile creation for users created in isolated preview Auth
-- - keep operator authority separate from competitor result confirmation

begin;

grant execute on function public.is_tournament_staff(uuid) to anon;
grant execute on function public.is_tournament_organizer(uuid) to anon;
grant execute on function public.is_tournament_entrant(uuid) to anon;
grant execute on function public.can_view_tournament(uuid) to anon;

delete from public.tournament_staff where role = 'scorekeeper';

alter table public.tournament_staff
  drop constraint if exists tournament_staff_role_check;

alter table public.tournament_staff
  add constraint tournament_staff_role_check
  check (role = 'judge');

create or replace function public.appoint_tournament_staff(
  p_tournament_id uuid,
  p_username text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_tournament_organizer(p_tournament_id) then
    raise exception 'Only the tournament operator can appoint a judge.';
  end if;

  if p_role <> 'judge' then
    raise exception 'Tournament staff must use the judge role.';
  end if;

  select id
  into v_user
  from public.profiles
  where lower(username) = lower(btrim(p_username));

  if v_user is null then
    raise exception 'No DraftCenter profile matches that username.';
  end if;

  insert into public.tournament_staff (
    tournament_id,
    user_id,
    role,
    appointed_by
  )
  values (
    p_tournament_id,
    v_user,
    'judge',
    auth.uid()
  )
  on conflict (tournament_id, user_id)
  do update set
    role = 'judge',
    appointed_by = auth.uid(),
    created_at = now();

  return jsonb_build_object('tournament_id', p_tournament_id);
end;
$$;

grant execute on function public.appoint_tournament_staff(
  uuid,
  text,
  text
) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Coach'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select
  user_account.id,
  coalesce(
    nullif(split_part(coalesce(user_account.email, ''), '@', 1), ''),
    'Coach'
  )
from auth.users user_account
left join public.profiles profile
  on profile.id = user_account.id
where profile.id is null
on conflict (id) do nothing;

create or replace function public.report_tournament_match(
  p_pairing_id uuid,
  p_games_a integer,
  p_games_b integer,
  p_replay_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.tournament_pairings;
  v_event public.tournaments;
  v_me uuid;
  v_winner uuid;
  v_needed integer;
  v_operator_override boolean;
begin
  select *
  into v_pair
  from public.tournament_pairings
  where id = p_pairing_id
  for update;

  select *
  into v_event
  from public.tournaments
  where id = v_pair.tournament_id;

  select id
  into v_me
  from public.tournament_entrants
  where tournament_id = v_pair.tournament_id
    and user_id = auth.uid();

  if (
    v_me is null
    or v_me not in (v_pair.entrant_a_id, v_pair.entrant_b_id)
  ) and v_event.organizer_id <> auth.uid() then
    raise exception 'Only a participant or organizer can report this match.';
  end if;

  if v_pair.status in ('confirmed', 'bye') then
    raise exception 'This result is already final.';
  end if;

  v_needed := ceil(v_event.best_of::numeric / 2);

  if p_games_a < 0
    or p_games_b < 0
    or p_games_a = p_games_b
    or greatest(p_games_a, p_games_b) <> v_needed
    or least(p_games_a, p_games_b) >= v_needed
  then
    raise exception 'Enter a valid best-of-% score.', v_event.best_of;
  end if;

  if p_replay_url is not null
    and p_replay_url !~ '^https://'
  then
    raise exception 'Replay links must use HTTPS.';
  end if;

  v_winner := case
    when p_games_a > p_games_b then v_pair.entrant_a_id
    else v_pair.entrant_b_id
  end;

  v_operator_override :=
    v_event.organizer_id = auth.uid()
    and (
      v_me is null
      or v_me not in (v_pair.entrant_a_id, v_pair.entrant_b_id)
    );

  update public.tournament_pairings
  set
    status = case
      when v_operator_override then 'confirmed'
      else 'reported'
    end,
    games_a = p_games_a,
    games_b = p_games_b,
    winner_entrant_id = v_winner,
    reported_by_entrant_id = v_me,
    replay_url = nullif(btrim(p_replay_url), ''),
    reported_at = now(),
    confirmed_at = case
      when v_operator_override then now()
      else null
    end
  where id = p_pairing_id;

  return jsonb_build_object(
    'tournament_id',
    v_pair.tournament_id
  );
end;
$$;

grant execute on function public.report_tournament_match(
  uuid,
  integer,
  integer,
  text
) to authenticated;

commit;

notify pgrst, 'reload schema';
