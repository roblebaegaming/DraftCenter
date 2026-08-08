-- Commissioner recovery for standalone tournaments. Replacements retain an
-- explicit identity trail and use one-time, fragment-safe claim codes.
begin;

alter table public.tournament_entrants
  drop constraint if exists tournament_entrants_status_check;
alter table public.tournament_entrants
  add constraint tournament_entrants_status_check
  check (status in ('registered', 'dropped', 'disqualified', 'replaced'));

create table public.tournament_entrant_replacements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  outgoing_entrant_id uuid not null,
  replacement_entrant_id uuid not null,
  roster_policy text not null
    check (roster_policy in ('retain-roster', 'replacement-selects-roster')),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  code_hash text check (code_hash is null or code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (outgoing_entrant_id),
  unique (replacement_entrant_id),
  foreign key (outgoing_entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict,
  foreign key (replacement_entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict,
  check (outgoing_entrant_id <> replacement_entrant_id),
  check ((claimed_at is null) = (claimed_by is null))
);

create index tournament_replacements_tournament_idx
  on public.tournament_entrant_replacements(tournament_id, created_at desc);
create index tournament_replacements_pending_idx
  on public.tournament_entrant_replacements(replacement_entrant_id, expires_at)
  where claimed_at is null;

alter table public.tournament_entrant_replacements enable row level security;
revoke all on public.tournament_entrant_replacements from public, anon, authenticated;
grant all on public.tournament_entrant_replacements to service_role;

-- Internal primitive used by every recovery path. It completes one forfeit and
-- keeps advancing only when the next match contains exactly one inactive
-- entrant. Two inactive entrants always stop for an explicit commissioner
-- decision instead of choosing a winner implicitly.
create or replace function public.resolve_tournament_forfeit_chain(
  p_match_id uuid,
  p_loser_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_initial_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_next public.tournament_matches%rowtype;
  v_winner_id uuid;
  v_loser_id uuid := p_loser_id;
  v_wins integer;
  v_kind text := p_initial_kind;
  v_inactive_count integer;
  v_inactive_id uuid;
begin
  if p_actor_id is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500
     or p_initial_kind not in (
       'match_forfeited',
       'dropped_entrant_forfeited',
       'disqualified_entrant_forfeited',
       'inactive_entrant_forfeited'
     ) then
    raise exception 'Tournament recovery details are invalid.';
  end if;

  loop
    select * into v_match
    from public.tournament_matches
    where id = p_match_id
    for update;

    if not found
       or v_match.status not in ('ready', 'reported')
       or v_match.winner_id is not null
       or v_match.entrant_a_id is null
       or v_match.entrant_b_id is null
       or v_loser_id not in (v_match.entrant_a_id, v_match.entrant_b_id) then
      raise exception 'That match cannot be recovered safely. Refresh and review it.';
    end if;

    v_winner_id := case
      when v_loser_id = v_match.entrant_a_id then v_match.entrant_b_id
      else v_match.entrant_a_id
    end;
    v_wins := (v_match.best_of + 1) / 2;

    update public.tournament_result_submissions
    set status = 'rejected', confirmed_by = p_actor_id, resolved_at = now()
    where match_id = v_match.id and status = 'pending';

    update public.tournament_matches
    set status = 'complete',
        games_a = case when v_winner_id = entrant_a_id then v_wins else 0 end,
        games_b = case when v_winner_id = entrant_b_id then v_wins else 0 end,
        winner_id = v_winner_id,
        loser_id = v_loser_id,
        replay_urls = '{}',
        mvp = null,
        revision = revision + 1,
        completed_at = now()
    where id = v_match.id;

    insert into public.tournament_audit_events(
      tournament_id, actor_id, kind, payload
    ) values (
      v_match.tournament_id,
      p_actor_id,
      v_kind,
      jsonb_build_object(
        'match_id', v_match.id,
        'winner_id', v_winner_id,
        'loser_id', v_loser_id,
        'reason', btrim(p_reason)
      )
    );

    if v_match.winner_to_match_id is null then
      update public.tournaments
      set status = 'complete', revision = revision + 1, updated_at = now()
      where id = v_match.tournament_id;
      return v_winner_id;
    end if;

    select * into v_next
    from public.tournament_matches
    where id = v_match.winner_to_match_id
    for update;

    if not found
       or v_next.status not in ('pending', 'ready')
       or v_next.winner_id is not null
       or (v_match.winner_to_slot = 'a'
           and v_next.entrant_a_id is not null
           and v_next.entrant_a_id <> v_winner_id)
       or (v_match.winner_to_slot = 'b'
           and v_next.entrant_b_id is not null
           and v_next.entrant_b_id <> v_winner_id) then
      raise exception 'The next match has already started. Recovery stopped safely.';
    end if;

    update public.tournament_matches
    set entrant_a_id = case
          when v_match.winner_to_slot = 'a' then v_winner_id
          else entrant_a_id
        end,
        entrant_b_id = case
          when v_match.winner_to_slot = 'b' then v_winner_id
          else entrant_b_id
        end,
        status = case
          when (case when v_match.winner_to_slot = 'a' then v_winner_id else entrant_a_id end) is not null
           and (case when v_match.winner_to_slot = 'b' then v_winner_id else entrant_b_id end) is not null
            then 'ready'
          else 'pending'
        end,
        revision = revision + 1
    where id = v_next.id
    returning * into v_next;

    if v_next.entrant_a_id is null or v_next.entrant_b_id is null then
      return v_winner_id;
    end if;

    select count(*), (array_agg(entrant.id order by entrant.id))[1]
    into v_inactive_count, v_inactive_id
    from public.tournament_entrants entrant
    where entrant.id in (v_next.entrant_a_id, v_next.entrant_b_id)
      and entrant.status <> 'registered';

    if v_inactive_count <> 1 then
      return v_winner_id;
    end if;

    p_match_id := v_next.id;
    v_loser_id := v_inactive_id;
    v_kind := 'inactive_entrant_forfeited';
  end loop;
end;
$$;

create or replace function public.forfeit_tournament_match(
  p_match_id uuid,
  p_expected_tournament_revision bigint,
  p_expected_match_revision bigint,
  p_forfeiting_entrant_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_winner uuid;
begin
  if auth.uid() is null then
    raise exception 'Only the tournament owner can record a forfeit.';
  end if;

  select * into v_match
  from public.tournament_matches
  where id = p_match_id
  for update;
  if not found then raise exception 'Match not found.'; end if;

  select * into v_tournament
  from public.tournaments
  where id = v_match.tournament_id
  for update;
  if v_tournament.owner_id <> auth.uid() then
    raise exception 'Only the tournament owner can record a forfeit.';
  end if;
  if v_tournament.status <> 'active' then
    raise exception 'Only an active tournament match can be forfeited.';
  end if;
  if v_tournament.revision <> p_expected_tournament_revision
     or v_match.revision <> p_expected_match_revision then
    raise exception 'The tournament changed. Refresh before recording a forfeit.';
  end if;

  v_winner := public.resolve_tournament_forfeit_chain(
    v_match.id,
    p_forfeiting_entrant_id,
    auth.uid(),
    p_reason,
    'match_forfeited'
  );
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = v_tournament.id;
  return v_winner;
end;
$$;

create or replace function public.set_tournament_entrant_status(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_expected_tournament_revision bigint,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_entrant public.tournament_entrants%rowtype;
  v_match public.tournament_matches%rowtype;
  v_kind text;
begin
  if auth.uid() is null then
    raise exception 'Only the tournament owner can change entrant status.';
  end if;
  if p_status not in ('dropped', 'disqualified')
     or char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then
    raise exception 'Entrant recovery details are invalid.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status not in ('registration', 'active') then
    raise exception 'Only the tournament owner can change an active entrant.';
  end if;
  if v_tournament.revision <> p_expected_tournament_revision then
    raise exception 'The tournament changed. Refresh before changing entrant status.';
  end if;

  select * into v_entrant
  from public.tournament_entrants
  where id = p_entrant_id and tournament_id = p_tournament_id
  for update;
  if not found or v_entrant.status <> 'registered' then
    raise exception 'That entrant is no longer active.';
  end if;

  update public.tournament_entrants
  set status = p_status,
      seed = case when v_tournament.status = 'registration' then null else seed end
  where id = v_entrant.id;

  select * into v_match
  from public.tournament_matches
  where tournament_id = p_tournament_id
    and p_entrant_id in (entrant_a_id, entrant_b_id)
    and winner_id is null
    and status in ('pending', 'ready', 'reported')
  order by round_number desc
  limit 1
  for update;

  if found
     and v_match.entrant_a_id is not null
     and v_match.entrant_b_id is not null then
    v_kind := case
      when p_status = 'dropped' then 'dropped_entrant_forfeited'
      else 'disqualified_entrant_forfeited'
    end;
    perform public.resolve_tournament_forfeit_chain(
      v_match.id,
      p_entrant_id,
      auth.uid(),
      p_reason,
      v_kind
    );
  end if;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(
    tournament_id, actor_id, kind, payload
  ) values (
    p_tournament_id,
    auth.uid(),
    'entrant_' || p_status,
    jsonb_build_object('entrant_id', p_entrant_id, 'reason', btrim(p_reason))
  );
end;
$$;

create or replace function public.replace_tournament_entrant(
  p_tournament_id uuid,
  p_outgoing_entrant_id uuid,
  p_expected_tournament_revision bigint,
  p_replacement_display_name text,
  p_roster_policy text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_outgoing public.tournament_entrants%rowtype;
  v_replacement_id uuid;
  v_code text;
  v_name text := btrim(coalesce(p_replacement_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Only the tournament owner can replace an entrant.';
  end if;
  if char_length(v_name) not between 1 and 100
     or p_roster_policy not in ('retain-roster', 'replacement-selects-roster')
     or char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then
    raise exception 'Replacement details are invalid.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status not in ('registration', 'active') then
    raise exception 'Only the tournament owner can replace an active entrant.';
  end if;
  if v_tournament.revision <> p_expected_tournament_revision then
    raise exception 'The tournament changed. Refresh before replacing an entrant.';
  end if;

  select * into v_outgoing
  from public.tournament_entrants
  where id = p_outgoing_entrant_id and tournament_id = p_tournament_id
  for update;
  if not found or v_outgoing.status <> 'registered' then
    raise exception 'That entrant is no longer active.';
  end if;

  if v_tournament.status = 'active' and (
    exists (
      select 1 from public.tournament_matches bracket_match
      where bracket_match.tournament_id = p_tournament_id
        and (
          p_outgoing_entrant_id in (bracket_match.winner_id, bracket_match.loser_id)
          or (p_outgoing_entrant_id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
              and bracket_match.status not in ('pending', 'ready'))
        )
    )
    or exists (
      select 1
      from public.tournament_result_submissions submission
      join public.tournament_matches bracket_match on bracket_match.id = submission.match_id
      where bracket_match.tournament_id = p_tournament_id
        and p_outgoing_entrant_id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
    )
    or not exists (
      select 1 from public.tournament_matches bracket_match
      where bracket_match.tournament_id = p_tournament_id
        and p_outgoing_entrant_id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
        and bracket_match.status in ('pending', 'ready')
    )
  ) then
    raise exception 'That entrant or their next opponent has already begun play. Use a drop or disqualification instead.';
  end if;

  update public.tournament_entrants
  set status = 'replaced', seed = null
  where id = v_outgoing.id;

  insert into public.tournament_entrants(
    tournament_id, user_id, registered_team_id, display_name, seed, status
  ) values (
    p_tournament_id,
    null,
    case when p_roster_policy = 'retain-roster' then v_outgoing.registered_team_id else null end,
    v_name,
    v_outgoing.seed,
    'registered'
  ) returning id into v_replacement_id;

  update public.tournament_matches
  set entrant_a_id = case when entrant_a_id = v_outgoing.id then v_replacement_id else entrant_a_id end,
      entrant_b_id = case when entrant_b_id = v_outgoing.id then v_replacement_id else entrant_b_id end,
      revision = revision + 1
  where tournament_id = p_tournament_id
    and status in ('pending', 'ready')
    and v_outgoing.id in (entrant_a_id, entrant_b_id);

  v_code := encode(gen_random_bytes(16), 'hex');
  insert into public.tournament_entrant_replacements(
    tournament_id,
    outgoing_entrant_id,
    replacement_entrant_id,
    roster_policy,
    reason,
    code_hash,
    expires_at,
    created_by
  ) values (
    p_tournament_id,
    v_outgoing.id,
    v_replacement_id,
    p_roster_policy,
    btrim(p_reason),
    encode(digest(v_code, 'sha256'), 'hex'),
    now() + interval '14 days',
    auth.uid()
  );

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(
    tournament_id, actor_id, kind, payload
  ) values (
    p_tournament_id,
    auth.uid(),
    'entrant_replaced',
    jsonb_build_object(
      'outgoing_entrant_id', v_outgoing.id,
      'replacement_entrant_id', v_replacement_id,
      'roster_policy', p_roster_policy,
      'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'replacement_entrant_id', v_replacement_id,
    'claim_code', v_code,
    'expires_at', now() + interval '14 days'
  );
end;
$$;

create or replace function public.claim_tournament_replacement(
  p_replacement_entrant_id uuid,
  p_claim_code text,
  p_registered_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_replacement public.tournament_entrant_replacements%rowtype;
  v_entrant public.tournament_entrants%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept a replacement invitation.';
  end if;
  if coalesce(p_claim_code, '') !~ '^[0-9a-f]{32}$' then
    raise exception 'This replacement invitation is invalid or expired.';
  end if;

  select * into v_replacement
  from public.tournament_entrant_replacements
  where replacement_entrant_id = p_replacement_entrant_id
  for update;
  if not found
     or v_replacement.claimed_at is not null
     or v_replacement.expires_at <= now()
     or v_replacement.code_hash is distinct from encode(digest(p_claim_code, 'sha256'), 'hex') then
    raise exception 'This replacement invitation is invalid or expired.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_replacement.tournament_id
  for update;
  select * into v_entrant
  from public.tournament_entrants
  where id = p_replacement_entrant_id
    and tournament_id = v_replacement.tournament_id
  for update;

  if v_tournament.status not in ('registration', 'active')
     or v_entrant.status <> 'registered'
     or v_entrant.user_id is not null
     or exists (
       select 1 from public.tournament_matches bracket_match
       where bracket_match.tournament_id = v_replacement.tournament_id
         and (
           p_replacement_entrant_id in (bracket_match.winner_id, bracket_match.loser_id)
           or (p_replacement_entrant_id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
               and bracket_match.status not in ('pending', 'ready'))
         )
     ) then
    raise exception 'This replacement invitation is no longer available.';
  end if;
  if exists (
    select 1 from public.tournament_entrants
    where tournament_id = v_replacement.tournament_id
      and user_id = auth.uid()
  ) then
    raise exception 'Your account is already attached to an entrant in this tournament.';
  end if;
  if v_replacement.roster_policy = 'retain-roster' and p_registered_team_id is not null then
    raise exception 'This replacement keeps the existing registered roster.';
  end if;
  if v_replacement.roster_policy = 'replacement-selects-roster'
     and p_registered_team_id is not null
     and not exists (
       select 1 from public.personal_teams
       where id = p_registered_team_id and owner_id = auth.uid() and archived = false
     ) then
    raise exception 'Choose one of your own registered teams.';
  end if;

  update public.tournament_entrants
  set user_id = auth.uid(),
      registered_team_id = case
        when v_replacement.roster_policy = 'replacement-selects-roster'
          then p_registered_team_id
        else registered_team_id
      end
  where id = v_entrant.id;
  update public.tournament_entrant_replacements
  set code_hash = null, claimed_at = now(), claimed_by = auth.uid()
  where id = v_replacement.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = v_replacement.tournament_id;
  insert into public.tournament_audit_events(
    tournament_id, actor_id, kind, payload
  ) values (
    v_replacement.tournament_id,
    auth.uid(),
    'replacement_claimed',
    jsonb_build_object(
      'outgoing_entrant_id', v_replacement.outgoing_entrant_id,
      'replacement_entrant_id', v_replacement.replacement_entrant_id,
      'roster_policy', v_replacement.roster_policy
    )
  );
  return v_replacement.tournament_id;
exception when unique_violation then
  raise exception 'Your account is already attached to an entrant in this tournament.';
end;
$$;

-- Standard confirmations now respect entrants who were dropped or
-- disqualified while they were waiting for an opponent.
create or replace function public.confirm_tournament_result(
  p_submission_id uuid,
  p_expected_match_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.tournament_result_submissions%rowtype;
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_next public.tournament_matches%rowtype;
  v_inactive_count integer;
  v_inactive_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to confirm a result.'; end if;
  select * into v_submission from public.tournament_result_submissions where id = p_submission_id for update;
  if not found then raise exception 'Result submission not found.'; end if;
  select * into v_match from public.tournament_matches where id = v_submission.match_id for update;
  select * into v_tournament from public.tournaments where id = v_match.tournament_id;
  if v_submission.status = 'confirmed' then
    if v_tournament.owner_id = auth.uid() or v_submission.confirmed_by = auth.uid() then
      return v_submission.match_id;
    end if;
    raise exception 'That result is no longer awaiting confirmation.';
  end if;
  if v_submission.status <> 'pending' then raise exception 'That result is no longer awaiting confirmation.'; end if;
  if v_match.status <> 'reported'
     or v_match.revision <> p_expected_match_revision
     or v_submission.expected_match_revision <> v_match.revision then
    raise exception 'That match changed. Refresh before confirming.';
  end if;
  if v_tournament.owner_id <> auth.uid()
     and not exists (
       select 1 from public.tournament_entrants
       where id in (v_match.entrant_a_id, v_match.entrant_b_id)
         and user_id = auth.uid()
         and user_id <> v_submission.submitted_by
     ) then
    raise exception 'The opponent or tournament owner must confirm this result.';
  end if;

  v_winner := case when v_submission.games_a > v_submission.games_b then v_match.entrant_a_id else v_match.entrant_b_id end;
  v_loser := case when v_winner = v_match.entrant_a_id then v_match.entrant_b_id else v_match.entrant_a_id end;
  update public.tournament_matches
  set status = 'complete', games_a = v_submission.games_a, games_b = v_submission.games_b,
      winner_id = v_winner, loser_id = v_loser, replay_urls = v_submission.replay_urls,
      mvp = v_submission.mvp, revision = revision + 1, completed_at = now()
  where id = v_match.id;
  update public.tournament_result_submissions
  set status = 'confirmed', confirmed_by = auth.uid(), resolved_at = now()
  where id = v_submission.id;

  if v_match.winner_to_match_id is not null then
    select * into v_next from public.tournament_matches where id = v_match.winner_to_match_id for update;
    if (v_match.winner_to_slot = 'a' and v_next.entrant_a_id is not null and v_next.entrant_a_id <> v_winner)
       or (v_match.winner_to_slot = 'b' and v_next.entrant_b_id is not null and v_next.entrant_b_id <> v_winner) then
      raise exception 'The next bracket slot is already occupied.';
    end if;
    update public.tournament_matches
    set entrant_a_id = case when v_match.winner_to_slot = 'a' then v_winner else entrant_a_id end,
        entrant_b_id = case when v_match.winner_to_slot = 'b' then v_winner else entrant_b_id end,
        status = case
          when (case when v_match.winner_to_slot = 'a' then v_winner else entrant_a_id end) is not null
           and (case when v_match.winner_to_slot = 'b' then v_winner else entrant_b_id end) is not null
            then 'ready'
          else 'pending'
        end,
        revision = revision + 1
    where id = v_next.id
    returning * into v_next;

    if v_next.entrant_a_id is not null and v_next.entrant_b_id is not null then
      select count(*), (array_agg(entrant.id order by entrant.id))[1]
      into v_inactive_count, v_inactive_id
      from public.tournament_entrants entrant
      where entrant.id in (v_next.entrant_a_id, v_next.entrant_b_id)
        and entrant.status <> 'registered';
      if v_inactive_count = 1 then
        perform public.resolve_tournament_forfeit_chain(
          v_next.id,
          v_inactive_id,
          auth.uid(),
          'Entrant was no longer active when the opponent advanced.',
          'inactive_entrant_forfeited'
        );
      end if;
    end if;
  else
    update public.tournaments
    set status = 'complete', revision = revision + 1, updated_at = now()
    where id = v_match.tournament_id;
  end if;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_match.tournament_id,
    auth.uid(),
    'result_confirmed',
    jsonb_build_object('match_id', v_match.id, 'winner_id', v_winner, 'submission_id', v_submission.id)
  );
  return v_match.id;
end;
$$;

-- The workspace exposes recovery state without exposing user IDs, saved-team
-- IDs, code hashes, or one-time claim codes.
create or replace function public.get_tournament_workspace(
  p_slug text,
  p_access_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  select * into v_tournament from public.tournaments where slug = p_slug;
  if not found or (
    not public.can_view_tournament(v_tournament.id)
    and not (
      v_tournament.status = 'registration'
      and coalesce(p_access_code, '') ~ '^[0-9a-f]{32}$'
      and exists (
        select 1 from public.tournament_registration_codes code
        where code.tournament_id = v_tournament.id
          and code.code_hash = encode(digest(p_access_code, 'sha256'), 'hex')
      )
    )
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', v_tournament.id,
      'slug', v_tournament.slug,
      'name', v_tournament.name,
      'description', v_tournament.description,
      'visibility', v_tournament.visibility,
      'format', v_tournament.format,
      'status', v_tournament.status,
      'rules', v_tournament.rules,
      'best_of', v_tournament.best_of,
      'entrant_limit', v_tournament.entrant_limit,
      'revision', v_tournament.revision,
      'is_owner', v_tournament.owner_id = auth.uid()
    ),
    'entrants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entrant.id,
        'display_name', entrant.display_name,
        'seed', entrant.seed,
        'status', entrant.status,
        'is_me', entrant.user_id = auth.uid(),
        'replacement_pending', exists (
          select 1 from public.tournament_entrant_replacements replacement
          where replacement.replacement_entrant_id = entrant.id
            and replacement.claimed_at is null
            and replacement.expires_at > now()
        )
      ) order by entrant.seed nulls last, entrant.registered_at)
      from public.tournament_entrants entrant
      where entrant.tournament_id = v_tournament.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bracket_match.id,
        'round_number', bracket_match.round_number,
        'match_number', bracket_match.match_number,
        'entrant_a_id', bracket_match.entrant_a_id,
        'entrant_b_id', bracket_match.entrant_b_id,
        'winner_id', bracket_match.winner_id,
        'games_a', bracket_match.games_a,
        'games_b', bracket_match.games_b,
        'best_of', bracket_match.best_of,
        'status', bracket_match.status,
        'revision', bracket_match.revision,
        'replay_urls', bracket_match.replay_urls,
        'mvp', bracket_match.mvp
      ) order by bracket_match.round_number, bracket_match.match_number)
      from public.tournament_matches bracket_match
      where bracket_match.tournament_id = v_tournament.id
    ), '[]'::jsonb),
    'submissions', case when auth.uid() is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', submission.id,
        'match_id', submission.match_id,
        'submitted_by_me', submission.submitted_by = auth.uid(),
        'games_a', submission.games_a,
        'games_b', submission.games_b,
        'replay_urls', submission.replay_urls,
        'mvp', submission.mvp,
        'status', submission.status,
        'expected_match_revision', submission.expected_match_revision
      ))
      from public.tournament_result_submissions submission
      join public.tournament_matches bracket_match on bracket_match.id = submission.match_id
      where submission.tournament_id = v_tournament.id
        and submission.status = 'pending'
        and (
          v_tournament.owner_id = auth.uid()
          or exists (
            select 1 from public.tournament_entrants entrant
            where entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
              and entrant.user_id = auth.uid()
          )
        )
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.resolve_tournament_forfeit_chain(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_tournament_forfeit_chain(uuid, uuid, uuid, text, text)
  to service_role;
revoke all on function public.forfeit_tournament_match(uuid, bigint, bigint, uuid, text),
  public.set_tournament_entrant_status(uuid, uuid, bigint, text, text),
  public.replace_tournament_entrant(uuid, uuid, bigint, text, text, text),
  public.claim_tournament_replacement(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.forfeit_tournament_match(uuid, bigint, bigint, uuid, text),
  public.set_tournament_entrant_status(uuid, uuid, bigint, text, text),
  public.replace_tournament_entrant(uuid, uuid, bigint, text, text, text),
  public.claim_tournament_replacement(uuid, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
