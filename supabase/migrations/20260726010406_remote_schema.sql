SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."draft_mode" AS ENUM (
    'snake',
    'auction'
);

ALTER TYPE "public"."draft_mode" OWNER TO "postgres";

CREATE TYPE "public"."league_status" AS ENUM (
    'setup',
    'drafting',
    'regular_season',
    'playoffs',
    'completed',
    'archived'
);

ALTER TYPE "public"."league_status" OWNER TO "postgres";

CREATE TYPE "public"."match_status" AS ENUM (
    'scheduled',
    'reported',
    'confirmed',
    'disputed',
    'forfeit',
    'cancelled'
);

ALTER TYPE "public"."match_status" OWNER TO "postgres";

CREATE TYPE "public"."membership_role" AS ENUM (
    'commissioner',
    'co_commissioner',
    'coach',
    'viewer'
);

ALTER TYPE "public"."membership_role" OWNER TO "postgres";

CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'pending',
    'paid',
    'waived',
    'refunded',
    'overdue'
);

ALTER TYPE "public"."payment_status" OWNER TO "postgres";

CREATE TYPE "public"."transaction_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'completed'
);

ALTER TYPE "public"."transaction_status" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."accept_league_invite"("p_token" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite public.league_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite.';
  end if;

  select *
  into v_invite
  from public.league_invites
  where token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'This invite is no longer available.';
  end if;

  if v_invite.expires_at is not null
     and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_invite.email is not null
     and v_invite.email <> v_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  if v_invite.email is not null
     and v_invite.accepted_at is not null then
    if (
      v_invite.accepted_by = auth.uid()
      or (
        v_invite.accepted_by is null
        and v_invite.email = v_email
      )
    )
    and exists (
      select 1
      from public.league_memberships
      where league_id = v_invite.league_id
        and user_id = auth.uid()
    ) then
      update public.league_invites
      set accepted_by = auth.uid()
      where id = v_invite.id
        and accepted_by is null;

      return v_invite.league_id;
    end if;

    raise exception 'This invite has already been accepted.';
  end if;

  insert into public.profiles (id, display_name)
  values (
    auth.uid(),
    coalesce(nullif(split_part(v_email, '@', 1), ''), 'Coach')
  )
  on conflict (id) do nothing;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_invite.league_id, auth.uid(), v_invite.role)
  on conflict (league_id, user_id) do update
  set role = case
    when public.league_memberships.role = 'commissioner'
      then public.league_memberships.role
    when excluded.role = 'co_commissioner'
      then 'co_commissioner'::public.membership_role
    when public.league_memberships.role = 'viewer'
      then excluded.role
    else public.league_memberships.role
  end;

  -- General links have no email and remain reusable until expiration.
  if v_invite.email is not null then
    update public.league_invites
    set
      accepted_at = now(),
      accepted_by = auth.uid()
    where id = v_invite.id;
  end if;

  return v_invite.league_id;
end;
$$;

ALTER FUNCTION "public"."accept_league_invite"("p_token" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."accept_spectator_invite"("p_token" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invite public.league_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to view this league.'; end if;
  select * into v_invite from public.league_invites where token = p_token for update;
  if v_invite.id is null or v_invite.role <> 'viewer' then raise exception 'That spectator link is not available.'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then raise exception 'That spectator link has expired.'; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_invite.email is not null and v_invite.email <> v_email then raise exception 'This spectator link was sent to a different email address.'; end if;
  insert into public.profiles (id, display_name) values (auth.uid(), coalesce(nullif(split_part(v_email, '@', 1), ''), 'Spectator')) on conflict (id) do nothing;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_invite.league_id, auth.uid(), 'viewer')
  on conflict (league_id, user_id) do nothing;
  update public.league_invites set accepted_at = coalesce(accepted_at, now()) where id = v_invite.id;
  return v_invite.league_id;
end;
$$;

ALTER FUNCTION "public"."accept_spectator_invite"("p_token" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."advance_live_snake_turn"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_order jsonb;
  v_total integer;
  v_scan integer;
  v_candidate uuid;
  v_next_team uuid;
  v_roster_max integer;
  v_roster_count integer;
  v_budget_enabled boolean;
  v_budget numeric;
  v_spent numeric;
  v_can_pick boolean;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can advance an expired turn.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status = 'active'
  for update;
  if v_session.id is null then
    raise exception 'No active live snake draft was found.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_order := coalesce(v_session.configuration -> 'team_order', '[]'::jsonb);
  v_total := jsonb_array_length(v_order);
  v_scan := v_session.current_pick_number + 1;
  v_roster_max := greatest(
    1,
    coalesce((v_state #>> '{settings,rosterMax}')::integer, 1)
  );
  v_budget_enabled := coalesce(
    (v_state #>> '{settings,snakeBudgetEnabled}')::boolean,
    false
  );
  v_budget := greatest(
    0,
    coalesce((v_state #>> '{settings,budget}')::numeric, 0)
  );

  while v_scan < v_total
  loop
    v_candidate := (v_order ->> v_scan)::uuid;
    select count(*)
    into v_roster_count
    from public.roster_entries
    where team_id = v_candidate
      and released_at is null;
    v_can_pick := v_roster_count < v_roster_max;

    if v_can_pick and v_budget_enabled then
      select coalesce(sum(pokemon.cost), 0)
      into v_spent
      from public.roster_entries entry
      join public.league_pokemon pokemon
        on pokemon.id = entry.league_pokemon_id
      where entry.team_id = v_candidate
        and entry.released_at is null;
      v_can_pick := exists (
        select 1
        from public.league_pokemon pokemon
        where pokemon.league_id = p_league_id
          and pokemon.is_allowed
          and not pokemon.is_drafted
          and coalesce(pokemon.cost, 0) <= v_budget - v_spent
      );
    end if;

    if v_can_pick then
      v_next_team := v_candidate;
      exit;
    end if;
    v_scan := v_scan + 1;
  end loop;

  if v_next_team is null then
    update public.draft_sessions
    set status = 'complete',
        current_pick_number = v_total,
        current_team_id = null,
        updated_at = now()
    where id = v_session.id;
  else
    update public.draft_sessions
    set current_pick_number = v_scan,
        current_team_id = v_next_team,
        updated_at = now()
    where id = v_session.id;
  end if;

  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_scan), true);
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_turn_advanced',
    auth.uid(),
    jsonb_build_object('next_pick_number', v_scan)
  );

  return v_state;
end;
$$;

ALTER FUNCTION "public"."advance_live_snake_turn"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_team_to_username"("p_team_id" "uuid", "p_username" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league_id uuid; v_user_id uuid; v_membership_id uuid;
begin
  select league_id into v_league_id from public.teams where id = p_team_id for update;
  if v_league_id is null then raise exception 'Team not found.'; end if;
  if not public.is_league_staff(v_league_id) then raise exception 'Only league commissioners can assign teams.'; end if;
  select id into v_user_id from public.profiles where lower(username) = lower(trim(p_username));
  if v_user_id is null then raise exception 'No DraftCenter profile has that username yet.'; end if;
  insert into public.league_memberships (league_id, user_id, role) values (v_league_id, v_user_id, 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
    returning id into v_membership_id;
  if exists (select 1 from public.teams where league_id = v_league_id and owner_membership_id = v_membership_id and id <> p_team_id) then
    raise exception 'That coach already has a team in this league.';
  end if;
  update public.teams set owner_membership_id = v_membership_id where id = p_team_id;
  insert into public.team_assignments (team_id, assigned_to, assigned_by) values (p_team_id, v_user_id, auth.uid())
    on conflict (team_id) do update set assigned_to = excluded.assigned_to, assigned_by = excluded.assigned_by, created_at = now();
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (v_league_id, 'team_assigned', auth.uid(), jsonb_build_object('team_id', p_team_id, 'username', lower(trim(p_username))));
  return v_membership_id;
end;
$$;

ALTER FUNCTION "public"."assign_team_to_username"("p_team_id" "uuid", "p_username" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auction_actor_can_control_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.is_league_staff(p_league_id) then return true; end if;
  return exists (
    select 1
    from public.auction_team_owners owner
    where owner.league_id = p_league_id
      and owner.team_index = p_team_index
      and owner.user_id = auth.uid()
  );
end;
$$;

ALTER FUNCTION "public"."auction_actor_can_control_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auto_assign_open_team"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_state jsonb; v_index integer; v_name text; v_username text; v_team_id uuid; v_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
    returning id into v_membership_id;

  -- Prefer the relational team table when a live draft has been provisioned.
  if exists (select 1 from public.draft_sessions where league_id = p_league_id) then
    select id into v_team_id from public.teams where league_id = p_league_id and owner_membership_id is null order by random() limit 1 for update skip locked;
    if v_team_id is null then return jsonb_build_object('assigned', false); end if;
    update public.teams set owner_membership_id = v_membership_id where id = v_team_id;
    select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
    if v_state is not null then
      select source_key::integer into v_index from public.teams where id = v_team_id;
      v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
      update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
    end if;
    insert into public.league_events(league_id, kind, actor_id, payload) values (p_league_id, 'replacement_assigned', auth.uid(), jsonb_build_object('team_id', v_team_id));
    return jsonb_build_object('assigned', true, 'team_id', v_team_id);
  end if;

  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  -- A replacement may be needed after a manual/off-platform draft has locked
  -- the saved prototype state, so an open saved team remains claimable here.
  if v_state is null then return jsonb_build_object('assigned', false); end if;
  select ordinality - 1 into v_index from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) with ordinality
    where nullif(trim(value ->> 'claimedBy'), '') is null order by random() limit 1;
  if v_index is null then return jsonb_build_object('assigned', false); end if;
  v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return jsonb_build_object('assigned', true, 'team_index', v_index);
end;
$$;

ALTER FUNCTION "public"."auto_assign_open_team"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."auto_assign_setup_team"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_state jsonb; v_index integer; v_name text; v_username text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is null or coalesce((v_state ->> 'locked')::boolean, false) then return null; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  if exists (select 1 from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) as team where lower(coalesce(team ->> 'claimedBy', '')) = lower(v_name)) then return v_state; end if;
  select team_index into v_index from (
    select ordinality - 1 as team_index
    from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) with ordinality
    where nullif(trim(value ->> 'claimedBy'), '') is null
    order by random() limit 1
  ) available_team;
  if v_index is null then return v_state; end if;
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end;
  v_state := jsonb_set(v_state, array['teams', v_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return v_state;
end;
$$;

ALTER FUNCTION "public"."auto_assign_setup_team"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cancel_private_free_agent_claim"("p_league_id" "uuid", "p_claim_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_claim public.league_free_agent_claims%rowtype;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  select * into v_claim
  from public.league_free_agent_claims
  where league_id = p_league_id and id = p_claim_id
  for update;
  if v_claim.id is null then
    raise exception 'That pending claim was not found.';
  end if;
  if not public.league_actor_can_control_snapshot_team(
    p_league_id, v_state, v_claim.team_index
  ) then
    raise exception 'Only that team owner or a commissioner can withdraw this claim.';
  end if;
  delete from public.league_free_agent_claims where id = p_claim_id;
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'free_agent_claim_withdrawn',
    auth.uid(),
    jsonb_build_object(
      'claim_id', p_claim_id,
      'team_index', v_claim.team_index
    )
  );
  return v_state;
end;
$$;

ALTER FUNCTION "public"."cancel_private_free_agent_claim"("p_league_id" "uuid", "p_claim_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."claim_live_setup_team"("p_league_id" "uuid", "p_team_index" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_state jsonb; v_team jsonb; v_name text; v_username text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then raise exception 'Teams cannot be claimed after the live draft starts.'; end if;
  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(trim(v_team ->> 'claimedBy'), '') is not null then raise exception 'That team has already been claimed.'; end if;
  select display_name, username into v_name, v_username from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), nullif(v_username, ''), 'Coach');
  if exists (select 1 from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) as team where lower(coalesce(team ->> 'claimedBy', '')) = lower(v_name)) then
    raise exception 'You already claimed a team in this league.';
  end if;
  insert into public.league_memberships (league_id, user_id, role) values (p_league_id, auth.uid(), 'coach')
    on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end;
  v_state := jsonb_set(v_state, array['teams', p_team_index::text, 'claimedBy'], to_jsonb(v_name), true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  return v_state;
end;
$$;

ALTER FUNCTION "public"."claim_live_setup_team"("p_league_id" "uuid", "p_team_index" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "kind" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone,
    "claimed_at" timestamp with time zone,
    "claim_token" "uuid",
    "last_error" "text",
    CONSTRAINT "notification_events_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'discord'::"text", 'in_app'::"text"])))
);

ALTER TABLE "public"."notification_events" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."claim_notification_events"("p_claim_token" "uuid", "p_limit" integer DEFAULT 50) RETURNS SETOF "public"."notification_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_claim_token is null then
    raise exception 'A claim token is required.';
  end if;

  return query
  with candidates as (
    select event.id
    from public.notification_events event
    where event.sent_at is null
      and event.failed_at is null
      and coalesce(event.next_attempt_at, event.scheduled_for) <= now()
      and (event.claimed_at is null or event.claimed_at < now() - interval '15 minutes')
    order by coalesce(event.next_attempt_at, event.scheduled_for), event.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_events event
  set claimed_at = now(),
      claim_token = p_claim_token,
      attempt_count = event.attempt_count + 1
  from candidates
  where event.id = candidates.id
  returning event.*;
end;
$$;

ALTER FUNCTION "public"."claim_notification_events"("p_claim_token" "uuid", "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_live_snake_roster"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_settings jsonb;
  v_order jsonb;
  v_new_order jsonb;
  v_snapshot_order jsonb;
  v_team_id uuid;
  v_team_index integer;
  v_roster_count integer;
  v_roster_min integer;
  v_new_total integer;
  v_next_team uuid;
  v_pick_deadline jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status = 'active'
  for update;

  if v_session.id is null or v_session.current_team_id is null then
    raise exception 'No active live snake turn was found.';
  end if;
  v_team_id := v_session.current_team_id;

  if not public.is_league_staff(p_league_id)
     and not exists (
       select 1
       from public.teams team
       join public.league_memberships membership
         on membership.id = team.owner_membership_id
       where team.id = v_team_id
         and membership.user_id = auth.uid()
     ) then
    raise exception 'Only the team on the clock or a commissioner can finish this roster.';
  end if;

  select league.settings
  into v_settings
  from public.leagues league
  where league.id = p_league_id;

  if not coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  ) then
    raise exception 'Only budgeted snake rosters can finish before the maximum.';
  end if;

  v_roster_min := greatest(
    1,
    coalesce((v_settings ->> 'rosterMin')::integer, 1)
  );

  select count(*)
  into v_roster_count
  from public.roster_entries entry
  where entry.team_id = v_team_id
    and entry.released_at is null;

  if v_roster_count < v_roster_min then
    raise exception
      'This roster needs at least % Pokemon before it can finish drafting.',
      v_roster_min;
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  select team.source_key::integer
  into v_team_index
  from public.teams team
  where team.id = v_team_id
    and team.league_id = p_league_id;

  if v_team_index is null then
    raise exception 'The active team is not mapped to the league snapshot.';
  end if;

  v_order := coalesce(
    v_session.configuration -> 'team_order',
    '[]'::jsonb
  );

  select coalesce(
    jsonb_agg(item.value order by item.ordinality),
    '[]'::jsonb
  )
  into v_new_order
  from jsonb_array_elements(v_order)
    with ordinality item(value, ordinality)
  where item.ordinality - 1 < v_session.current_pick_number
     or (item.value #>> '{}')::uuid <> v_team_id;

  v_new_total := jsonb_array_length(v_new_order);
  if v_session.current_pick_number < v_new_total then
    v_next_team := (v_new_order ->> v_session.current_pick_number)::uuid;
  else
    v_next_team := null;
  end if;

  update public.draft_sessions
  set configuration = jsonb_set(
        coalesce(configuration, '{}'::jsonb),
        '{team_order}',
        v_new_order,
        true
      ),
      status = case
        when v_next_team is null then 'complete'
        else status
      end,
      current_pick_number = case
        when v_next_team is null then v_new_total
        else v_session.current_pick_number
      end,
      current_team_id = v_next_team,
      updated_at = now()
  where id = v_session.id;

  select coalesce(
    jsonb_agg(team.source_key::integer order by item.ordinality),
    '[]'::jsonb
  )
  into v_snapshot_order
  from jsonb_array_elements(v_new_order)
    with ordinality item(value, ordinality)
  join public.teams team
    on team.id = (item.value #>> '{}')::uuid
   and team.league_id = p_league_id;

  v_pick_deadline := case
    when v_next_team is null
      or coalesce(
        (v_settings ->> 'pickTimeLimitMinutes')::integer,
        0
      ) <= 0
      then 'null'::jsonb
    else to_jsonb(
      floor(extract(epoch from clock_timestamp()) * 1000)::bigint
        + (v_settings ->> 'pickTimeLimitMinutes')::integer * 60000
    )
  end;

  v_state := jsonb_set(
    v_state,
    '{snakeOrder}',
    v_snapshot_order,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{pickIndex}',
    to_jsonb(
      case
        when v_next_team is null then v_new_total
        else v_session.current_pick_number
      end
    ),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    v_pick_deadline,
    true
  );
  v_state := jsonb_set(
    v_state,
    array['teams', v_team_index::text, 'budgetDraftComplete'],
    'true'::jsonb,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (
    league_id,
    kind,
    actor_id,
    payload
  )
  values (
    p_league_id,
    'budget_snake_roster_completed',
    auth.uid(),
    jsonb_build_object(
      'team_id', v_team_id,
      'team_index', v_team_index,
      'roster_count', v_roster_count
    )
  );

  return v_state;
end;
$$;

ALTER FUNCTION "public"."complete_live_snake_roster"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.notification_events
  set sent_at = now(),
      claimed_at = null,
      claim_token = null,
      next_attempt_at = null,
      last_error = null
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;
  return found;
end;
$$;

ALTER FUNCTION "public"."complete_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_co_commissioner_invite"("p_league_id" "uuid", "p_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_token uuid;
  v_email text;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can invite co-commissioners.';
  end if;

  v_email := nullif(lower(trim(p_email)), '');

  if v_email is null
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  then
    raise exception 'Enter a valid email address.';
  end if;

  insert into public.league_invites (
    league_id,
    email,
    role,
    created_by,
    expires_at
  )
  values (
    p_league_id,
    v_email,
    'co_commissioner',
    auth.uid(),
    now() + interval '14 days'
  )
  returning token into v_token;

  return jsonb_build_object(
    'token',
    v_token,
    'role',
    'co_commissioner',
    'expires_at',
    now() + interval '14 days'
  );
end;
$_$;

ALTER FUNCTION "public"."create_co_commissioner_invite"("p_league_id" "uuid", "p_email" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_daily_game_comment"("p_game_type" "text", "p_game_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to comment.'; end if;
  if p_game_type not in ('bracket', 'quiz') then raise exception 'Unknown Daily Three activity.'; end if;
  if p_game_type = 'bracket' and not exists(select 1 from public.daily_draft_brackets where id = p_game_id) then raise exception 'That bracket was not found.'; end if;
  if p_game_type = 'quiz' and not exists(select 1 from public.daily_quizzes where id = p_game_id) then raise exception 'That quiz was not found.'; end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 1000 then raise exception 'Comments must be between 1 and 1,000 characters.'; end if;
  if p_parent_comment_id is not null and not exists(
    select 1 from public.daily_game_comments where id = p_parent_comment_id and game_type = p_game_type and game_id = p_game_id and parent_comment_id is null
  ) then raise exception 'Replies must belong to a top-level comment on this activity.'; end if;
  insert into public.daily_game_comments(game_type, game_id, user_id, parent_comment_id, body)
  values(p_game_type, p_game_id, auth.uid(), p_parent_comment_id, trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

ALTER FUNCTION "public"."create_daily_game_comment"("p_game_type" "text", "p_game_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to comment.';
  end if;

  if not exists (
    select 1 from public.daily_polls
    where id = p_poll_id and poll_date <= current_date
  ) then
    raise exception 'That poll is not available for comments.';
  end if;

  insert into public.daily_poll_comments(poll_id, user_id, body)
  values (p_poll_id, auth.uid(), trim(p_body))
  returning id into v_id;

  return v_id;
end;
$$;

ALTER FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to comment.'; end if;
  if not exists (select 1 from public.daily_polls where id = p_poll_id and poll_date <= current_date) then raise exception 'That poll is not available for comments.'; end if;
  if p_parent_comment_id is not null and not exists (
    select 1 from public.daily_poll_comments where id = p_parent_comment_id and poll_id = p_poll_id and parent_comment_id is null
  ) then raise exception 'Replies must be attached to a top-level comment on this poll.'; end if;
  insert into public.daily_poll_comments(poll_id, user_id, body, parent_comment_id)
  values (p_poll_id, auth.uid(), trim(p_body), p_parent_comment_id) returning id into v_id;
  return v_id;
end;
$$;

ALTER FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text" DEFAULT ''::"text", "p_season_label" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a league.';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'League name must be at least 2 characters.';
  end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then
    raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.';
  end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), 'Coach')
  on conflict (id) do nothing;

  insert into public.leagues (name, slug, description, season_label, created_by)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid())
  returning id into v_league_id;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'commissioner');

  insert into public.league_state_snapshots (league_id)
  values (v_league_id);

  return v_league_id;
end;
$_$;

ALTER FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_league_id uuid; v_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to create a league.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.'; end if;
  v_visibility := coalesce(nullif(lower(trim(p_visibility)), ''), 'private');
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Invalid league visibility.'; end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), 'Coach') on conflict (id) do nothing;

  insert into public.leagues (name, slug, description, season_label, created_by, is_public, league_visibility, is_practice, practice_expires_at)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid(),
          v_visibility <> 'private', v_visibility, coalesce(p_is_practice, false),
          case when coalesce(p_is_practice, false) then now() + interval '30 days' else null end)
  returning id into v_league_id;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'commissioner');
  insert into public.league_state_snapshots (league_id) values (v_league_id);
  return v_league_id;
end;
$_$;

ALTER FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean, "p_draft_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_league_id uuid; v_visibility text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to create a league.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.'; end if;
  v_visibility := coalesce(nullif(lower(trim(p_visibility)), ''), 'private');
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Invalid league visibility.'; end if;

  insert into public.profiles (id, display_name) values (auth.uid(), 'Coach') on conflict (id) do nothing;
  insert into public.leagues (name, slug, description, season_label, created_by, is_public, league_visibility, is_practice, practice_expires_at, draft_starts_at)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid(),
    v_visibility <> 'private', v_visibility, coalesce(p_is_practice, false),
    case when coalesce(p_is_practice, false) then now() + interval '30 days' else null end,
    p_draft_starts_at)
  returning id into v_league_id;
  insert into public.league_memberships (league_id, user_id, role) values (v_league_id, auth.uid(), 'commissioner');
  insert into public.league_state_snapshots (league_id) values (v_league_id);
  return v_league_id;
end;
$_$;

ALTER FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean, "p_draft_starts_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_league_invite"("p_league_id" "uuid", "p_email" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_token uuid; v_expires_at timestamptz := now() + interval '14 days';
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can create invites.'; end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'coach', auth.uid(), v_expires_at)
  returning token into v_token;
  return jsonb_build_object('token', v_token, 'role', 'coach', 'expires_at', v_expires_at);
end;
$$;

ALTER FUNCTION "public"."create_league_invite"("p_league_id" "uuid", "p_email" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_spectator_invite"("p_league_id" "uuid", "p_email" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_token uuid; v_expires_at timestamptz := now() + interval '90 days';
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can create spectator links.'; end if;
  insert into public.league_invites (league_id, email, role, created_by, expires_at)
  values (p_league_id, nullif(lower(trim(p_email)), ''), 'viewer', auth.uid(), v_expires_at)
  returning token into v_token;
  return jsonb_build_object('token', v_token, 'role', 'viewer', 'expires_at', v_expires_at);
end;
$$;

ALTER FUNCTION "public"."create_spectator_invite"("p_league_id" "uuid", "p_email" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."daily_three_activity_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_date date;
begin
  if tg_table_name='daily_poll_answers' then select poll_date into v_date from public.daily_polls where id=new.poll_id;
  elsif tg_table_name='daily_quiz_answers' then select quiz_date into v_date from public.daily_quizzes where id=new.quiz_id;
  else select game_date into v_date from public.daily_draft_brackets where id=new.bracket_id; if new.round_number<>3 then return new; end if;
  end if;
  perform public.refresh_daily_three(new.user_id,v_date); return new;
end; $$;

ALTER FUNCTION "public"."daily_three_activity_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."defer_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_next_attempt_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.notification_events
  set claimed_at = null,
      claim_token = null,
      next_attempt_at = greatest(
        coalesce(p_next_attempt_at, now() + interval '15 minutes'),
        now() + interval '1 minute'
      )
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;

  return found;
end;
$$;

ALTER FUNCTION "public"."defer_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_next_attempt_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."end_league_live_stream"("p_stream_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_league_id uuid;
begin
  select league_id
  into v_league_id
  from public.league_live_streams
  where id = p_stream_id;

  if v_league_id is null then
    raise exception 'Broadcast not found.';
  end if;

  if not exists(
    select 1
    from public.league_live_streams
    where id = p_stream_id
      and (
        created_by = auth.uid()
        or public.is_league_staff(v_league_id)
      )
  ) then
    raise exception 'You cannot end that broadcast.';
  end if;

  update public.league_live_streams
  set
    status = 'ended',
    updated_at = now()
  where id = p_stream_id;

  delete from public.notification_events
  where kind = 'match_reminder'
    and payload->>'stream_id' = p_stream_id::text
    and sent_at is null;

  return true;
end;
$$;

ALTER FUNCTION "public"."end_league_live_stream"("p_stream_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enforce_budget_snake_minimum_reserve"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_league_id uuid;
  v_mode text;
  v_settings jsonb;
  v_budget_enabled boolean;
  v_budget numeric;
  v_roster_min integer;
  v_roster_count integer;
  v_spent numeric;
  v_pick_cost numeric;
  v_required_reserve numeric;
begin
  select session.league_id, session.mode
  into v_league_id, v_mode
  from public.draft_sessions session
  where session.id = new.draft_session_id;

  if v_league_id is null or v_mode <> 'snake' then
    return new;
  end if;

  select league.settings
  into v_settings
  from public.leagues league
  where league.id = v_league_id;

  v_budget_enabled := coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  );
  if not v_budget_enabled then
    return new;
  end if;

  v_budget := greatest(
    0,
    coalesce((v_settings ->> 'budget')::numeric, 0)
  );
  v_roster_min := greatest(
    1,
    coalesce((v_settings ->> 'rosterMin')::integer, 1)
  );

  select
    count(*),
    coalesce(sum(pokemon.cost), 0)
  into v_roster_count, v_spent
  from public.roster_entries entry
  join public.league_pokemon pokemon
    on pokemon.id = entry.league_pokemon_id
  where entry.team_id = new.team_id
    and entry.released_at is null;

  select coalesce(pokemon.cost, 0)
  into v_pick_cost
  from public.league_pokemon pokemon
  where pokemon.id = new.league_pokemon_id
    and pokemon.league_id = v_league_id;

  if v_pick_cost is null then
    raise exception 'The selected Pokemon is not part of this league.';
  end if;

  v_required_reserve := greatest(
    0,
    v_roster_min - v_roster_count - 1
  );

  if v_pick_cost > v_budget - v_spent - v_required_reserve then
    raise exception
      'That pick would leave less than 1 point for each of the % remaining minimum roster slots.',
      v_required_reserve;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_budget_snake_minimum_reserve"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enforce_personal_team_free_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.owner_id <> auth.uid() then
    raise exception 'Personal teams can only be created for your own account.';
  end if;

  if (
    select count(*)
    from public.personal_teams
    where owner_id = new.owner_id
  ) >= 10 then
    raise exception 'The free My Teams plan supports up to 10 external teams.';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_personal_team_free_limit"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fail_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_error" "text", "p_max_attempts" integer DEFAULT 5) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.notification_events
  set claimed_at = null,
      claim_token = null,
      last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
      next_attempt_at = case
        when attempt_count >= greatest(1, coalesce(p_max_attempts, 5)) then null
        else now() + make_interval(mins => least(60, (power(2, greatest(attempt_count - 1, 0)) * 5)::integer))
      end,
      failed_at = case
        when attempt_count >= greatest(1, coalesce(p_max_attempts, 5)) then now()
        else null
      end
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;
  return found;
end;
$$;

ALTER FUNCTION "public"."fail_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_error" "text", "p_max_attempts" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."finalize_private_free_agent_claims"("p_league_id" "uuid", "p_state" "jsonb", "p_claim_ids" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing jsonb;
  v_incoming jsonb := p_state;
  v_expected_ids text[];
  v_actual_ids text[];
  v_sanitized_results jsonb;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can process pending claims.';
  end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_claim_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'The claim-processing request is invalid.';
  end if;

  select state into v_existing
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;
  if coalesce((p_state ->> 'rev')::bigint, -1)
     <> coalesce((v_existing ->> 'rev')::bigint, 0) + 1 then
    raise exception 'League data changed while claims were processing. Reload and try again.';
  end if;
  if jsonb_typeof(coalesce(p_state -> 'pendingClaims', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_state -> 'pendingClaims', '[]'::jsonb)) <> 0 then
    raise exception 'Processed state must not retain pending claims.';
  end if;

  select coalesce(array_agg(value order by value), array[]::text[])
  into v_expected_ids
  from jsonb_array_elements_text(p_claim_ids);
  select coalesce(array_agg(id::text order by id::text), array[]::text[])
  into v_actual_ids
  from public.league_free_agent_claims
  where league_id = p_league_id;
  if v_expected_ids is distinct from v_actual_ids then
    raise exception 'Pending claims changed while processing. Reload and try again.';
  end if;

  -- Winning bids may be published by league policy later. For now the shared
  -- snapshot records outcomes without copying any private bid into history.
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(result.value -> 'claim') = 'object'
        then jsonb_set(
          result.value,
          '{claim}',
          (result.value -> 'claim') - 'bidAmount',
          false
        )
        else result.value
      end
      order by result.ordinality
    ),
    '[]'::jsonb
  )
  into v_sanitized_results
  from jsonb_array_elements(
    coalesce(p_state -> 'lastClaimResults', '[]'::jsonb)
  ) with ordinality result(value, ordinality);
  v_incoming := jsonb_set(
    v_incoming,
    '{lastClaimResults}',
    v_sanitized_results,
    true
  );
  v_incoming := jsonb_set(v_incoming, '{pendingClaims}', '[]'::jsonb, true);

  update public.league_state_snapshots
  set state = v_incoming,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;
  delete from public.league_free_agent_claims
  where league_id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'free_agent_claims_processed',
    auth.uid(),
    jsonb_build_object('claim_count', cardinality(v_actual_ids))
  );
  return v_incoming;
end;
$$;

ALTER FUNCTION "public"."finalize_private_free_agent_claims"("p_league_id" "uuid", "p_state" "jsonb", "p_claim_ids" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_bracket_official_champions"() RETURNS TABLE("bracket_id" "uuid", "game_date" "date", "pokemon_key" "text", "pokemon" "text", "championship_votes" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with finalists as (
    select
      b.id as bracket_id,
      b.game_date,
      lower(trim(m.winner)) as pokemon_key,
      min(m.winner) as pokemon,
      count(*)::integer as final_wins
    from public.daily_draft_brackets b
    join public.daily_bracket_matchups m on m.bracket_id = b.id
    where b.game_date < current_date
      and m.round_number = 3
    group by b.id, b.game_date, lower(trim(m.winner))
  ),
  scored as (
    select
      f.*,
      coalesce((
        select
          count(*) filter (
            where lower(trim(m.winner)) = f.pokemon_key
          )::numeric / nullif(count(*), 0)
        from public.daily_bracket_matchups m
        where m.bracket_id = f.bracket_id
          and m.round_number = 2
          and (
            lower(trim(m.winner)) = f.pokemon_key
            or lower(trim(m.loser)) = f.pokemon_key
          )
      ), 0) as semifinal_rate,
      coalesce((
        select
          count(*) filter (
            where lower(trim(m.winner)) = f.pokemon_key
          )::numeric / nullif(count(*), 0)
        from public.daily_bracket_matchups m
        where m.bracket_id = f.bracket_id
          and m.round_number = 1
          and (
            lower(trim(m.winner)) = f.pokemon_key
            or lower(trim(m.loser)) = f.pokemon_key
          )
      ), 0) as quarterfinal_rate
    from finalists f
  ),
  ranked as (
    select
      s.*,
      row_number() over (
        partition by s.game_date
        order by
          s.final_wins desc,
          s.semifinal_rate desc,
          s.quarterfinal_rate desc,
          s.pokemon_key
      ) as champion_rank
    from scored s
  )
  select
    r.bracket_id,
    r.game_date,
    r.pokemon_key,
    r.pokemon,
    r.final_wins as championship_votes
  from ranked r
  where r.champion_rank = 1;
$$;

ALTER FUNCTION "public"."get_daily_bracket_official_champions"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_community_games"("p_local_date" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'bracket', (
      select jsonb_build_object(
        'id', b.id,
        'game_date', b.game_date,
        'pokemon', b.pokemon,
        'completed_brackets', (
          select count(distinct m.user_id)::integer
          from public.daily_bracket_matchups m
          where m.bracket_id = b.id
            and m.round_number = 3
        ),
        'results_revealed',
          b.game_date < current_date or auth.uid() is not null,

        'champions', case
          when b.game_date >= current_date and auth.uid() is null
            then '[]'::jsonb
          else coalesce((
            with finalists as (
              select
                lower(m.winner) as pokemon_key,
                min(m.winner) as pokemon,
                count(*)::integer as final_wins
              from public.daily_bracket_matchups m
              where m.bracket_id = b.id
                and m.round_number = 3
              group by lower(m.winner)
            ),
            ranked as (
              select
                f.pokemon,
                f.final_wins,

                coalesce((
                  select round(
                    100.0 *
                    count(*) filter (
                      where lower(m.winner) = f.pokemon_key
                    ) / nullif(count(*), 0)
                  )::integer
                  from public.daily_bracket_matchups m
                  where m.bracket_id = b.id
                    and m.round_number = 2
                    and (
                      lower(m.winner) = f.pokemon_key
                      or lower(m.loser) = f.pokemon_key
                    )
                ), 0) as semifinal_percent,

                coalesce((
                  select round(
                    100.0 *
                    count(*) filter (
                      where lower(m.winner) = f.pokemon_key
                    ) / nullif(count(*), 0)
                  )::integer
                  from public.daily_bracket_matchups m
                  where m.bracket_id = b.id
                    and m.round_number = 1
                    and (
                      lower(m.winner) = f.pokemon_key
                      or lower(m.loser) = f.pokemon_key
                    )
                ), 0) as quarterfinal_percent
              from finalists f
            )
            select jsonb_agg(
              jsonb_build_object(
                'pokemon', pokemon,
                'wins', final_wins,
                'semifinal_percent', semifinal_percent,
                'quarterfinal_percent', quarterfinal_percent
              )
              order by
                final_wins desc,
                semifinal_percent desc,
                quarterfinal_percent desc,
                pokemon
            )
            from ranked
          ), '[]'::jsonb)
        end,

        'matchup_results', case
          when b.game_date >= current_date and auth.uid() is null
            then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'round', round_number,
                'winner', winner,
                'loser', loser,
                'votes', total
              )
              order by round_number, total desc
            )
            from (
              select
                round_number,
                min(winner) as winner,
                min(loser) as loser,
                count(*)::integer as total
              from public.daily_bracket_matchups
              where bracket_id = b.id
              group by round_number, lower(winner), lower(loser)
            ) results
          ), '[]'::jsonb)
        end,

        'selected_winners', case
          when auth.uid() is null then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              m.winner order by m.round_number, m.match_number
            )
            from public.daily_bracket_matchups m
            where m.bracket_id = b.id
              and m.user_id = auth.uid()
          ), '[]'::jsonb)
        end
      )
      from public.daily_draft_brackets b
      where b.game_date = p_local_date
    ),

    'quiz', (
      select jsonb_build_object(
        'id', q.id,
        'quiz_date', q.quiz_date,
        'prompt', q.prompt,
        'hint', q.hint,
        'difficulty', q.difficulty,

        'answered', exists(
          select 1
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),

        'selected_answer', (
          select a.display_answer
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),

        'selected_correct', (
          select a.is_correct
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
            and a.user_id = auth.uid()
        ),

        'correct_answers', case
          when q.quiz_date < current_date or exists(
            select 1
            from public.daily_quiz_answers a
            where a.quiz_id = q.id
              and a.user_id = auth.uid()
          )
            then q.accepted_answers
          else '[]'::jsonb
        end,

        'total_answers', (
          select count(*)::integer
          from public.daily_quiz_answers a
          where a.quiz_id = q.id
        ),

        'correct_percent', case
          when q.quiz_date >= current_date and (
            auth.uid() is null or not exists(
              select 1
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
                and a.user_id = auth.uid()
            )
          )
            then null
          else coalesce((
            select round(
              100.0 * count(*) filter (where a.is_correct)
              / nullif(count(*), 0)
            )::integer
            from public.daily_quiz_answers a
            where a.quiz_id = q.id
          ), 0)
        end,

        'top_answers', case
          when q.quiz_date >= current_date and (
            auth.uid() is null or not exists(
              select 1
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
                and a.user_id = auth.uid()
            )
          )
            then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'answer', ranked.display_answer,
                'count', ranked.total
              )
              order by ranked.total desc, ranked.display_answer
            )
            from (
              select
                min(a.display_answer) as display_answer,
                count(*)::integer as total
              from public.daily_quiz_answers a
              where a.quiz_id = q.id
              group by a.normalized_answer
              order by total desc
              limit 5
            ) ranked
          ), '[]'::jsonb)
        end
      )
      from public.daily_quizzes q
      where q.quiz_date = p_local_date
    )
  );
$$;

ALTER FUNCTION "public"."get_daily_community_games"("p_local_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_game_comments"("p_game_type" "text", "p_game_id" "uuid", "p_limit" integer DEFAULT 50) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      to_jsonb(rows)
      order by
        rows.parent_comment_id nulls first,
        rows.upvotes desc,
        rows.created_at asc
    ),
    '[]'::jsonb
  )
  from (
    select
      c.id,
      c.body,
      c.created_at,
      c.parent_comment_id,
      c.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      (
        select count(*)::integer
        from public.daily_game_comment_upvotes u
        where u.comment_id = c.id
      ) as upvotes,
      exists(
        select 1
        from public.daily_game_comment_upvotes u
        where u.comment_id = c.id
          and u.user_id = auth.uid()
      ) as upvoted_by_me
    from public.daily_game_comments c
    left join public.profiles p
      on p.id = c.user_id
    where c.game_type = p_game_type
      and c.game_id = p_game_id
    order by
      c.parent_comment_id nulls first,
      upvotes desc,
      c.created_at asc
    limit greatest(
      1,
      least(coalesce(p_limit, 50), 200)
    )
  ) rows;
$$;

ALTER FUNCTION "public"."get_daily_game_comments"("p_game_type" "text", "p_game_id" "uuid", "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_poll"("p_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_poll public.daily_polls;
begin
  select * into v_poll from public.daily_polls where poll_date = p_date;
  if v_poll.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_poll.id,
    'poll_date', v_poll.poll_date,
    'question', v_poll.question,
    'options', v_poll.options,
    'answer_type', v_poll.answer_type,
    'selected_key', (select answer_key from public.daily_poll_answers where poll_id = v_poll.id and user_id = auth.uid()),
    'counts', coalesce((select jsonb_object_agg(answer_key, total) from (select answer_key, count(*)::integer as total from public.daily_poll_answers where poll_id = v_poll.id group by answer_key) results), '{}'::jsonb),
    'total_votes', (select count(*)::integer from public.daily_poll_answers where poll_id = v_poll.id)
  );
end;
$$;

ALTER FUNCTION "public"."get_daily_poll"("p_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_poll_comments"("p_poll_id" "uuid", "p_limit" integer DEFAULT 5) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with ranked_top as (
    select
      c.id,
      (
        select count(*)::integer
        from public.daily_poll_comment_upvotes u
        where u.comment_id = c.id
      ) as score
    from public.daily_poll_comments c
    where c.poll_id = p_poll_id
      and c.parent_comment_id is null
    order by score desc, c.created_at desc
    limit greatest(
      1,
      least(coalesce(p_limit, 5), 100)
    )
  ),
  selected_comments as (
    select
      c.id,
      c.body,
      c.created_at,
      c.parent_comment_id,
      c.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      (
        select count(*)::integer
        from public.daily_poll_comment_upvotes u
        where u.comment_id = c.id
      ) as upvotes,
      exists(
        select 1
        from public.daily_poll_comment_upvotes u
        where u.comment_id = c.id
          and u.user_id = auth.uid()
      ) as upvoted_by_me
    from public.daily_poll_comments c
    left join public.profiles p
      on p.id = c.user_id
    where c.id in (
      select id
      from ranked_top
    )
    or c.parent_comment_id in (
      select id
      from ranked_top
    )
  )
  select jsonb_build_object(
    'total', (
      select count(*)::integer
      from public.daily_poll_comments
      where poll_id = p_poll_id
    ),
    'comments', coalesce((
      select jsonb_agg(
        to_jsonb(sc)
        order by
          case
            when sc.parent_comment_id is null then 0
            else 1
          end,
          sc.upvotes desc,
          sc.created_at desc
      )
      from selected_comments sc
    ), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_daily_poll_comments"("p_poll_id" "uuid", "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_daily_poll_history"("p_limit" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(public.get_daily_poll(p.poll_date) order by p.poll_date desc),
    '[]'::jsonb
  )
  from (
    select poll_date
    from public.daily_polls
    where poll_date <= current_date
    order by poll_date desc
    limit greatest(1, least(coalesce(p_limit, 30), 365))
  ) p;
$$;

ALTER FUNCTION "public"."get_daily_poll_history"("p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_league_live_streams"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member boolean := false;
  v_public boolean := false;
begin
  select exists(
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
  ) into v_member;

  select coalesce(league_visibility in ('open', 'watch'), false)
  into v_public
  from public.leagues
  where id = p_league_id;

  if not v_member and not v_public then
    raise exception 'This league broadcast board is private.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'league_id', s.league_id,
        'match_key', s.match_key,
        'title', s.title,
        'platform', s.platform,
        'stream_url', s.stream_url,
        'starts_at', s.starts_at,
        'visibility', s.visibility,
        'status', s.status,
        'created_by', s.created_by,
        'can_manage',
          s.created_by = auth.uid()
          or public.is_league_staff(s.league_id)
      )
      order by
        case s.status
          when 'live' then 0
          when 'scheduled' then 1
          else 2
        end,
        s.starts_at nulls last,
        s.updated_at desc
    )
    from public.league_live_streams s
    where s.league_id = p_league_id
      and (
        s.visibility = 'public'
        or (v_member and s.visibility = 'league')
        or (
          v_member
          and s.visibility = 'private'
          and (
            s.created_by = auth.uid()
            or public.is_league_staff(s.league_id)
          )
        )
      )
      and (
        s.status <> 'ended'
        or s.updated_at > now() - interval '14 days'
      )
  ), '[]'::jsonb);
end;
$$;

ALTER FUNCTION "public"."get_league_live_streams"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_league_tool_members"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when not public.is_league_staff(p_league_id) then
      '[]'::jsonb
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'username', p.username,
          'display_name', p.display_name,
          'role', m.role,
          'team_name', t.name
        )
        order by
          case m.role
            when 'commissioner' then 1
            when 'co_commissioner' then 2
            when 'coach' then 3
            else 4
          end,
          coalesce(p.display_name, p.username)
      )
      from public.league_memberships m
      join public.profiles p on p.id = m.user_id
      left join public.teams t on t.owner_membership_id = m.id
      where m.league_id = p_league_id
        and m.role in ('commissioner', 'co_commissioner', 'coach')
    ), '[]'::jsonb)
  end;
$$;

ALTER FUNCTION "public"."get_league_tool_members"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_live_snake_draft"("p_league_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'session', (select to_jsonb(d) from public.draft_sessions d where d.league_id = p_league_id),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'source_key', t.source_key) order by t.source_key::int) from public.teams t where t.league_id = p_league_id), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(jsonb_build_object('pick_number', p.pick_number, 'team_id', p.team_id, 'league_pokemon_id', p.league_pokemon_id, 'pokemon_source_key', lp.source_key, 'team_source_key', t.source_key) order by p.pick_number)
      from public.draft_picks p join public.teams t on t.id = p.team_id join public.league_pokemon lp on lp.id = p.league_pokemon_id
      where p.draft_session_id = (select id from public.draft_sessions where league_id = p_league_id)), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_live_snake_draft"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select jsonb_build_object(
        'id',
        p.id,

        'poll_date',
        p.poll_date,

        'question',
        p.question,

        'answer_type',
        p.answer_type,

        'options',
        p.options,

        'counts',
        case
          when auth.uid() is null then '{}'::jsonb
          else coalesce(
            (
              select jsonb_object_agg(
                answer_key,
                total
              )
              from (
                select
                  a.answer_key,
                  count(*)::integer as total
                from public.daily_poll_answers a
                where a.poll_id = p.id
                group by a.answer_key
              ) answer_counts
            ),
            '{}'::jsonb
          )
        end,

        'total_votes',
        (
          select count(*)::integer
          from public.daily_poll_answers a
          where a.poll_id = p.id
        ),

        'selected_key',
        case
          when auth.uid() is null then null
          else (
            select a.answer_key
            from public.daily_poll_answers a
            where a.poll_id = p.id
              and a.user_id = auth.uid()
          )
        end
      )
      from public.daily_polls p
      where p.poll_date = p_local_date
    ),
    'null'::jsonb
  );
$$;

ALTER FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        p.id,

        'poll_date',
        p.poll_date,

        'question',
        p.question,

        'answer_type',
        p.answer_type,

        'options',
        p.options,

        'counts',
        coalesce(
          (
            select jsonb_object_agg(
              answer_key,
              total
            )
            from (
              select
                a.answer_key,
                count(*)::integer as total
              from public.daily_poll_answers a
              where a.poll_id = p.id
              group by a.answer_key
            ) result_counts
          ),
          '{}'::jsonb
        ),

        'total_votes',
        (
          select count(*)::integer
          from public.daily_poll_answers a
          where a.poll_id = p.id
        )
      )
      order by p.poll_date desc
    ),
    '[]'::jsonb
  )
  from (
    select *
    from public.daily_polls
    where poll_date < p_local_date
    order by poll_date desc
    limit greatest(
      1,
      least(
        coalesce(p_limit, 30),
        365
      )
    )
  ) p;
$$;

ALTER FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_badge_profile"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
select jsonb_build_object(
'badges',coalesce((select jsonb_agg(jsonb_build_object('code',c.code,'name',c.name,'description',c.description,'icon',c.icon,'category',c.category,'thresholds',c.thresholds,'subject',coalesce(p.subject,''),'progress',coalesce(p.progress,0),'tier',coalesce(p.tier,0),'tier_names',c.tier_names) order by coalesce(p.tier,0) desc,coalesce(p.progress,0) desc,c.name) from public.badge_catalog c left join public.user_badge_progress p on p.badge_code=c.code and p.user_id=auth.uid()),'[]'::jsonb),
'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'code',e.badge_code,'name',c.name,'description',c.description,'icon',c.icon,'subject',e.subject,'tier',e.tier,'awarded_at',e.awarded_at) order by e.awarded_at) from public.badge_award_events e join public.badge_catalog c on c.code=e.badge_code where e.user_id=auth.uid() and e.seen_at is null),'[]'::jsonb),
'daily_three',jsonb_build_object('total',(select count(*) from public.daily_three_completions where user_id=auth.uid()),'dates',coalesce((select jsonb_agg(activity_date order by activity_date desc) from public.daily_three_completions where user_id=auth.uid()),'[]'::jsonb))
); $$;

ALTER FUNCTION "public"."get_my_badge_profile"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_career_match_record"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_name text;
  v_wins integer := 0;
  v_losses integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your career record.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_name
  from public.profiles
  where id = auth.uid();

  with current_matches as (
    select
      case when result.value ->> 'gamesA' ~ '^[0-9]+$'
        then (result.value ->> 'gamesA')::integer else 0 end as games_a,
      case when result.value ->> 'gamesB' ~ '^[0-9]+$'
        then (result.value ->> 'gamesB')::integer else 0 end as games_b,
      lower(coalesce(s.state #>> array[
        'teams',
        s.state #>> array[
          'schedule',
          split_part(result.key, '-', 1),
          split_part(result.key, '-', 2),
          '0'
        ],
        'claimedBy'
      ], '')) = lower(v_name) as is_team_a,
      lower(coalesce(s.state #>> array[
        'teams',
        s.state #>> array[
          'schedule',
          split_part(result.key, '-', 1),
          split_part(result.key, '-', 2),
          '1'
        ],
        'claimedBy'
      ], '')) = lower(v_name) as is_team_b
    from public.league_state_snapshots s
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(s.state -> 'matchResults') = 'object'
          then s.state -> 'matchResults'
        else '{}'::jsonb
      end
    ) result
  ),
  current_record as (
    select
      count(*) filter (
        where (is_team_a and games_a > games_b)
           or (is_team_b and games_b > games_a)
      )::integer as wins,
      count(*) filter (
        where (is_team_a and games_a < games_b)
           or (is_team_b and games_b < games_a)
      )::integer as losses
    from current_matches
    where is_team_a or is_team_b
  ),
  archived_record as (
    select
      coalesce(sum(
        case
          when standing.value ->> 'w' ~ '^[0-9]+$'
            then (standing.value ->> 'w')::integer
          else 0
        end
      ), 0)::integer as wins,
      coalesce(sum(
        case
          when standing.value ->> 'l' ~ '^[0-9]+$'
            then (standing.value ->> 'l')::integer
          else 0
        end
      ), 0)::integer as losses
    from public.league_state_snapshots s
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(s.state -> 'seasonHistory') = 'array'
          then s.state -> 'seasonHistory'
        else '[]'::jsonb
      end
    ) season
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(season.value -> 'standings') = 'array'
          then season.value -> 'standings'
        else '[]'::jsonb
      end
    ) standing
    where lower(coalesce(
      season.value #>> array[
        'teams',
        standing.value ->> 'id',
        'claimedBy'
      ],
      ''
    )) = lower(v_name)
  )
  select
    coalesce(current_record.wins, 0)
      + coalesce(archived_record.wins, 0),
    coalesce(current_record.losses, 0)
      + coalesce(archived_record.losses, 0)
  into v_wins, v_losses
  from current_record
  cross join archived_record;

  return jsonb_build_object(
    'wins', v_wins,
    'losses', v_losses,
    'games', v_wins + v_losses,
    'win_percentage',
      case
        when v_wins + v_losses = 0 then 0
        else round(
          100.0 * v_wins / (v_wins + v_losses),
          1
        )
      end
  );
end;
$_$;

ALTER FUNCTION "public"."get_my_career_match_record"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_my_league_team_history"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_identity text;
  v_teams jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your league teams.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity
  from public.profiles
  where id = auth.uid();

  with current_teams as (
    select
      l.id as league_id,
      l.name as league_name,
      l.slug,
      coalesce(
        nullif(s.state ->> 'seasonNumber', '')::integer,
        1
      ) as season_number,
      false as archived,
      team.ordinality::integer - 1 as team_index,
      team.value ->> 'name' as team_name,
      team.value ->> 'color' as color,
      team.value ->> 'logoUrl' as logo_url,
      coalesce(
        s.state -> 'rosters' -> (team.ordinality::integer - 1),
        '[]'::jsonb
      ) as roster
    from public.league_state_snapshots s
    join public.leagues l
      on l.id = s.league_id
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(s.state -> 'teams') = 'array'
          then s.state -> 'teams'
        else '[]'::jsonb
      end
    ) with ordinality team(value, ordinality)
    where lower(coalesce(team.value ->> 'claimedBy', '')) =
          lower(v_identity)
  ),
  archived_teams as (
    select
      l.id as league_id,
      l.name as league_name,
      l.slug,
      coalesce(
        nullif(season.value ->> 'seasonNumber', '')::integer,
        season.ordinality::integer
      ) as season_number,
      true as archived,
      team.ordinality::integer - 1 as team_index,
      team.value ->> 'name' as team_name,
      team.value ->> 'color' as color,
      team.value ->> 'logoUrl' as logo_url,
      coalesce(
        season.value -> 'rosters' -> (team.ordinality::integer - 1),
        '[]'::jsonb
      ) as roster
    from public.league_state_snapshots s
    join public.leagues l
      on l.id = s.league_id
    join public.league_memberships membership
      on membership.league_id = s.league_id
     and membership.user_id = auth.uid()
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(s.state -> 'seasonHistory') = 'array'
          then s.state -> 'seasonHistory'
        else '[]'::jsonb
      end
    ) with ordinality season(value, ordinality)
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(season.value -> 'teams') = 'array'
          then season.value -> 'teams'
        else '[]'::jsonb
      end
    ) with ordinality team(value, ordinality)
    where lower(coalesce(team.value ->> 'claimedBy', '')) =
          lower(v_identity)
  ),
  combined as (
    select * from current_teams
    union all
    select * from archived_teams
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'league_id', league_id,
        'league_name', league_name,
        'slug', slug,
        'season_number', season_number,
        'archived', archived,
        'team_index', team_index,
        'team_name', team_name,
        'color', color,
        'logo_url', logo_url,
        'pokemon', coalesce(
          (
            select jsonb_agg(mon.value ->> 'name')
            from jsonb_array_elements(
              case
                when jsonb_typeof(roster) = 'array'
                  then roster
                else '[]'::jsonb
              end
            ) mon(value)
            where nullif(mon.value ->> 'name', '') is not null
          ),
          '[]'::jsonb
        )
      )
      order by
        archived asc,
        league_name,
        season_number desc,
        team_name
    ),
    '[]'::jsonb
  )
  into v_teams
  from combined;

  return jsonb_build_object('teams', v_teams);
end;
$$;

ALTER FUNCTION "public"."get_my_league_team_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'pokemon', p_pokemon,
    'wins', (select count(*)::integer from public.daily_bracket_matchups where lower(winner) = lower(p_pokemon)),
    'losses', (select count(*)::integer from public.daily_bracket_matchups where lower(loser) = lower(p_pokemon)),
    'championships', (select count(*)::integer from public.daily_bracket_matchups where round_number = 3 and lower(winner) = lower(p_pokemon)),
    'most_defeated', coalesce((
      select jsonb_agg(jsonb_build_object('pokemon', opponent, 'wins', total) order by total desc, opponent)
      from (
        select min(loser) opponent, count(*)::integer total
        from public.daily_bracket_matchups
        where lower(winner) = lower(p_pokemon)
        group by lower(loser)
        order by total desc
        limit 5
      ) wins
    ), '[]'::jsonb),
    'toughest_opponents', coalesce((
      select jsonb_agg(jsonb_build_object('pokemon', opponent, 'losses', total) order by total desc, opponent)
      from (
        select min(winner) opponent, count(*)::integer total
        from public.daily_bracket_matchups
        where lower(loser) = lower(p_pokemon)
        group by lower(winner)
        order by total desc
        limit 5
      ) losses
    ), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_pokemon_community_ranking_totals"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with poll_answer_counts as (
    select
      p.id as poll_id,
      lower(
        regexp_replace(trim(a.answer_key), '[^a-zA-Z0-9]+', '', 'g')
      ) as pokemon_key,
      min(a.answer_key) as pokemon,
      count(*)::integer as votes
    from public.daily_polls p
    join public.daily_poll_answers a on a.poll_id = p.id
    where p.answer_type = 'pokemon'
      and p.poll_date < current_date
    group by
      p.id,
      lower(
        regexp_replace(trim(a.answer_key), '[^a-zA-Z0-9]+', '', 'g')
      )
  ),
  poll_ranked as (
    select *,
      dense_rank() over (
        partition by poll_id
        order by votes desc
      ) as place
    from poll_answer_counts
  ),
  poll_totals as (
    select
      pokemon_key,
      min(pokemon) as pokemon,
      count(*)::integer as poll_wins
    from poll_ranked
    where place = 1
    group by pokemon_key
  ),
  bracket_totals as (
    select
      lower(
        regexp_replace(pokemon, '[^a-zA-Z0-9]+', '', 'g')
      ) as pokemon_key,
      min(pokemon) as pokemon,
      count(*)::integer as bracket_championships,
      sum(championship_votes)::integer as bracket_championship_votes
    from public.get_daily_bracket_official_champions()
    group by lower(
      regexp_replace(pokemon, '[^a-zA-Z0-9]+', '', 'g')
    )
  ),
  quiz_answer_counts as (
    select
      q.id as quiz_id,
      lower(a.normalized_answer) as pokemon_key,
      min(a.display_answer) as pokemon,
      count(*)::integer as votes
    from public.daily_quizzes q
    join public.daily_quiz_answers a on a.quiz_id = q.id
    where q.quiz_date < current_date
    group by q.id, lower(a.normalized_answer)
  ),
  quiz_ranked as (
    select *,
      dense_rank() over (
        partition by quiz_id
        order by votes desc
      ) as place
    from quiz_answer_counts
  ),
  quiz_totals as (
    select
      pokemon_key,
      min(pokemon) as pokemon,
      count(*)::integer as quiz_popular_finishes
    from quiz_ranked
    where place = 1
    group by pokemon_key
  ),
  pokemon_keys as (
    select pokemon_key from poll_totals
    union
    select pokemon_key from bracket_totals
    union
    select pokemon_key from quiz_totals
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'pokemon', coalesce(
          p.pokemon,
          b.pokemon,
          q.pokemon,
          k.pokemon_key
        ),
        'pokemon_key', k.pokemon_key,
        'poll_wins', coalesce(p.poll_wins, 0),
        'bracket_championships',
          coalesce(b.bracket_championships, 0),
        'bracket_championship_votes',
          coalesce(b.bracket_championship_votes, 0),
        'quiz_popular_finishes',
          coalesce(q.quiz_popular_finishes, 0)
      )
      order by k.pokemon_key
    ),
    '[]'::jsonb
  )
  from pokemon_keys k
  left join poll_totals p using (pokemon_key)
  left join bracket_totals b using (pokemon_key)
  left join quiz_totals q using (pokemon_key);
$$;

ALTER FUNCTION "public"."get_pokemon_community_ranking_totals"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with requested as (
    select lower(
      regexp_replace(trim(p_pokemon), '[^a-zA-Z0-9]+', '', 'g')
    ) as pokemon_key
  ),
  quiz_answer_counts as (
    select
      q.id as quiz_id,
      q.quiz_date,
      q.prompt,
      min(a.display_answer) as display_answer,
      lower(a.normalized_answer) as pokemon_key,
      count(*)::integer as votes
    from public.daily_quizzes q
    join public.daily_quiz_answers a on a.quiz_id = q.id
    where q.quiz_date < current_date
    group by
      q.id,
      q.quiz_date,
      q.prompt,
      lower(a.normalized_answer)
  ),
  ranked_quiz_answers as (
    select *,
      dense_rank() over (
        partition by quiz_id
        order by votes desc
      ) as place
    from quiz_answer_counts
  ),
  popular_quiz_finishes as (
    select
      quiz_id,
      quiz_date,
      prompt,
      display_answer,
      votes
    from ranked_quiz_answers, requested
    where place = 1
      and ranked_quiz_answers.pokemon_key = requested.pokemon_key
  ),
  championships as (
    select c.*
    from public.get_daily_bracket_official_champions() c, requested
    where lower(
      regexp_replace(c.pokemon, '[^a-zA-Z0-9]+', '', 'g')
    ) = requested.pokemon_key
  )
  select jsonb_build_object(
    'pokemon', p_pokemon,
    'bracket_wins', (
      select count(*)::integer
      from public.daily_bracket_matchups
      where lower(winner) = lower(trim(p_pokemon))
    ),
    'bracket_losses', (
      select count(*)::integer
      from public.daily_bracket_matchups
      where lower(loser) = lower(trim(p_pokemon))
    ),
    'bracket_championships', (
      select count(*)::integer
      from championships
    ),
    'bracket_championship_votes', coalesce((
      select sum(championship_votes)::integer
      from championships
    ), 0),
    'most_defeated', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'pokemon', opponent,
          'wins', total
        )
        order by total desc, opponent
      )
      from (
        select
          min(loser) as opponent,
          count(*)::integer as total
        from public.daily_bracket_matchups
        where lower(winner) = lower(trim(p_pokemon))
        group by lower(loser)
        order by total desc, opponent
        limit 5
      ) wins
    ), '[]'::jsonb),
    'quiz_popular_finishes', (
      select count(*)::integer
      from popular_quiz_finishes
    ),
    'quiz_popular_days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', quiz_id,
          'date', quiz_date,
          'prompt', prompt,
          'answer', display_answer,
          'votes', votes
        )
        order by quiz_date desc
      )
      from popular_quiz_finishes
    ), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with answer_counts as (
    select p.id as poll_id, p.poll_date, p.question, a.answer_key,
      count(*)::integer as votes
    from public.daily_polls p
    join public.daily_poll_answers a on a.poll_id = p.id
    where p.answer_type = 'pokemon' and p.poll_date < current_date
    group by p.id, p.poll_date, p.question, a.answer_key
  ),
  ranked as (
    select *, dense_rank() over (partition by poll_id order by votes desc) as place
    from answer_counts
  ),
  matches as (
    select poll_id, poll_date, question, votes, place::integer
    from ranked
    where place <= 3 and lower(answer_key) = lower(trim(p_pokemon))
  )
  select jsonb_build_object(
    'first', jsonb_build_object(
      'count', count(*) filter (where place = 1),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 1), '[]'::jsonb)
    ),
    'second', jsonb_build_object(
      'count', count(*) filter (where place = 2),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 2), '[]'::jsonb)
    ),
    'third', jsonb_build_object(
      'count', count(*) filter (where place = 3),
      'polls', coalesce(jsonb_agg(jsonb_build_object('id', poll_id, 'date', poll_date, 'question', question, 'votes', votes)
        order by poll_date desc) filter (where place = 3), '[]'::jsonb)
    )
  )
  from matches;
$$;

ALTER FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_coach_profile"("p_identity" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_profile public.profiles%rowtype;
  v_identity text;
  v_wins integer := 0;
  v_losses integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view coach profiles.';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where lower(p.username) = lower(trim(p_identity))
     or lower(p.display_name) = lower(trim(p_identity))
  order by
    case
      when lower(p.username) = lower(trim(p_identity)) then 0
      else 1
    end
  limit 1;

  if v_profile.id is null then
    raise exception 'That coach profile was not found.';
  end if;

  v_identity := coalesce(
    nullif(v_profile.display_name, ''),
    v_profile.username
  );

  with current_matches as (
    select
      case
        when result.value ->> 'gamesA' ~ '^[0-9]+$'
          then (result.value ->> 'gamesA')::integer
        else 0
      end as games_a,
      case
        when result.value ->> 'gamesB' ~ '^[0-9]+$'
          then (result.value ->> 'gamesB')::integer
        else 0
      end as games_b,
      lower(coalesce(
        s.state #>> array[
          'teams',
          s.state #>> array[
            'schedule',
            split_part(result.key, '-', 1),
            split_part(result.key, '-', 2),
            '0'
          ],
          'claimedBy'
        ],
        ''
      )) = lower(v_identity) as is_a,
      lower(coalesce(
        s.state #>> array[
          'teams',
          s.state #>> array[
            'schedule',
            split_part(result.key, '-', 1),
            split_part(result.key, '-', 2),
            '1'
          ],
          'claimedBy'
        ],
        ''
      )) = lower(v_identity) as is_b
    from public.league_state_snapshots s
    join public.league_memberships m
      on m.league_id = s.league_id
     and m.user_id = v_profile.id
    cross join lateral jsonb_each(
      case
        when jsonb_typeof(s.state -> 'matchResults') = 'object'
          then s.state -> 'matchResults'
        else '{}'::jsonb
      end
    ) result
  ),
  current_record as (
    select
      count(*) filter (
        where (is_a and games_a > games_b)
           or (is_b and games_b > games_a)
      )::integer as wins,
      count(*) filter (
        where (is_a and games_a < games_b)
           or (is_b and games_b < games_a)
      )::integer as losses
    from current_matches
    where is_a or is_b
  ),
  archived_record as (
    select
      coalesce(sum(
        case
          when standing.value ->> 'w' ~ '^[0-9]+$'
            then (standing.value ->> 'w')::integer
          else 0
        end
      ), 0)::integer as wins,
      coalesce(sum(
        case
          when standing.value ->> 'l' ~ '^[0-9]+$'
            then (standing.value ->> 'l')::integer
          else 0
        end
      ), 0)::integer as losses
    from public.league_state_snapshots s
    join public.league_memberships m
      on m.league_id = s.league_id
     and m.user_id = v_profile.id
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(s.state -> 'seasonHistory') = 'array'
          then s.state -> 'seasonHistory'
        else '[]'::jsonb
      end
    ) season
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(season.value -> 'standings') = 'array'
          then season.value -> 'standings'
        else '[]'::jsonb
      end
    ) standing
    where lower(coalesce(
      season.value #>> array[
        'teams',
        standing.value ->> 'id',
        'claimedBy'
      ],
      ''
    )) = lower(v_identity)
  )
  select
    coalesce(c.wins, 0) + coalesce(a.wins, 0),
    coalesce(c.losses, 0) + coalesce(a.losses, 0)
  into v_wins, v_losses
  from current_record c
  cross join archived_record a;

  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar_url', v_profile.avatar_url,
    'favorite_pokemon',
      to_jsonb(coalesce(v_profile.favorite_pokemon, '{}'::text[])),
    'record', jsonb_build_object(
      'wins', v_wins,
      'losses', v_losses,
      'games', v_wins + v_losses,
      'win_percentage',
        case
          when v_wins + v_losses = 0 then 0
          else round(
            100.0 * v_wins / (v_wins + v_losses),
            1
          )
        end
    ),
    'badges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', c.code,
          'name', c.name,
          'description', c.description,
          'icon', c.icon,
          'subject', coalesce(progress.subject, ''),
          'tier', progress.tier
        )
        order by progress.tier desc, c.name
      )
      from public.user_badge_progress progress
      join public.badge_catalog c
        on c.code = progress.badge_code
      where progress.user_id = v_profile.id
        and progress.tier > 0
    ), '[]'::jsonb)
  );
end;
$_$;

ALTER FUNCTION "public"."get_public_coach_profile"("p_identity" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_draft_trends"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with public_leagues as (
    select id
    from public.leagues
    where league_visibility in ('watch', 'open')
      and not is_practice
  ),
  weekly as (
    select
      pc.display_name as pokemon,
      count(distinct ds.id)::integer as drafts
    from public.draft_picks dp
    join public.draft_sessions ds
      on ds.id = dp.draft_session_id
    join public_leagues eligible_league
      on eligible_league.id = ds.league_id
    join public.league_pokemon lp
      on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc
      on pc.id = lp.pokemon_id
    where dp.created_at >= now() - interval '7 days'
    group by pc.display_name
    order by drafts desc, pokemon asc
    limit 20
  ),
  season_states as (
    select
      l.id as league_id,
      s.state as season_state
    from public.leagues l
    join public.league_state_snapshots s
      on s.league_id = l.id
    where not l.is_practice

    union all

    select
      l.id,
      archived
    from public.leagues l
    join public.league_state_snapshots s
      on s.league_id = l.id
    cross join lateral jsonb_array_elements(
      coalesce(s.state -> 'seasonHistory', '[]'::jsonb)
    ) archived
    where not l.is_practice
  ),
  pokemon_match_rows as (
    select
      mon ->> 'name' as pokemon,
      side.won
    from season_states ss
    cross join lateral jsonb_each(
      coalesce(
        ss.season_state -> 'matchResults',
        '{}'::jsonb
      )
    ) result_row
    cross join lateral (
      select ss.season_state #> array[
        'schedule',
        split_part(result_row.key, '-', 1),
        split_part(result_row.key, '-', 2)
      ] as matchup
    ) scheduled
    cross join lateral (
      values
        (
          (scheduled.matchup ->> 0)::integer,
          case
            when (result_row.value ->> 'gamesA')::integer
              > (result_row.value ->> 'gamesB')::integer
            then 1
            else 0
          end
        ),
        (
          (scheduled.matchup ->> 1)::integer,
          case
            when (result_row.value ->> 'gamesB')::integer
              > (result_row.value ->> 'gamesA')::integer
            then 1
            else 0
          end
        )
    ) side(team_index, won)
    cross join lateral jsonb_array_elements(
      coalesce(
        ss.season_state -> 'rosters' -> side.team_index,
        '[]'::jsonb
      )
    ) mon
    where scheduled.matchup is not null
      and nullif(result_row.value ->> 'gamesA', '') is not null
      and nullif(result_row.value ->> 'gamesB', '') is not null
      and (result_row.value ->> 'gamesA')::integer
        <> (result_row.value ->> 'gamesB')::integer
      and nullif(mon ->> 'name', '') is not null
  ),
  win_rates as (
    select
      pokemon,
      count(*)::integer as games,
      sum(won)::integer as wins,
      round(
        100.0 * sum(won) / nullif(count(*), 0),
        1
      ) as win_rate
    from pokemon_match_rows
    group by pokemon
    having count(*) >= 2
    order by win_rate desc, games desc, pokemon asc
    limit 20
  )
  select jsonb_build_object(
    'weekly_drafted',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pokemon',
            pokemon,
            'drafts',
            drafts
          )
        )
        from weekly
      ),
      '[]'::jsonb
    ),

    'win_rates',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pokemon',
            pokemon,
            'games',
            games,
            'wins',
            wins,
            'win_rate',
            win_rate
          )
        )
        from win_rates
      ),
      '[]'::jsonb
    ),

    'partners',
    '[]'::jsonb
  );
$$;

ALTER FUNCTION "public"."get_public_draft_trends"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_explore"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with current_poll as (
    select p.*
    from public.daily_polls p
    where p.poll_date <= current_date
    order by p.poll_date desc
    limit 1
  ),
  public_leagues as (
    select
      l.id,
      l.slug,
      l.name,
      l.description,
      l.season_label,
      l.image_url,
      l.league_visibility,
      l.is_practice,
      l.draft_starts_at,
      l.updated_at
    from public.leagues l
    where l.league_visibility in ('watch', 'open')
      and (
        not l.is_practice
        or l.practice_expires_at is null
        or l.practice_expires_at > now()
      )
    order by l.updated_at desc
    limit 24
  ),
  favorite_counts as (
    select
      trim(pokemon) as pokemon,
      count(*)::integer as total
    from public.profiles pr
    cross join lateral unnest(
      coalesce(pr.favorite_pokemon, '{}'::text[])
    ) as pokemon
    where trim(pokemon) <> ''
    group by trim(pokemon)
    order by total desc, pokemon asc
    limit 24
  ),
  relational_eligible as (
    select
      ds.id as draft_session_id,
      ds.league_id,
      ds.created_at,
      lp.id as league_pokemon_id,
      lp.pokemon_id
    from public.draft_sessions ds
    join public.league_pokemon lp
      on lp.league_id = ds.league_id
    left join public.league_state_snapshots s
      on s.league_id = ds.league_id
    where ds.mode = 'snake'
      and ds.status = 'complete'
      and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
      and not exists (
        select 1
        from jsonb_array_elements(
          coalesce(s.state -> 'seasonHistory', '[]'::jsonb)
        ) archived
        where coalesce(archived ->> 'draftType', 'snake') = 'snake'
          and nullif(archived ->> 'endedAt', '') is not null
          and to_timestamp(
            (archived ->> 'endedAt')::double precision / 1000.0
          ) >= ds.created_at
      )
  ),
  relational_adp as (
    select
      pc.display_name as pokemon,
      count(dp.id)::integer as drafts,
      count(distinct re.draft_session_id)::integer as eligible_drafts,
      sum(dp.pick_number + 1)::numeric as pick_sum
    from relational_eligible re
    join public.pokemon_catalogue pc
      on pc.id = re.pokemon_id
    left join public.draft_picks dp
      on dp.draft_session_id = re.draft_session_id
      and dp.league_pokemon_id = re.league_pokemon_id
    group by pc.display_name
  ),
  archived_drafts as (
    select
      l.id as league_id,
      archived ->> 'seasonNumber' as season_number,
      pc.display_name as pokemon,
      nullif(entry ->> 'draftPick', '')::numeric + 1 as pick_number
    from public.leagues l
    join public.league_state_snapshots s
      on s.league_id = l.id
    cross join lateral jsonb_array_elements(
      coalesce(s.state -> 'seasonHistory', '[]'::jsonb)
    ) archived
    cross join lateral jsonb_array_elements(
      coalesce(archived -> 'draftLog', '[]'::jsonb)
    ) entry
    join public.pokemon_catalogue pc
      on lower(pc.display_name) = lower(entry ->> 'name')
    where coalesce(archived ->> 'draftType', 'snake') = 'snake'
      and nullif(entry ->> 'name', '') is not null
      and nullif(entry ->> 'draftPick', '') is not null
  ),
  archived_adp as (
    select
      pokemon,
      count(*)::integer as drafts,
      count(
        distinct (
          league_id::text
          || ':'
          || coalesce(season_number, 'unknown')
        )
      )::integer as eligible_drafts,
      sum(pick_number)::numeric as pick_sum
    from archived_drafts
    group by pokemon
  ),
  combined_adp as (
    select
      pokemon,
      sum(drafts)::integer as drafts,
      sum(eligible_drafts)::integer as eligible_drafts,
      round(
        sum(pick_sum) / nullif(sum(drafts), 0),
        1
      ) as average_pick
    from (
      select pokemon, drafts, eligible_drafts, pick_sum
      from relational_adp

      union all

      select pokemon, drafts, eligible_drafts, pick_sum
      from archived_adp
    ) samples
    group by pokemon
    having sum(drafts) > 0
    order by average_pick asc, drafts desc, pokemon asc
    limit 50
  )
  select jsonb_build_object(
    'signed_in',
    auth.uid() is not null,

    'poll',
    coalesce(
      (
        select jsonb_build_object(
          'id',
          p.id,

          'poll_date',
          p.poll_date,

          'question',
          p.question,

          'answer_type',
          p.answer_type,

          'options',
          p.options,

          'counts',
          case
            when auth.uid() is null then '{}'::jsonb
            else coalesce(
              (
                select jsonb_object_agg(answer_key, total)
                from (
                  select
                    a.answer_key,
                    count(*)::integer as total
                  from public.daily_poll_answers a
                  where a.poll_id = p.id
                  group by a.answer_key
                ) poll_counts
              ),
              '{}'::jsonb
            )
          end,

          'total_votes',
          (
            select count(*)::integer
            from public.daily_poll_answers a
            where a.poll_id = p.id
          ),

          'selected_key',
          case
            when auth.uid() is null then null
            else (
              select a.answer_key
              from public.daily_poll_answers a
              where a.poll_id = p.id
                and a.user_id = auth.uid()
            )
          end
        )
        from current_poll p
      ),
      'null'::jsonb
    ),

    'leagues',
    coalesce(
      (
        select jsonb_agg(to_jsonb(public_leagues))
        from public_leagues
      ),
      '[]'::jsonb
    ),

    'popularity',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pokemon',
            pokemon,
            'favorites',
            total
          )
        )
        from favorite_counts
      ),
      '[]'::jsonb
    ),

    'adp',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pokemon',
            pokemon,
            'drafts',
            drafts,
            'eligible_drafts',
            eligible_drafts,
            'average_pick',
            average_pick
          )
        )
        from combined_adp
      ),
      '[]'::jsonb
    )
  );
$$;

ALTER FUNCTION "public"."get_public_explore"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_league"("p_slug" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with league_row as (
    select id, slug, name, description, season_label, image_url, league_visibility, draft_starts_at, updated_at
    from public.leagues
    where slug = p_slug and league_visibility in ('watch', 'open')
  ), snapshot as (
    select jsonb_build_object(
      'settings', jsonb_build_object(
        'calendarMode', s.state #> '{settings,calendarMode}',
        'seasonStartsAt', s.state #> '{settings,seasonStartsAt}',
        'leagueTimeZone', s.state #> '{settings,leagueTimeZone}',
        'matchDayOfWeek', s.state #> '{settings,matchDayOfWeek}',
        'matchTime', s.state #> '{settings,matchTime}',
        'claimDayOfWeek', s.state #> '{settings,claimDayOfWeek}',
        'claimTime', s.state #> '{settings,claimTime}',
        'regulationId', s.state #> '{settings,regulationId}'
      ),
      'teams', coalesce(s.state -> 'teams', '[]'::jsonb),
      'rosters', coalesce(s.state -> 'rosters', '[]'::jsonb),
      'schedule', coalesce(s.state -> 'schedule', '[]'::jsonb),
      'matchResults', coalesce(s.state -> 'matchResults', '{}'::jsonb),
      'playoffs', s.state -> 'playoffs',
      'seasonNumber', coalesce(s.state -> 'seasonNumber', '1'::jsonb)
    ) as state
    from public.league_state_snapshots s
    join league_row l on l.id = s.league_id
  )
  select jsonb_build_object(
    'league', (select to_jsonb(league_row) from league_row),
    'state', (select state from snapshot),
    'draft', (
      select jsonb_build_object(
        'status', ds.status,
        'current_pick_number', ds.current_pick_number
      )
      from public.draft_sessions ds
      join league_row l on l.id = ds.league_id
      order by ds.created_at desc
      limit 1
    ),
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pick_number', dp.pick_number,
        'round_number', dp.round_number,
        'pokemon', pc.display_name,
        'team', t.name
      ) order by dp.pick_number)
      from public.draft_picks dp
      join public.draft_sessions ds on ds.id = dp.draft_session_id
      join league_row l on l.id = ds.league_id
      join public.teams t on t.id = dp.team_id
      join public.league_pokemon lp on lp.id = dp.league_pokemon_id
      join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    ), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_public_league"("p_slug" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_league_cards"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(card) order by card.updated_at desc), '[]'::jsonb)
  from (
    select l.id, l.name, l.slug, l.description, l.image_url, l.season_label, l.status,
      l.draft_starts_at, l.league_visibility, l.is_practice, l.updated_at,
      coalesce((
        select count(*)::integer
        from jsonb_array_elements(coalesce(s.state -> 'teams', '[]'::jsonb)) as team
        where nullif(trim(team ->> 'claimedBy'), '') is not null
      ), 0) as filled_spots,
      coalesce(
        nullif(s.state #>> '{settings,leagueSize}', '')::integer,
        jsonb_array_length(coalesce(s.state -> 'teams', '[]'::jsonb))
      ) as total_spots,
      coalesce(nullif(s.state #>> '{settings,draftType}', ''), 'snake') as draft_type,
      nullif(s.state #>> '{settings,rosterMin}', '')::integer as roster_min,
      nullif(s.state #>> '{settings,rosterMax}', '')::integer as roster_max,
      nullif(s.state #>> '{settings,budget}', '')::integer as draft_budget,
      nullif(s.state #>> '{settings,pickTimeLimitMinutes}', '')::integer as pick_minutes,
      coalesce((s.state #>> '{settings,keepersEnabled}')::boolean, false) as keepers_enabled,
      nullif(s.state #>> '{settings,maxKeepers}', '')::integer as max_keepers,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id,
      coalesce((s.state ->> 'locked')::boolean, false) as draft_started,
      jsonb_build_object(
        'seasonNumber', coalesce(s.state -> 'seasonNumber', '1'::jsonb),
        'week', coalesce(s.state -> 'week', '0'::jsonb),
        'settings', jsonb_build_object(
          'calendarMode', coalesce(s.state #> '{settings,calendarMode}', '"untimed"'::jsonb),
          'seasonStartsAt', s.state #> '{settings,seasonStartsAt}',
          'leagueTimeZone', coalesce(s.state #> '{settings,leagueTimeZone}', '"UTC"'::jsonb),
          'matchDayOfWeek', coalesce(s.state #> '{settings,matchDayOfWeek}', '6'::jsonb),
          'matchTime', coalesce(s.state #> '{settings,matchTime}', '"19:00"'::jsonb),
          'claimDayOfWeek', coalesce(s.state #> '{settings,claimDayOfWeek}', '3'::jsonb),
          'claimTime', coalesce(s.state #> '{settings,claimTime}', '"20:00"'::jsonb)
        ),
        'teams', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', team.ordinality - 1,
            'name', team.value ->> 'name',
            'logoUrl', team.value ->> 'logoUrl',
            'color', team.value ->> 'color'
          ) order by team.ordinality)
          from jsonb_array_elements(coalesce(s.state -> 'teams', '[]'::jsonb))
            with ordinality as team(value, ordinality)
        ), '[]'::jsonb),
        'schedule', coalesce(s.state -> 'schedule', '[]'::jsonb),
        'matchResults', coalesce(s.state -> 'matchResults', '{}'::jsonb)
      ) as public_state
    from public.leagues l
    left join public.league_state_snapshots s on s.league_id = l.id
    where l.league_visibility in ('open', 'watch')
      and (not l.is_practice or l.practice_expires_at is null or l.practice_expires_at > now())
    order by l.updated_at desc
    limit 100
  ) card;
$$;

ALTER FUNCTION "public"."get_public_league_cards"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_live_streams"("p_limit" integer DEFAULT 12) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      to_jsonb(rows)
      order by rows.sort_order,
               rows.starts_at nulls last,
               rows.updated_at desc
    ),
    '[]'::jsonb
  )
  from (
    select
      s.id,
      s.league_id,
      s.match_key,
      s.title,
      s.platform,
      s.stream_url,
      s.starts_at,
      s.status,
      s.updated_at,
      l.name as league_name,
      l.slug as league_slug,
      l.image_url as league_image,
      case s.status when 'live' then 0 else 1 end as sort_order
    from public.league_live_streams s
    join public.leagues l on l.id = s.league_id
    where s.visibility = 'public'
      and s.status in ('live', 'scheduled')
      and l.league_visibility in ('open', 'watch')
      and (
        s.status = 'live'
        or s.starts_at is null
        or s.starts_at > now() - interval '2 hours'
      )
    order by sort_order, s.starts_at nulls last, s.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  ) rows;
$$;

ALTER FUNCTION "public"."get_public_live_streams"("p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_market_trends"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ),
  pick_windows as (
    select pc.display_name as pokemon,
      count(*) filter (where dp.created_at >= now() - interval '7 days')::integer as current_drafts,
      count(*) filter (
        where dp.created_at >= now() - interval '14 days'
          and dp.created_at < now() - interval '7 days'
      )::integer as previous_drafts
    from public.draft_picks dp
    join public.draft_sessions ds on ds.id = dp.draft_session_id
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.id = dp.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where dp.created_at >= now() - interval '14 days'
    group by pc.display_name
  ),
  risers as (
    select pokemon, current_drafts, previous_drafts,
      current_drafts - previous_drafts as change
    from pick_windows
    where current_drafts - previous_drafts > 0
    order by change desc, current_drafts desc, pokemon asc
    limit 10
  ),
  fallers as (
    select pokemon, current_drafts, previous_drafts,
      current_drafts - previous_drafts as change
    from pick_windows
    where current_drafts - previous_drafts < 0
    order by change asc, previous_drafts desc, pokemon asc
    limit 10
  ),
  auction_rosters as (
    select distinct re.team_id, pc.display_name as pokemon, dp.price
    from public.roster_entries re
    join public.teams t on t.id = re.team_id
    join eligible_leagues el on el.id = t.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    join public.draft_picks dp
      on dp.team_id = re.team_id and dp.league_pokemon_id = re.league_pokemon_id
    join public.draft_sessions ds on ds.id = dp.draft_session_id and ds.mode = 'auction'
    where re.released_at is null and dp.price is not null
  ),
  team_matches as (
    select m.home_team_id as team_id, (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
    union all
    select m.away_team_id as team_id, (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
  ),
  busts as (
    select ar.pokemon, round(avg(ar.price), 1) as average_cost,
      count(tm.team_id)::integer as games, sum(tm.won)::integer as wins,
      round(100.0 * sum(tm.won) / nullif(count(tm.team_id), 0), 1) as win_rate,
      round(avg(ar.price) * (1 - sum(tm.won)::numeric / nullif(count(tm.team_id), 0)), 2) as bust_score
    from auction_rosters ar
    join team_matches tm on tm.team_id = ar.team_id
    group by ar.pokemon
    having count(tm.team_id) >= 2
    order by bust_score desc, average_cost desc, games desc
    limit 10
  )
  select jsonb_build_object(
    'risers', coalesce((select jsonb_agg(to_jsonb(risers)) from risers), '[]'::jsonb),
    'fallers', coalesce((select jsonb_agg(to_jsonb(fallers)) from fallers), '[]'::jsonb),
    'busts', coalesce((select jsonb_agg(to_jsonb(busts)) from busts), '[]'::jsonb)
  );
$$;

ALTER FUNCTION "public"."get_public_market_trends"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with eligible_leagues as (
    select id from public.leagues
    where league_visibility in ('watch', 'open') and not is_practice
  ),
  target as (
    select id, display_name
    from public.pokemon_catalogue
    where lower(display_name) = lower(trim(p_pokemon))
    limit 1
  ),
  eligible_sessions as (
    select ds.id, ds.mode, ds.league_id, lp.id as league_pokemon_id,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id
    from public.draft_sessions ds
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.league_id = ds.league_id
    join target t on t.id = lp.pokemon_id
    left join public.league_state_snapshots s on s.league_id = ds.league_id
    where ds.status = 'complete'
      and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
  ),
  target_picks as (
    select dp.*, es.mode, es.league_id, es.regulation_id
    from eligible_sessions es
    join public.draft_picks dp
      on dp.draft_session_id = es.id
      and dp.league_pokemon_id = es.league_pokemon_id
  ),
  draft_summary as (
    select
      (select count(*)::integer from eligible_sessions where mode = 'snake') as eligible_drafts,
      count(distinct draft_session_id) filter (where mode = 'snake')::integer as drafted_in,
      round((avg(pick_number + 1) filter (where mode = 'snake'))::numeric, 1) as average_pick,
      round((avg(price) filter (where mode = 'auction' and price is not null))::numeric, 1) as average_auction_price,
      count(*) filter (where mode = 'auction' and price is not null)::integer as auction_samples
    from target_picks
  ),
  format_adp as (
    select es.regulation_id,
      count(*)::integer as eligible_drafts,
      count(distinct tp.draft_session_id)::integer as drafted_in,
      round(avg(tp.pick_number + 1)::numeric, 1) as average_pick
    from eligible_sessions es
    left join target_picks tp on tp.draft_session_id = es.id
    where es.mode = 'snake'
    group by es.regulation_id
  ),
  target_teams as (
    select distinct re.team_id
    from public.roster_entries re
    join public.teams team on team.id = re.team_id
    join eligible_leagues el on el.id = team.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join target t on t.id = lp.pokemon_id
    where re.released_at is null
  ),
  team_matches as (
    select m.home_team_id as team_id,
      (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m
    join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed'
      and m.winner_team_id is not null

    union all

    select m.away_team_id as team_id,
      (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m
    join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed'
      and m.winner_team_id is not null
  ),
  performance as (
    select count(tm.team_id)::integer as games,
      coalesce(sum(tm.won), 0)::integer as wins,
      round(
        100.0 * sum(tm.won) / nullif(count(tm.team_id), 0),
        1
      ) as win_rate
    from target_teams tt
    left join team_matches tm on tm.team_id = tt.team_id
  ),
  partners as (
    select pc.display_name as pokemon,
      count(distinct re.team_id)::integer as teams
    from target_teams tt
    join public.roster_entries re
      on re.team_id = tt.team_id
      and re.released_at is null
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where not exists (
      select 1 from target t where t.id = pc.id
    )
    group by pc.display_name
    order by teams desc, pokemon asc
    limit 10
  ),
  usage_weeks as (
    select date_trunc('week', dp.created_at)::date as week,
      count(*)::integer as picks
    from target_picks dp
    where dp.created_at >= date_trunc('week', now()) - interval '11 weeks'
    group by date_trunc('week', dp.created_at)::date
  )
  select jsonb_build_object(
    'pokemon', (select display_name from target),
    'eligible_drafts', ds.eligible_drafts,
    'drafted_in', ds.drafted_in,
    'draft_rate', round(
      100.0 * ds.drafted_in / nullif(ds.eligible_drafts, 0),
      1
    ),
    'average_pick', ds.average_pick,
    'adp_by_format', coalesce((
      select jsonb_agg(
        to_jsonb(format_adp)
        order by regulation_id
      )
      from format_adp
    ), '[]'::jsonb),
    'average_auction_price', ds.average_auction_price,
    'auction_samples', ds.auction_samples,
    'games', perf.games,
    'wins', perf.wins,
    'win_rate', perf.win_rate,
    'partners', coalesce((
      select jsonb_agg(to_jsonb(partners))
      from partners
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(
        to_jsonb(usage_weeks)
        order by week
      )
      from usage_weeks
    ), '[]'::jsonb)
  )
  from draft_summary ds
  cross join performance perf;
$$;

ALTER FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_public_poll_history"("p_limit" integer DEFAULT 12) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'poll_date', p.poll_date, 'question', p.question,
    'answer_type', p.answer_type, 'options', p.options,
    'counts', coalesce((
      select jsonb_object_agg(answer_key, total) from (
        select a.answer_key, count(*)::integer as total
        from public.daily_poll_answers a where a.poll_id = p.id group by a.answer_key
      ) result_counts
    ), '{}'::jsonb),
    'total_votes', (select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id)
  ) order by p.poll_date desc), '[]'::jsonb)
  from (
    select * from public.daily_polls
    where poll_date < current_date
    order by poll_date desc
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  ) p;
$$;

ALTER FUNCTION "public"."get_public_poll_history"("p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Coach'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."initialize_league_setup_if_empty"("p_league_id" "uuid", "p_state" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_incoming jsonb := p_state;
  v_team_count integer;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can initialize league setup.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League setup was not found.';
  end if;

  -- Idempotent and overwrite-safe: once the server has teams, the caller's
  -- fallback payload is ignored and the authoritative state is returned.
  if jsonb_typeof(v_existing -> 'teams') = 'array'
     and jsonb_array_length(v_existing -> 'teams') > 0 then
    return v_existing;
  end if;

  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array' then
    raise exception 'The initial league setup is incomplete.';
  end if;
  v_team_count := jsonb_array_length(p_state -> 'teams');
  if v_team_count < 2 or v_team_count > 16 then
    raise exception 'A league must start with 2 to 16 teams.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'teams') team(value)
    where jsonb_typeof(team.value) <> 'object'
      or nullif(btrim(team.value ->> 'name'), '') is null
  ) then
    raise exception 'Every initial team needs a name.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_state -> 'teams') team(value)
    group by lower(btrim(team.value ->> 'name'))
    having count(*) > 1
  ) then
    raise exception 'Initial team names must be unique.';
  end if;
  if coalesce((p_state ->> 'locked')::boolean, false)
     or jsonb_array_length(coalesce(p_state -> 'rosters', '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(p_state -> 'schedule', '[]'::jsonb)) > 0
     or coalesce(p_state -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb
     or jsonb_array_length(coalesce(p_state -> 'seasonHistory', '[]'::jsonb)) > 0 then
    raise exception 'Only a brand-new empty league can be initialized.';
  end if;

  v_incoming := jsonb_set(
    v_incoming,
    '{rev}',
    to_jsonb(coalesce((v_existing ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_incoming,
      revision = coalesce(v_existing_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  update public.leagues
  set settings = coalesce(v_incoming -> 'settings', '{}'::jsonb),
      updated_at = now()
  where id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'league_setup_initialized',
    auth.uid(),
    jsonb_build_object('team_count', v_team_count)
  );
  return v_incoming;
end;
$$;

ALTER FUNCTION "public"."initialize_league_setup_if_empty"("p_league_id" "uuid", "p_state" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_league_member"("target_league" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.league_memberships
    where league_id = target_league and user_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."is_league_member"("target_league" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_league_staff"("target_league" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.league_memberships
    where league_id = target_league and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner')
  );
$$;

ALTER FUNCTION "public"."is_league_staff"("target_league" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."join_open_league"("p_slug" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a league.'; end if;
  select id into v_league_id from public.leagues where slug = p_slug and league_visibility = 'open';
  if v_league_id is null then raise exception 'That open league was not found.'; end if;
  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'coach') on conflict (league_id, user_id) do nothing;
  return v_league_id;
end;
$$;

ALTER FUNCTION "public"."join_open_league"("p_slug" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."join_public_league"("p_slug" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select id into v_league_id
  from public.leagues
  where slug = p_slug and is_public = true;

  if v_league_id is null then
    raise exception 'That public league was not found.';
  end if;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'viewer')
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;

ALTER FUNCTION "public"."join_public_league"("p_slug" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."league_actor_can_control_snapshot_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_claimed_by text;
  v_display_name text;
  v_username text;
begin
  if public.is_league_staff(p_league_id) then
    return true;
  end if;
  if auth.uid() is null
     or not public.is_league_member(p_league_id)
     or p_team_index is null
     or p_team_index < 0
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(p_state -> 'teams') then
    return false;
  end if;

  if exists (
    select 1
    from public.teams t
    join public.league_memberships membership
      on membership.id = t.owner_membership_id
    where t.league_id = p_league_id
      and t.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select display_name, username
  into v_display_name, v_username
  from public.profiles
  where id = auth.uid();

  v_claimed_by := nullif(
    btrim(p_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$$;

ALTER FUNCTION "public"."league_actor_can_control_snapshot_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your draft queue.';
  end if;
  if p_team_index < 0 then
    raise exception 'Choose a valid team.';
  end if;
  if not exists (
    select 1
    from public.teams team
    join public.league_memberships membership
      on membership.id = team.owner_membership_id
    where team.league_id = p_league_id
      and team.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    raise exception 'You can only view your own team queue.';
  end if;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$$;

ALTER FUNCTION "public"."list_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_private_free_agent_claims"("p_league_id" "uuid") RETURNS TABLE("id" "uuid", "team_index" integer, "add_name" "text", "drop_name" "text", "bid_amount" integer, "week" integer, "submitted_at" timestamp with time zone, "can_withdraw" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_staff boolean;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id;
  v_staff := public.is_league_staff(p_league_id);

  return query
  select
    c.id,
    c.team_index,
    c.add_name,
    c.drop_name,
    case
      when v_staff
        or public.league_actor_can_control_snapshot_team(
          p_league_id, v_state, c.team_index
        )
      then c.bid_amount
      else null
    end,
    c.week,
    c.submitted_at,
    v_staff
      or public.league_actor_can_control_snapshot_team(
        p_league_id, v_state, c.team_index
      )
  from public.league_free_agent_claims c
  where c.league_id = p_league_id
  order by c.submitted_at, c.id;
end;
$$;

ALTER FUNCTION "public"."list_private_free_agent_claims"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."make_snake_pick"("p_draft_session_id" "uuid", "p_league_pokemon_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_league uuid;
  v_team uuid;
  v_pick integer;
  v_config jsonb;
  v_order jsonb;
  v_total integer;
  v_next_team uuid;
  v_candidate uuid;
  v_pokemon public.league_pokemon;
  v_pick_id uuid;
  v_settings jsonb;
  v_budget_enabled boolean;
  v_budget numeric;
  v_spent numeric;
  v_cost numeric;
  v_roster_max integer;
  v_roster_count integer;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
  v_scan integer;
  v_can_pick boolean;
  v_state jsonb;
  v_team_index integer;
  v_snapshot_mon jsonb;
  v_snapshot_rosters jsonb;
  v_snapshot_roster jsonb;
  v_snapshot_budgets jsonb;
  v_snapshot_pool jsonb;
begin
  select league_id, current_team_id, current_pick_number, configuration
  into v_league, v_team, v_pick, v_config
  from public.draft_sessions
  where id = p_draft_session_id
    and status = 'active'
    and mode = 'snake'
  for update;
  if v_league is null then
    raise exception 'No active snake draft found.';
  end if;
  if not public.is_league_staff(v_league)
     and not exists (
       select 1
       from public.teams t
       join public.league_memberships membership
         on membership.id = t.owner_membership_id
       where t.id = v_team
         and membership.user_id = auth.uid()
     ) then
    raise exception 'It is not your team''s turn.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = v_league
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  select settings into v_settings
  from public.leagues
  where id = v_league;
  v_budget_enabled := coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  );
  v_budget := greatest(
    0,
    coalesce((v_settings ->> 'budget')::numeric, 0)
  );
  v_roster_max := greatest(
    1,
    coalesce((v_settings ->> 'rosterMax')::integer, 1)
  );
  v_restricted_cap := case
    when jsonb_typeof(v_settings -> 'restrictedCap') = 'number'
      then (v_settings ->> 'restrictedCap')::integer
    else null
  end;
  v_mega_cap := case
    when jsonb_typeof(v_settings -> 'megaCap') = 'number'
      then (v_settings ->> 'megaCap')::integer
    else null
  end;

  select * into v_pokemon
  from public.league_pokemon
  where id = p_league_pokemon_id
    and league_id = v_league
  for update;
  if v_pokemon.id is null
     or not v_pokemon.is_allowed
     or v_pokemon.is_drafted then
    raise exception 'That Pokemon is no longer available.';
  end if;
  v_cost := coalesce(v_pokemon.cost, 0);
  select
    count(*),
    count(*) filter (where lp.is_restricted),
    count(*) filter (where lp.is_mega),
    coalesce(sum(lp.cost), 0)
  into
    v_roster_count,
    v_restricted_count,
    v_mega_count,
    v_spent
  from public.roster_entries entry
  join public.league_pokemon lp
    on lp.id = entry.league_pokemon_id
  where entry.team_id = v_team
    and entry.released_at is null;

  if v_roster_count >= v_roster_max then
    raise exception 'That roster is full.';
  end if;
  if v_pokemon.is_restricted
     and v_restricted_cap is not null
     and v_restricted_count >= v_restricted_cap then
    raise exception 'That team has reached its restricted Pokemon limit.';
  end if;
  if v_pokemon.is_mega
     and v_mega_cap is not null
     and v_mega_count >= v_mega_cap then
    raise exception 'That team has reached its Mega Pokemon limit.';
  end if;
  if v_budget_enabled and v_cost > v_budget - v_spent then
    raise exception 'That Pokemon costs more than this team''s remaining budget.';
  end if;

  update public.league_pokemon
  set is_drafted = true
  where id = p_league_pokemon_id;
  insert into public.draft_picks(
    draft_session_id,
    team_id,
    league_pokemon_id,
    pick_number,
    made_by
  )
  values (
    p_draft_session_id,
    v_team,
    p_league_pokemon_id,
    v_pick,
    auth.uid()
  )
  returning id into v_pick_id;
  insert into public.roster_entries(
    team_id,
    league_pokemon_id,
    acquisition_type
  )
  values (v_team, p_league_pokemon_id, 'draft');

  v_order := v_config -> 'team_order';
  v_total := jsonb_array_length(v_order);
  v_scan := v_pick + 1;
  v_next_team := null;
  while v_scan < v_total loop
    v_candidate := (v_order ->> v_scan)::uuid;
    select
      count(*),
      count(*) filter (where lp.is_restricted),
      count(*) filter (where lp.is_mega),
      coalesce(sum(lp.cost), 0)
    into
      v_roster_count,
      v_restricted_count,
      v_mega_count,
      v_spent
    from public.roster_entries entry
    join public.league_pokemon lp
      on lp.id = entry.league_pokemon_id
    where entry.team_id = v_candidate
      and entry.released_at is null;

    v_can_pick := v_roster_count < v_roster_max
      and exists (
        select 1
        from public.league_pokemon available
        where available.league_id = v_league
          and available.is_allowed
          and not available.is_drafted
          and (
            not v_budget_enabled
            or coalesce(available.cost, 0) <= v_budget - v_spent
          )
          and (
            not available.is_restricted
            or v_restricted_cap is null
            or v_restricted_count < v_restricted_cap
          )
          and (
            not available.is_mega
            or v_mega_cap is null
            or v_mega_count < v_mega_cap
          )
      );
    if v_can_pick then
      v_next_team := v_candidate;
      exit;
    end if;
    v_scan := v_scan + 1;
  end loop;

  if v_next_team is null then
    update public.draft_sessions
    set status = 'complete',
        current_pick_number = v_scan,
        current_team_id = null,
        updated_at = now()
    where id = p_draft_session_id;
  else
    update public.draft_sessions
    set current_pick_number = v_scan,
        current_team_id = v_next_team,
        updated_at = now()
    where id = p_draft_session_id;
  end if;

  select source_key::integer
  into v_team_index
  from public.teams
  where id = v_team;
  if v_team_index is null then
    raise exception 'The active team is not mapped to the league snapshot.';
  end if;

  if jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
    select mon.value
    into v_snapshot_mon
    from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
    limit 1;
  end if;
  if v_snapshot_mon is null then
    select mon.value
    into v_snapshot_mon
    from jsonb_array_elements(
      coalesce(v_state -> 'pool', '[]'::jsonb)
    ) mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
    limit 1;
  end if;
  if v_snapshot_mon is null then
    raise exception 'The selected Pokemon is missing from the league snapshot.';
  end if;

  v_snapshot_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  if jsonb_typeof(v_snapshot_rosters) <> 'array'
     or v_team_index >= jsonb_array_length(v_snapshot_rosters) then
    raise exception 'The league snapshot roster map is invalid.';
  end if;
  v_snapshot_roster := coalesce(
    v_snapshot_rosters -> v_team_index,
    '[]'::jsonb
  );
  v_snapshot_roster := v_snapshot_roster || jsonb_build_array(
    jsonb_set(
      jsonb_set(
        v_snapshot_mon,
        '{draftPick}',
        to_jsonb(v_pick),
        true
      ),
      '{acquiredVia}',
      to_jsonb('draft'::text),
      true
    )
  );
  v_snapshot_rosters := jsonb_set(
    v_snapshot_rosters,
    array[v_team_index::text],
    v_snapshot_roster,
    false
  );
  v_state := jsonb_set(v_state, '{rosters}', v_snapshot_rosters, true);

  if v_budget_enabled then
    v_snapshot_budgets := coalesce(v_state -> 'budgets', '[]'::jsonb);
    if jsonb_typeof(v_snapshot_budgets) <> 'array'
       or v_team_index >= jsonb_array_length(v_snapshot_budgets) then
      raise exception 'The league snapshot budget map is invalid.';
    end if;
    v_snapshot_budgets := jsonb_set(
      v_snapshot_budgets,
      array[v_team_index::text],
      to_jsonb(
        greatest(
          0,
          coalesce((v_snapshot_budgets ->> v_team_index)::numeric, 0)
            - v_cost
        )
      ),
      false
    );
    v_state := jsonb_set(v_state, '{budgets}', v_snapshot_budgets, true);
  end if;

  select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
  into v_snapshot_pool
  from jsonb_array_elements(
    coalesce(v_state -> 'pool', '[]'::jsonb)
  ) with ordinality mon(value, ordinality)
  where mon.value ->> 'id' <> v_pokemon.source_key;
  v_state := jsonb_set(v_state, '{pool}', v_snapshot_pool, true);
  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_scan), true);
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    case
      when v_next_team is null
        or coalesce((v_settings ->> 'pickTimeLimitMinutes')::integer, 0) <= 0
        then 'null'::jsonb
      else to_jsonb(
        floor(extract(epoch from clock_timestamp()) * 1000)::bigint
          + (v_settings ->> 'pickTimeLimitMinutes')::integer * 60000
      )
    end,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    v_league,
    'draft_pick',
    auth.uid(),
    jsonb_build_object(
      'draft_pick_id', v_pick_id,
      'team_id', v_team,
      'league_pokemon_id', p_league_pokemon_id,
      'pick_number', v_pick
    )
  );
  return v_pick_id;
end;
$$;

ALTER FUNCTION "public"."make_snake_pick"("p_draft_session_id" "uuid", "p_league_pokemon_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mark_badge_events_seen"("p_event_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
update public.badge_award_events set seen_at=now() where user_id=auth.uid() and id=any(p_event_ids); $$;

ALTER FUNCTION "public"."mark_badge_events_seen"("p_event_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mutate_league_communication"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role public.membership_role;
  v_name text;
  v_state jsonb;
  v_messages jsonb;
  v_receipts jsonb;
  v_board jsonb;
  v_direct jsonb;
  v_key text;
  v_other text;
  v_text text;
  v_id text;
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_revision bigint;
begin
  select role into v_role
  from public.league_memberships
  where league_id = p_league_id and user_id = auth.uid();
  if v_role is null or v_role::text = 'viewer' then
    raise exception 'Spectators cannot use league messages.';
  end if;
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Coach')
    into v_name from public.profiles where id = auth.uid();
  select state into v_state from public.league_state_snapshots
    where league_id = p_league_id for update;
  if v_state is null then raise exception 'League state was not found.'; end if;
  v_messages := coalesce(v_state -> 'messages', '{"board":[],"direct":{}}'::jsonb);
  v_receipts := coalesce(v_state -> 'readReceipts', '{}'::jsonb);
  v_board := coalesce(v_messages -> 'board', '[]'::jsonb);
  v_direct := coalesce(v_messages -> 'direct', '{}'::jsonb);

  if p_action = 'board_post' then
    v_text := trim(p_payload ->> 'text');
    if char_length(v_text) not between 1 and 1000 then raise exception 'Enter a message up to 1,000 characters.'; end if;
    v_id := gen_random_uuid()::text;
    v_board := v_board || jsonb_build_array(jsonb_build_object('id', v_id, 'author', v_name, 'text', v_text, 'ts', v_now));
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'board_delete' then
    v_id := p_payload ->> 'id';
    if v_role::text not in ('commissioner', 'co_commissioner') and not exists (
      select 1 from jsonb_array_elements(v_board) m where m ->> 'id' = v_id and m ->> 'author' = v_name
    ) then raise exception 'You cannot delete that post.'; end if;
    select coalesce(jsonb_agg(m), '[]'::jsonb) into v_board from jsonb_array_elements(v_board) m where m ->> 'id' <> v_id;
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'direct_send' then
    v_other := trim(p_payload ->> 'to');
    v_text := trim(p_payload ->> 'text');
    if v_other = '' or char_length(v_text) not between 1 and 1000 then raise exception 'Choose a manager and enter a message.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_direct := jsonb_set(v_direct, array[v_key],
      coalesce(v_direct -> v_key, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('from', v_name, 'text', v_text, 'ts', v_now)), true);
    v_messages := jsonb_set(v_messages, '{direct}', v_direct, true);
  elsif p_action = 'board_read' then
    v_receipts := jsonb_set(v_receipts, array[v_name],
      coalesce(v_receipts -> v_name, '{}'::jsonb) || jsonb_build_object('board', v_now), true);
  elsif p_action = 'direct_read' then
    v_other := trim(p_payload ->> 'other');
    if v_other = '' then raise exception 'Choose a message thread.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_receipts := jsonb_set(v_receipts, array[v_name],
      jsonb_set(
        coalesce(v_receipts -> v_name, '{}'::jsonb),
        '{direct}',
        jsonb_set(coalesce(v_receipts #> array[v_name, 'direct'], '{}'::jsonb), array[v_key], to_jsonb(v_now), true),
        true
      ),
      true
    );
  else
    raise exception 'Unknown communication action.';
  end if;

  v_state := jsonb_set(jsonb_set(v_state, '{messages}', v_messages, true), '{readReceipts}', v_receipts, true);
  update public.league_state_snapshots
    set state = v_state, revision = revision + 1, updated_at = now()
    where league_id = p_league_id
    returning revision into v_revision;
  return jsonb_build_object('state', v_state, 'revision', v_revision);
end;
$$;

ALTER FUNCTION "public"."mutate_league_communication"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mutate_league_team_preference"("p_league_id" "uuid", "p_action" "text", "p_team_index" integer, "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_state jsonb;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_teams jsonb;
  v_team jsonb;
  v_team_count integer;
  v_value text;
  v_current jsonb;
  v_next jsonb;
  v_roster jsonb;
  v_max_keepers integer;
  v_identity text;
  v_member_role text;
  v_event_payload jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'The preference request is invalid.';
  end if;

  select role::text
  into v_member_role
  from public.league_memberships
  where league_id = p_league_id
    and user_id = auth.uid();
  if coalesce(v_member_role, '') = 'viewer' then
    raise exception 'Spectators cannot change team preferences.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_teams := coalesce(v_state -> 'teams', '[]'::jsonb);
  if jsonb_typeof(v_teams) <> 'array' then
    raise exception 'League team data is invalid.';
  end if;
  v_team_count := jsonb_array_length(v_teams);
  if p_team_index is null
     or p_team_index < 0
     or p_team_index >= v_team_count then
    raise exception 'Choose a valid team.';
  end if;

  if v_action = 'draft_hero_vote' then
    select coalesce(nullif(display_name, ''), nullif(username, ''), 'League member')
    into v_identity
    from public.profiles
    where id = auth.uid();
    if v_identity is null then
      raise exception 'Your profile identity was not found.';
    end if;
    if jsonb_typeof(v_state -> 'draftHeroVotes') <> 'object' then
      v_state := jsonb_set(v_state, '{draftHeroVotes}', '{}'::jsonb, true);
    end if;
    v_state := jsonb_set(
      v_state,
      array['draftHeroVotes', v_identity],
      to_jsonb(p_team_index),
      true
    );
    v_event_payload := jsonb_build_object('team_index', p_team_index);
  else
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      p_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can make this change.';
    end if;

    v_team := v_teams -> p_team_index;
    if v_action = 'toggle_auto_draft' then
      v_team := jsonb_set(
        v_team,
        '{autoDraft}',
        to_jsonb(not coalesce((v_team ->> 'autoDraft')::boolean, false)),
        true
      );

    elsif v_action = 'toggle_archetype' then
      v_value := nullif(btrim(p_payload ->> 'key'), '');
      if v_value is null or length(v_value) > 40 then
        raise exception 'Choose a valid draft strategy.';
      end if;
      v_current := coalesce(v_team -> 'archetypes', '[]'::jsonb);
      if jsonb_typeof(v_current) <> 'array' then
        v_current := '[]'::jsonb;
      end if;
      if exists (
        select 1
        from jsonb_array_elements_text(v_current) item(value)
        where item.value = v_value
      ) then
        select coalesce(jsonb_agg(to_jsonb(item.value)), '[]'::jsonb)
        into v_next
        from jsonb_array_elements_text(v_current) item(value)
        where item.value <> v_value;
      elsif jsonb_array_length(v_current) < 2 then
        v_next := v_current || jsonb_build_array(v_value);
      else
        raise exception 'A team can use at most two draft strategies.';
      end if;
      v_team := jsonb_set(v_team, '{archetypes}', v_next, true);

    elsif v_action = 'keeper_selection' then
      v_next := coalesce(p_payload -> 'names', '[]'::jsonb);
      if jsonb_typeof(v_next) <> 'array' then
        raise exception 'Keeper selections must be a list.';
      end if;
      if not coalesce(
        (v_state #>> '{settings,keepersEnabled}')::boolean,
        false
      ) then
        raise exception 'Keepers are not enabled for this league.';
      end if;
      v_max_keepers := greatest(
        0,
        coalesce((v_state #>> '{settings,maxKeepers}')::integer, 0)
      );
      if jsonb_array_length(v_next) > v_max_keepers then
        raise exception 'That team selected too many keepers.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements_text(v_next) keeper(name)
        group by lower(keeper.name)
        having count(*) > 1
      ) then
        raise exception 'A keeper cannot be selected twice.';
      end if;
      v_roster := coalesce(
        v_state #> array['rosters', p_team_index::text],
        '[]'::jsonb
      );
      if exists (
        select 1
        from jsonb_array_elements_text(v_next) keeper(name)
        where not exists (
          select 1
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(keeper.name)
        )
      ) then
        raise exception 'Every keeper must still be on that team''s roster.';
      end if;
      if jsonb_typeof(v_state -> 'keeperSelections') <> 'object' then
        v_state := jsonb_set(v_state, '{keeperSelections}', '{}'::jsonb, true);
      end if;
      v_state := jsonb_set(
        v_state,
        array['keeperSelections', p_team_index::text],
        v_next,
        true
      );

    elsif v_action = 'rename' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is null or length(v_value) > 80 then
        raise exception 'Team names must be between 1 and 80 characters.';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(v_teams) with ordinality other(value, ordinality)
        where other.ordinality - 1 <> p_team_index
          and lower(btrim(coalesce(other.value ->> 'name', ''))) = lower(v_value)
      ) then
        raise exception 'Every team needs a unique name.';
      end if;
      v_team := jsonb_set(v_team, '{name}', to_jsonb(v_value), true);

    elsif v_action = 'logo' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is not null
         and (length(v_value) > 1000 or v_value !~* '^https://') then
        raise exception 'Team logos must use a secure HTTPS URL.';
      end if;
      v_team := jsonb_set(
        v_team,
        '{logoUrl}',
        case when v_value is null then 'null'::jsonb else to_jsonb(v_value) end,
        true
      );

    elsif v_action = 'color' then
      v_value := nullif(btrim(p_payload ->> 'value'), '');
      if v_value is null or v_value !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Choose a valid six-digit team color.';
      end if;
      v_team := jsonb_set(v_team, '{color}', to_jsonb(v_value), true);

    elsif v_action = 'description' then
      v_value := coalesce(p_payload ->> 'value', '');
      if length(v_value) > 500 then
        raise exception 'Team descriptions are limited to 500 characters.';
      end if;
      v_team := jsonb_set(v_team, '{description}', to_jsonb(v_value), true);
    else
      raise exception 'Unknown team preference action.';
    end if;

    if v_action <> 'keeper_selection' then
      v_teams := jsonb_set(
        v_teams,
        array[p_team_index::text],
        v_team,
        false
      );
      v_state := jsonb_set(v_state, '{teams}', v_teams, true);
    end if;
    v_event_payload := jsonb_build_object(
      'team_index', p_team_index,
      'action', v_action
    );
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when v_action = 'draft_hero_vote'
      then 'draft_hero_vote'
      else 'team_preference_changed' end,
    auth.uid(),
    v_event_payload
  );
  return v_state;
end;
$_$;

ALTER FUNCTION "public"."mutate_league_team_preference"("p_league_id" "uuid", "p_action" "text", "p_team_index" integer, "p_payload" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mutate_league_transaction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_settings jsonb;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_identity text;
  v_team_count integer;
  v_team_index integer;
  v_other_team integer;
  v_rosters jsonb;
  v_budgets jsonb;
  v_pool jsonb;
  v_roster jsonb;
  v_other_roster jsonb;
  v_new_roster jsonb;
  v_other_new_roster jsonb;
  v_add_name text;
  v_drop_name text;
  v_add_mon jsonb;
  v_drop_mon jsonb;
  v_add_cost numeric;
  v_drop_cost numeric;
  v_current_budget numeric;
  v_new_budget numeric;
  v_uses_budget boolean;
  v_week integer;
  v_total_limit integer;
  v_week_limit integer;
  v_deadline_week integer;
  v_total_used integer;
  v_week_used integer;
  v_claim jsonb;
  v_claim_id text;
  v_claim_index integer;
  v_bid integer;
  v_available_faab integer;
  v_trade jsonb;
  v_trade_id text;
  v_trade_index integer;
  v_offer_names jsonb;
  v_request_names jsonb;
  v_offer_mons jsonb := '[]'::jsonb;
  v_request_mons jsonb := '[]'::jsonb;
  v_mon jsonb;
  v_name text;
  v_offer_value numeric;
  v_request_value numeric;
  v_diff numeric;
  v_event_kind text;
  v_event_payload jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'The transaction request is invalid.';
  end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'League member')
  into v_identity
  from public.profiles
  where id = auth.uid();

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;
  if not public.snapshot_draft_is_complete(v_state) then
    raise exception 'Transactions open only after the draft is complete.';
  end if;

  v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
  v_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  v_budgets := coalesce(v_state -> 'budgets', '[]'::jsonb);
  v_pool := coalesce(v_state -> 'pool', '[]'::jsonb);
  if jsonb_typeof(v_rosters) <> 'array'
     or jsonb_typeof(v_pool) <> 'array'
     or jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League roster data is invalid. Ask a commissioner to restore a backup.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  v_week := greatest(0, coalesce((v_state ->> 'week')::integer, 0));
  if coalesce(v_settings ->> 'calendarMode', '') = 'weekly'
     and nullif(v_settings ->> 'seasonStartsAt', '') is not null then
    begin
      v_week := greatest(
        0,
        floor(
          extract(
            epoch from (
              clock_timestamp()
              - (v_settings ->> 'seasonStartsAt')::timestamptz
            )
          ) / 604800
        )::integer
      );
    exception when others then
      v_week := greatest(0, coalesce((v_state ->> 'week')::integer, 0));
    end;
  end if;

  if v_action in ('instant_free_agent', 'claim_submit') then
    v_team_index := nullif(p_payload ->> 'team_index', '')::integer;
    if v_team_index is null
       or v_team_index < 0
       or v_team_index >= v_team_count
       or v_team_index >= jsonb_array_length(v_rosters) then
      raise exception 'Choose a valid team.';
    end if;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can make this move.';
    end if;
    if coalesce((v_settings ->> 'lockTransactionsAtPlayoffs')::boolean, false)
       and (v_state -> 'playoffs') is not null
       and (v_state -> 'playoffs') <> 'null'::jsonb then
      raise exception 'Transactions are closed once the playoff bracket is generated.';
    end if;

    v_total_limit := case
      when jsonb_typeof(v_settings -> 'maxTransactionsTotal') = 'number'
        then (v_settings ->> 'maxTransactionsTotal')::integer
      else null
    end;
    v_week_limit := case
      when jsonb_typeof(v_settings -> 'maxTransactionsPerWeek') = 'number'
        then (v_settings ->> 'maxTransactionsPerWeek')::integer
      else null
    end;
    v_deadline_week := case
      when jsonb_typeof(v_settings -> 'transactionsLastWeek') = 'number'
        then (v_settings ->> 'transactionsLastWeek')::integer
      else null
    end;
    if v_deadline_week is not null
       and v_deadline_week > 0
       and v_week > v_deadline_week - 1 then
      raise exception 'The transaction deadline has passed.';
    end if;

    select
      count(*),
      count(*) filter (
        where coalesce((entry.value ->> 'week')::integer, -1) = v_week
      )
    into v_total_used, v_week_used
    from jsonb_array_elements(
      coalesce(v_state -> 'transactionLog', '[]'::jsonb)
    ) entry(value)
    where coalesce((entry.value ->> 'teamIdx')::integer, -1) = v_team_index;
    if v_total_limit is not null
       and v_total_limit > 0
       and v_total_used >= v_total_limit then
      raise exception 'This team has reached its season transaction limit.';
    end if;
    if v_week_limit is not null
       and v_week_limit > 0
       and v_week_used >= v_week_limit then
      raise exception 'This team has reached its weekly transaction limit.';
    end if;

    v_add_name := nullif(btrim(p_payload ->> 'add_name'), '');
    v_drop_name := nullif(btrim(p_payload ->> 'drop_name'), '');
    if v_add_name is null then
      raise exception 'Choose a Pokemon to add.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_rosters) roster(value)
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster.value) = 'array'
          then roster.value else '[]'::jsonb end
      ) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
    ) then
      raise exception 'That Pokemon is already rostered.';
    end if;

    select mon.value
    into v_add_mon
    from jsonb_array_elements(v_pool) mon(value)
    where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
    limit 1;
    if v_add_mon is null
       and jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
      select mon.value
      into v_add_mon
      from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
      limit 1;
    end if;
    if v_add_mon is null then
      raise exception 'That Pokemon is not in this league''s verified free-agent pool.';
    end if;

    v_roster := v_rosters -> v_team_index;
    if jsonb_typeof(v_roster) <> 'array' then
      raise exception 'That team roster is invalid.';
    end if;
    if v_drop_name is not null then
      select mon.value
      into v_drop_mon
      from jsonb_array_elements(v_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_drop_name)
      limit 1;
      if v_drop_mon is null then
        raise exception 'The selected drop is no longer on that roster.';
      end if;
    end if;

    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_new_roster
    from jsonb_array_elements(v_roster) with ordinality mon(value, ordinality)
    where v_drop_name is null
       or lower(coalesce(mon.value ->> 'name', '')) <> lower(v_drop_name);
    v_new_roster := v_new_roster || jsonb_build_array(
      jsonb_set(
        v_add_mon,
        '{acquiredVia}',
        to_jsonb('freeagency'::text),
        true
      )
    );
    if not public.snapshot_roster_respects_caps(v_new_roster, v_settings) then
      raise exception 'That move would exceed the roster size or a configured roster cap.';
    end if;
  end if;

  if v_action = 'instant_free_agent' then
    if coalesce(v_settings ->> 'faClaimMode', 'instant') <> 'instant' then
      raise exception 'This league uses claims. Submit a claim instead.';
    end if;
    v_uses_budget := case
      when jsonb_typeof(v_settings -> 'postDraftBudgetEnabled') = 'boolean'
        then (v_settings ->> 'postDraftBudgetEnabled')::boolean
      else coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
        or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false)
    end;
    v_add_cost := greatest(0, coalesce((v_add_mon ->> 'cost')::numeric, 0));
    v_drop_cost := greatest(0, coalesce((v_drop_mon ->> 'cost')::numeric, 0));
    if v_uses_budget then
      if jsonb_typeof(v_budgets) <> 'array' then
        v_budgets := '[]'::jsonb;
      end if;
      if jsonb_array_length(v_budgets) <> v_team_count then
        select jsonb_agg(
          coalesce(
            nullif(v_budgets ->> team_index, '')::numeric,
            greatest(0, coalesce((v_settings ->> 'budget')::numeric, 0))
          )
          order by team_index
        )
        into v_budgets
        from generate_series(0, v_team_count - 1) as series(team_index);
      end if;
      v_current_budget := greatest(
        0,
        coalesce((v_budgets ->> v_team_index)::numeric, 0)
      );
      v_new_budget := v_current_budget + v_drop_cost - v_add_cost;
      if v_new_budget < 0 then
        raise exception 'That team does not have enough remaining budget.';
      end if;
      v_budgets := jsonb_set(
        v_budgets,
        array[v_team_index::text],
        to_jsonb(v_new_budget),
        false
      );
    end if;

    v_rosters := jsonb_set(
      v_rosters,
      array[v_team_index::text],
      v_new_roster,
      false
    );
    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_pool
    from jsonb_array_elements(v_pool) with ordinality mon(value, ordinality)
    where lower(coalesce(mon.value ->> 'name', '')) <> lower(v_add_name);
    if v_drop_mon is not null
       and not exists (
         select 1
         from jsonb_array_elements(v_pool) mon(value)
         where lower(coalesce(mon.value ->> 'name', '')) = lower(v_drop_name)
       ) then
      v_pool := v_pool || jsonb_build_array(v_drop_mon);
    end if;

    v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
    v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(
      v_state,
      '{transactionLog}',
      coalesce(v_state -> 'transactionLog', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'teamIdx', v_team_index,
            'week', v_week,
            'timestamp', v_now_ms,
            'addName', v_add_mon ->> 'name',
            'addCost', v_add_cost,
            'dropName', case when v_drop_mon is null
              then null else v_drop_mon ->> 'name' end,
            'dropCost', case when v_drop_mon is null
              then null else v_drop_cost end
          )
        ),
      true
    );
    v_event_kind := 'free_agent_transaction';
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'add_name', v_add_mon ->> 'name',
      'drop_name', case when v_drop_mon is null
        then null else v_drop_mon ->> 'name' end
    );

  elsif v_action = 'claim_submit' then
    if coalesce(v_settings ->> 'faClaimMode', 'instant') = 'instant' then
      raise exception 'This league processes free agents instantly.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(
        coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
      ) existing(value)
      where coalesce((existing.value ->> 'teamIdx')::integer, -1) = v_team_index
        and lower(coalesce(existing.value ->> 'addName', '')) = lower(v_add_name)
    ) then
      raise exception 'This team already has a pending claim on that Pokemon.';
    end if;

    v_bid := case
      when coalesce(v_settings ->> 'faClaimMode', '') = 'faab'
        then greatest(0, coalesce((p_payload ->> 'bid_amount')::integer, 0))
      else null
    end;
    if coalesce(v_settings ->> 'faClaimMode', '') = 'faab' then
      if coalesce((v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean, false) then
        v_available_faab := greatest(
          0,
          coalesce((v_budgets ->> v_team_index)::integer, 0)
        );
      else
        v_available_faab := greatest(
          0,
          coalesce(
            (v_state #>> array['faabBudgets', v_team_index::text])::integer,
            (v_settings ->> 'faabBudget')::integer,
            0
          )
        );
      end if;
      if v_bid > v_available_faab then
        raise exception 'That bid is greater than this team''s available FAAB.';
      end if;
    end if;

    v_claim_id := gen_random_uuid()::text;
    v_claim := jsonb_build_object(
      'id', v_claim_id,
      'teamIdx', v_team_index,
      'addName', v_add_mon ->> 'name',
      'dropName', case when v_drop_mon is null
        then null else v_drop_mon ->> 'name' end,
      'bidAmount', v_bid,
      'submittedAt', v_now_ms,
      'week', v_week
    );
    v_state := jsonb_set(
      v_state,
      '{pendingClaims}',
      coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
        || jsonb_build_array(v_claim),
      true
    );
    v_event_kind := 'free_agent_claim_submitted';
    v_event_payload := jsonb_build_object(
      'claim_id', v_claim_id,
      'team_index', v_team_index,
      'add_name', v_add_mon ->> 'name'
    );

  elsif v_action = 'claim_cancel' then
    v_claim_id := nullif(btrim(p_payload ->> 'claim_id'), '');
    select claim.value, claim.ordinality - 1
    into v_claim, v_claim_index
    from jsonb_array_elements(
      coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
    ) with ordinality claim(value, ordinality)
    where claim.value ->> 'id' = v_claim_id
    limit 1;
    if v_claim is null then
      raise exception 'That pending claim was not found.';
    end if;
    v_team_index := (v_claim ->> 'teamIdx')::integer;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can withdraw this claim.';
    end if;
    v_state := jsonb_set(
      v_state,
      '{pendingClaims}',
      coalesce(
        (
          select jsonb_agg(claim.value order by claim.ordinality)
          from jsonb_array_elements(
            coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
          ) with ordinality claim(value, ordinality)
          where claim.value ->> 'id' <> v_claim_id
        ),
        '[]'::jsonb
      ),
      true
    );
    v_event_kind := 'free_agent_claim_withdrawn';
    v_event_payload := jsonb_build_object(
      'claim_id', v_claim_id,
      'team_index', v_team_index
    );

  elsif v_action = 'trade_propose' then
    v_team_index := nullif(p_payload ->> 'from_team', '')::integer;
    v_other_team := nullif(p_payload ->> 'to_team', '')::integer;
    if v_team_index is null
       or v_other_team is null
       or v_team_index < 0
       or v_other_team < 0
       or v_team_index >= v_team_count
       or v_other_team >= v_team_count
       or v_team_index = v_other_team then
      raise exception 'Choose two different valid teams.';
    end if;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can propose this trade.';
    end if;
    v_offer_names := coalesce(p_payload -> 'offer_names', '[]'::jsonb);
    v_request_names := coalesce(p_payload -> 'request_names', '[]'::jsonb);
    if jsonb_typeof(v_offer_names) <> 'array'
       or jsonb_typeof(v_request_names) <> 'array'
       or jsonb_array_length(v_offer_names) + jsonb_array_length(v_request_names) = 0 then
      raise exception 'Choose at least one Pokemon.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_offer_names) offered(name)
      group by lower(offered.name)
      having count(*) > 1
    ) or exists (
      select 1
      from jsonb_array_elements_text(v_request_names) requested(name)
      group by lower(requested.name)
      having count(*) > 1
    ) then
      raise exception 'A Pokemon cannot appear twice in the same trade.';
    end if;

    v_roster := v_rosters -> v_team_index;
    v_other_roster := v_rosters -> v_other_team;
    for v_name in
      select value from jsonb_array_elements_text(v_offer_names)
    loop
      select mon.value into v_mon
      from jsonb_array_elements(v_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
      limit 1;
      if v_mon is null then
        raise exception 'An offered Pokemon is no longer on the proposing roster.';
      end if;
    end loop;
    for v_name in
      select value from jsonb_array_elements_text(v_request_names)
    loop
      select mon.value into v_mon
      from jsonb_array_elements(v_other_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
      limit 1;
      if v_mon is null then
        raise exception 'A requested Pokemon is no longer on the receiving roster.';
      end if;
    end loop;

    v_trade_id := gen_random_uuid()::text;
    v_trade := jsonb_build_object(
      'id', v_trade_id,
      'fromTeam', v_team_index,
      'toTeam', v_other_team,
      'offerNames', v_offer_names,
      'requestNames', v_request_names,
      'status', 'pending',
      'proposedBy', v_identity,
      'createdAt', v_now_ms
    );
    v_state := jsonb_set(
      v_state,
      '{trades}',
      coalesce(v_state -> 'trades', '[]'::jsonb)
        || jsonb_build_array(v_trade),
      true
    );
    v_event_kind := 'trade_proposed';
    v_event_payload := jsonb_build_object(
      'trade_id', v_trade_id,
      'from_team', v_team_index,
      'to_team', v_other_team
    );

  elsif v_action in ('trade_cancel', 'trade_respond') then
    v_trade_id := nullif(btrim(p_payload ->> 'trade_id'), '');
    select trade.value, trade.ordinality - 1
    into v_trade, v_trade_index
    from jsonb_array_elements(
      coalesce(v_state -> 'trades', '[]'::jsonb)
    ) with ordinality trade(value, ordinality)
    where trade.value ->> 'id' = v_trade_id
    limit 1;
    if v_trade is null or coalesce(v_trade ->> 'status', '') <> 'pending' then
      raise exception 'That trade is no longer pending.';
    end if;
    v_team_index := (v_trade ->> 'fromTeam')::integer;
    v_other_team := (v_trade ->> 'toTeam')::integer;

    if v_action = 'trade_cancel' then
      if not public.league_actor_can_control_snapshot_team(
        p_league_id,
        v_state,
        v_team_index
      ) then
        raise exception 'Only the proposing team or a commissioner can cancel this trade.';
      end if;
      v_trade := jsonb_set(
        v_trade,
        '{status}',
        to_jsonb('cancelled'::text),
        true
      );
      v_event_kind := 'trade_cancelled';
    else
      if not public.league_actor_can_control_snapshot_team(
        p_league_id,
        v_state,
        v_other_team
      ) then
        raise exception 'Only the receiving team or a commissioner can respond to this trade.';
      end if;
      if not coalesce((p_payload ->> 'accept')::boolean, false) then
        v_trade := jsonb_set(
          v_trade,
          '{status}',
          to_jsonb('rejected'::text),
          true
        );
        v_event_kind := 'trade_rejected';
      else
        v_offer_names := coalesce(v_trade -> 'offerNames', '[]'::jsonb);
        v_request_names := coalesce(v_trade -> 'requestNames', '[]'::jsonb);
        v_roster := v_rosters -> v_team_index;
        v_other_roster := v_rosters -> v_other_team;

        for v_name in
          select value from jsonb_array_elements_text(v_offer_names)
        loop
          select mon.value into v_mon
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
          limit 1;
          if v_mon is null then
            raise exception 'An offered Pokemon moved after this trade was proposed.';
          end if;
          v_offer_mons := v_offer_mons || jsonb_build_array(
            jsonb_set(v_mon, '{acquiredVia}', to_jsonb('trade'::text), true)
          );
        end loop;
        for v_name in
          select value from jsonb_array_elements_text(v_request_names)
        loop
          select mon.value into v_mon
          from jsonb_array_elements(v_other_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
          limit 1;
          if v_mon is null then
            raise exception 'A requested Pokemon moved after this trade was proposed.';
          end if;
          v_request_mons := v_request_mons || jsonb_build_array(
            jsonb_set(v_mon, '{acquiredVia}', to_jsonb('trade'::text), true)
          );
        end loop;

        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_new_roster
        from jsonb_array_elements(v_roster) with ordinality mon(value, ordinality)
        where not exists (
          select 1
          from jsonb_array_elements_text(v_offer_names) offered(name)
          where lower(offered.name) = lower(coalesce(mon.value ->> 'name', ''))
        );
        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_other_new_roster
        from jsonb_array_elements(v_other_roster) with ordinality mon(value, ordinality)
        where not exists (
          select 1
          from jsonb_array_elements_text(v_request_names) requested(name)
          where lower(requested.name) = lower(coalesce(mon.value ->> 'name', ''))
        );
        v_new_roster := v_new_roster || v_request_mons;
        v_other_new_roster := v_other_new_roster || v_offer_mons;
        if not public.snapshot_roster_respects_caps(v_new_roster, v_settings)
           or not public.snapshot_roster_respects_caps(
             v_other_new_roster,
             v_settings
           ) then
          raise exception 'The trade would exceed a roster size or configured roster cap.';
        end if;

        v_uses_budget := coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
          or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false);
        if v_uses_budget then
          if jsonb_typeof(v_budgets) <> 'array'
             or jsonb_array_length(v_budgets) <> v_team_count then
            raise exception 'League budgets are incomplete. Ask a commissioner to restore a backup.';
          end if;
          select coalesce(sum((mon.value ->> 'cost')::numeric), 0)
          into v_offer_value
          from jsonb_array_elements(v_offer_mons) mon(value);
          select coalesce(sum((mon.value ->> 'cost')::numeric), 0)
          into v_request_value
          from jsonb_array_elements(v_request_mons) mon(value);
          v_diff := v_request_value - v_offer_value;
          if (v_budgets ->> v_team_index)::numeric - v_diff < 0
             or (v_budgets ->> v_other_team)::numeric + v_diff < 0 then
            raise exception 'The trade would put a team below zero budget.';
          end if;
          v_budgets := jsonb_set(
            v_budgets,
            array[v_team_index::text],
            to_jsonb((v_budgets ->> v_team_index)::numeric - v_diff),
            false
          );
          v_budgets := jsonb_set(
            v_budgets,
            array[v_other_team::text],
            to_jsonb((v_budgets ->> v_other_team)::numeric + v_diff),
            false
          );
        end if;

        v_rosters := jsonb_set(
          v_rosters,
          array[v_team_index::text],
          v_new_roster,
          false
        );
        v_rosters := jsonb_set(
          v_rosters,
          array[v_other_team::text],
          v_other_new_roster,
          false
        );
        v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
        v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
        v_trade := jsonb_set(
          v_trade,
          '{status}',
          to_jsonb('accepted'::text),
          true
        );
        v_event_kind := 'trade_accepted';
      end if;
    end if;

    v_state := jsonb_set(
      v_state,
      array['trades', v_trade_index::text],
      v_trade,
      false
    );
    v_event_payload := jsonb_build_object(
      'trade_id', v_trade_id,
      'from_team', v_team_index,
      'to_team', v_other_team
    );
  else
    raise exception 'Unknown league transaction action.';
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    v_event_kind,
    auth.uid(),
    coalesce(v_event_payload, '{}'::jsonb)
  );
  return v_state;
end;
$$;

ALTER FUNCTION "public"."mutate_league_transaction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mutate_live_auction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_team_index integer;
  v_n integer;
  v_nomination_index integer;
  v_order jsonb;
  v_nominee jsonb;
  v_mon jsonb;
  v_mon_id text;
  v_bid integer;
  v_budget integer;
  v_roster jsonb;
  v_roster_max integer;
  v_deadline bigint;
  v_reset_seconds integer;
  v_pause_started bigint;
  v_pause_ms bigint;
  v_pool jsonb;
  v_event_payload jsonb := '{}'::jsonb;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League draft state was not found.'; end if;
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'There is no active hosted auction draft.';
  end if;

  insert into public.auction_team_owners (league_id, team_index, user_id)
  select p_league_id, team.ordinality - 1, owner.id
  from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
    with ordinality as team(value, ordinality)
  cross join lateral (
    select profile.id
    from public.profiles profile
    join public.league_memberships membership
      on membership.user_id = profile.id
     and membership.league_id = p_league_id
    where nullif(trim(team.value ->> 'claimedBy'), '') is not null
      and (
        lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy')
        or lower(coalesce(profile.display_name, '')) = lower(team.value ->> 'claimedBy')
      )
    order by case
      when lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy') then 0
      else 1
    end
    limit 1
  ) owner
  on conflict do nothing;

  v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
  v_n := jsonb_array_length(v_order);
  v_nomination_index := coalesce((v_state ->> 'auctionNominationIdx')::integer, 0);
  v_roster_max := greatest(1, coalesce((v_state #>> '{settings,rosterMax}')::integer, 1));

  if v_action = 'start_clock' then
    if coalesce((v_state ->> 'paused')::boolean, false)
       or v_state -> 'nominee' <> 'null'::jsonb
       or coalesce((v_state ->> 'auctionEnded')::boolean, false)
       or jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0 then
      return v_state;
    end if;
    if v_state -> 'nominationDeadline' = 'null'::jsonb then
      v_deadline := v_now_ms
        + greatest(1, coalesce((v_state #>> '{settings,auctionNominationSeconds}')::integer, 30)) * 1000;
      v_state := jsonb_set(v_state, '{nominationDeadline}', to_jsonb(v_deadline), true);
    else
      return v_state;
    end if;

  elsif v_action = 'nominate' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Another Pokemon is already being auctioned.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'It is not your team''s nomination turn.';
    end if;
    v_mon_id := p_payload ->> 'pokemon_id';
    select pokemon.value
    into v_mon
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb)) pokemon(value)
    where pokemon.value ->> 'id' = v_mon_id
    limit 1;
    if v_mon is null then raise exception 'That Pokemon is no longer available.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_bid := greatest(1, coalesce((p_payload ->> 'amount')::integer, 1));
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That opening bid is over the team''s remaining budget.'; end if;
    v_deadline := v_now_ms
      + greatest(1, coalesce((v_state #>> '{settings,auctionTimerSeconds}')::integer, 30)) * 1000;
    v_nominee := jsonb_build_object(
      'mon', v_mon,
      'currentBid', v_bid,
      'currentBidder', v_team_index,
      'nominatedBy', v_team_index,
      'deadline', v_deadline,
      'bids', jsonb_build_array(
        jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
      )
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

  elsif v_action = 'bid' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then raise exception 'There is no active nomination.'; end if;
    v_deadline := (v_nominee ->> 'deadline')::bigint;
    if v_now_ms >= v_deadline then raise exception 'The bidding clock has expired.'; end if;
    v_team_index := (p_payload ->> 'team_index')::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'You cannot bid for that team.';
    end if;
    if v_team_index = (v_nominee ->> 'currentBidder')::integer then
      raise exception 'Your team already has the highest bid.';
    end if;
    v_bid := (p_payload ->> 'amount')::integer;
    if v_bid <= (v_nominee ->> 'currentBid')::integer then raise exception 'That bid is no longer high enough.'; end if;
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That bid is over the team''s remaining budget.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_mon := v_nominee -> 'mon';
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_reset_seconds := greatest(
      1,
      coalesce((v_state #>> '{settings,auctionBidResetSeconds}')::integer, 10)
    );
    v_nominee := jsonb_set(v_nominee, '{currentBid}', to_jsonb(v_bid), true);
    v_nominee := jsonb_set(v_nominee, '{currentBidder}', to_jsonb(v_team_index), true);
    v_nominee := jsonb_set(
      v_nominee,
      '{deadline}',
      to_jsonb(v_now_ms + v_reset_seconds * 1000),
      true
    );
    v_nominee := jsonb_set(
      v_nominee,
      '{bids}',
      coalesce(v_nominee -> 'bids', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
        ),
      true
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_event_payload := jsonb_build_object('team_index', v_team_index, 'amount', v_bid);

  elsif v_action = 'resolve' then
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then return v_state; end if;
    if v_now_ms < (v_nominee ->> 'deadline')::bigint then return v_state; end if;
    v_team_index := (v_nominee ->> 'currentBidder')::integer;
    v_bid := (v_nominee ->> 'currentBid')::integer;
    v_mon := jsonb_set(v_nominee -> 'mon', '{cost}', to_jsonb(v_bid), true);
    v_mon := jsonb_set(v_mon, '{acquiredVia}', '"draft"'::jsonb, true);
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if jsonb_array_length(v_roster) >= v_roster_max or v_bid > v_budget then
      raise exception 'The winning team can no longer complete this purchase.';
    end if;
    v_state := jsonb_set(
      v_state,
      array['rosters', v_team_index::text],
      v_roster || jsonb_build_array(v_mon),
      true
    );
    v_state := jsonb_set(
      v_state,
      array['budgets', v_team_index::text],
      to_jsonb(v_budget - v_bid),
      true
    );
    v_mon_id := v_nominee #>> '{mon,id}';
    select coalesce(jsonb_agg(pokemon.value order by pokemon.ordinality), '[]'::jsonb)
    into v_pool
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
      with ordinality as pokemon(value, ordinality)
    where pokemon.value ->> 'id' <> v_mon_id;
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{nominee}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

  elsif v_action = 'skip' then
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'An active auction cannot be skipped.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.is_league_staff(p_league_id) then
      if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
        raise exception 'You cannot skip another team''s nomination turn.';
      end if;
      if v_state -> 'nominationDeadline' = 'null'::jsonb
         or v_now_ms < (v_state ->> 'nominationDeadline')::bigint then
        raise exception 'The nomination clock has not expired.';
      end if;
    end if;
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);

  elsif v_action = 'pause' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can pause the draft.'; end if;
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(
      v_state,
      '{pauseIsOvernight}',
      to_jsonb(coalesce((p_payload ->> 'overnight')::boolean, false)),
      true
    );

  elsif v_action = 'resume' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can resume the draft.'; end if;
    if not coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_pause_started := coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms);
    v_pause_ms := greatest(0, v_now_ms - v_pause_started);
    if v_state -> 'nominationDeadline' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominationDeadline}',
        to_jsonb((v_state ->> 'nominationDeadline')::bigint + v_pause_ms),
        true
      );
    end if;
    if v_state -> 'nominee' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominee,deadline}',
        to_jsonb((v_state #>> '{nominee,deadline}')::bigint + v_pause_ms),
        true
      );
    end if;
    v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);

  elsif v_action = 'end' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can end the auction.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Let the current nomination finish first.'; end if;
    v_state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);

  else
    raise exception 'Unknown auction action.';
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (p_league_id, 'auction_' || v_action, auth.uid(), v_event_payload);

  return v_state;
end;
$$;

ALTER FUNCTION "public"."mutate_live_auction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mutate_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer, "p_action" "text", "p_pokemon_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_action text := lower(trim(coalesce(p_action, '')));
  v_name text := nullif(trim(p_pokemon_name), '');
  v_position integer;
  v_target_position integer;
  v_target_name text;
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update your draft queue.';
  end if;
  if p_team_index < 0 then
    raise exception 'Choose a valid team.';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Choose a valid Pokemon.';
  end if;
  if not exists (
    select 1
    from public.teams team
    join public.league_memberships membership
      on membership.id = team.owner_membership_id
    where team.league_id = p_league_id
      and team.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    raise exception 'You can only update your own team queue.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_league_id::text),
    p_team_index
  );

  select item.position
  into v_position
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = v_name;

  if v_action = 'add' then
    if v_position is null then
      if (
        select count(*)
        from public.private_draft_queue_items item
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
      ) >= 100 then
        raise exception 'Draft queues can hold up to 100 Pokemon.';
      end if;
      insert into public.private_draft_queue_items (
        league_id,
        user_id,
        team_index,
        pokemon_name,
        position
      )
      select
        p_league_id,
        auth.uid(),
        p_team_index,
        v_name,
        coalesce(max(item.position) + 1, 0)
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index;
    end if;

  elsif v_action = 'remove' then
    delete from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
      and item.pokemon_name = v_name;

  elsif v_action in ('up', 'down') then
    if v_position is not null then
      v_target_position := v_position + case when v_action = 'up' then -1 else 1 end;
      select item.pokemon_name
      into v_target_name
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index
        and item.position = v_target_position;

      if v_target_name is not null then
        update public.private_draft_queue_items item
        set position = 1000000
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;
        update public.private_draft_queue_items item
        set position = v_target_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_name;
        update public.private_draft_queue_items item
        set position = v_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;
      end if;
    end if;
  else
    raise exception 'Unknown queue action.';
  end if;

  with ordered as (
    select
      item.pokemon_name,
      row_number() over (order by item.position) - 1 as next_position
    from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
  )
  update public.private_draft_queue_items item
  set position = ordered.next_position
  from ordered
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = ordered.pokemon_name;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$$;

ALTER FUNCTION "public"."mutate_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer, "p_action" "text", "p_pokemon_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."preview_league_invite"("p_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite public.league_invites;
  v_league public.leagues;
  v_email text;
  v_already_joined boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Sign in before opening an invite.';
  end if;

  select *
  into v_invite
  from public.league_invites
  where token = p_token;

  if v_invite.id is null then
    raise exception 'This invite is no longer available.';
  end if;

  if v_invite.expires_at is not null
     and v_invite.expires_at < now() then
    raise exception 'This invite has expired.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if v_invite.email is not null
     and v_invite.email <> v_email then
    raise exception 'This invite was sent to a different email address.';
  end if;

  v_already_joined := exists (
    select 1
    from public.league_memberships
    where league_id = v_invite.league_id
      and user_id = auth.uid()
  );

  if v_invite.email is not null
     and v_invite.accepted_at is not null
     and not (
       v_already_joined
       and (
         v_invite.accepted_by = auth.uid()
         or (
           v_invite.accepted_by is null
           and v_invite.email = v_email
         )
       )
     ) then
    raise exception 'This invite has already been accepted.';
  end if;

  select *
  into v_league
  from public.leagues
  where id = v_invite.league_id;

  return jsonb_build_object(
    'token', v_invite.token,
    'league_id', v_league.id,
    'league_name', v_league.name,
    'season_label', v_league.season_label,
    'role', v_invite.role,
    'is_spectator', v_invite.role = 'viewer',
    'expires_at', v_invite.expires_at,
    'already_joined', v_already_joined
  );
end;
$$;

ALTER FUNCTION "public"."preview_league_invite"("p_token" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."provision_live_snake_draft"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_team_order" integer[], "p_rounds" integer, "p_settings" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session_id uuid;
  v_team record;
  v_pokemon jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := array[]::uuid[];
  v_source_key text;
  v_owner_name text;
  v_owner_id uuid;
  v_membership_id uuid;
  v_order_ids uuid[];
  v_team_count integer;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a live draft.';
  end if;
  v_team_count := jsonb_array_length(coalesce(p_teams, '[]'::jsonb));
  if v_team_count < 2 then
    raise exception 'A live draft needs at least two teams.';
  end if;
  if jsonb_array_length(coalesce(p_pokemon, '[]'::jsonb)) = 0 then
    raise exception 'No eligible Pokemon were supplied.';
  end if;
  if p_rounds < 1 or p_rounds > 30 then
    raise exception 'Choose between 1 and 30 rounds.';
  end if;
  if coalesce(array_length(p_team_order, 1), 0) <> v_team_count
     or (select count(distinct item) from unnest(p_team_order) as item) <> v_team_count
     or exists (select 1 from unnest(p_team_order) as item where item < 0 or item >= v_team_count) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;
  if exists (select 1 from public.draft_sessions where league_id = p_league_id and status in ('active', 'paused', 'complete')) then
    raise exception 'This league already has a live draft. Do not provision it again.';
  end if;

  delete from public.roster_entries where team_id in (select id from public.teams where league_id = p_league_id);
  delete from public.league_pokemon where league_id = p_league_id;
  delete from public.teams where league_id = p_league_id;

  for v_team in select value as team, ordinality - 1 as team_index from jsonb_array_elements(p_teams) with ordinality loop
    v_source_key := v_team.team_index::text;
    insert into public.teams (league_id, source_key, name, color, logo_url, description)
    values (
      p_league_id, v_source_key,
      coalesce(nullif(trim(v_team.team ->> 'name'), ''), 'Team ' || (v_team.team_index + 1)),
      nullif(v_team.team ->> 'color', ''), nullif(v_team.team ->> 'logoUrl', ''),
      coalesce(v_team.team ->> 'description', '')
    ) returning id into v_team_id;
    v_team_ids := array_append(v_team_ids, v_team_id);

    v_owner_name := nullif(trim(v_team.team ->> 'claimedBy'), '');
    if v_owner_name is not null then
      select id into v_owner_id from public.profiles where lower(username) = lower(v_owner_name) or lower(display_name) = lower(v_owner_name) limit 1;
      if v_owner_id is not null then
        insert into public.league_memberships (league_id, user_id, role)
        values (p_league_id, v_owner_id, 'coach')
        on conflict (league_id, user_id) do update set role = case when public.league_memberships.role = 'viewer' then 'coach' else public.league_memberships.role end
        returning id into v_membership_id;
        update public.teams set owner_membership_id = v_membership_id where id = v_team_id;
      end if;
    end if;
  end loop;

  for v_pokemon in select value from jsonb_array_elements(p_pokemon) loop
    if nullif(v_pokemon ->> 'id', '') is null then raise exception 'Every Pokemon needs a stable source id.'; end if;
    insert into public.pokemon_catalogue (id, display_name, primary_type, secondary_type, base_stat_total, sprite_url)
    values (v_pokemon ->> 'id', coalesce(v_pokemon ->> 'name', v_pokemon ->> 'id'), coalesce(v_pokemon ->> 't1', 'normal'), nullif(v_pokemon ->> 't2', ''), nullif(v_pokemon ->> 'bst', '')::smallint, nullif(v_pokemon ->> 'spriteUrl', ''))
    on conflict (id) do update set display_name = excluded.display_name, primary_type = excluded.primary_type, secondary_type = excluded.secondary_type, base_stat_total = excluded.base_stat_total, sprite_url = coalesce(excluded.sprite_url, public.pokemon_catalogue.sprite_url);
    insert into public.league_pokemon (league_id, pokemon_id, source_key, cost, is_allowed, is_drafted)
    values (p_league_id, v_pokemon ->> 'id', v_pokemon ->> 'id', coalesce(nullif(v_pokemon ->> 'cost', '')::numeric, 0), true, false);
  end loop;

  update public.leagues set settings = coalesce(settings, '{}'::jsonb) || coalesce(p_settings, '{}'::jsonb) || jsonb_build_object('rosterMax', p_rounds), updated_at = now() where id = p_league_id;

  -- p_team_order contains zero-based team indexes. Read its value at each
  -- PostgreSQL position, then convert that zero-based value to the UUID array.
  select array_agg(v_team_ids[p_team_order[s.position] + 1] order by s.ordinality) into v_order_ids
  from generate_subscripts(p_team_order, 1) with ordinality as s(position, ordinality);
  if coalesce(array_length(v_order_ids, 1), 0) <> v_team_count or exists (select 1 from unnest(v_order_ids) as id where id is null) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;

  v_session_id := public.start_snake_draft(p_league_id, v_order_ids);
  return jsonb_build_object('draft_session_id', v_session_id, 'pokemon_ids', coalesce((select jsonb_object_agg(source_key, id) from public.league_pokemon where league_id = p_league_id), '{}'::jsonb));
end;
$$;

ALTER FUNCTION "public"."provision_live_snake_draft"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_team_order" integer[], "p_rounds" integer, "p_settings" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."provision_live_snake_draft_v2"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_pick_order" integer[], "p_settings" "jsonb", "p_keepers" "jsonb", "p_started_state" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_state jsonb;
  v_state jsonb;
  v_session_id uuid;
  v_team record;
  v_pokemon jsonb;
  v_keeper jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := array[]::uuid[];
  v_order_ids uuid[];
  v_source_key text;
  v_owner_name text;
  v_owner_id uuid;
  v_membership_id uuid;
  v_league_pokemon_id uuid;
  v_team_count integer;
  v_team_index integer;
  v_target integer;
  v_keeper_count integer;
  v_pokemon_ids jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a live draft.';
  end if;
  if jsonb_typeof(p_teams) <> 'array'
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_typeof(coalesce(p_keepers, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(p_started_state) <> 'object' then
    raise exception 'The saved draft setup is incomplete. Refresh Setup and try again.';
  end if;

  v_team_count := jsonb_array_length(p_teams);
  if v_team_count < 2 or v_team_count > 16 then
    raise exception 'A live draft needs between 2 and 16 teams.';
  end if;
  if jsonb_array_length(p_pokemon) = 0 then
    raise exception 'No eligible Pokemon were supplied.';
  end if;
  if coalesce(array_length(p_pick_order, 1), 0) < 1
     or coalesce(array_length(p_pick_order, 1), 0) > 480
     or exists (
       select 1
       from unnest(p_pick_order) item
       where item < 0 or item >= v_team_count
     ) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;
  if exists (
    select 1
    from public.draft_sessions
    where league_id = p_league_id
      and status in ('active', 'paused', 'complete')
  ) then
    raise exception 'This league already has a live draft. Do not provision it again.';
  end if;

  select state
  into v_existing_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing_state is null then
    raise exception 'League setup was not found.';
  end if;
  if coalesce((v_existing_state ->> 'locked')::boolean, false) then
    raise exception 'This league draft has already started.';
  end if;

  delete from public.roster_entries
  where team_id in (
    select id from public.teams where league_id = p_league_id
  );
  delete from public.league_pokemon where league_id = p_league_id;
  delete from public.teams where league_id = p_league_id;

  for v_team in
    select value as team, ordinality - 1 as team_index
    from jsonb_array_elements(p_teams) with ordinality
  loop
    v_source_key := v_team.team_index::text;
    insert into public.teams (
      league_id,
      source_key,
      name,
      color,
      logo_url,
      description
    )
    values (
      p_league_id,
      v_source_key,
      coalesce(
        nullif(btrim(v_team.team ->> 'name'), ''),
        'Team ' || (v_team.team_index + 1)
      ),
      nullif(v_team.team ->> 'color', ''),
      nullif(v_team.team ->> 'logoUrl', ''),
      coalesce(v_team.team ->> 'description', '')
    )
    returning id into v_team_id;
    v_team_ids := array_append(v_team_ids, v_team_id);

    v_owner_name := nullif(btrim(v_team.team ->> 'claimedBy'), '');
    if v_owner_name is not null then
      select id
      into v_owner_id
      from public.profiles
      where lower(coalesce(username, '')) = lower(v_owner_name)
         or lower(coalesce(display_name, '')) = lower(v_owner_name)
      order by case
        when lower(coalesce(username, '')) = lower(v_owner_name) then 0
        else 1
      end
      limit 1;

      if v_owner_id is not null then
        insert into public.league_memberships (league_id, user_id, role)
        values (p_league_id, v_owner_id, 'coach')
        on conflict (league_id, user_id) do update
        set role = case
          when public.league_memberships.role = 'viewer' then 'coach'
          else public.league_memberships.role
        end
        returning id into v_membership_id;

        update public.teams
        set owner_membership_id = v_membership_id
        where id = v_team_id;
      end if;
    end if;
    v_owner_id := null;
    v_membership_id := null;
  end loop;

  for v_pokemon in
    select value from jsonb_array_elements(p_pokemon)
  loop
    v_source_key := nullif(v_pokemon ->> 'id', '');
    if v_source_key is null then
      raise exception 'Every Pokemon needs a stable source ID.';
    end if;
    if exists (
      select 1
      from public.league_pokemon
      where league_id = p_league_id
        and source_key = v_source_key
    ) then
      raise exception 'Every Pokemon must have a unique source ID.';
    end if;

    insert into public.pokemon_catalogue (
      id,
      display_name,
      primary_type,
      secondary_type,
      base_stat_total,
      sprite_url
    )
    values (
      v_source_key,
      coalesce(v_pokemon ->> 'name', v_source_key),
      coalesce(v_pokemon ->> 't1', 'normal'),
      nullif(v_pokemon ->> 't2', ''),
      nullif(v_pokemon ->> 'bst', '')::smallint,
      nullif(v_pokemon ->> 'spriteUrl', '')
    )
    on conflict (id) do update
    set display_name = excluded.display_name,
        primary_type = excluded.primary_type,
        secondary_type = excluded.secondary_type,
        base_stat_total = excluded.base_stat_total,
        sprite_url = coalesce(
          excluded.sprite_url,
          public.pokemon_catalogue.sprite_url
        );

    insert into public.league_pokemon (
      league_id,
      pokemon_id,
      source_key,
      cost,
      is_allowed,
      is_drafted,
      is_restricted,
      is_mega
    )
    values (
      p_league_id,
      v_source_key,
      v_source_key,
      greatest(0, coalesce(nullif(v_pokemon ->> 'cost', '')::numeric, 0)),
      true,
      false,
      coalesce((v_pokemon ->> 'isRestricted')::boolean, false),
      coalesce((v_pokemon ->> 'isMega')::boolean, false)
    );
  end loop;

  v_target := greatest(
    1,
    case
      when coalesce((p_settings ->> 'snakeBudgetEnabled')::boolean, false)
        then coalesce((p_settings ->> 'rosterMax')::integer, 1)
      else coalesce((p_settings ->> 'rosterSize')::integer, 1)
    end
  );

  for v_team_index in 0..v_team_count - 1
  loop
    if jsonb_typeof(coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)) <> 'array' then
      raise exception 'The keeper list for Team % is invalid.', v_team_index + 1;
    end if;
    v_keeper_count := jsonb_array_length(
      coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)
    );
    if v_keeper_count > v_target then
      raise exception 'Team % has more keepers than roster slots.', v_team_index + 1;
    end if;

    for v_keeper in
      select value
      from jsonb_array_elements(
        coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)
      )
    loop
      v_source_key := nullif(v_keeper ->> 'id', '');
      if v_source_key is null then
        raise exception 'Every keeper needs a stable source ID.';
      end if;

      update public.league_pokemon
      set is_drafted = true,
          cost = greatest(
            0,
            coalesce(nullif(v_keeper ->> 'cost', '')::numeric, cost)
          )
      where league_id = p_league_id
        and source_key = v_source_key
        and is_allowed
        and not is_drafted
      returning id into v_league_pokemon_id;

      if v_league_pokemon_id is null then
        raise exception 'A keeper is no longer legal or appears on more than one team.';
      end if;

      insert into public.roster_entries (
        team_id,
        league_pokemon_id,
        acquisition_type
      )
      values (
        v_team_ids[v_team_index + 1],
        v_league_pokemon_id,
        'draft'
      );
      v_league_pokemon_id := null;
    end loop;
  end loop;

  select array_agg(
    v_team_ids[pick.item + 1]
    order by pick.ordinality
  )
  into v_order_ids
  from unnest(p_pick_order) with ordinality as pick(item, ordinality);
  if coalesce(array_length(v_order_ids, 1), 0)
     <> coalesce(array_length(p_pick_order, 1), 0)
     or exists (select 1 from unnest(v_order_ids) id where id is null) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;

  insert into public.draft_sessions (
    league_id,
    mode,
    status,
    current_pick_number,
    current_team_id,
    configuration
  )
  values (
    p_league_id,
    'snake',
    'active',
    0,
    v_order_ids[1],
    jsonb_build_object('team_order', to_jsonb(v_order_ids))
  )
  returning id into v_session_id;

  update public.leagues
  set settings = coalesce(settings, '{}'::jsonb)
      || coalesce(p_settings, '{}'::jsonb)
      || jsonb_build_object('rosterMax', v_target),
      status = 'drafting',
      updated_at = now()
  where id = p_league_id;

  select coalesce(jsonb_object_agg(source_key, id), '{}'::jsonb)
  into v_pokemon_ids
  from public.league_pokemon
  where league_id = p_league_id;

  v_state := p_started_state;
  v_state := jsonb_set(
    v_state,
    '{liveDraft,sessionId}',
    to_jsonb(v_session_id),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{liveDraft,pokemonIds}',
    v_pokemon_ids,
    true
  );
  v_state := jsonb_set(v_state, '{locked}', 'true'::jsonb, true);
  v_state := jsonb_set(
    v_state,
    '{draftStartedAt}',
    to_jsonb(v_now_ms),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_existing_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_started',
    auth.uid(),
    jsonb_build_object(
      'draft_session_id',
      v_session_id,
      'keeper_count',
      (
        select count(*)
        from public.roster_entries entry
        join public.teams team on team.id = entry.team_id
        where team.league_id = p_league_id
          and entry.released_at is null
      )
    )
  );

  return jsonb_build_object(
    'state',
    v_state,
    'draft_session_id',
    v_session_id,
    'pokemon_ids',
    v_pokemon_ids
  );
end;
$$;

ALTER FUNCTION "public"."provision_live_snake_draft_v2"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_pick_order" integer[], "p_settings" "jsonb", "p_keepers" "jsonb", "p_started_state" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."publish_league_live_stream"("p_league_id" "uuid", "p_stream_id" "uuid", "p_match_key" "text", "p_title" "text", "p_stream_url" "text", "p_starts_at" timestamp with time zone, "p_visibility" "text", "p_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_stream public.league_live_streams;
  v_platform text;
  v_league_name text;
  v_slug text;
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to publish a stream.';
  end if;

  if not exists(
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner', 'coach')
  ) then
    raise exception
      'Only participating managers and commissioners can publish league streams.';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Add a stream title.';
  end if;

  if p_visibility not in ('private', 'league', 'public') then
    raise exception 'Choose a valid stream audience.';
  end if;

  if p_status not in ('scheduled', 'live', 'ended') then
    raise exception 'Choose a valid stream status.';
  end if;

  if lower(p_stream_url)
    ~ '^https://(www\.)?(twitch\.tv|player\.twitch\.tv)/'
  then
    v_platform := 'twitch';
  elsif lower(p_stream_url)
    ~ '^https://(www\.)?(youtube\.com|youtu\.be)/'
  then
    v_platform := 'youtube';
  else
    raise exception
      'Use a Twitch or YouTube stream URL beginning with https://';
  end if;

  select name, slug
  into v_league_name, v_slug
  from public.leagues
  where id = p_league_id;

  if v_league_name is null then
    raise exception 'League not found.';
  end if;

  if p_stream_id is not null then
    select status
    into v_previous_status
    from public.league_live_streams
    where id = p_stream_id
      and league_id = p_league_id
      and (
        created_by = auth.uid()
        or public.is_league_staff(p_league_id)
      );

    if not found then
      raise exception 'You cannot edit that broadcast.';
    end if;

    update public.league_live_streams
    set
      match_key = nullif(trim(p_match_key), ''),
      title = trim(p_title),
      platform = v_platform,
      stream_url = trim(p_stream_url),
      starts_at = p_starts_at,
      visibility = p_visibility,
      status = p_status,
      updated_at = now()
    where id = p_stream_id
    returning * into v_stream;
  else
    insert into public.league_live_streams(
      league_id,
      match_key,
      title,
      platform,
      stream_url,
      starts_at,
      visibility,
      status,
      created_by
    )
    values (
      p_league_id,
      nullif(trim(p_match_key), ''),
      trim(p_title),
      v_platform,
      trim(p_stream_url),
      p_starts_at,
      p_visibility,
      p_status,
      auth.uid()
    )
    returning * into v_stream;
  end if;

  delete from public.notification_events
  where league_id = p_league_id
    and kind = 'match_reminder'
    and payload->>'stream_id' = v_stream.id::text
    and sent_at is null;

  if v_stream.status = 'scheduled'
    and v_stream.starts_at is not null
    and v_stream.visibility <> 'private'
  then
    insert into public.notification_events(
      league_id,
      user_id,
      kind,
      channel,
      dedupe_key,
      scheduled_for,
      payload
    )
    select
      p_league_id,
      null,
      'match_reminder',
      'discord',
      'stream-reminder:'
        || v_stream.id::text
        || ':'
        || reminder.hours_before::text,
      v_stream.starts_at
        - make_interval(hours => reminder.hours_before),
      jsonb_build_object(
        'stream_id', v_stream.id,
        'league_name', v_league_name,
        'league_slug', v_slug,
        'title', v_stream.title,
        'stream_url', v_stream.stream_url,
        'starts_at', v_stream.starts_at,
        'hours_before', reminder.hours_before
      )
    from (values (24), (1)) reminder(hours_before)
    where v_stream.starts_at
        - make_interval(hours => reminder.hours_before) > now()
    on conflict (dedupe_key) do nothing;
  end if;

  if v_stream.status = 'live'
    and v_stream.visibility <> 'private'
    and coalesce(v_previous_status, '') <> 'live'
  then
    insert into public.notification_events(
      league_id,
      user_id,
      kind,
      channel,
      dedupe_key,
      scheduled_for,
      payload
    )
    values (
      p_league_id,
      null,
      'stream_live',
      'discord',
      'stream-live:' || v_stream.id::text,
      now(),
      jsonb_build_object(
        'stream_id', v_stream.id,
        'league_name', v_league_name,
        'league_slug', v_slug,
        'title', v_stream.title,
        'stream_url', v_stream.stream_url
      )
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return to_jsonb(v_stream);
end;
$$;

ALTER FUNCTION "public"."publish_league_live_stream"("p_league_id" "uuid", "p_stream_id" "uuid", "p_match_key" "text", "p_title" "text", "p_stream_url" "text", "p_starts_at" timestamp with time zone, "p_visibility" "text", "p_status" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."purge_old_operational_health_events"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_deleted integer;
begin
  delete from public.operational_health_events
  where occurred_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

ALTER FUNCTION "public"."purge_old_operational_health_events"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reconcile_overnight_draft_pauses"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_state jsonb;
  v_settings jsonb;
  v_start integer;
  v_end integer;
  v_hour integer;
  v_in_window boolean;
  v_now_ms bigint;
  v_paused_ms bigint;
  v_changed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_hour := extract(
    hour from (clock_timestamp() at time zone 'UTC')
  )::integer;

  for r in
    select league_id, state
    from public.league_state_snapshots
    for update
  loop
    v_state := r.state;
    v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
    if not coalesce((v_state ->> 'locked')::boolean, false)
       or not coalesce(
         (v_settings ->> 'overnightPauseEnabled')::boolean,
         false
       ) then
      continue;
    end if;

    v_start := coalesce(
      (v_settings ->> 'overnightPauseStartUTCHour')::integer,
      3
    );
    v_end := coalesce(
      (v_settings ->> 'overnightPauseEndUTCHour')::integer,
      13
    );
    v_in_window := case
      when v_start = v_end then false
      when v_start < v_end then v_hour >= v_start and v_hour < v_end
      else v_hour >= v_start or v_hour < v_end
    end;

    if v_in_window
       and not coalesce((v_state ->> 'paused')::boolean, false) then
      v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
      v_state := jsonb_set(
        v_state,
        '{pauseIsOvernight}',
        'true'::jsonb,
        true
      );

      update public.draft_sessions
      set status = 'paused',
          configuration = jsonb_set(
            jsonb_set(
              coalesce(configuration, '{}'::jsonb),
              '{pause_started_at}',
              to_jsonb(v_now_ms),
              true
            ),
            '{pause_is_overnight}',
            'true'::jsonb,
            true
          )
      where league_id = r.league_id
        and mode = 'snake'
        and status = 'active';

      update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = r.league_id;
      v_changed := v_changed + 1;

    elsif not v_in_window
       and coalesce((v_state ->> 'paused')::boolean, false)
       and coalesce((v_state ->> 'pauseIsOvernight')::boolean, false) then
      v_paused_ms := greatest(
        0,
        v_now_ms - coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms)
      );
      if v_state ->> 'pickDeadline' is not null then
        v_state := jsonb_set(
          v_state,
          '{pickDeadline}',
          to_jsonb((v_state ->> 'pickDeadline')::bigint + v_paused_ms),
          true
        );
      end if;
      if v_state ->> 'nominationDeadline' is not null then
        v_state := jsonb_set(
          v_state,
          '{nominationDeadline}',
          to_jsonb(
            (v_state ->> 'nominationDeadline')::bigint + v_paused_ms
          ),
          true
        );
      end if;
      if v_state #>> '{nominee,deadline}' is not null then
        v_state := jsonb_set(
          v_state,
          '{nominee,deadline}',
          to_jsonb(
            (v_state #>> '{nominee,deadline}')::bigint + v_paused_ms
          ),
          true
        );
      end if;
      v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
      v_state := jsonb_set(
        v_state,
        '{pauseIsOvernight}',
        'false'::jsonb,
        true
      );

      update public.draft_sessions
      set status = 'active',
          updated_at = updated_at
            + make_interval(secs => v_paused_ms::double precision / 1000.0),
          configuration = coalesce(configuration, '{}'::jsonb)
            - array['pause_started_at', 'pause_is_overnight']
      where league_id = r.league_id
        and mode = 'snake'
        and status = 'paused'
        and coalesce(
          (configuration ->> 'pause_is_overnight')::boolean,
          false
        );

      update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = r.league_id;
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

ALTER FUNCTION "public"."reconcile_overnight_draft_pauses"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refresh_daily_three"("p_user" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_poll boolean; v_bracket boolean; v_quiz boolean; v_total integer; v_current integer:=0; v_best integer:=0; v_run integer:=0; v_prev date; r record;
begin
  select exists(select 1 from public.daily_poll_answers a join public.daily_polls p on p.id=a.poll_id where a.user_id=p_user and p.poll_date=p_date) into v_poll;
  select exists(select 1 from public.daily_bracket_matchups m join public.daily_draft_brackets b on b.id=m.bracket_id where m.user_id=p_user and b.game_date=p_date and m.round_number=3) into v_bracket;
  select exists(select 1 from public.daily_quiz_answers a join public.daily_quizzes q on q.id=a.quiz_id where a.user_id=p_user and q.quiz_date=p_date) into v_quiz;
  if v_poll and v_bracket and v_quiz then insert into public.daily_three_completions(user_id,activity_date) values(p_user,p_date) on conflict do nothing; end if;
  select count(*)::integer into v_total from public.daily_three_completions where user_id=p_user;
  for r in select activity_date from public.daily_three_completions where user_id=p_user order by activity_date loop
    if v_prev is not null and r.activity_date=v_prev+1 then v_run:=v_run+1; else v_run:=1; end if;
    v_best:=greatest(v_best,v_run); v_prev:=r.activity_date;
  end loop;
  v_prev:=p_date; v_current:=0;
  while exists(select 1 from public.daily_three_completions where user_id=p_user and activity_date=v_prev) loop v_current:=v_current+1; v_prev:=v_prev-1; end loop;
  perform public.set_badge_progress(p_user,'daily_trio','',v_total);
  perform public.set_badge_progress(p_user,'community_regular','',v_total);
  perform public.set_badge_progress(p_user,'daily_streak','',greatest(v_current,v_best));
end; $$;

ALTER FUNCTION "public"."refresh_daily_three"("p_user" "uuid", "p_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refresh_my_account_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_name text;
  v_map jsonb := jsonb_build_object(
    'draftDayHero','draft_day_hero',
    'leagueChampion','league_champion',
    'playoffQualifier','playoff_qualifier',
    'predictionChampion','prediction_champion',
    'biggestTrader','trade_master',
    'waiverWireWizard','waiver_wizard',
    'perfectSeason','perfect_season',
    'giantSlayer','giant_slayer'
  );
  v_key text;
  v_code text;
  v_total integer;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view badges.';
  end if;

  select coalesce(nullif(display_name,''), username)
    into v_name
  from public.profiles
  where id = auth.uid();

  for v_key, v_code in
    select key, value #>> '{}'
    from jsonb_each(v_map)
  loop
    select coalesce(sum(
      case
        when jsonb_typeof(s.state #> array['badges',v_name,v_key]) = 'number'
          then (s.state #>> array['badges',v_name,v_key])::integer
        else 0
      end
    ),0)::integer
      into v_total
    from public.league_state_snapshots s
    join public.league_memberships m on m.league_id = s.league_id
    where m.user_id = auth.uid();

    perform public.set_badge_progress(auth.uid(), v_code, '', v_total);
  end loop;

  with current_wins as (
    select count(*)::integer total
    from public.league_state_snapshots s
    join public.league_memberships lm on lm.league_id = s.league_id
    cross join lateral jsonb_each(
      case when jsonb_typeof(s.state->'matchResults') = 'object'
        then s.state->'matchResults' else '{}'::jsonb end
    ) result
    where lm.user_id = auth.uid()
      and lower(coalesce(s.state #>> array[
        'teams',
        case
          when coalesce((result.value->>'gamesA')::integer,0) >
               coalesce((result.value->>'gamesB')::integer,0)
            then s.state #>> array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'0']
          else s.state #>> array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'1']
        end,
        'claimedBy'
      ],'')) = lower(v_name)
  ),
  archived_wins as (
    select coalesce(sum(coalesce((standing.value->>'w')::integer,0)),0)::integer total
    from public.league_state_snapshots s
    join public.league_memberships lm on lm.league_id = s.league_id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(s.state->'seasonHistory') = 'array'
        then s.state->'seasonHistory' else '[]'::jsonb end
    ) season
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(season.value->'standings') = 'array'
        then season.value->'standings' else '[]'::jsonb end
    ) standing
    where lm.user_id = auth.uid()
      and lower(coalesce(season.value #>> array['teams',standing.value->>'id','claimedBy'],'')) = lower(v_name)
  )
  select coalesce((select total from current_wins),0) +
         coalesce((select total from archived_wins),0)
    into v_total;

  perform public.set_badge_progress(auth.uid(), 'career_wins', '', v_total);

  for r in
    with roster_mons as (
      select mon.value mon
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_each(
        case when jsonb_typeof(s.state->'rosters') = 'object'
          then s.state->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array'
          then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(s.state #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)

      union all

      select mon.value
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.state->'seasonHistory') = 'array'
          then s.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral jsonb_each(
        case when jsonb_typeof(season.value->'rosters') = 'object'
          then season.value->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array'
          then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(season.value #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)
    )
    select mon->>'name' subject, count(*)::integer total
    from roster_mons
    where mon->>'name' is not null
    group by mon->>'name'
  loop
    perform public.set_badge_progress(
      auth.uid(),
      'pokemon_loyalist',
      r.subject,
      r.total
    );
  end loop;

  for r in
    with roster_mons as (
      select mon.value mon
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_each(
        case when jsonb_typeof(s.state->'rosters') = 'object'
          then s.state->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array'
          then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(s.state #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)

      union all

      select mon.value
      from public.league_state_snapshots s
      join public.league_memberships lm on lm.league_id = s.league_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.state->'seasonHistory') = 'array'
          then s.state->'seasonHistory' else '[]'::jsonb end
      ) season
      cross join lateral jsonb_each(
        case when jsonb_typeof(season.value->'rosters') = 'object'
          then season.value->'rosters' else '{}'::jsonb end
      ) rr
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(rr.value) = 'array'
          then rr.value else '[]'::jsonb end
      ) mon
      where lm.user_id = auth.uid()
        and lower(coalesce(season.value #>> array['teams',rr.key,'claimedBy'],'')) = lower(v_name)
    )
    select coalesce(mon->>'gen','Unknown') subject,
           count(*)::integer total
    from roster_mons
    group by coalesce(mon->>'gen','Unknown')
  loop
    if r.subject <> 'Unknown' then
      perform public.set_badge_progress(
        auth.uid(),
        'generation_veteran',
        r.subject,
        r.total
      );
    end if;
  end loop;

  return public.get_my_badge_profile();
end;
$$;

ALTER FUNCTION "public"."refresh_my_account_badges"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refresh_my_daily_three_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to refresh Daily Three badges.';
  end if;

  for r in
    select distinct activity_date
    from (
      select p.poll_date activity_date
      from public.daily_poll_answers a
      join public.daily_polls p on p.id = a.poll_id
      where a.user_id = auth.uid()

      union all

      select b.game_date
      from public.daily_bracket_matchups m
      join public.daily_draft_brackets b on b.id = m.bracket_id
      where m.user_id = auth.uid()
        and m.round_number = 3

      union all

      select q.quiz_date
      from public.daily_quiz_answers a
      join public.daily_quizzes q on q.id = a.quiz_id
      where a.user_id = auth.uid()
    ) activity
  loop
    perform public.refresh_daily_three(auth.uid(), r.activity_date);
  end loop;

  return public.refresh_my_account_badges();
end;
$$;

ALTER FUNCTION "public"."refresh_my_daily_three_badges"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_league_manager"("p_league_id" "uuid", "p_username" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_target_id uuid; v_target public.league_memberships; v_actor_role public.membership_role; v_state jsonb; v_name text;
begin
  select role into v_actor_role from public.league_memberships where league_id = p_league_id and user_id = auth.uid();
  if v_actor_role not in ('commissioner', 'co_commissioner') then raise exception 'Only league commissioners can remove managers.'; end if;
  select id, display_name into v_target_id, v_name from public.profiles where lower(username) = lower(trim(p_username));
  if v_target_id is null then raise exception 'No DraftCenter account has that username.'; end if;
  select * into v_target from public.league_memberships where league_id = p_league_id and user_id = v_target_id for update;
  if v_target.id is null then raise exception 'That user is not in this league.'; end if;
  if v_target.user_id = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  if v_target.role = 'commissioner' then raise exception 'The primary commissioner cannot be removed.'; end if;
  if v_actor_role = 'co_commissioner' and v_target.role <> 'coach' then raise exception 'Only the primary commissioner can remove a co-commissioner.'; end if;
  update public.teams set owner_membership_id = null where league_id = p_league_id and owner_membership_id = v_target.id;
  delete from public.team_assignments where assigned_to = v_target_id and team_id in (select id from public.teams where league_id = p_league_id);
  delete from public.league_memberships where id = v_target.id;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is not null then
    v_state := jsonb_set(v_state, '{teams}', coalesce((select jsonb_agg(case when lower(coalesce(team.value ->> 'claimedBy', '')) = lower(coalesce(v_name, '')) then jsonb_set(team.value, '{claimedBy}', 'null'::jsonb, true) else team.value end order by team.ordinality) from jsonb_array_elements(v_state -> 'teams') with ordinality as team(value, ordinality)), '[]'::jsonb));
    update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = p_league_id;
  end if;
  insert into public.league_events(league_id, kind, actor_id, payload) values (p_league_id, 'manager_removed', auth.uid(), jsonb_build_object('username', lower(trim(p_username))));
end;
$$;

ALTER FUNCTION "public"."remove_league_manager"("p_league_id" "uuid", "p_username" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."report_operational_issue"("p_kind" "text", "p_message" "text", "p_league_id" "uuid" DEFAULT NULL::"uuid", "p_context" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before reporting an operational issue.';
  end if;

  if p_kind not in (
    'league_save_failed',
    'draft_operation_failed',
    'result_save_failed',
    'client_runtime_error'
  ) then
    raise exception 'Unsupported operational issue category.';
  end if;

  if p_league_id is not null
     and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;

  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and occurred_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  insert into public.operational_health_events(
    actor_id,
    league_id,
    kind,
    message,
    context
  )
  values (
    auth.uid(),
    p_league_id,
    p_kind,
    left(coalesce(nullif(btrim(p_message), ''), 'Unknown client error'), 1000),
    case
      when jsonb_typeof(p_context) = 'object'
       and pg_column_size(p_context) <= 4096
        then p_context
      else '{}'::jsonb
    end
  );
end;
$$;

ALTER FUNCTION "public"."report_operational_issue"("p_kind" "text", "p_message" "text", "p_league_id" "uuid", "p_context" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reset_current_league_cycle"("p_league_id" "uuid", "p_state" "jsonb", "p_mode" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_mode text := lower(btrim(coalesce(p_mode, '')));
  v_index integer;
  v_existing_team jsonb;
  v_incoming_team jsonb;
  v_existing_history jsonb;
  v_incoming_history jsonb;
  v_existing_last jsonb;
  v_incoming_last jsonb;
  v_existing_log jsonb;
  v_incoming_log jsonb;
  v_scheduled_at timestamptz;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can reset the current league cycle.';
  end if;
  if v_mode not in ('restart_draft', 'rebuild_season') then
    raise exception 'Choose a valid reset mode.';
  end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or jsonb_typeof(p_state -> 'seasonHistory') <> 'array' then
    raise exception 'The replacement league state is incomplete.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;
  if coalesce((p_state ->> 'rev')::bigint, -1)
     <> coalesce((v_existing ->> 'rev')::bigint, 0) + 1 then
    raise exception 'This league changed in another session. Reload before resetting it.';
  end if;
  if greatest(1, coalesce((p_state ->> 'seasonNumber')::integer, 1))
     <> greatest(1, coalesce((v_existing ->> 'seasonNumber')::integer, 1)) then
    raise exception 'A reset cannot change the current season number.';
  end if;

  if jsonb_typeof(v_existing -> 'teams') <> 'array'
     or jsonb_array_length(p_state -> 'teams')
       <> jsonb_array_length(v_existing -> 'teams') then
    raise exception 'A reset cannot add or remove teams.';
  end if;
  if jsonb_array_length(v_existing -> 'teams') > 0 then
    for v_index in 0..jsonb_array_length(v_existing -> 'teams') - 1 loop
      v_existing_team := v_existing #> array['teams', v_index::text];
      v_incoming_team := p_state #> array['teams', v_index::text];
      if coalesce(v_incoming_team ->> 'id', '')
           <> coalesce(v_existing_team ->> 'id', '')
         or coalesce(v_incoming_team ->> 'claimedBy', '')
           <> coalesce(v_existing_team ->> 'claimedBy', '') then
        raise exception 'Team identity and ownership must survive a reset.';
      end if;
    end loop;
  end if;

  v_existing_history := case
    when jsonb_typeof(v_existing -> 'seasonHistory') = 'array'
    then v_existing -> 'seasonHistory'
    else '[]'::jsonb
  end;
  v_incoming_history := p_state -> 'seasonHistory';
  if jsonb_array_length(v_incoming_history)
     <> jsonb_array_length(v_existing_history) then
    raise exception 'A reset cannot add or remove archived seasons.';
  end if;

  if v_mode = 'restart_draft' then
    if v_incoming_history is distinct from v_existing_history then
      raise exception 'Restarting a draft cannot rewrite league history.';
    end if;
    if jsonb_array_length(coalesce(v_existing -> 'schedule', '[]'::jsonb)) > 0
       or coalesce(v_existing -> 'matchResults', '{}'::jsonb) <> '{}'::jsonb
       or jsonb_array_length(coalesce(v_existing -> 'trades', '[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(v_existing -> 'transactionLog', '[]'::jsonb)) > 0
       or coalesce(v_existing -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb then
      raise exception 'Competition activity exists. Rebuild the season instead of restarting only the draft.';
    end if;
  elsif jsonb_array_length(v_existing_history) > 0 then
    -- Rebuild may recover missing pick rows into only the newest archive's
    -- draftLog. Every older archive and every other newest-archive field is
    -- immutable.
    if jsonb_array_length(v_existing_history) > 1 and exists (
      select 1
      from generate_series(
        0,
        jsonb_array_length(v_existing_history) - 2
      ) as series(history_index)
      where v_incoming_history -> history_index
        is distinct from v_existing_history -> history_index
    ) then
      raise exception 'Older archived seasons cannot be rewritten.';
    end if;
    v_existing_last := v_existing_history -> (jsonb_array_length(v_existing_history) - 1);
    v_incoming_last := v_incoming_history -> (jsonb_array_length(v_incoming_history) - 1);
    v_existing_log := case
      when jsonb_typeof(v_existing_last -> 'draftLog') = 'array'
      then v_existing_last -> 'draftLog'
      else '[]'::jsonb
    end;
    v_incoming_log := case
      when jsonb_typeof(v_incoming_last -> 'draftLog') = 'array'
      then v_incoming_last -> 'draftLog'
      else '[]'::jsonb
    end;
    if (v_incoming_last - 'draftLog') is distinct from (v_existing_last - 'draftLog')
       or jsonb_array_length(v_incoming_log) < jsonb_array_length(v_existing_log)
       or exists (
         select 1
         from generate_series(
           0,
           jsonb_array_length(v_existing_log) - 1
         ) as series(log_index)
         where v_incoming_log -> log_index is distinct from v_existing_log -> log_index
       ) then
      raise exception 'Rebuild can only append recovered picks to the newest archived draft log.';
    end if;
  end if;

  if coalesce((p_state ->> 'locked')::boolean, true)
     or coalesce(p_state -> 'liveDraft', 'null'::jsonb) <> 'null'::jsonb
     or jsonb_array_length(coalesce(p_state -> 'rosters', '[]'::jsonb)) <> 0
     or jsonb_array_length(coalesce(p_state -> 'budgets', '[]'::jsonb)) <> 0
     or jsonb_array_length(coalesce(p_state -> 'pool', '[]'::jsonb)) <> 0
     or coalesce((p_state ->> 'pickIndex')::integer, -1) <> 0 then
    raise exception 'The replacement state still contains active draft data.';
  end if;
  if v_mode = 'rebuild_season'
     and (
       jsonb_array_length(coalesce(p_state -> 'schedule', '[]'::jsonb)) <> 0
       or coalesce(p_state -> 'matchResults', '{}'::jsonb) <> '{}'::jsonb
       or jsonb_array_length(coalesce(p_state -> 'trades', '[]'::jsonb)) <> 0
       or jsonb_array_length(coalesce(p_state -> 'transactionLog', '[]'::jsonb)) <> 0
       or coalesce(p_state -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb
     ) then
    raise exception 'The rebuilt season still contains competition activity.';
  end if;

  delete from public.roster_entries entry
  using public.teams team
  where entry.team_id = team.id
    and team.league_id = p_league_id;
  delete from public.draft_picks pick
  using public.draft_sessions session
  where pick.draft_session_id = session.id
    and session.league_id = p_league_id;
  delete from public.draft_sessions
  where league_id = p_league_id;
  update public.league_pokemon
  set is_drafted = false
  where league_id = p_league_id;
  delete from public.auction_team_owners
  where league_id = p_league_id;
  delete from public.league_free_agent_claims
  where league_id = p_league_id;

  update public.league_state_snapshots
  set state = p_state,
      revision = coalesce(v_existing_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  begin
    v_scheduled_at := nullif(p_state #>> '{settings,draftScheduledAt}', '')::timestamptz;
  exception when others then
    raise exception 'The preserved draft time is invalid.';
  end;
  update public.leagues
  set settings = coalesce(p_state -> 'settings', '{}'::jsonb),
      status = 'setup',
      draft_starts_at = v_scheduled_at,
      updated_at = now()
  where id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when v_mode = 'restart_draft'
      then 'draft_restarted'
      else 'current_season_rebuilt'
    end,
    auth.uid(),
    jsonb_build_object(
      'season_number',
      greatest(1, coalesce((p_state ->> 'seasonNumber')::integer, 1))
    )
  );
  return p_state;
end;
$$;

ALTER FUNCTION "public"."reset_current_league_cycle"("p_league_id" "uuid", "p_state" "jsonb", "p_mode" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reset_live_snake_draft"("p_league_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can reset a live draft.';
  end if;

  -- Clear dependent data first. Teams, manager ownership, league settings,
  -- and the league Pokemon catalogue intentionally remain in place.
  delete from public.roster_entries r
  using public.teams t
  where r.team_id = t.id and t.league_id = p_league_id and r.released_at is null;

  delete from public.draft_picks p
  using public.draft_sessions d
  where p.draft_session_id = d.id and d.league_id = p_league_id;

  update public.league_pokemon
  set is_drafted = false
  where league_id = p_league_id;

  -- Provisioning creates a fresh official session on the next start.
  delete from public.draft_sessions where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (p_league_id, 'draft_reset', auth.uid(), jsonb_build_object('reason', 'commissioner restart'));
end;
$$;

ALTER FUNCTION "public"."reset_live_snake_draft"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."restore_my_personal_teams"("p_teams" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_team jsonb;
  v_id uuid;
  v_existing integer;
  v_new integer;
  v_restored integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring My Teams.';
  end if;

  if jsonb_typeof(p_teams) <> 'array'
     or jsonb_array_length(p_teams) > 10 then
    raise exception 'A My Teams recovery file must contain at most 10 teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_teams) team
    where nullif(team ->> 'id', '') is null
       or nullif(btrim(team ->> 'team_name'), '') is null
  ) then
    raise exception 'The recovery file contains an invalid team.';
  end if;

  select count(*) into v_existing
  from public.personal_teams
  where owner_id = auth.uid();

  select count(*) into v_new
  from jsonb_array_elements(p_teams) team
  where not exists (
    select 1
    from public.personal_teams existing
    where existing.id = (team ->> 'id')::uuid
      and existing.owner_id = auth.uid()
  );

  if v_existing + v_new > 10 then
    raise exception 'Restoring this file would exceed the 10-team limit.';
  end if;

  for v_team in
    select value from jsonb_array_elements(p_teams)
  loop
    v_id := (v_team ->> 'id')::uuid;

    update public.personal_teams
    set team_name = btrim(v_team ->> 'team_name'),
        league_name = nullif(btrim(v_team ->> 'league_name'), ''),
        format_name = nullif(btrim(v_team ->> 'format_name'), ''),
        workspace_type = case
          when v_team ->> 'workspace_type' = 'tournament'
            then 'tournament'
          else 'weekly'
        end,
        planning_entries = coalesce(
          v_team -> 'planning_entries',
          '[]'::jsonb
        ),
        notes = coalesce(v_team ->> 'notes', ''),
        weekly_notes = coalesce(v_team ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        replica_code = coalesce(v_team ->> 'replica_code', ''),
        spreadsheet_url = nullif(
          btrim(v_team ->> 'spreadsheet_url'),
          ''
        ),
        pokemon = coalesce(v_team -> 'pokemon', '[]'::jsonb),
        archived = coalesce(
          (v_team ->> 'archived')::boolean,
          false
        ),
        updated_at = now()
    where id = v_id
      and owner_id = auth.uid();

    if not found then
      insert into public.personal_teams (
        id,
        owner_id,
        team_name,
        league_name,
        format_name,
        workspace_type,
        planning_entries,
        notes,
        weekly_notes,
        pokepaste_url,
        replica_code,
        spreadsheet_url,
        pokemon,
        archived
      )
      values (
        v_id,
        auth.uid(),
        btrim(v_team ->> 'team_name'),
        nullif(btrim(v_team ->> 'league_name'), ''),
        nullif(btrim(v_team ->> 'format_name'), ''),
        case
          when v_team ->> 'workspace_type' = 'tournament'
            then 'tournament'
          else 'weekly'
        end,
        coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        coalesce(v_team ->> 'notes', ''),
        coalesce(v_team ->> 'weekly_notes', ''),
        nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        coalesce(v_team ->> 'replica_code', ''),
        nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        coalesce(v_team -> 'pokemon', '[]'::jsonb),
        coalesce((v_team ->> 'archived')::boolean, false)
      );
    end if;

    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

ALTER FUNCTION "public"."restore_my_personal_teams"("p_teams" "jsonb") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_discord_settings" (
    "league_id" "uuid" NOT NULL,
    "guild_id" "text",
    "channel_id" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notify_draft_reminders" boolean DEFAULT true NOT NULL,
    "notify_match_reminders" boolean DEFAULT true NOT NULL,
    "notify_live_streams" boolean DEFAULT true NOT NULL,
    "notify_transactions" boolean DEFAULT false NOT NULL,
    "notify_results" boolean DEFAULT false NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT true NOT NULL,
    "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "quiet_hours_end" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "quiet_hours_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "last_test_at" timestamp with time zone,
    "last_test_status" "text",
    "last_test_error" "text",
    CONSTRAINT "league_discord_settings_check" CHECK ((("enabled" = false) OR (("guild_id" IS NOT NULL) AND ("channel_id" IS NOT NULL))))
);

ALTER TABLE "public"."league_discord_settings" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_league_discord_preferences"("p_league_id" "uuid", "p_notify_draft_reminders" boolean, "p_notify_match_reminders" boolean, "p_notify_live_streams" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") RETURNS "public"."league_discord_settings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settings public.league_discord_settings;
  v_timezone text := nullif(trim(p_quiet_hours_timezone), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage Discord settings.';
  end if;

  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can manage Discord settings.';
  end if;

  if not exists(select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Choose a valid time zone.';
  end if;

  update public.league_discord_settings
  set notify_draft_reminders = coalesce(p_notify_draft_reminders, false),
      notify_match_reminders = coalesce(p_notify_match_reminders, false),
      notify_live_streams = coalesce(p_notify_live_streams, false),
      notify_transactions = coalesce(p_notify_transactions, false),
      notify_results = coalesce(p_notify_results, false),
      quiet_hours_enabled = coalesce(p_quiet_hours_enabled, false),
      quiet_hours_start = coalesce(p_quiet_hours_start, '22:00'::time),
      quiet_hours_end = coalesce(p_quiet_hours_end, '08:00'::time),
      quiet_hours_timezone = v_timezone,
      updated_by = auth.uid(),
      updated_at = now()
  where league_id = p_league_id
  returning * into v_settings;

  if not found then
    raise exception 'Save the Discord server and channel before announcement preferences.';
  end if;

  return v_settings;
end;
$$;

ALTER FUNCTION "public"."save_league_discord_preferences"("p_league_id" "uuid", "p_notify_draft_reminders" boolean, "p_notify_match_reminders" boolean, "p_notify_live_streams" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_league_discord_settings"("p_league_id" "uuid", "p_guild_id" "text", "p_channel_id" "text", "p_enabled" boolean) RETURNS "public"."league_discord_settings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_settings public.league_discord_settings;
  v_guild_id text := nullif(trim(p_guild_id), '');
  v_channel_id text := nullif(trim(p_channel_id), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage Discord settings.';
  end if;

  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can manage Discord settings.';
  end if;

  if v_guild_id is not null and v_guild_id !~ '^[0-9]{17,20}$' then
    raise exception 'Enter a valid Discord server ID.';
  end if;

  if v_channel_id is not null and v_channel_id !~ '^[0-9]{17,20}$' then
    raise exception 'Enter a valid Discord announcement channel ID.';
  end if;

  if coalesce(p_enabled, false) and (v_guild_id is null or v_channel_id is null) then
    raise exception 'Enter both the Discord server ID and announcement channel ID before enabling announcements.';
  end if;

  insert into public.league_discord_settings (
    league_id,
    guild_id,
    channel_id,
    enabled,
    updated_by,
    updated_at
  )
  values (
    p_league_id,
    v_guild_id,
    v_channel_id,
    coalesce(p_enabled, false),
    auth.uid(),
    now()
  )
  on conflict (league_id) do update
  set guild_id = excluded.guild_id,
      channel_id = excluded.channel_id,
      enabled = excluded.enabled,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning * into v_settings;

  return v_settings;
end;
$_$;

ALTER FUNCTION "public"."save_league_discord_settings"("p_league_id" "uuid", "p_guild_id" "text", "p_channel_id" "text", "p_enabled" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_league_prediction"("p_league_id" "uuid", "p_week" integer, "p_match_index" integer, "p_patch" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_name text;
  v_key text;
  v_match jsonb;
  v_existing jsonb;
  v_safe_patch jsonb := '{}'::jsonb;
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to predict.';
  end if;

  if not exists (
    select 1
    from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner', 'coach', 'viewer')
  ) then
    raise exception 'Join or watch this league before predicting.';
  end if;

  if p_week < 0 or p_match_index < 0 then
    raise exception 'That matchup does not exist.';
  end if;

  select state, revision
    into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_match := v_state #> array['schedule', p_week::text, p_match_index::text];
  if v_match is null
     or jsonb_typeof(v_match) <> 'array'
     or jsonb_array_length(v_match) <> 2 then
    raise exception 'That matchup does not exist.';
  end if;

  v_key := p_week::text || '-' || p_match_index::text;

  if v_state #> array['matchResults', v_key] is not null then
    raise exception 'Predictions are closed because this result is final.';
  end if;

  select coalesce(
    nullif(trim(display_name), ''),
    nullif(trim(username), ''),
    'Coach'
  )
  into v_name
  from public.profiles
  where id = auth.uid();

  if p_patch ? 'side' then
    if p_patch ->> 'side' not in ('A', 'B') then
      raise exception 'Prediction side must be A or B.';
    end if;

    v_safe_patch :=
      v_safe_patch ||
      jsonb_build_object('side', p_patch -> 'side');
  end if;

  if p_patch ? 'setScore' then
    if jsonb_typeof(p_patch -> 'setScore') not in ('string', 'null') then
      raise exception 'The predicted score is invalid.';
    end if;

    v_safe_patch :=
      v_safe_patch ||
      jsonb_build_object('setScore', p_patch -> 'setScore');
  end if;

  if p_patch ? 'monsAlive' then
    if jsonb_typeof(p_patch -> 'monsAlive') not in ('number', 'null')
       or (
         jsonb_typeof(p_patch -> 'monsAlive') = 'number'
         and (p_patch ->> 'monsAlive')::integer not between 0 and 6
       ) then
      raise exception 'Mons remaining must be between 0 and 6.';
    end if;

    v_safe_patch :=
      v_safe_patch ||
      jsonb_build_object('monsAlive', p_patch -> 'monsAlive');
  end if;

  if p_patch ? 'gameMargins' then
    if jsonb_typeof(p_patch -> 'gameMargins') not in ('array', 'null') then
      raise exception 'Per-game predictions are invalid.';
    end if;

    v_safe_patch :=
      v_safe_patch ||
      jsonb_build_object('gameMargins', p_patch -> 'gameMargins');
  end if;

  if v_safe_patch = '{}'::jsonb then
    raise exception 'No supported prediction fields were supplied.';
  end if;

  v_existing :=
    coalesce(
      v_state #> array['predictions', v_key, v_name],
      '{}'::jsonb
    );

  v_state := jsonb_set(
    v_state,
    array['predictions', v_key, v_name],
    v_existing || v_safe_patch,
    true
  );

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(
      coalesce(
        (v_state ->> 'rev')::bigint,
        v_revision,
        0
      ) + 1
    ),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$$;

ALTER FUNCTION "public"."save_league_prediction"("p_league_id" "uuid", "p_week" integer, "p_match_index" integer, "p_patch" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_league_snapshot"("p_league_id" "uuid", "p_state" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_revision bigint;
  v_existing jsonb;
  v_next jsonb := p_state;
  v_key text;
  v_incoming_rev bigint;
  v_existing_rev bigint;
  v_protected_keys text[] := array[
    'locked', 'rosters', 'budgets', 'pool', 'auctionNominationOrder',
    'auctionNominationIdx', 'nominationDeadline', 'nominee', 'paused',
    'pausedAt', 'pauseIsOvernight', 'auctionEnded'
  ];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save league state.';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'League state must be a JSON object.';
  end if;

  select state
  into v_existing
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;

  v_incoming_rev := coalesce((p_state ->> 'rev')::bigint, 0);
  v_existing_rev := coalesce((v_existing ->> 'rev')::bigint, 0);
  if v_incoming_rev <= v_existing_rev then
    raise exception 'This league changed in another session. Refresh before saving again.';
  end if;

  if v_existing ? 'messages' then
    v_next := jsonb_set(v_next, '{messages}', v_existing -> 'messages', true);
  end if;
  if v_existing ? 'readReceipts' then
    v_next := jsonb_set(
      v_next,
      '{readReceipts}',
      v_existing -> 'readReceipts',
      true
    );
  end if;
  if coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and coalesce((p_state ->> 'locked')::boolean, false) then
    foreach v_key in array v_protected_keys loop
      if v_existing ? v_key then
        v_next := jsonb_set(v_next, array[v_key], v_existing -> v_key, true);
      end if;
    end loop;
  elsif coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and not coalesce((p_state ->> 'locked')::boolean, false) then
    delete from public.auction_team_owners
    where league_id = p_league_id;
  end if;

  update public.league_state_snapshots
  set state = v_next,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id
  returning revision into v_revision;
  return v_revision;
end;
$$;

ALTER FUNCTION "public"."save_league_snapshot"("p_league_id" "uuid", "p_state" "jsonb") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."discord_user_connections" (
    "user_id" "uuid" NOT NULL,
    "discord_user_id" "text" NOT NULL,
    "discord_username" "text" NOT NULL,
    "discord_avatar" "text",
    "manageable_guilds" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dm_enabled" boolean DEFAULT false NOT NULL,
    "notify_draft_reminders" boolean DEFAULT true NOT NULL,
    "notify_match_scheduling" boolean DEFAULT true NOT NULL,
    "notify_match_reminders" boolean DEFAULT true NOT NULL,
    "notify_transactions" boolean DEFAULT false NOT NULL,
    "notify_results" boolean DEFAULT false NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT true NOT NULL,
    "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    "quiet_hours_end" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "quiet_hours_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "last_dm_test_at" timestamp with time zone,
    "last_dm_test_status" "text",
    "last_dm_test_error" "text"
);

ALTER TABLE "public"."discord_user_connections" OWNER TO "postgres";

COMMENT ON COLUMN "public"."discord_user_connections"."manageable_guilds" IS 'Retained temporarily for schema compatibility; personal OAuth stores an empty array.';

CREATE OR REPLACE FUNCTION "public"."save_my_discord_notification_preferences"("p_dm_enabled" boolean, "p_notify_draft_reminders" boolean, "p_notify_match_scheduling" boolean, "p_notify_match_reminders" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") RETURNS "public"."discord_user_connections"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_connection public.discord_user_connections;
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage personal Discord notifications.';
  end if;

  if not exists (
    select 1
    from pg_timezone_names
    where name = nullif(trim(p_quiet_hours_timezone), '')
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  update public.discord_user_connections
  set dm_enabled = coalesce(p_dm_enabled, false),
      notify_draft_reminders = coalesce(p_notify_draft_reminders, false),
      notify_match_scheduling = coalesce(p_notify_match_scheduling, false),
      notify_match_reminders = coalesce(p_notify_match_reminders, false),
      notify_transactions = coalesce(p_notify_transactions, false),
      notify_results = coalesce(p_notify_results, false),
      quiet_hours_enabled = coalesce(p_quiet_hours_enabled, false),
      quiet_hours_start = coalesce(p_quiet_hours_start, '22:00'::time),
      quiet_hours_end = coalesce(p_quiet_hours_end, '08:00'::time),
      quiet_hours_timezone = trim(p_quiet_hours_timezone),
      updated_at = now()
  where user_id = auth.uid()
  returning * into v_connection;

  if v_connection.user_id is null then
    raise exception 'Connect your Discord profile before enabling personal notifications.';
  end if;

  return v_connection;
end;
$$;

ALTER FUNCTION "public"."save_my_discord_notification_preferences"("p_dm_enabled" boolean, "p_notify_draft_reminders" boolean, "p_notify_match_scheduling" boolean, "p_notify_match_reminders" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_playoff_result"("p_league_id" "uuid", "p_result_key" "text", "p_result" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_state jsonb;
  v_revision bigint;
  v_games_a integer;
  v_games_b integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report playoff results.';
  end if;

  if p_result_key !~ '^[0-9]+-[0-9]+$' then
    raise exception 'Invalid playoff matchup.';
  end if;

  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'A playoff result object is required.';
  end if;

  v_games_a := coalesce((p_result ->> 'gamesA')::integer, 0);
  v_games_b := coalesce((p_result ->> 'gamesB')::integer, 0);

  if v_games_a < 0
     or v_games_b < 0
     or v_games_a = v_games_b
     or v_games_a > 3
     or v_games_b > 3 then
    raise exception 'Enter a completed best-of-1, best-of-3, or best-of-5 result.';
  end if;

  select state, revision
  into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null or jsonb_typeof(v_state -> 'playoffs') <> 'object' then
    raise exception 'The playoff bracket was not found.';
  end if;

  v_state := jsonb_set(
    v_state,
    array['playoffs', 'results', p_result_key],
    p_result,
    true
  );

  v_state := jsonb_set(
    v_state,
    array['rev'],
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = coalesce(v_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$_$;

ALTER FUNCTION "public"."save_playoff_result"("p_league_id" "uuid", "p_result_key" "text", "p_result" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_playoff_result_v2"("p_league_id" "uuid", "p_path" "text"[], "p_team_a" integer, "p_team_b" integer, "p_result" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_state jsonb;
  v_revision bigint;
  v_identity text;
  v_playoffs jsonb;
  v_mode text;
  v_parent jsonb;
  v_existing jsonb;
  v_team_count integer;
  v_games_a integer;
  v_games_b integer;
  v_best_of integer;
  v_wins_needed integer;
  v_mons_alive_a integer;
  v_mons_alive_b integer;
  v_replay_a text;
  v_replay_b text;
  v_mvp jsonb;
  v_mvp_team integer;
  v_saved_result jsonb;
  v_result_key text;
  v_division_index integer;
  v_allowed_path boolean := false;
  v_seeded_a boolean := false;
  v_seeded_b boolean := false;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report playoff results.';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'A playoff result object is required.';
  end if;
  if p_team_a is null or p_team_b is null
     or p_team_a < 0 or p_team_b < 0 or p_team_a = p_team_b then
    raise exception 'Choose a valid playoff matchup.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity
  from public.profiles
  where id = auth.uid();
  if nullif(v_identity, '') is null then
    raise exception 'Complete your DraftCenter profile before reporting a result.';
  end if;

  select state, revision
  into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_playoffs := v_state -> 'playoffs';
  if jsonb_typeof(v_playoffs) <> 'object' then
    raise exception 'The playoff bracket was not found.';
  end if;
  v_mode := coalesce(v_playoffs ->> 'mode', 'single');
  v_team_count := jsonb_array_length(
    coalesce(v_state -> 'teams', '[]'::jsonb)
  );
  if p_team_a >= v_team_count or p_team_b >= v_team_count then
    raise exception 'That playoff team was not found.';
  end if;

  if not public.is_league_staff(p_league_id)
     and lower(coalesce(
       v_state #>> array['teams', p_team_a::text, 'claimedBy'],
       ''
     )) <> lower(v_identity)
     and lower(coalesce(
       v_state #>> array['teams', p_team_b::text, 'claimedBy'],
       ''
     )) <> lower(v_identity) then
    raise exception 'You can only report a playoff matchup involving your own team.';
  end if;

  if coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'results'
     and p_path[2] ~ '^[0-9]+-[0-9]+$'
     and v_mode <> 'divisions' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'results';

  elsif coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'losersResults'
     and p_path[2] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'double-elim' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'losersResults';

  elsif coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'grandFinal'
     and p_path[2] in ('game1', 'game2')
     and v_mode = 'double-elim' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'grandFinal';

  elsif coalesce(array_length(p_path, 1), 0) = 4
     and p_path[1] = 'divisionBrackets'
     and p_path[2] ~ '^[0-9]+$'
     and p_path[3] = 'results'
     and p_path[4] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'divisions' then
    v_division_index := p_path[2]::integer;
    if v_division_index < jsonb_array_length(
      coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
    ) then
      v_allowed_path := true;
      v_result_key := p_path[4];
      v_parent := v_playoffs
        #> array['divisionBrackets', p_path[2], 'results'];
    end if;

  elsif coalesce(array_length(p_path, 1), 0) = 3
     and p_path[1] = 'championBracket'
     and p_path[2] = 'results'
     and p_path[3] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'divisions' then
    v_allowed_path := true;
    v_result_key := p_path[3];
    v_parent := v_playoffs #> '{championBracket,results}';
  end if;

  if not v_allowed_path or jsonb_typeof(v_parent) <> 'object' then
    raise exception 'That playoff result path is not valid for this bracket.';
  end if;

  if v_mode = 'divisions' then
    select
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
        ) as bracket(value)
        cross join lateral jsonb_array_elements_text(
          coalesce(bracket.value -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_a
      ),
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
        ) as bracket(value)
        cross join lateral jsonb_array_elements_text(
          coalesce(bracket.value -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_b
      )
    into v_seeded_a, v_seeded_b;
  else
    select
      exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(v_playoffs -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_a
      ),
      exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(v_playoffs -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_b
      )
    into v_seeded_a, v_seeded_b;
  end if;
  if not v_seeded_a or not v_seeded_b then
    raise exception 'That team is not part of this playoff bracket.';
  end if;

  v_existing := v_state #> (array['playoffs']::text[] || p_path);
  if jsonb_typeof(v_existing) = 'object'
     and (
       (v_existing ->> 'teamA') is not null
       or (v_existing ->> 'teamB') is not null
     )
     and (
       (v_existing ->> 'teamA')::integer <> p_team_a
       or (v_existing ->> 'teamB')::integer <> p_team_b
     ) then
    raise exception 'That bracket slot has changed. Refresh before reporting it.';
  end if;

  v_games_a := coalesce((p_result ->> 'gamesA')::integer, 0);
  v_games_b := coalesce((p_result ->> 'gamesB')::integer, 0);
  v_best_of := coalesce((p_result ->> 'bestOf')::integer, 3);
  if v_best_of not in (1, 3, 5) then
    raise exception 'Choose a best-of-1, best-of-3, or best-of-5 result.';
  end if;
  v_wins_needed := (v_best_of + 1) / 2;
  if v_games_a < 0 or v_games_b < 0
     or not (
       (v_games_a = v_wins_needed and v_games_b < v_wins_needed)
       or (v_games_b = v_wins_needed and v_games_a < v_wins_needed)
     ) then
    raise exception 'Enter a completed result for the selected series length.';
  end if;

  v_mons_alive_a := coalesce((p_result ->> 'monsAliveA')::integer, 0);
  v_mons_alive_b := coalesce((p_result ->> 'monsAliveB')::integer, 0);
  if v_mons_alive_a < 0 or v_mons_alive_b < 0
     or v_mons_alive_a > 6 * v_games_a
     or v_mons_alive_b > 6 * v_games_b then
    raise exception 'Enter valid remaining-Pokemon totals.';
  end if;

  v_replay_a := nullif(btrim(p_result ->> 'replayUrlA'), '');
  v_replay_b := nullif(btrim(p_result ->> 'replayUrlB'), '');
  if (
    v_replay_a is not null
    and (char_length(v_replay_a) > 2000 or v_replay_a !~* '^https://')
  ) or (
    v_replay_b is not null
    and (char_length(v_replay_b) > 2000 or v_replay_b !~* '^https://')
  ) then
    raise exception 'Replay links must be secure web addresses.';
  end if;

  v_mvp := p_result -> 'mvp';
  if v_mvp is not null and jsonb_typeof(v_mvp) <> 'null' then
    if jsonb_typeof(v_mvp) <> 'object'
       or coalesce(v_mvp ->> 'side', '') not in ('A', 'B')
       or nullif(btrim(v_mvp ->> 'name'), '') is null
       or char_length(v_mvp ->> 'name') > 120 then
      raise exception 'Choose a valid Match MVP.';
    end if;
    v_mvp_team := case
      when v_mvp ->> 'side' = 'A' then p_team_a
      else p_team_b
    end;
    if (
      (v_mvp ->> 'side' = 'A' and v_games_a < v_games_b)
      or (v_mvp ->> 'side' = 'B' and v_games_b < v_games_a)
      or not exists (
        select 1
        from jsonb_array_elements(
          coalesce(
            v_state #> array['rosters', v_mvp_team::text],
            '[]'::jsonb
          )
        ) pokemon
        where pokemon ->> 'name' = v_mvp ->> 'name'
      )
    ) then
      raise exception 'The Match MVP must come from the winning roster.';
    end if;
  else
    v_mvp := 'null'::jsonb;
  end if;

  v_saved_result := jsonb_build_object(
    'gamesA', v_games_a,
    'gamesB', v_games_b,
    'bestOf', v_best_of,
    'monsAliveA', v_mons_alive_a,
    'monsAliveB', v_mons_alive_b,
    'reportedBy', v_identity,
    'replayUrlA', v_replay_a,
    'replayUrlB', v_replay_b,
    'mvp', v_mvp,
    'teamA', p_team_a,
    'teamB', p_team_b
  );

  v_state := jsonb_set(
    v_state,
    array['playoffs']::text[] || p_path,
    v_saved_result,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = coalesce(v_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'playoff_result',
    auth.uid(),
    jsonb_build_object(
      'path',
      to_jsonb(p_path),
      'team_a',
      p_team_a,
      'team_b',
      p_team_b
    )
  );

  return v_state;
end;
$_$;

ALTER FUNCTION "public"."save_playoff_result_v2"("p_league_id" "uuid", "p_path" "text"[], "p_team_a" integer, "p_team_b" integer, "p_result" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_public_match_prediction"("p_slug" "text", "p_match_key" "text", "p_team_index" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_league_id uuid;
  v_state jsonb;
  v_week integer;
  v_match integer;
  v_pair jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to make a prediction.';
  end if;

  select l.id, s.state into v_league_id, v_state
  from public.leagues l
  join public.league_state_snapshots s on s.league_id = l.id
  where l.slug = p_slug
    and l.league_visibility in ('watch', 'open');

  if v_league_id is null then
    raise exception 'That public league was not found.';
  end if;

  if p_match_key !~ '^[0-9]+-[0-9]+$' then
    raise exception 'Invalid matchup.';
  end if;

  v_week := split_part(p_match_key, '-', 1)::integer;
  v_match := split_part(p_match_key, '-', 2)::integer;
  v_pair := v_state #> array['schedule', v_week::text, v_match::text];

  if v_pair is null
    or p_team_index not in (
      (v_pair ->> 0)::integer,
      (v_pair ->> 1)::integer
    )
  then
    raise exception 'Choose a team in that matchup.';
  end if;

  if (v_state -> 'matchResults') ? p_match_key then
    raise exception 'Predictions close when a result is reported.';
  end if;

  insert into public.public_match_predictions (
    league_id,
    user_id,
    match_key,
    predicted_team_index
  )
  values (
    v_league_id,
    auth.uid(),
    p_match_key,
    p_team_index
  )
  on conflict (league_id, user_id, match_key)
  do update set
    predicted_team_index = excluded.predicted_team_index,
    updated_at = now();
end;
$_$;

ALTER FUNCTION "public"."save_public_match_prediction"("p_slug" "text", "p_match_key" "text", "p_team_index" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_regular_season_result"("p_league_id" "uuid", "p_week" integer, "p_match" integer, "p_result" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_revision bigint;
  v_match jsonb;
  v_team_a integer;
  v_team_b integer;
  v_identity text;
  v_games_a integer;
  v_games_b integer;
  v_best_of integer;
  v_wins_needed integer;
  v_mons_alive_a integer;
  v_mons_alive_b integer;
  v_replay_a text;
  v_replay_b text;
  v_mvp jsonb;
  v_saved_result jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report match results.';
  end if;

  if p_week is null or p_match is null or p_week < 0 or p_match < 0
     or p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Choose a valid scheduled matchup.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity
  from public.profiles
  where id = auth.uid();

  if nullif(v_identity, '') is null then
    raise exception 'Complete your DraftCenter profile before reporting a result.';
  end if;

  select state, revision
  into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_match := v_state #> array['schedule', p_week::text, p_match::text];

  if jsonb_typeof(v_match) <> 'array' or jsonb_array_length(v_match) <> 2 then
    raise exception 'That scheduled matchup was not found.';
  end if;

  v_team_a := (v_match ->> 0)::integer;
  v_team_b := (v_match ->> 1)::integer;

  if not public.is_league_staff(p_league_id)
     and lower(coalesce(v_state #>> array['teams', v_team_a::text, 'claimedBy'], '')) <> lower(v_identity)
     and lower(coalesce(v_state #>> array['teams', v_team_b::text, 'claimedBy'], '')) <> lower(v_identity) then
    raise exception 'You can only report a matchup involving your own team.';
  end if;

  v_games_a := coalesce((p_result ->> 'gamesA')::integer, 0);
  v_games_b := coalesce((p_result ->> 'gamesB')::integer, 0);
  v_best_of := coalesce((p_result ->> 'bestOf')::integer, 3);

  if v_best_of not in (1, 3, 5) then
    raise exception 'Choose a best-of-1, best-of-3, or best-of-5 result.';
  end if;

  v_wins_needed := (v_best_of + 1) / 2;

  if v_games_a < 0 or v_games_b < 0
     or not (
       (v_games_a = v_wins_needed and v_games_b < v_wins_needed)
       or (v_games_b = v_wins_needed and v_games_a < v_wins_needed)
     ) then
    raise exception 'Enter a completed result for the selected series length.';
  end if;

  v_mons_alive_a := coalesce((p_result ->> 'monsAliveA')::integer, 0);
  v_mons_alive_b := coalesce((p_result ->> 'monsAliveB')::integer, 0);

  if v_mons_alive_a < 0 or v_mons_alive_b < 0
     or v_mons_alive_a > 6 * v_games_a
     or v_mons_alive_b > 6 * v_games_b then
    raise exception 'Enter valid remaining-Pokemon totals.';
  end if;

  v_replay_a := nullif(btrim(p_result ->> 'replayUrlA'), '');
  v_replay_b := nullif(btrim(p_result ->> 'replayUrlB'), '');

  if (v_replay_a is not null and (
        char_length(v_replay_a) > 2000
        or v_replay_a !~* '^https://'
      ))
     or (v_replay_b is not null and (
        char_length(v_replay_b) > 2000
        or v_replay_b !~* '^https://'
      )) then
    raise exception 'Replay links must be secure web addresses.';
  end if;

  v_mvp := p_result -> 'mvp';

  if v_mvp is not null and jsonb_typeof(v_mvp) <> 'null' then
    if jsonb_typeof(v_mvp) <> 'object'
       or coalesce(v_mvp ->> 'side', '') not in ('A', 'B')
       or nullif(btrim(v_mvp ->> 'name'), '') is null
       or char_length(v_mvp ->> 'name') > 120 then
      raise exception 'Choose a valid Match MVP.';
    end if;
  else
    v_mvp := 'null'::jsonb;
  end if;

  v_saved_result := jsonb_build_object(
    'gamesA', v_games_a,
    'gamesB', v_games_b,
    'bestOf', v_best_of,
    'monsAliveA', v_mons_alive_a,
    'monsAliveB', v_mons_alive_b,
    'reportedBy', v_identity,
    'replayUrlA', v_replay_a,
    'replayUrlB', v_replay_b,
    'mvp', v_mvp
  );

  if jsonb_typeof(v_state -> 'matchResults') <> 'object' then
    v_state := jsonb_set(v_state, '{matchResults}', '{}'::jsonb, true);
  end if;

  v_state := jsonb_set(
    v_state,
    array['matchResults', p_week::text || '-' || p_match::text],
    v_saved_result,
    true
  );

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = coalesce(v_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$$;

ALTER FUNCTION "public"."save_regular_season_result"("p_league_id" "uuid", "p_week" integer, "p_match" integer, "p_result" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."schedule_draft_reminders"("p_league_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_start timestamptz;
  v_name text;
  v_count integer := 0;
  v_rows integer := 0;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can schedule reminders.';
  end if;

  select draft_starts_at, name
  into v_start, v_name
  from public.leagues
  where id = p_league_id;

  if v_start is null then
    raise exception 'Set a draft date and time first.';
  end if;

  -- A changed draft time replaces all undelivered timed reminders.
  delete from public.notification_events
  where league_id = p_league_id
    and kind = 'draft_reminder'
    and sent_at is null;

  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  select
    p_league_id,
    m.user_id,
    'draft_reminder',
    'email',
    'draft-email:' || p_league_id::text || ':' ||
      extract(epoch from v_start)::bigint::text || ':' ||
      reminder.hours_before::text || ':' || m.user_id::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object(
      'subject', v_name || ' draft reminder',
      'league_name', v_name,
      'hours_before', reminder.hours_before,
      'draft_starts_at', v_start
    )
  from public.league_memberships m
  cross join (values (168), (24), (1)) as reminder(hours_before)
  where m.league_id = p_league_id
    and m.role in ('commissioner', 'co_commissioner', 'coach')
    and v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  select
    p_league_id,
    null,
    'draft_reminder',
    'discord',
    'draft-discord:' || p_league_id::text || ':' ||
      extract(epoch from v_start)::bigint::text || ':' ||
      reminder.hours_before::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object(
      'league_name', v_name,
      'hours_before', reminder.hours_before,
      'draft_starts_at', v_start
    )
  from (values (168), (24), (1)) as reminder(hours_before)
  where v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- One immediate league-channel announcement for each distinct scheduled time.
  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  values (
    p_league_id,
    null,
    'draft_schedule_update',
    'discord',
    'draft-schedule-update:' || p_league_id::text || ':' ||
      extract(epoch from v_start)::bigint::text,
    now(),
    jsonb_build_object(
      'league_name', v_name,
      'draft_starts_at', v_start
    )
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;
$$;

ALTER FUNCTION "public"."schedule_draft_reminders"("p_league_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_badge_progress"("p_user" "uuid", "p_code" "text", "p_subject" "text", "p_progress" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_old integer:=0; v_new integer:=0; v_thresholds integer[]; v_value integer:=greatest(0,coalesce(p_progress,0)); v_threshold integer;
begin
  select thresholds into v_thresholds from public.badge_catalog where code=p_code;
  if v_thresholds is null then return; end if;
  select tier into v_old from public.user_badge_progress where user_id=p_user and badge_code=p_code and subject=coalesce(p_subject,'');
  foreach v_threshold in array v_thresholds loop if v_value>=v_threshold then v_new:=v_threshold; end if; end loop;
  insert into public.user_badge_progress(user_id,badge_code,subject,progress,tier,first_earned_at)
  values(p_user,p_code,coalesce(p_subject,''),v_value,v_new,case when v_new>0 then now() end)
  on conflict(user_id,badge_code,subject) do update set progress=excluded.progress,tier=greatest(public.user_badge_progress.tier,excluded.tier),
    first_earned_at=coalesce(public.user_badge_progress.first_earned_at,excluded.first_earned_at),updated_at=now();
  if v_new>v_old then
    foreach v_threshold in array v_thresholds loop
      if v_threshold>v_old and v_threshold<=v_new then
        insert into public.badge_award_events(user_id,badge_code,subject,tier) values(p_user,p_code,coalesce(p_subject,''),v_threshold) on conflict do nothing;
      end if;
    end loop;
  end if;
end; $$;

ALTER FUNCTION "public"."set_badge_progress"("p_user" "uuid", "p_code" "text", "p_subject" "text", "p_progress" integer) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."membership_role" DEFAULT 'viewer'::"public"."membership_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."league_memberships" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_co_commissioner"("p_league_id" "uuid", "p_username" "text", "p_enabled" boolean) RETURNS "public"."league_memberships"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_user_id uuid; v_membership public.league_memberships;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only a commissioner can manage co-commissioners.'; end if;
  select id into v_user_id from public.profiles where lower(username) = lower(trim(p_username));
  if v_user_id is null then raise exception 'No DraftCenter account has that username.'; end if;
  select * into v_membership from public.league_memberships where league_id = p_league_id and user_id = v_user_id for update;
  if v_membership.id is null then raise exception 'That user must join the league before they can become a co-commissioner.'; end if;
  if v_membership.role = 'commissioner' then raise exception 'The primary commissioner cannot be changed here.'; end if;
  update public.league_memberships set role = case when p_enabled then 'co_commissioner'::public.membership_role else 'coach'::public.membership_role end
    where id = v_membership.id returning * into v_membership;
  return v_membership;
end;
$$;

ALTER FUNCTION "public"."set_co_commissioner"("p_league_id" "uuid", "p_username" "text", "p_enabled" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_live_snake_draft_paused"("p_league_id" "uuid", "p_paused" boolean, "p_overnight" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_pause_started_ms bigint;
  v_pause_duration_ms bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can pause or resume the draft.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status in ('active', 'paused')
  for update;
  if v_session.id is null then
    raise exception 'No active live snake draft was found.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  if p_paused and v_session.status = 'active' then
    update public.draft_sessions
    set status = 'paused',
        configuration = jsonb_set(
          jsonb_set(
            coalesce(configuration, '{}'::jsonb),
            '{pause_started_at}',
            to_jsonb(v_now_ms),
            true
          ),
          '{pause_is_overnight}',
          to_jsonb(coalesce(p_overnight, false)),
          true
        )
    where id = v_session.id;

    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(
      v_state,
      '{pauseIsOvernight}',
      to_jsonb(coalesce(p_overnight, false)),
      true
    );
  elsif not p_paused and v_session.status = 'paused' then
    v_pause_started_ms := coalesce(
      (v_session.configuration ->> 'pause_started_at')::bigint,
      v_now_ms
    );
    v_pause_duration_ms := greatest(0, v_now_ms - v_pause_started_ms);

    update public.draft_sessions
    set status = 'active',
        updated_at = updated_at
          + make_interval(secs => v_pause_duration_ms::double precision / 1000.0),
        configuration = coalesce(configuration, '{}'::jsonb)
          - array['pause_started_at', 'pause_is_overnight']
    where id = v_session.id;

    v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
  else
    return v_state;
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when p_paused then 'draft_paused' else 'draft_resumed' end,
    auth.uid(),
    jsonb_build_object('overnight', coalesce(p_overnight, false))
  );

  return v_state;
end;
$$;

ALTER FUNCTION "public"."set_live_snake_draft_paused"("p_league_id" "uuid", "p_paused" boolean, "p_overnight" boolean) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "timezone" "text" DEFAULT 'America/Los_Angeles'::"text" NOT NULL,
    "discord_user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    "favorite_pokemon" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "profiles_display_name_check" CHECK ((("char_length"("display_name") >= 2) AND ("char_length"("display_name") <= 40))),
    CONSTRAINT "profiles_favorite_pokemon_limit" CHECK ((COALESCE("cardinality"("favorite_pokemon"), 0) <= 6))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_my_profile"("p_display_name" "text", "p_username" "text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  p_username := lower(trim(p_username));

  if p_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters: lowercase letters, numbers, and underscores.';
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    auth.uid(),
    coalesce(nullif(trim(p_display_name), ''), p_username),
    p_username
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = coalesce(
          nullif(trim(p_display_name), ''),
          public.profiles.display_name
        )
  returning * into v_profile;

  return v_profile;
end;
$_$;

ALTER FUNCTION "public"."set_my_profile"("p_display_name" "text", "p_username" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_personal_team_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_personal_team_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."snapshot_draft_is_complete"("p_state" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_draft_type text;
  v_order jsonb;
begin
  if not coalesce((p_state ->> 'locked')::boolean, false) then
    return false;
  end if;
  v_draft_type := coalesce(p_state #>> '{settings,draftType}', 'snake');
  if v_draft_type = 'snake' then
    v_order := coalesce(p_state -> 'snakeOrder', '[]'::jsonb);
    return jsonb_typeof(v_order) = 'array'
      and coalesce((p_state ->> 'pickIndex')::integer, 0)
        >= jsonb_array_length(v_order);
  end if;
  return coalesce((p_state ->> 'auctionEnded')::boolean, false)
    or jsonb_array_length(coalesce(p_state -> 'pool', '[]'::jsonb)) = 0;
end;
$$;

ALTER FUNCTION "public"."snapshot_draft_is_complete"("p_state" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."snapshot_roster_respects_caps"("p_roster" "jsonb", "p_settings" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_roster_max integer;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if jsonb_typeof(p_roster) <> 'array' then
    return false;
  end if;
  v_roster_max := greatest(
    1,
    coalesce(nullif(p_settings ->> 'rosterMax', '')::integer, 1)
  );
  if jsonb_array_length(p_roster) > v_roster_max then
    return false;
  end if;

  v_restricted_cap := case
    when jsonb_typeof(p_settings -> 'restrictedCap') = 'number'
      then (p_settings ->> 'restrictedCap')::integer
    else null
  end;
  v_mega_cap := case
    when jsonb_typeof(p_settings -> 'megaCap') = 'number'
      then (p_settings ->> 'megaCap')::integer
    else null
  end;
  select
    count(*) filter (
      where coalesce((mon.value ->> 'isRestricted')::boolean, false)
    ),
    count(*) filter (
      where coalesce((mon.value ->> 'isMega')::boolean, false)
    )
  into v_restricted_count, v_mega_count
  from jsonb_array_elements(p_roster) mon(value);

  return (v_restricted_cap is null or v_restricted_count <= v_restricted_cap)
    and (v_mega_cap is null or v_mega_count <= v_mega_cap);
end;
$$;

ALTER FUNCTION "public"."snapshot_roster_respects_caps"("p_roster" "jsonb", "p_settings" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."start_snake_draft"("p_league_id" "uuid", "p_team_order" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_session uuid;
  v_count integer;
  v_first uuid;
  v_rounds integer;
  v_full_order jsonb;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can start a draft.';
  end if;

  select count(*) into v_count
  from public.teams
  where league_id = p_league_id;

  if v_count < 2 or coalesce(array_length(p_team_order, 1), 0) <> v_count then
    raise exception 'Draft order must contain each team exactly once.';
  end if;

  if (select count(distinct supplied.team_id) from unnest(p_team_order) as supplied(team_id)) <> v_count
     or exists (
       select 1
       from unnest(p_team_order) as supplied(supplied_team_id)
       where not exists (
         select 1
         from public.teams t
         where t.id = supplied.supplied_team_id
           and t.league_id = p_league_id
       )
     ) then
    raise exception 'Draft order contains an invalid team.';
  end if;

  select greatest(1, coalesce((settings ->> 'rosterMax')::integer, 11))
  into v_rounds
  from public.leagues
  where id = p_league_id;

  if v_rounds is null then
    raise exception 'League not found.';
  end if;

  select jsonb_agg(team_id order by pick_number)
  into v_full_order
  from (
    select
      ((draft_round - 1) * v_count + round_position) as pick_number,
      case
        when draft_round % 2 = 1 then p_team_order[round_position]
        else p_team_order[v_count - round_position + 1]
      end as team_id
    from generate_series(1, v_rounds) as rounds(draft_round)
    cross join generate_series(1, v_count) as positions(round_position)
  ) ordered_picks;

  v_first := p_team_order[1];

  insert into public.draft_sessions (
    league_id,
    mode,
    status,
    current_pick_number,
    current_team_id,
    configuration
  )
  values (
    p_league_id,
    'snake',
    'active',
    0,
    v_first,
    jsonb_build_object('team_order', v_full_order)
  )
  on conflict (league_id) do update
  set
    mode = 'snake',
    status = 'active',
    current_pick_number = 0,
    current_team_id = v_first,
    configuration = excluded.configuration,
    updated_at = now()
  returning id into v_session;

  update public.leagues
  set status = 'drafting', updated_at = now()
  where id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_started',
    auth.uid(),
    jsonb_build_object('draft_session_id', v_session)
  );

  return v_session;
end;
$$;

ALTER FUNCTION "public"."start_snake_draft"("p_league_id" "uuid", "p_team_order" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."strip_private_claims_from_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.state := jsonb_set(
    coalesce(new.state, '{}'::jsonb),
    '{pendingClaims}',
    '[]'::jsonb,
    true
  );
  return new;
end;
$$;

ALTER FUNCTION "public"."strip_private_claims_from_snapshot"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_daily_draft_bracket"("p_bracket_id" "uuid", "p_winners" "jsonb", "p_local_date" "date", "p_time_zone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_bracket public.daily_draft_brackets;
  v_names text[];
  v_winners text[];
  v_left text;
  v_right text;
  v_winner text;
  v_i integer;
  v_round integer;
  v_match integer;
  v_verified_date date;
begin
  if auth.uid() is null then raise exception 'Sign in to complete today''s bracket.'; end if;
  begin v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then raise exception 'Your browser time zone was not recognized.'; end;
  if v_verified_date <> p_local_date then raise exception 'Your local game date changed. Refresh and try again.'; end if;
  select * into v_bracket from public.daily_draft_brackets where id = p_bracket_id for update;
  if v_bracket.id is null or v_bracket.game_date <> p_local_date then raise exception 'That daily bracket is not active.'; end if;
  if jsonb_typeof(p_winners) <> 'array' or jsonb_array_length(p_winners) <> 7 then raise exception 'Complete all seven bracket matchups.'; end if;
  select array_agg(value order by ordinality) into v_names from jsonb_array_elements_text(v_bracket.pokemon) with ordinality;
  select array_agg(value order by ordinality) into v_winners from jsonb_array_elements_text(p_winners) with ordinality;
  delete from public.daily_bracket_matchups where bracket_id = p_bracket_id and user_id = auth.uid();
  for v_i in 1..7 loop
    if v_i <= 4 then
      v_round := 1; v_match := v_i; v_left := v_names[(v_i - 1) * 2 + 1]; v_right := v_names[(v_i - 1) * 2 + 2];
    elsif v_i <= 6 then
      v_round := 2; v_match := v_i - 4; v_left := v_winners[(v_i - 5) * 2 + 1]; v_right := v_winners[(v_i - 5) * 2 + 2];
    else
      v_round := 3; v_match := 1; v_left := v_winners[5]; v_right := v_winners[6];
    end if;
    v_winner := v_winners[v_i];
    if v_winner not in (v_left, v_right) then raise exception 'Bracket choices do not follow the matchup winners.'; end if;
    insert into public.daily_bracket_matchups(bracket_id, user_id, round_number, match_number, winner, loser)
    values (p_bracket_id, auth.uid(), v_round, v_match, v_winner, case when v_winner = v_left then v_right else v_left end);
  end loop;
  return public.get_daily_community_games(p_local_date);
end;
$$;

ALTER FUNCTION "public"."submit_daily_draft_bracket"("p_bracket_id" "uuid", "p_winners" "jsonb", "p_local_date" "date", "p_time_zone" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_poll public.daily_polls; v_is_valid boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in to vote.'; end if;
  select * into v_poll from public.daily_polls where id = p_poll_id for update;
  if v_poll.id is null then raise exception 'That poll was not found.'; end if;
  if v_poll.poll_date < current_date then raise exception 'Voting for this poll has closed.'; end if;
  if v_poll.poll_date > current_date then raise exception 'That poll is not open yet.'; end if;
  p_answer_key := trim(p_answer_key);
  if v_poll.answer_type = 'choice' and not exists (
    select 1 from jsonb_array_elements(v_poll.options) option where option ->> 'key' = p_answer_key
  ) then raise exception 'Choose one of the listed answers.'; end if;
  if v_poll.answer_type = 'pokemon' then
    if char_length(p_answer_key) not between 2 and 60 then raise exception 'Choose a Pokemon from the search list.'; end if;
    if to_regclass('public.pokemon_species') is not null then
      execute 'select exists (select 1 from public.pokemon_species where lower(name) = lower($1))'
        into v_is_valid using p_answer_key;
      if not v_is_valid then raise exception 'Choose a Pokemon from the search list.'; end if;
    end if;
  end if;
  insert into public.daily_poll_answers(poll_id, user_id, answer_key)
  values(v_poll.id, auth.uid(), p_answer_key)
  on conflict (poll_id, user_id) do update
    set answer_key = excluded.answer_key, answered_at = now();
  return public.get_daily_poll(v_poll.poll_date);
end;
$_$;

ALTER FUNCTION "public"."submit_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_daily_quiz_answer"("p_quiz_id" "uuid", "p_answer" "text", "p_local_date" "date", "p_time_zone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_quiz public.daily_quizzes;
  v_display text;
  v_normalized text;
  v_correct boolean;
  v_verified_date date;
begin
  if auth.uid() is null then raise exception 'Sign in to answer today''s quiz.'; end if;
  begin v_verified_date := (now() at time zone p_time_zone)::date;
  exception when others then raise exception 'Your browser time zone was not recognized.'; end;
  if v_verified_date <> p_local_date then raise exception 'Your local quiz date changed. Refresh and try again.'; end if;
  select * into v_quiz from public.daily_quizzes where id = p_quiz_id for update;
  if v_quiz.id is null or v_quiz.quiz_date <> p_local_date then raise exception 'That daily quiz is not active.'; end if;
  v_display := nullif(trim(p_answer), '');
  if v_display is null or char_length(v_display) > 60 then raise exception 'Enter a PokÃ©mon, type, or answer under 60 characters.'; end if;
  v_normalized := lower(regexp_replace(v_display, '[^a-zA-Z0-9]+', '', 'g'));
  select exists(
    select 1 from jsonb_array_elements_text(v_quiz.accepted_answers) accepted
    where lower(regexp_replace(accepted, '[^a-zA-Z0-9]+', '', 'g')) = v_normalized
  ) into v_correct;
  insert into public.daily_quiz_answers(quiz_id, user_id, display_answer, normalized_answer, is_correct)
  values(v_quiz.id, auth.uid(), v_display, v_normalized, v_correct)
  on conflict (quiz_id, user_id) do nothing;
  return public.get_daily_community_games(p_local_date);
end;
$$;

ALTER FUNCTION "public"."submit_daily_quiz_answer"("p_quiz_id" "uuid", "p_answer" "text", "p_local_date" "date", "p_time_zone" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_local_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text", "p_local_date" "date", "p_time_zone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_poll public.daily_polls;
  v_is_valid boolean;
  v_verified_date date;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to vote.';
  end if;

  begin
    v_verified_date :=
      (now() at time zone p_time_zone)::date;
  exception
    when others then
      raise exception 'Your browser time zone was not recognized.';
  end;

  if v_verified_date <> p_local_date then
    raise exception 'Your local poll date changed. Refresh and try again.';
  end if;

  select *
  into v_poll
  from public.daily_polls
  where id = p_poll_id
  for update;

  if v_poll.id is null then
    raise exception 'That poll was not found.';
  end if;

  if v_poll.poll_date <> p_local_date then
    raise exception 'Voting for that poll is closed in your local time.';
  end if;

  p_answer_key := trim(p_answer_key);

  if v_poll.answer_type = 'choice'
    and not exists (
      select 1
      from jsonb_array_elements(
        v_poll.options
      ) option
      where option ->> 'key' = p_answer_key
    )
  then
    raise exception 'Choose one of the listed answers.';
  end if;

  if v_poll.answer_type = 'pokemon' then
    if char_length(p_answer_key)
      not between 2 and 60
    then
      raise exception 'Choose a Pokemon from the search list.';
    end if;

    if to_regclass(
      'public.pokemon_species'
    ) is not null
    then
      execute '
        select exists (
          select 1
          from public.pokemon_species
          where lower(name) = lower($1)
        )
      '
      into v_is_valid
      using p_answer_key;

      if not v_is_valid then
        raise exception 'Choose a Pokemon from the search list.';
      end if;
    end if;
  end if;

  insert into public.daily_poll_answers (
    poll_id,
    user_id,
    answer_key
  )
  values (
    v_poll.id,
    auth.uid(),
    p_answer_key
  )
  on conflict (
    poll_id,
    user_id
  )
  do update
  set
    answer_key = excluded.answer_key,
    answered_at = now();

  return public.get_local_daily_poll(
    p_local_date
  );
end;
$_$;

ALTER FUNCTION "public"."submit_local_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text", "p_local_date" "date", "p_time_zone" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_private_free_agent_claim"("p_league_id" "uuid", "p_team_index" integer, "p_add_name" "text", "p_add_mon" "jsonb", "p_drop_name" "text" DEFAULT NULL::"text", "p_bid_amount" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb;
  v_result jsonb;
  v_claim jsonb;
  v_claim_id uuid;
begin
  -- Reuse migration 091's complete permission, deadline, roster, pool, cap,
  -- and budget validation while holding the same snapshot lock.
  v_result := public.mutate_league_transaction(
    p_league_id,
    'claim_submit',
    jsonb_build_object(
      'team_index', p_team_index,
      'add_name', p_add_name,
      'add_mon', p_add_mon,
      'drop_name', p_drop_name,
      'bid_amount', p_bid_amount
    )
  );

  select value into v_claim
  from jsonb_array_elements(coalesce(v_result -> 'pendingClaims', '[]'::jsonb))
  where (value ->> 'teamIdx')::integer = p_team_index
    and lower(value ->> 'addName') = lower(btrim(p_add_name))
  order by (value ->> 'submittedAt')::bigint desc
  limit 1;
  if v_claim is null then
    raise exception 'The claim could not be created.';
  end if;

  v_claim_id := gen_random_uuid();
  insert into public.league_free_agent_claims(
    id, league_id, team_index, add_name, add_mon, drop_name, bid_amount,
    week, submitted_at, submitted_by
  ) values (
    v_claim_id,
    p_league_id,
    p_team_index,
    v_claim ->> 'addName',
    p_add_mon,
    nullif(v_claim ->> 'dropName', ''),
    nullif(v_claim ->> 'bidAmount', '')::integer,
    greatest(0, coalesce((v_claim ->> 'week')::integer, 0)),
    to_timestamp((v_claim ->> 'submittedAt')::double precision / 1000.0),
    auth.uid()
  );

  -- Private claims never remain in the shared snapshot.
  v_result := jsonb_set(v_result, '{pendingClaims}', '[]'::jsonb, true);
  update public.league_state_snapshots
  set state = v_result
  where league_id = p_league_id;

  return jsonb_build_object('state', v_result, 'claim_id', v_claim_id);
end;
$$;

ALTER FUNCTION "public"."submit_private_free_agent_claim"("p_league_id" "uuid", "p_team_index" integer, "p_add_name" "text", "p_add_mon" "jsonb", "p_drop_name" "text", "p_bid_amount" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."toggle_daily_poll_comment_upvote"("p_comment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Sign in to upvote.'; end if;
  if not exists(select 1 from public.daily_poll_comments where id = p_comment_id) then raise exception 'That comment no longer exists.'; end if;
  insert into public.daily_poll_comment_upvotes(comment_id, user_id)
  values(p_comment_id, auth.uid()) on conflict do nothing;
  return true;
end;
$$;

ALTER FUNCTION "public"."toggle_daily_poll_comment_upvote"("p_comment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."transition_league_to_new_season"("p_league_id" "uuid", "p_state" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_existing_rev bigint;
  v_incoming_rev bigint;
  v_existing_season integer;
  v_incoming_season integer;
  v_existing_history jsonb;
  v_incoming_history jsonb;
  v_existing_team jsonb;
  v_incoming_team jsonb;
  v_index integer;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a new season.';
  end if;
  if jsonb_typeof(p_state) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or jsonb_typeof(p_state -> 'seasonHistory') <> 'array' then
    raise exception 'The new-season archive is incomplete.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;

  v_existing_rev := coalesce((v_existing ->> 'rev')::bigint, 0);
  v_incoming_rev := coalesce((p_state ->> 'rev')::bigint, 0);
  if v_incoming_rev <> v_existing_rev + 1 then
    raise exception 'This league changed in another session. Refresh before starting the new season.';
  end if;

  v_existing_season := greatest(
    1,
    coalesce((v_existing ->> 'seasonNumber')::integer, 1)
  );
  v_incoming_season := coalesce(
    (p_state ->> 'seasonNumber')::integer,
    0
  );
  if v_incoming_season <> v_existing_season + 1 then
    raise exception 'The new season number is invalid.';
  end if;

  v_existing_history := coalesce(
    v_existing -> 'seasonHistory',
    '[]'::jsonb
  );
  v_incoming_history := p_state -> 'seasonHistory';
  if jsonb_typeof(v_existing_history) <> 'array'
     or jsonb_array_length(v_incoming_history)
       <> jsonb_array_length(v_existing_history) + 1 then
    raise exception 'Exactly one season archive must be added.';
  end if;
  if exists (
    select 1
    from generate_series(
      0,
      jsonb_array_length(v_existing_history) - 1
    ) as series(history_index)
    where (v_incoming_history -> series.history_index)
      is distinct from (v_existing_history -> series.history_index)
  ) then
    raise exception 'Existing season history cannot be rewritten during rollover.';
  end if;
  if coalesce(
       (
         v_incoming_history
           -> (jsonb_array_length(v_incoming_history) - 1)
           ->> 'seasonNumber'
       )::integer,
       0
     ) <> v_existing_season then
    raise exception 'The appended archive does not describe the season being closed.';
  end if;

  if jsonb_typeof(v_existing -> 'teams') <> 'array'
     or jsonb_array_length(p_state -> 'teams')
       <> jsonb_array_length(v_existing -> 'teams') then
    raise exception 'Team identity cannot change during season rollover.';
  end if;
  for v_index in
    0..jsonb_array_length(v_existing -> 'teams') - 1
  loop
    v_existing_team := v_existing #> array['teams', v_index::text];
    v_incoming_team := p_state #> array['teams', v_index::text];
    if coalesce(v_incoming_team ->> 'id', '') <> coalesce(v_existing_team ->> 'id', '')
       or coalesce(v_incoming_team ->> 'claimedBy', '')
         <> coalesce(v_existing_team ->> 'claimedBy', '') then
      raise exception 'Team identity and ownership must carry into the new season.';
    end if;
  end loop;

  delete from public.roster_entries entry
  using public.teams team
  where entry.team_id = team.id
    and team.league_id = p_league_id;

  delete from public.draft_picks pick
  using public.draft_sessions session
  where pick.draft_session_id = session.id
    and session.league_id = p_league_id;

  delete from public.draft_sessions
  where league_id = p_league_id;

  update public.league_pokemon
  set is_drafted = false
  where league_id = p_league_id;

  delete from public.auction_team_owners
  where league_id = p_league_id;

  update public.league_state_snapshots
  set state = p_state,
      revision = coalesce(v_existing_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  update public.leagues
  set settings = coalesce(p_state -> 'settings', '{}'::jsonb),
      status = 'setup',
      draft_starts_at = null,
      updated_at = now()
  where id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'season_started',
    auth.uid(),
    jsonb_build_object(
      'closed_season', v_existing_season,
      'new_season', v_incoming_season
    )
  );

  return p_state;
end;
$$;

ALTER FUNCTION "public"."transition_league_to_new_season"("p_league_id" "uuid", "p_state" "jsonb") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "status" "public"."league_status" DEFAULT 'setup'::"public"."league_status" NOT NULL,
    "draft_mode" "public"."draft_mode" DEFAULT 'snake'::"public"."draft_mode" NOT NULL,
    "season_label" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "draft_starts_at" timestamp with time zone,
    "league_visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "is_practice" boolean DEFAULT false NOT NULL,
    "practice_expires_at" timestamp with time zone,
    "image_url" "text",
    CONSTRAINT "leagues_name_check" CHECK ((("char_length"("name") >= 2) AND ("char_length"("name") <= 100))),
    CONSTRAINT "leagues_slug_check" CHECK (("slug" ~ '^[a-z0-9-]{3,100}$'::"text")),
    CONSTRAINT "leagues_visibility_check" CHECK (("league_visibility" = ANY (ARRAY['private'::"text", 'watch'::"text", 'open'::"text"])))
);

ALTER TABLE "public"."leagues" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_league_access"("p_league_id" "uuid", "p_visibility" "text", "p_is_practice" boolean DEFAULT false, "p_practice_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."leagues"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league public.leagues; v_visibility text;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can update league access.'; end if;
  v_visibility := lower(trim(p_visibility));
  if v_visibility not in ('private', 'watch', 'open') then raise exception 'Choose private, watch, or open.'; end if;
  update public.leagues set league_visibility = v_visibility, is_public = v_visibility <> 'private',
    is_practice = coalesce(p_is_practice, false), practice_expires_at = case
      when coalesce(p_is_practice, false) then coalesce(p_practice_expires_at, now() + interval '30 days') else null end,
    updated_at = now()
  where id = p_league_id returning * into v_league;
  return v_league;
end;
$$;

ALTER FUNCTION "public"."update_league_access"("p_league_id" "uuid", "p_visibility" "text", "p_is_practice" boolean, "p_practice_expires_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_league_details"("p_league_id" "uuid", "p_name" "text", "p_description" "text" DEFAULT ''::"text", "p_season_label" "text" DEFAULT NULL::"text", "p_draft_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_is_public" boolean DEFAULT false) RETURNS "public"."leagues"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can update league details.'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'League name must be at least 2 characters.'; end if;
  update public.leagues set
    name = trim(p_name), description = coalesce(trim(p_description), ''),
    season_label = nullif(trim(p_season_label), ''), draft_starts_at = p_draft_starts_at,
    is_public = coalesce(p_is_public, false), updated_at = now()
  where id = p_league_id returning * into v_league;
  return v_league;
end; $$;

ALTER FUNCTION "public"."update_league_details"("p_league_id" "uuid", "p_name" "text", "p_description" "text", "p_season_label" "text", "p_draft_starts_at" timestamp with time zone, "p_is_public" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_league_draft_time"("p_league_id" "uuid", "p_draft_starts_at" timestamp with time zone) RETURNS "public"."leagues"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can update the draft time.';
  end if;
  update public.leagues
  set draft_starts_at = p_draft_starts_at, updated_at = now()
  where id = p_league_id
  returning * into v_league;
  return v_league;
end;
$$;

ALTER FUNCTION "public"."update_league_draft_time"("p_league_id" "uuid", "p_draft_starts_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_league_image"("p_league_id" "uuid", "p_image_url" "text" DEFAULT NULL::"text") RETURNS "public"."leagues"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can update a league image.';
  end if;
  if nullif(trim(p_image_url), '') is not null and trim(p_image_url) !~ '^https?://' then
    raise exception 'League image must be a full https:// or http:// URL.';
  end if;
  update public.leagues
  set image_url = nullif(trim(p_image_url), ''), updated_at = now()
  where id = p_league_id
  returning * into v_league;
  return v_league;
end;
$$;

ALTER FUNCTION "public"."update_league_image"("p_league_id" "uuid", "p_image_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."upvote_daily_game_comment"("p_comment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to upvote.'; end if;
  if not exists(select 1 from public.daily_game_comments where id = p_comment_id) then raise exception 'That comment no longer exists.'; end if;
  insert into public.daily_game_comment_upvotes(comment_id, user_id)
  values(p_comment_id, auth.uid()) on conflict do nothing;
  select count(*)::integer into v_count from public.daily_game_comment_upvotes where comment_id = p_comment_id;
  return v_count;
end;
$$;

ALTER FUNCTION "public"."upvote_daily_game_comment"("p_comment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."validate_live_auction_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_state jsonb := new.state;
  v_team_count integer;
  v_team_index integer;
  v_roster_min integer;
  v_roster_count integer;
  v_budget integer;
  v_missing integer;
  v_nominee jsonb;
  v_bidder integer;
  v_bid integer;
  v_finishing boolean;
begin
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    return new;
  end if;

  v_roster_min := greatest(
    1,
    coalesce((v_state #>> '{settings,rosterMin}')::integer, 1)
  );
  v_team_count := jsonb_array_length(coalesce(v_state -> 'teams', '[]'::jsonb));
  v_nominee := v_state -> 'nominee';
  v_bidder := case
    when v_nominee is not null and v_nominee <> 'null'::jsonb
      then (v_nominee ->> 'currentBidder')::integer
    else null
  end;
  v_bid := case
    when v_bidder is not null then (v_nominee ->> 'currentBid')::integer
    else 0
  end;
  v_finishing :=
    coalesce((v_state ->> 'auctionEnded')::boolean, false)
    or jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0;

  if v_team_count > 0 then
    for v_team_index in 0..(v_team_count - 1) loop
      v_roster_count := jsonb_array_length(
        coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb)
      );
      v_budget := coalesce(
        (v_state #>> array['budgets', v_team_index::text])::integer,
        0
      );
      v_missing := greatest(0, v_roster_min - v_roster_count);

      if v_budget < v_missing then
        raise exception
          'Team % must preserve % budget point(s) to reach the roster minimum.',
          v_team_index + 1,
          v_missing;
      end if;

      if v_bidder = v_team_index then
        v_missing := greatest(0, v_roster_min - (v_roster_count + 1));
        if v_bid > v_budget or v_budget - v_bid < v_missing then
          raise exception
            'That bid must leave % budget point(s) for the remaining minimum roster slots.',
            v_missing;
        end if;
      end if;

      if v_finishing and v_roster_count < v_roster_min then
        raise exception
          'The auction cannot finish: team % has % of the required % Pokemon.',
          v_team_index + 1,
          v_roster_count,
          v_roster_min;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."validate_live_auction_snapshot"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."auction_team_owners" (
    "league_id" "uuid" NOT NULL,
    "team_index" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auction_team_owners_team_index_check" CHECK (("team_index" >= 0))
);

ALTER TABLE "public"."auction_team_owners" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."badge_award_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_code" "text" NOT NULL,
    "subject" "text" DEFAULT ''::"text" NOT NULL,
    "tier" integer NOT NULL,
    "awarded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "seen_at" timestamp with time zone
);

ALTER TABLE "public"."badge_award_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."badge_catalog" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "category" "text" NOT NULL,
    "thresholds" integer[] NOT NULL,
    "tier_names" "text"[] DEFAULT ARRAY['Bronze'::"text", 'Silver'::"text", 'Gold'::"text"] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."badge_catalog" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_bracket_matchups" (
    "bracket_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "round_number" integer NOT NULL,
    "match_number" integer NOT NULL,
    "winner" "text" NOT NULL,
    "loser" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_bracket_matchups_round_number_check" CHECK ((("round_number" >= 1) AND ("round_number" <= 3)))
);

ALTER TABLE "public"."daily_bracket_matchups" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_draft_brackets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_date" "date" NOT NULL,
    "pokemon" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_draft_brackets_pokemon_check" CHECK ((("jsonb_typeof"("pokemon") = 'array'::"text") AND ("jsonb_array_length"("pokemon") = 8)))
);

ALTER TABLE "public"."daily_draft_brackets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_game_comment_upvotes" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_game_comment_upvotes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_game_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_type" "text" NOT NULL,
    "game_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_game_comments_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 1000))),
    CONSTRAINT "daily_game_comments_game_type_check" CHECK (("game_type" = ANY (ARRAY['bracket'::"text", 'quiz'::"text"])))
);

ALTER TABLE "public"."daily_game_comments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_poll_answers" (
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "answer_key" "text" NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_poll_answers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_poll_comment_upvotes" (
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_poll_comment_upvotes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_poll_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_comment_id" "uuid",
    CONSTRAINT "daily_poll_comments_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 500)))
);

ALTER TABLE "public"."daily_poll_comments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_poll_email_deliveries" (
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_poll_email_deliveries" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_date" "date" NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "answer_type" "text" DEFAULT 'choice'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_polls_answer_type_check" CHECK (("answer_type" = ANY (ARRAY['choice'::"text", 'pokemon'::"text"])))
);

ALTER TABLE "public"."daily_polls" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_quiz_answers" (
    "quiz_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_answer" "text" NOT NULL,
    "normalized_answer" "text" NOT NULL,
    "is_correct" boolean NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_quiz_answers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_quizzes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_date" "date" NOT NULL,
    "prompt" "text" NOT NULL,
    "hint" "text",
    "difficulty" "text" NOT NULL,
    "accepted_answers" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_quizzes_accepted_answers_check" CHECK (("jsonb_typeof"("accepted_answers") = 'array'::"text")),
    CONSTRAINT "daily_quizzes_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text", 'expert'::"text"])))
);

ALTER TABLE "public"."daily_quizzes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."daily_three_completions" (
    "user_id" "uuid" NOT NULL,
    "activity_date" "date" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."daily_three_completions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."discord_oauth_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "state_hash" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."discord_oauth_states" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."draft_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_session_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "league_pokemon_id" "uuid" NOT NULL,
    "pick_number" integer NOT NULL,
    "round_number" integer,
    "price" numeric(7,2),
    "made_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."draft_picks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."draft_queues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "league_pokemon_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."draft_queues" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."draft_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "mode" "public"."draft_mode" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "current_pick_number" integer DEFAULT 0 NOT NULL,
    "current_team_id" "uuid",
    "turn_ends_at" timestamp with time zone,
    "configuration" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "draft_sessions_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'active'::"text", 'paused'::"text", 'complete'::"text"])))
);

ALTER TABLE "public"."draft_sessions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."integration_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integration_configs_provider_check" CHECK (("provider" = ANY (ARRAY['discord'::"text", 'resend'::"text"])))
);

ALTER TABLE "public"."integration_configs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_events" (
    "id" bigint NOT NULL,
    "league_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "actor_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."league_events" OWNER TO "postgres";

ALTER TABLE "public"."league_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."league_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."league_free_agent_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "team_index" integer NOT NULL,
    "add_name" "text" NOT NULL,
    "add_mon" "jsonb" NOT NULL,
    "drop_name" "text",
    "bid_amount" integer,
    "week" integer DEFAULT 0 NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    CONSTRAINT "league_free_agent_claims_bid_amount_check" CHECK ((("bid_amount" IS NULL) OR ("bid_amount" >= 0))),
    CONSTRAINT "league_free_agent_claims_team_index_check" CHECK (("team_index" >= 0)),
    CONSTRAINT "league_free_agent_claims_week_check" CHECK (("week" >= 0))
);

ALTER TABLE "public"."league_free_agent_claims" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "email" "text",
    "role" "public"."membership_role" DEFAULT 'coach'::"public"."membership_role" NOT NULL,
    "token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_by" "uuid"
);

ALTER TABLE "public"."league_invites" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_live_streams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "match_key" "text",
    "title" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "stream_url" "text" NOT NULL,
    "starts_at" timestamp with time zone,
    "visibility" "text" DEFAULT 'league'::"text" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "league_live_streams_platform_check" CHECK (("platform" = ANY (ARRAY['twitch'::"text", 'youtube'::"text"]))),
    CONSTRAINT "league_live_streams_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'live'::"text", 'ended'::"text"]))),
    CONSTRAINT "league_live_streams_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'league'::"text", 'public'::"text"])))
);

ALTER TABLE "public"."league_live_streams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_move_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "pokemon_name" "text" NOT NULL,
    "move_name" "text" NOT NULL,
    "rule_status" "text" NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "league_move_rules_rule_status_check" CHECK (("rule_status" = ANY (ARRAY['legal'::"text", 'unavailable'::"text"])))
);

ALTER TABLE "public"."league_move_rules" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_pokemon" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "pokemon_id" "text" NOT NULL,
    "cost" numeric(7,2),
    "is_allowed" boolean DEFAULT true NOT NULL,
    "is_drafted" boolean DEFAULT false NOT NULL,
    "source_key" "text",
    "is_restricted" boolean DEFAULT false NOT NULL,
    "is_mega" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."league_pokemon" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."league_state_snapshots" (
    "league_id" "uuid" NOT NULL,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "revision" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."league_state_snapshots" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "week_number" integer,
    "stage" "text" DEFAULT 'regular_season'::"text" NOT NULL,
    "bracket_round" integer,
    "home_team_id" "uuid" NOT NULL,
    "away_team_id" "uuid" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "status" "public"."match_status" DEFAULT 'scheduled'::"public"."match_status" NOT NULL,
    "home_games_won" smallint,
    "away_games_won" smallint,
    "home_mons_alive" smallint,
    "away_mons_alive" smallint,
    "winner_team_id" "uuid",
    "reported_by" "uuid",
    "confirmed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matches_check" CHECK (("home_team_id" <> "away_team_id"))
);

ALTER TABLE "public"."matches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "email_draft_reminders" boolean DEFAULT true NOT NULL,
    "email_turn_reminders" boolean DEFAULT true NOT NULL,
    "email_transactions" boolean DEFAULT true NOT NULL,
    "email_messages" boolean DEFAULT false NOT NULL,
    "email_weekly_digest" boolean DEFAULT false NOT NULL,
    "discord_draft_reminders" boolean DEFAULT true NOT NULL,
    "discord_transactions" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_daily_poll_results" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."operational_health_events" (
    "id" bigint NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "league_id" "uuid",
    "kind" "text" NOT NULL,
    "message" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "operational_health_events_context_check" CHECK ((("jsonb_typeof"("context") = 'object'::"text") AND ("pg_column_size"("context") <= 4096))),
    CONSTRAINT "operational_health_events_kind_check" CHECK (("kind" = ANY (ARRAY['league_save_failed'::"text", 'draft_operation_failed'::"text", 'result_save_failed'::"text", 'notification_dispatch_failed'::"text", 'client_runtime_error'::"text"]))),
    CONSTRAINT "operational_health_events_message_check" CHECK ((("char_length"("message") >= 1) AND ("char_length"("message") <= 1000)))
);

ALTER TABLE "public"."operational_health_events" OWNER TO "postgres";

ALTER TABLE "public"."operational_health_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."operational_health_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."payment_obligations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "membership_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "due_at" timestamp with time zone,
    "status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "payment_obligations_amount_cents_check" CHECK (("amount_cents" >= 0))
);

ALTER TABLE "public"."payment_obligations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."personal_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "team_name" "text" NOT NULL,
    "league_name" "text",
    "format_name" "text",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "weekly_notes" "text" DEFAULT ''::"text" NOT NULL,
    "pokepaste_url" "text",
    "replica_code" "text" DEFAULT ''::"text" NOT NULL,
    "spreadsheet_url" "text",
    "pokemon" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_type" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "planning_entries" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "personal_teams_format_name_check" CHECK ((("format_name" IS NULL) OR ("char_length"("format_name") <= 100))),
    CONSTRAINT "personal_teams_league_name_check" CHECK ((("league_name" IS NULL) OR ("char_length"("league_name") <= 120))),
    CONSTRAINT "personal_teams_notes_check" CHECK (("char_length"("notes") <= 20000)),
    CONSTRAINT "personal_teams_planning_entries_check" CHECK ((("jsonb_typeof"("planning_entries") = 'array'::"text") AND ("jsonb_array_length"("planning_entries") <= 100) AND ("octet_length"(("planning_entries")::"text") <= 100000))),
    CONSTRAINT "personal_teams_pokemon_check" CHECK ((("jsonb_typeof"("pokemon") = 'array'::"text") AND ("jsonb_array_length"("pokemon") <= 20))),
    CONSTRAINT "personal_teams_pokepaste_url_check" CHECK ((("pokepaste_url" IS NULL) OR ("pokepaste_url" ~ '^https?://'::"text"))),
    CONSTRAINT "personal_teams_replica_code_check" CHECK (("char_length"("replica_code") <= 5000)),
    CONSTRAINT "personal_teams_spreadsheet_url_check" CHECK ((("spreadsheet_url" IS NULL) OR ("spreadsheet_url" ~ '^https?://'::"text"))),
    CONSTRAINT "personal_teams_team_name_check" CHECK ((("char_length"("btrim"("team_name")) >= 1) AND ("char_length"("btrim"("team_name")) <= 120))),
    CONSTRAINT "personal_teams_weekly_notes_check" CHECK (("char_length"("weekly_notes") <= 30000)),
    CONSTRAINT "personal_teams_workspace_type_check" CHECK (("workspace_type" = ANY (ARRAY['weekly'::"text", 'tournament'::"text"])))
);

ALTER TABLE "public"."personal_teams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pokemon_catalogue" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "form_name" "text",
    "generation" smallint,
    "primary_type" "text" NOT NULL,
    "secondary_type" "text",
    "base_stat_total" smallint,
    "sprite_url" "text",
    "is_mega" boolean DEFAULT false NOT NULL,
    "is_restricted" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."pokemon_catalogue" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pokemon_game_versions" (
    "game_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "release_order" integer NOT NULL,
    "mechanics_note" "text" DEFAULT ''::"text" NOT NULL,
    "data_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source_label" "text",
    "source_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pokemon_game_versions_data_status_check" CHECK (("data_status" = ANY (ARRAY['pending'::"text", 'importing'::"text", 'ready'::"text", 'retired'::"text"])))
);

ALTER TABLE "public"."pokemon_game_versions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pokemon_move_learnsets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pokemon_name" "text" NOT NULL,
    "game_key" "text" NOT NULL,
    "move_name" "text" NOT NULL,
    "learn_method" "text" DEFAULT 'special'::"text" NOT NULL,
    "level_learned_at" integer DEFAULT 0 NOT NULL,
    "data_version" "text" DEFAULT 'initial'::"text" NOT NULL,
    "source_url" "text",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pokemon_move_learnsets_level_learned_at_check" CHECK (("level_learned_at" >= 0))
);

ALTER TABLE "public"."pokemon_move_learnsets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."private_draft_queue_items" (
    "league_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "team_index" integer NOT NULL,
    "pokemon_name" "text" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "private_draft_queue_items_pokemon_name_check" CHECK ((("char_length"("pokemon_name") >= 1) AND ("char_length"("pokemon_name") <= 120))),
    CONSTRAINT "private_draft_queue_items_position_check" CHECK (("position" >= 0)),
    CONSTRAINT "private_draft_queue_items_team_index_check" CHECK (("team_index" >= 0))
);

ALTER TABLE "public"."private_draft_queue_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."private_league_team_notebooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "league_id" "uuid" NOT NULL,
    "team_source_key" "text" NOT NULL,
    "week_number" integer NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "pokepaste_url" "text",
    "replica_code" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "private_league_team_notebooks_notes_check" CHECK (("char_length"("notes") <= 20000)),
    CONSTRAINT "private_league_team_notebooks_pokepaste_url_check" CHECK ((("pokepaste_url" IS NULL) OR ("pokepaste_url" = ''::"text") OR ("pokepaste_url" ~ '^https://pokepast\.es/[A-Za-z0-9]+/?$'::"text"))),
    CONSTRAINT "private_league_team_notebooks_replica_code_check" CHECK (("char_length"("replica_code") <= 5000)),
    CONSTRAINT "private_league_team_notebooks_week_number_check" CHECK ((("week_number" >= 0) AND ("week_number" <= 100)))
);

ALTER TABLE "public"."private_league_team_notebooks" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."public_match_predictions" (
    "league_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "match_key" "text" NOT NULL,
    "predicted_team_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."public_match_predictions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."roster_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "league_pokemon_id" "uuid" NOT NULL,
    "acquisition_type" "text" NOT NULL,
    "acquired_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "released_at" timestamp with time zone,
    CONSTRAINT "roster_entries_acquisition_type_check" CHECK (("acquisition_type" = ANY (ARRAY['draft'::"text", 'trade'::"text", 'free_agency'::"text", 'commissioner'::"text"])))
);

ALTER TABLE "public"."roster_entries" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."team_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."team_assignments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "owner_membership_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text",
    "logo_url" "text",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "division_name" "text",
    "standings_adjustment" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_key" "text"
);

ALTER TABLE "public"."teams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."transaction_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "league_pokemon_id" "uuid" NOT NULL,
    "from_team_id" "uuid",
    "to_team_id" "uuid"
);

ALTER TABLE "public"."transaction_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "status" "public"."transaction_status" DEFAULT 'draft'::"public"."transaction_status" NOT NULL,
    "initiated_by" "uuid" NOT NULL,
    "reviewed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['trade'::"text", 'free_agency'::"text", 'drop'::"text"])))
);

ALTER TABLE "public"."transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_badge_progress" (
    "user_id" "uuid" NOT NULL,
    "badge_code" "text" NOT NULL,
    "subject" "text" DEFAULT ''::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "tier" integer DEFAULT 0 NOT NULL,
    "first_earned_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_badge_progress" OWNER TO "postgres";

ALTER TABLE ONLY "public"."auction_team_owners"
    ADD CONSTRAINT "auction_team_owners_league_id_user_id_key" UNIQUE ("league_id", "user_id");

ALTER TABLE ONLY "public"."auction_team_owners"
    ADD CONSTRAINT "auction_team_owners_pkey" PRIMARY KEY ("league_id", "team_index");

ALTER TABLE ONLY "public"."badge_award_events"
    ADD CONSTRAINT "badge_award_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."badge_award_events"
    ADD CONSTRAINT "badge_award_events_user_id_badge_code_subject_tier_key" UNIQUE ("user_id", "badge_code", "subject", "tier");

ALTER TABLE ONLY "public"."badge_catalog"
    ADD CONSTRAINT "badge_catalog_pkey" PRIMARY KEY ("code");

ALTER TABLE ONLY "public"."daily_bracket_matchups"
    ADD CONSTRAINT "daily_bracket_matchups_pkey" PRIMARY KEY ("bracket_id", "user_id", "round_number", "match_number");

ALTER TABLE ONLY "public"."daily_draft_brackets"
    ADD CONSTRAINT "daily_draft_brackets_game_date_key" UNIQUE ("game_date");

ALTER TABLE ONLY "public"."daily_draft_brackets"
    ADD CONSTRAINT "daily_draft_brackets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."daily_game_comment_upvotes"
    ADD CONSTRAINT "daily_game_comment_upvotes_pkey" PRIMARY KEY ("comment_id", "user_id");

ALTER TABLE ONLY "public"."daily_game_comments"
    ADD CONSTRAINT "daily_game_comments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."daily_poll_answers"
    ADD CONSTRAINT "daily_poll_answers_pkey" PRIMARY KEY ("poll_id", "user_id");

ALTER TABLE ONLY "public"."daily_poll_comment_upvotes"
    ADD CONSTRAINT "daily_poll_comment_upvotes_pkey" PRIMARY KEY ("comment_id", "user_id");

ALTER TABLE ONLY "public"."daily_poll_comments"
    ADD CONSTRAINT "daily_poll_comments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."daily_poll_email_deliveries"
    ADD CONSTRAINT "daily_poll_email_deliveries_pkey" PRIMARY KEY ("poll_id", "user_id");

ALTER TABLE ONLY "public"."daily_polls"
    ADD CONSTRAINT "daily_polls_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."daily_polls"
    ADD CONSTRAINT "daily_polls_poll_date_key" UNIQUE ("poll_date");

ALTER TABLE ONLY "public"."daily_quiz_answers"
    ADD CONSTRAINT "daily_quiz_answers_pkey" PRIMARY KEY ("quiz_id", "user_id");

ALTER TABLE ONLY "public"."daily_quizzes"
    ADD CONSTRAINT "daily_quizzes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."daily_quizzes"
    ADD CONSTRAINT "daily_quizzes_quiz_date_key" UNIQUE ("quiz_date");

ALTER TABLE ONLY "public"."daily_three_completions"
    ADD CONSTRAINT "daily_three_completions_pkey" PRIMARY KEY ("user_id", "activity_date");

ALTER TABLE ONLY "public"."discord_oauth_states"
    ADD CONSTRAINT "discord_oauth_states_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discord_oauth_states"
    ADD CONSTRAINT "discord_oauth_states_state_hash_key" UNIQUE ("state_hash");

ALTER TABLE ONLY "public"."discord_user_connections"
    ADD CONSTRAINT "discord_user_connections_discord_user_id_key" UNIQUE ("discord_user_id");

ALTER TABLE ONLY "public"."discord_user_connections"
    ADD CONSTRAINT "discord_user_connections_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_session_id_league_pokemon_id_key" UNIQUE ("draft_session_id", "league_pokemon_id");

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_session_id_pick_number_key" UNIQUE ("draft_session_id", "pick_number");

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."draft_queues"
    ADD CONSTRAINT "draft_queues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."draft_queues"
    ADD CONSTRAINT "draft_queues_team_id_league_pokemon_id_key" UNIQUE ("team_id", "league_pokemon_id");

ALTER TABLE ONLY "public"."draft_queues"
    ADD CONSTRAINT "draft_queues_team_id_position_key" UNIQUE ("team_id", "position");

ALTER TABLE ONLY "public"."draft_sessions"
    ADD CONSTRAINT "draft_sessions_league_id_key" UNIQUE ("league_id");

ALTER TABLE ONLY "public"."draft_sessions"
    ADD CONSTRAINT "draft_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."integration_configs"
    ADD CONSTRAINT "integration_configs_league_id_provider_key" UNIQUE ("league_id", "provider");

ALTER TABLE ONLY "public"."integration_configs"
    ADD CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_discord_settings"
    ADD CONSTRAINT "league_discord_settings_pkey" PRIMARY KEY ("league_id");

ALTER TABLE ONLY "public"."league_events"
    ADD CONSTRAINT "league_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_free_agent_claims"
    ADD CONSTRAINT "league_free_agent_claims_league_id_team_index_add_name_key" UNIQUE ("league_id", "team_index", "add_name");

ALTER TABLE ONLY "public"."league_free_agent_claims"
    ADD CONSTRAINT "league_free_agent_claims_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_invites"
    ADD CONSTRAINT "league_invites_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_invites"
    ADD CONSTRAINT "league_invites_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."league_live_streams"
    ADD CONSTRAINT "league_live_streams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_memberships"
    ADD CONSTRAINT "league_memberships_league_id_user_id_key" UNIQUE ("league_id", "user_id");

ALTER TABLE ONLY "public"."league_memberships"
    ADD CONSTRAINT "league_memberships_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_move_rules"
    ADD CONSTRAINT "league_move_rules_league_id_pokemon_name_move_name_key" UNIQUE ("league_id", "pokemon_name", "move_name");

ALTER TABLE ONLY "public"."league_move_rules"
    ADD CONSTRAINT "league_move_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_pokemon"
    ADD CONSTRAINT "league_pokemon_league_id_pokemon_id_key" UNIQUE ("league_id", "pokemon_id");

ALTER TABLE ONLY "public"."league_pokemon"
    ADD CONSTRAINT "league_pokemon_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."league_state_snapshots"
    ADD CONSTRAINT "league_state_snapshots_pkey" PRIMARY KEY ("league_id");

ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_dedupe_key_key" UNIQUE ("dedupe_key");

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."operational_health_events"
    ADD CONSTRAINT "operational_health_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_obligations"
    ADD CONSTRAINT "payment_obligations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_obligations"
    ADD CONSTRAINT "payment_obligations_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");

ALTER TABLE ONLY "public"."payment_obligations"
    ADD CONSTRAINT "payment_obligations_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");

ALTER TABLE ONLY "public"."personal_teams"
    ADD CONSTRAINT "personal_teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pokemon_catalogue"
    ADD CONSTRAINT "pokemon_catalogue_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pokemon_game_versions"
    ADD CONSTRAINT "pokemon_game_versions_pkey" PRIMARY KEY ("game_key");

ALTER TABLE ONLY "public"."pokemon_move_learnsets"
    ADD CONSTRAINT "pokemon_move_learnsets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pokemon_move_learnsets"
    ADD CONSTRAINT "pokemon_move_learnsets_pokemon_name_game_key_move_name_lear_key" UNIQUE ("pokemon_name", "game_key", "move_name", "learn_method", "level_learned_at", "data_version");

ALTER TABLE ONLY "public"."private_draft_queue_items"
    ADD CONSTRAINT "private_draft_queue_items_league_id_user_id_team_index_posi_key" UNIQUE ("league_id", "user_id", "team_index", "position");

ALTER TABLE ONLY "public"."private_draft_queue_items"
    ADD CONSTRAINT "private_draft_queue_items_pkey" PRIMARY KEY ("league_id", "user_id", "team_index", "pokemon_name");

ALTER TABLE ONLY "public"."private_league_team_notebooks"
    ADD CONSTRAINT "private_league_team_notebooks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."private_league_team_notebooks"
    ADD CONSTRAINT "private_league_team_notebooks_user_id_league_id_team_source_key" UNIQUE ("user_id", "league_id", "team_source_key", "week_number");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_discord_user_id_key" UNIQUE ("discord_user_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."public_match_predictions"
    ADD CONSTRAINT "public_match_predictions_pkey" PRIMARY KEY ("league_id", "user_id", "match_key");

ALTER TABLE ONLY "public"."roster_entries"
    ADD CONSTRAINT "roster_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."roster_entries"
    ADD CONSTRAINT "roster_entries_team_id_league_pokemon_id_key" UNIQUE ("team_id", "league_pokemon_id");

ALTER TABLE ONLY "public"."team_assignments"
    ADD CONSTRAINT "team_assignments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."team_assignments"
    ADD CONSTRAINT "team_assignments_team_id_key" UNIQUE ("team_id");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_league_id_name_key" UNIQUE ("league_id", "name");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_badge_progress"
    ADD CONSTRAINT "user_badge_progress_pkey" PRIMARY KEY ("user_id", "badge_code", "subject");

CREATE INDEX "daily_bracket_matchups_loser_idx" ON "public"."daily_bracket_matchups" USING "btree" ("lower"("loser"));

CREATE INDEX "daily_bracket_matchups_winner_idx" ON "public"."daily_bracket_matchups" USING "btree" ("lower"("winner"));

CREATE INDEX "daily_poll_comments_parent_idx" ON "public"."daily_poll_comments" USING "btree" ("parent_comment_id", "created_at");

CREATE INDEX "daily_poll_comments_poll_created_idx" ON "public"."daily_poll_comments" USING "btree" ("poll_id", "created_at" DESC);

CREATE INDEX "daily_quiz_answers_normalized_idx" ON "public"."daily_quiz_answers" USING "btree" ("normalized_answer");

CREATE INDEX "discord_oauth_states_expiry_idx" ON "public"."discord_oauth_states" USING "btree" ("expires_at") WHERE ("used_at" IS NULL);

CREATE INDEX "league_events_feed_idx" ON "public"."league_events" USING "btree" ("league_id", "id" DESC);

CREATE INDEX "league_free_agent_claims_league_add_idx" ON "public"."league_free_agent_claims" USING "btree" ("league_id", "lower"("add_name"), "submitted_at");

CREATE INDEX "league_live_streams_league_status_idx" ON "public"."league_live_streams" USING "btree" ("league_id", "status", "starts_at");

CREATE INDEX "league_memberships_user_idx" ON "public"."league_memberships" USING "btree" ("user_id");

CREATE INDEX "league_move_rules_lookup_idx" ON "public"."league_move_rules" USING "btree" ("league_id", "pokemon_name");

CREATE INDEX "league_pokemon_available_idx" ON "public"."league_pokemon" USING "btree" ("league_id", "is_allowed", "is_drafted");

CREATE UNIQUE INDEX "league_pokemon_league_source_key_idx" ON "public"."league_pokemon" USING "btree" ("league_id", "source_key") WHERE ("source_key" IS NOT NULL);

CREATE INDEX "matches_league_week_idx" ON "public"."matches" USING "btree" ("league_id", "week_number");

CREATE INDEX "notification_events_dispatch_idx" ON "public"."notification_events" USING "btree" (COALESCE("next_attempt_at", "scheduled_for"), "scheduled_for") WHERE (("sent_at" IS NULL) AND ("failed_at" IS NULL));

CREATE INDEX "operational_health_events_kind_idx" ON "public"."operational_health_events" USING "btree" ("kind", "occurred_at" DESC);

CREATE INDEX "operational_health_events_league_idx" ON "public"."operational_health_events" USING "btree" ("league_id", "occurred_at" DESC) WHERE ("league_id" IS NOT NULL);

CREATE INDEX "operational_health_events_occurred_idx" ON "public"."operational_health_events" USING "btree" ("occurred_at" DESC);

CREATE INDEX "personal_teams_owner_updated_idx" ON "public"."personal_teams" USING "btree" ("owner_id", "updated_at" DESC);

CREATE INDEX "pokemon_move_learnsets_lookup_idx" ON "public"."pokemon_move_learnsets" USING "btree" ("pokemon_name", "game_key");

CREATE UNIQUE INDEX "profiles_username_unique_idx" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);

CREATE INDEX "roster_entries_active_idx" ON "public"."roster_entries" USING "btree" ("team_id") WHERE ("released_at" IS NULL);

CREATE INDEX "teams_league_idx" ON "public"."teams" USING "btree" ("league_id");

CREATE UNIQUE INDEX "teams_league_source_key_idx" ON "public"."teams" USING "btree" ("league_id", "source_key") WHERE ("source_key" IS NOT NULL);

CREATE OR REPLACE TRIGGER "daily_three_bracket" AFTER INSERT ON "public"."daily_bracket_matchups" FOR EACH ROW EXECUTE FUNCTION "public"."daily_three_activity_trigger"();

CREATE OR REPLACE TRIGGER "daily_three_poll" AFTER INSERT OR UPDATE ON "public"."daily_poll_answers" FOR EACH ROW EXECUTE FUNCTION "public"."daily_three_activity_trigger"();

CREATE OR REPLACE TRIGGER "daily_three_quiz" AFTER INSERT ON "public"."daily_quiz_answers" FOR EACH ROW EXECUTE FUNCTION "public"."daily_three_activity_trigger"();

CREATE OR REPLACE TRIGGER "enforce_budget_snake_minimum_reserve" BEFORE INSERT ON "public"."draft_picks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_budget_snake_minimum_reserve"();

CREATE OR REPLACE TRIGGER "personal_teams_enforce_free_limit" BEFORE INSERT ON "public"."personal_teams" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_personal_team_free_limit"();

CREATE OR REPLACE TRIGGER "personal_teams_set_updated_at" BEFORE UPDATE ON "public"."personal_teams" FOR EACH ROW EXECUTE FUNCTION "public"."set_personal_team_updated_at"();

CREATE OR REPLACE TRIGGER "strip_private_claims_from_snapshot" BEFORE INSERT OR UPDATE OF "state" ON "public"."league_state_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."strip_private_claims_from_snapshot"();

CREATE OR REPLACE TRIGGER "validate_live_auction_snapshot" BEFORE UPDATE OF "state" ON "public"."league_state_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."validate_live_auction_snapshot"();

ALTER TABLE ONLY "public"."auction_team_owners"
    ADD CONSTRAINT "auction_team_owners_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."auction_team_owners"
    ADD CONSTRAINT "auction_team_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."badge_award_events"
    ADD CONSTRAINT "badge_award_events_badge_code_fkey" FOREIGN KEY ("badge_code") REFERENCES "public"."badge_catalog"("code");

ALTER TABLE ONLY "public"."badge_award_events"
    ADD CONSTRAINT "badge_award_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_bracket_matchups"
    ADD CONSTRAINT "daily_bracket_matchups_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "public"."daily_draft_brackets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_bracket_matchups"
    ADD CONSTRAINT "daily_bracket_matchups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_game_comment_upvotes"
    ADD CONSTRAINT "daily_game_comment_upvotes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."daily_game_comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_game_comment_upvotes"
    ADD CONSTRAINT "daily_game_comment_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_game_comments"
    ADD CONSTRAINT "daily_game_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."daily_game_comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_game_comments"
    ADD CONSTRAINT "daily_game_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_answers"
    ADD CONSTRAINT "daily_poll_answers_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."daily_polls"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_answers"
    ADD CONSTRAINT "daily_poll_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_comment_upvotes"
    ADD CONSTRAINT "daily_poll_comment_upvotes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."daily_poll_comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_comment_upvotes"
    ADD CONSTRAINT "daily_poll_comment_upvotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_comments"
    ADD CONSTRAINT "daily_poll_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."daily_poll_comments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_comments"
    ADD CONSTRAINT "daily_poll_comments_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."daily_polls"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_comments"
    ADD CONSTRAINT "daily_poll_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_email_deliveries"
    ADD CONSTRAINT "daily_poll_email_deliveries_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."daily_polls"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_poll_email_deliveries"
    ADD CONSTRAINT "daily_poll_email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_quiz_answers"
    ADD CONSTRAINT "daily_quiz_answers_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."daily_quizzes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_quiz_answers"
    ADD CONSTRAINT "daily_quiz_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."daily_three_completions"
    ADD CONSTRAINT "daily_three_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discord_oauth_states"
    ADD CONSTRAINT "discord_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discord_user_connections"
    ADD CONSTRAINT "discord_user_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_draft_session_id_fkey" FOREIGN KEY ("draft_session_id") REFERENCES "public"."draft_sessions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_league_pokemon_id_fkey" FOREIGN KEY ("league_pokemon_id") REFERENCES "public"."league_pokemon"("id");

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_made_by_fkey" FOREIGN KEY ("made_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."draft_picks"
    ADD CONSTRAINT "draft_picks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."draft_queues"
    ADD CONSTRAINT "draft_queues_league_pokemon_id_fkey" FOREIGN KEY ("league_pokemon_id") REFERENCES "public"."league_pokemon"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."draft_queues"
    ADD CONSTRAINT "draft_queues_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."draft_sessions"
    ADD CONSTRAINT "draft_sessions_current_team_id_fkey" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."draft_sessions"
    ADD CONSTRAINT "draft_sessions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."integration_configs"
    ADD CONSTRAINT "integration_configs_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_discord_settings"
    ADD CONSTRAINT "league_discord_settings_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_discord_settings"
    ADD CONSTRAINT "league_discord_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."league_events"
    ADD CONSTRAINT "league_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."league_events"
    ADD CONSTRAINT "league_events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_free_agent_claims"
    ADD CONSTRAINT "league_free_agent_claims_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_free_agent_claims"
    ADD CONSTRAINT "league_free_agent_claims_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_invites"
    ADD CONSTRAINT "league_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."league_invites"
    ADD CONSTRAINT "league_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_invites"
    ADD CONSTRAINT "league_invites_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_live_streams"
    ADD CONSTRAINT "league_live_streams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_live_streams"
    ADD CONSTRAINT "league_live_streams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_memberships"
    ADD CONSTRAINT "league_memberships_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_memberships"
    ADD CONSTRAINT "league_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_move_rules"
    ADD CONSTRAINT "league_move_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."league_move_rules"
    ADD CONSTRAINT "league_move_rules_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_pokemon"
    ADD CONSTRAINT "league_pokemon_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."league_pokemon"
    ADD CONSTRAINT "league_pokemon_pokemon_id_fkey" FOREIGN KEY ("pokemon_id") REFERENCES "public"."pokemon_catalogue"("id");

ALTER TABLE ONLY "public"."league_state_snapshots"
    ADD CONSTRAINT "league_state_snapshots_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."operational_health_events"
    ADD CONSTRAINT "operational_health_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."operational_health_events"
    ADD CONSTRAINT "operational_health_events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_obligations"
    ADD CONSTRAINT "payment_obligations_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_obligations"
    ADD CONSTRAINT "payment_obligations_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."league_memberships"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."personal_teams"
    ADD CONSTRAINT "personal_teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."pokemon_move_learnsets"
    ADD CONSTRAINT "pokemon_move_learnsets_game_key_fkey" FOREIGN KEY ("game_key") REFERENCES "public"."pokemon_game_versions"("game_key") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_draft_queue_items"
    ADD CONSTRAINT "private_draft_queue_items_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_draft_queue_items"
    ADD CONSTRAINT "private_draft_queue_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_league_team_notebooks"
    ADD CONSTRAINT "private_league_team_notebooks_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_league_team_notebooks"
    ADD CONSTRAINT "private_league_team_notebooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."public_match_predictions"
    ADD CONSTRAINT "public_match_predictions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."public_match_predictions"
    ADD CONSTRAINT "public_match_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."roster_entries"
    ADD CONSTRAINT "roster_entries_league_pokemon_id_fkey" FOREIGN KEY ("league_pokemon_id") REFERENCES "public"."league_pokemon"("id");

ALTER TABLE ONLY "public"."roster_entries"
    ADD CONSTRAINT "roster_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."team_assignments"
    ADD CONSTRAINT "team_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."team_assignments"
    ADD CONSTRAINT "team_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."team_assignments"
    ADD CONSTRAINT "team_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."league_memberships"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_from_team_id_fkey" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_league_pokemon_id_fkey" FOREIGN KEY ("league_pokemon_id") REFERENCES "public"."league_pokemon"("id");

ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."transaction_items"
    ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."user_badge_progress"
    ADD CONSTRAINT "user_badge_progress_badge_code_fkey" FOREIGN KEY ("badge_code") REFERENCES "public"."badge_catalog"("code") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_badge_progress"
    ADD CONSTRAINT "user_badge_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Managers create only their private league notebooks" ON "public"."private_league_team_notebooks" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_league_member"("league_id")));

CREATE POLICY "Managers delete only their private league notebooks" ON "public"."private_league_team_notebooks" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."is_league_member"("league_id")));

CREATE POLICY "Managers read only their private league notebooks" ON "public"."private_league_team_notebooks" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."is_league_member"("league_id")));

CREATE POLICY "Managers update only their private league notebooks" ON "public"."private_league_team_notebooks" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."is_league_member"("league_id"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_league_member"("league_id")));

CREATE POLICY "Owners create their personal teams" ON "public"."personal_teams" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));

CREATE POLICY "Owners delete their personal teams" ON "public"."personal_teams" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));

CREATE POLICY "Owners read their personal teams" ON "public"."personal_teams" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));

CREATE POLICY "Owners update their personal teams" ON "public"."personal_teams" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));

ALTER TABLE "public"."auction_team_owners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."badge_award_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."badge_catalog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue readable" ON "public"."pokemon_catalogue" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."daily_bracket_matchups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_draft_brackets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_game_comment_upvotes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_game_comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_poll_answers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_poll_comment_upvotes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_poll_comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_poll_email_deliveries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_polls" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_quiz_answers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_quizzes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."daily_three_completions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discord_oauth_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discord_user_connections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "draft sessions visible to members" ON "public"."draft_sessions" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

ALTER TABLE "public"."draft_picks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."draft_queues" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."draft_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."integration_configs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "league members read Discord settings" ON "public"."league_discord_settings" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "league members read move rules" ON "public"."league_move_rules" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "league members read snapshots" ON "public"."league_state_snapshots" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "league pool visible to members" ON "public"."league_pokemon" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

ALTER TABLE "public"."league_discord_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_free_agent_claims" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_invites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_live_streams" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_move_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_pokemon" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."league_state_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."leagues" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches visible to league members" ON "public"."matches" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "members read auction team owners" ON "public"."auction_team_owners" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "members read league events" ON "public"."league_events" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

CREATE POLICY "members see team assignments" ON "public"."team_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "team_assignments"."team_id") AND "public"."is_league_member"("t"."league_id")))));

CREATE POLICY "memberships visible to league members" ON "public"."league_memberships" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."operational_health_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read private draft queues" ON "public"."private_draft_queue_items" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "payment owner or staff may read" ON "public"."payment_obligations" FOR SELECT TO "authenticated" USING (("public"."is_league_staff"("league_id") OR (EXISTS ( SELECT 1
   FROM "public"."league_memberships" "m"
  WHERE (("m"."id" = "payment_obligations"."membership_id") AND ("m"."user_id" = "auth"."uid"()))))));

ALTER TABLE "public"."payment_obligations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."personal_teams" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "picks visible to draft members" ON "public"."draft_picks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."draft_sessions" "d"
  WHERE (("d"."id" = "draft_picks"."draft_session_id") AND "public"."is_league_member"("d"."league_id")))));

ALTER TABLE "public"."pokemon_catalogue" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pokemon_game_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pokemon_move_learnsets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_draft_queue_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_league_team_notebooks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles are visible to signed-in users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "public or joined leagues are visible" ON "public"."leagues" FOR SELECT TO "authenticated" USING (("is_public" OR "public"."is_league_member"("id")));

CREATE POLICY "public read game move versions" ON "public"."pokemon_game_versions" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "public read imported Pokemon move pools" ON "public"."pokemon_move_learnsets" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."public_match_predictions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."roster_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rosters visible to league members" ON "public"."roster_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."teams" "t"
  WHERE (("t"."id" = "roster_entries"."team_id") AND "public"."is_league_member"("t"."league_id")))));

CREATE POLICY "signed-in users read daily polls" ON "public"."daily_polls" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "signed-in users read poll comment upvotes" ON "public"."daily_poll_comment_upvotes" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "signed-in users read poll comments" ON "public"."daily_poll_comments" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "staff manage league invites" ON "public"."league_invites" TO "authenticated" USING ("public"."is_league_staff"("league_id")) WITH CHECK ("public"."is_league_staff"("league_id"));

CREATE POLICY "staff update their league" ON "public"."leagues" FOR UPDATE TO "authenticated" USING ("public"."is_league_staff"("id")) WITH CHECK ("public"."is_league_staff"("id"));

ALTER TABLE "public"."team_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams visible to league members" ON "public"."teams" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

ALTER TABLE "public"."transaction_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions visible to league members" ON "public"."transactions" FOR SELECT TO "authenticated" USING ("public"."is_league_member"("league_id"));

ALTER TABLE "public"."user_badge_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users add their own poll comments" ON "public"."daily_poll_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "users disconnect their Discord account" ON "public"."discord_user_connections" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "users manage their own notification preferences" ON "public"."notification_preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "users manage their own poll comment upvotes" ON "public"."daily_poll_comment_upvotes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "users read their Discord connection" ON "public"."discord_user_connections" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "users read their own daily poll delivery history" ON "public"."daily_poll_email_deliveries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "users update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."league_events";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "public"."accept_league_invite"("p_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."accept_league_invite"("p_token" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."accept_league_invite"("p_token" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."accept_spectator_invite"("p_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."accept_spectator_invite"("p_token" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."accept_spectator_invite"("p_token" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."advance_live_snake_turn"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."advance_live_snake_turn"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."advance_live_snake_turn"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."assign_team_to_username"("p_team_id" "uuid", "p_username" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."assign_team_to_username"("p_team_id" "uuid", "p_username" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."auction_actor_can_control_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auction_actor_can_control_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."auction_actor_can_control_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."auto_assign_open_team"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auto_assign_open_team"("p_league_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."auto_assign_setup_team"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auto_assign_setup_team"("p_league_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_private_free_agent_claim"("p_league_id" "uuid", "p_claim_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."cancel_private_free_agent_claim"("p_league_id" "uuid", "p_claim_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."cancel_private_free_agent_claim"("p_league_id" "uuid", "p_claim_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."claim_live_setup_team"("p_league_id" "uuid", "p_team_index" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_live_setup_team"("p_league_id" "uuid", "p_team_index" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."claim_live_setup_team"("p_league_id" "uuid", "p_team_index" integer) TO "authenticated";

GRANT ALL ON TABLE "public"."notification_events" TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_notification_events"("p_claim_token" "uuid", "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_notification_events"("p_claim_token" "uuid", "p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_live_snake_roster"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_live_snake_roster"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_live_snake_roster"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."complete_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_co_commissioner_invite"("p_league_id" "uuid", "p_email" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_co_commissioner_invite"("p_league_id" "uuid", "p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."create_co_commissioner_invite"("p_league_id" "uuid", "p_email" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_daily_game_comment"("p_game_type" "text", "p_game_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_daily_game_comment"("p_game_type" "text", "p_game_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_daily_game_comment"("p_game_type" "text", "p_game_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_daily_poll_comment"("p_poll_id" "uuid", "p_body" "text", "p_parent_comment_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean, "p_draft_starts_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean, "p_draft_starts_at" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."create_league"("p_name" "text", "p_slug" "text", "p_description" "text", "p_season_label" "text", "p_visibility" "text", "p_is_practice" boolean, "p_draft_starts_at" timestamp with time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_league_invite"("p_league_id" "uuid", "p_email" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_league_invite"("p_league_id" "uuid", "p_email" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_league_invite"("p_league_id" "uuid", "p_email" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_spectator_invite"("p_league_id" "uuid", "p_email" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_spectator_invite"("p_league_id" "uuid", "p_email" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_spectator_invite"("p_league_id" "uuid", "p_email" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."daily_three_activity_trigger"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."daily_three_activity_trigger"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."defer_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_next_attempt_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."defer_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_next_attempt_at" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."end_league_live_stream"("p_stream_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."end_league_live_stream"("p_stream_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."end_league_live_stream"("p_stream_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."enforce_budget_snake_minimum_reserve"() TO "anon";

GRANT ALL ON FUNCTION "public"."enforce_budget_snake_minimum_reserve"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."enforce_budget_snake_minimum_reserve"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_personal_team_free_limit"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."enforce_personal_team_free_limit"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fail_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_error" "text", "p_max_attempts" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fail_notification_event"("p_event_id" "uuid", "p_claim_token" "uuid", "p_error" "text", "p_max_attempts" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."finalize_private_free_agent_claims"("p_league_id" "uuid", "p_state" "jsonb", "p_claim_ids" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."finalize_private_free_agent_claims"("p_league_id" "uuid", "p_state" "jsonb", "p_claim_ids" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."finalize_private_free_agent_claims"("p_league_id" "uuid", "p_state" "jsonb", "p_claim_ids" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_daily_bracket_official_champions"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_bracket_official_champions"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_daily_community_games"("p_local_date" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_community_games"("p_local_date" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_daily_community_games"("p_local_date" "date") TO "anon";

GRANT ALL ON FUNCTION "public"."get_daily_community_games"("p_local_date" "date") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_daily_game_comments"("p_game_type" "text", "p_game_id" "uuid", "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_game_comments"("p_game_type" "text", "p_game_id" "uuid", "p_limit" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_daily_game_comments"("p_game_type" "text", "p_game_id" "uuid", "p_limit" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_daily_poll"("p_date" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_poll"("p_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_daily_poll_comments"("p_poll_id" "uuid", "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_poll_comments"("p_poll_id" "uuid", "p_limit" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_daily_poll_comments"("p_poll_id" "uuid", "p_limit" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_daily_poll_history"("p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_daily_poll_history"("p_limit" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_daily_poll_history"("p_limit" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_league_live_streams"("p_league_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_league_live_streams"("p_league_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_league_live_streams"("p_league_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_league_tool_members"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_league_tool_members"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_league_tool_members"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_live_snake_draft"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_live_snake_draft"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_live_snake_draft"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") TO "anon";

GRANT ALL ON FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_local_daily_poll"("p_local_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_local_poll_history"("p_local_date" "date", "p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_my_badge_profile"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_my_badge_profile"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_badge_profile"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_my_career_match_record"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_my_career_match_record"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_career_match_record"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_my_league_team_history"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_my_league_team_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_my_league_team_history"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."get_pokemon_bracket_profile"("p_pokemon" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_pokemon_community_ranking_totals"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_pokemon_community_ranking_totals"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_pokemon_community_ranking_totals"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_pokemon_community_ranking_totals"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."get_pokemon_daily_three_profile"("p_pokemon" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_pokemon_poll_placements"("p_pokemon" "text") TO "anon";

REVOKE ALL ON FUNCTION "public"."get_public_coach_profile"("p_identity" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_coach_profile"("p_identity" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_public_coach_profile"("p_identity" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_public_draft_trends"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_draft_trends"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_draft_trends"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_draft_trends"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_public_explore"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_explore"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_public_explore"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_explore"() TO "anon";

REVOKE ALL ON FUNCTION "public"."get_public_league"("p_slug" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_league"("p_slug" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_public_league"("p_slug" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_league"("p_slug" "text") TO "anon";

REVOKE ALL ON FUNCTION "public"."get_public_league_cards"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_league_cards"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_public_league_cards"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_league_cards"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_live_streams"("p_limit" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_live_streams"("p_limit" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_live_streams"("p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_public_market_trends"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_market_trends"() TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_market_trends"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_market_trends"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_pokemon_draft_profile"("p_pokemon" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_public_poll_history"("p_limit" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_public_poll_history"("p_limit" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."get_public_poll_history"("p_limit" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_public_poll_history"("p_limit" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."initialize_league_setup_if_empty"("p_league_id" "uuid", "p_state" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."initialize_league_setup_if_empty"("p_league_id" "uuid", "p_state" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."initialize_league_setup_if_empty"("p_league_id" "uuid", "p_state" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_league_member"("target_league" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."is_league_member"("target_league" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_league_member"("target_league" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_league_staff"("target_league" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."is_league_staff"("target_league" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_league_staff"("target_league" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."join_open_league"("p_slug" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."join_open_league"("p_slug" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."join_open_league"("p_slug" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."join_public_league"("p_slug" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."join_public_league"("p_slug" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."league_actor_can_control_snapshot_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."league_actor_can_control_snapshot_team"("p_league_id" "uuid", "p_state" "jsonb", "p_team_index" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."list_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_private_free_agent_claims"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_private_free_agent_claims"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."list_private_free_agent_claims"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."make_snake_pick"("p_draft_session_id" "uuid", "p_league_pokemon_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."make_snake_pick"("p_draft_session_id" "uuid", "p_league_pokemon_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."make_snake_pick"("p_draft_session_id" "uuid", "p_league_pokemon_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."mark_badge_events_seen"("p_event_ids" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mark_badge_events_seen"("p_event_ids" "uuid"[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."mark_badge_events_seen"("p_event_ids" "uuid"[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."mutate_league_communication"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mutate_league_communication"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."mutate_league_communication"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."mutate_league_team_preference"("p_league_id" "uuid", "p_action" "text", "p_team_index" integer, "p_payload" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mutate_league_team_preference"("p_league_id" "uuid", "p_action" "text", "p_team_index" integer, "p_payload" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."mutate_league_team_preference"("p_league_id" "uuid", "p_action" "text", "p_team_index" integer, "p_payload" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."mutate_league_transaction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mutate_league_transaction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."mutate_league_transaction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."mutate_live_auction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mutate_live_auction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."mutate_live_auction"("p_league_id" "uuid", "p_action" "text", "p_payload" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."mutate_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer, "p_action" "text", "p_pokemon_name" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."mutate_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer, "p_action" "text", "p_pokemon_name" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."mutate_my_draft_queue"("p_league_id" "uuid", "p_team_index" integer, "p_action" "text", "p_pokemon_name" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."preview_league_invite"("p_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."preview_league_invite"("p_token" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."preview_league_invite"("p_token" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."provision_live_snake_draft"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_team_order" integer[], "p_rounds" integer, "p_settings" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."provision_live_snake_draft"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_team_order" integer[], "p_rounds" integer, "p_settings" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."provision_live_snake_draft"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_team_order" integer[], "p_rounds" integer, "p_settings" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."provision_live_snake_draft_v2"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_pick_order" integer[], "p_settings" "jsonb", "p_keepers" "jsonb", "p_started_state" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."provision_live_snake_draft_v2"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_pick_order" integer[], "p_settings" "jsonb", "p_keepers" "jsonb", "p_started_state" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."provision_live_snake_draft_v2"("p_league_id" "uuid", "p_teams" "jsonb", "p_pokemon" "jsonb", "p_pick_order" integer[], "p_settings" "jsonb", "p_keepers" "jsonb", "p_started_state" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."publish_league_live_stream"("p_league_id" "uuid", "p_stream_id" "uuid", "p_match_key" "text", "p_title" "text", "p_stream_url" "text", "p_starts_at" timestamp with time zone, "p_visibility" "text", "p_status" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."publish_league_live_stream"("p_league_id" "uuid", "p_stream_id" "uuid", "p_match_key" "text", "p_title" "text", "p_stream_url" "text", "p_starts_at" timestamp with time zone, "p_visibility" "text", "p_status" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."publish_league_live_stream"("p_league_id" "uuid", "p_stream_id" "uuid", "p_match_key" "text", "p_title" "text", "p_stream_url" "text", "p_starts_at" timestamp with time zone, "p_visibility" "text", "p_status" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."purge_old_operational_health_events"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."purge_old_operational_health_events"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."reconcile_overnight_draft_pauses"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."reconcile_overnight_draft_pauses"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."refresh_daily_three"("p_user" "uuid", "p_date" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."refresh_daily_three"("p_user" "uuid", "p_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."refresh_my_account_badges"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."refresh_my_account_badges"() TO "service_role";

GRANT ALL ON FUNCTION "public"."refresh_my_account_badges"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."refresh_my_daily_three_badges"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."refresh_my_daily_three_badges"() TO "service_role";

GRANT ALL ON FUNCTION "public"."refresh_my_daily_three_badges"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."remove_league_manager"("p_league_id" "uuid", "p_username" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."remove_league_manager"("p_league_id" "uuid", "p_username" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."remove_league_manager"("p_league_id" "uuid", "p_username" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."report_operational_issue"("p_kind" "text", "p_message" "text", "p_league_id" "uuid", "p_context" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."report_operational_issue"("p_kind" "text", "p_message" "text", "p_league_id" "uuid", "p_context" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."report_operational_issue"("p_kind" "text", "p_message" "text", "p_league_id" "uuid", "p_context" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."reset_current_league_cycle"("p_league_id" "uuid", "p_state" "jsonb", "p_mode" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."reset_current_league_cycle"("p_league_id" "uuid", "p_state" "jsonb", "p_mode" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."reset_current_league_cycle"("p_league_id" "uuid", "p_state" "jsonb", "p_mode" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."reset_live_snake_draft"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."reset_live_snake_draft"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."reset_live_snake_draft"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restore_my_personal_teams"("p_teams" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."restore_my_personal_teams"("p_teams" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."restore_my_personal_teams"("p_teams" "jsonb") TO "authenticated";

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."league_discord_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."league_discord_settings" TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_league_discord_preferences"("p_league_id" "uuid", "p_notify_draft_reminders" boolean, "p_notify_match_reminders" boolean, "p_notify_live_streams" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_league_discord_preferences"("p_league_id" "uuid", "p_notify_draft_reminders" boolean, "p_notify_match_reminders" boolean, "p_notify_live_streams" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_league_discord_preferences"("p_league_id" "uuid", "p_notify_draft_reminders" boolean, "p_notify_match_reminders" boolean, "p_notify_live_streams" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_league_discord_settings"("p_league_id" "uuid", "p_guild_id" "text", "p_channel_id" "text", "p_enabled" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_league_discord_settings"("p_league_id" "uuid", "p_guild_id" "text", "p_channel_id" "text", "p_enabled" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_league_discord_settings"("p_league_id" "uuid", "p_guild_id" "text", "p_channel_id" "text", "p_enabled" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_league_prediction"("p_league_id" "uuid", "p_week" integer, "p_match_index" integer, "p_patch" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_league_prediction"("p_league_id" "uuid", "p_week" integer, "p_match_index" integer, "p_patch" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_league_prediction"("p_league_id" "uuid", "p_week" integer, "p_match_index" integer, "p_patch" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_league_snapshot"("p_league_id" "uuid", "p_state" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_league_snapshot"("p_league_id" "uuid", "p_state" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."save_league_snapshot"("p_league_id" "uuid", "p_state" "jsonb") TO "authenticated";

GRANT ALL ON TABLE "public"."discord_user_connections" TO "service_role";

GRANT SELECT,DELETE ON TABLE "public"."discord_user_connections" TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_my_discord_notification_preferences"("p_dm_enabled" boolean, "p_notify_draft_reminders" boolean, "p_notify_match_scheduling" boolean, "p_notify_match_reminders" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_my_discord_notification_preferences"("p_dm_enabled" boolean, "p_notify_draft_reminders" boolean, "p_notify_match_scheduling" boolean, "p_notify_match_reminders" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_my_discord_notification_preferences"("p_dm_enabled" boolean, "p_notify_draft_reminders" boolean, "p_notify_match_scheduling" boolean, "p_notify_match_reminders" boolean, "p_notify_transactions" boolean, "p_notify_results" boolean, "p_quiet_hours_enabled" boolean, "p_quiet_hours_start" time without time zone, "p_quiet_hours_end" time without time zone, "p_quiet_hours_timezone" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_playoff_result"("p_league_id" "uuid", "p_result_key" "text", "p_result" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_playoff_result"("p_league_id" "uuid", "p_result_key" "text", "p_result" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_playoff_result_v2"("p_league_id" "uuid", "p_path" "text"[], "p_team_a" integer, "p_team_b" integer, "p_result" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_playoff_result_v2"("p_league_id" "uuid", "p_path" "text"[], "p_team_a" integer, "p_team_b" integer, "p_result" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."save_playoff_result_v2"("p_league_id" "uuid", "p_path" "text"[], "p_team_a" integer, "p_team_b" integer, "p_result" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_public_match_prediction"("p_slug" "text", "p_match_key" "text", "p_team_index" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_public_match_prediction"("p_slug" "text", "p_match_key" "text", "p_team_index" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."save_public_match_prediction"("p_slug" "text", "p_match_key" "text", "p_team_index" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_regular_season_result"("p_league_id" "uuid", "p_week" integer, "p_match" integer, "p_result" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."save_regular_season_result"("p_league_id" "uuid", "p_week" integer, "p_match" integer, "p_result" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."save_regular_season_result"("p_league_id" "uuid", "p_week" integer, "p_match" integer, "p_result" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."schedule_draft_reminders"("p_league_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."schedule_draft_reminders"("p_league_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."schedule_draft_reminders"("p_league_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_badge_progress"("p_user" "uuid", "p_code" "text", "p_subject" "text", "p_progress" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_badge_progress"("p_user" "uuid", "p_code" "text", "p_subject" "text", "p_progress" integer) TO "service_role";

GRANT ALL ON TABLE "public"."league_memberships" TO "anon";

GRANT ALL ON TABLE "public"."league_memberships" TO "authenticated";

GRANT ALL ON TABLE "public"."league_memberships" TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_co_commissioner"("p_league_id" "uuid", "p_username" "text", "p_enabled" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_co_commissioner"("p_league_id" "uuid", "p_username" "text", "p_enabled" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."set_co_commissioner"("p_league_id" "uuid", "p_username" "text", "p_enabled" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_live_snake_draft_paused"("p_league_id" "uuid", "p_paused" boolean, "p_overnight" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_live_snake_draft_paused"("p_league_id" "uuid", "p_paused" boolean, "p_overnight" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."set_live_snake_draft_paused"("p_league_id" "uuid", "p_paused" boolean, "p_overnight" boolean) TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_my_profile"("p_display_name" "text", "p_username" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_my_profile"("p_display_name" "text", "p_username" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_personal_team_updated_at"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_personal_team_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."snapshot_draft_is_complete"("p_state" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."snapshot_draft_is_complete"("p_state" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."snapshot_roster_respects_caps"("p_roster" "jsonb", "p_settings" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."snapshot_roster_respects_caps"("p_roster" "jsonb", "p_settings" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."start_snake_draft"("p_league_id" "uuid", "p_team_order" "uuid"[]) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."start_snake_draft"("p_league_id" "uuid", "p_team_order" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."strip_private_claims_from_snapshot"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."strip_private_claims_from_snapshot"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_daily_draft_bracket"("p_bracket_id" "uuid", "p_winners" "jsonb", "p_local_date" "date", "p_time_zone" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_daily_draft_bracket"("p_bracket_id" "uuid", "p_winners" "jsonb", "p_local_date" "date", "p_time_zone" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."submit_daily_draft_bracket"("p_bracket_id" "uuid", "p_winners" "jsonb", "p_local_date" "date", "p_time_zone" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."submit_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_daily_quiz_answer"("p_quiz_id" "uuid", "p_answer" "text", "p_local_date" "date", "p_time_zone" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_daily_quiz_answer"("p_quiz_id" "uuid", "p_answer" "text", "p_local_date" "date", "p_time_zone" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."submit_daily_quiz_answer"("p_quiz_id" "uuid", "p_answer" "text", "p_local_date" "date", "p_time_zone" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_local_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text", "p_local_date" "date", "p_time_zone" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_local_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text", "p_local_date" "date", "p_time_zone" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."submit_local_daily_poll_answer"("p_poll_id" "uuid", "p_answer_key" "text", "p_local_date" "date", "p_time_zone" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_private_free_agent_claim"("p_league_id" "uuid", "p_team_index" integer, "p_add_name" "text", "p_add_mon" "jsonb", "p_drop_name" "text", "p_bid_amount" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."submit_private_free_agent_claim"("p_league_id" "uuid", "p_team_index" integer, "p_add_name" "text", "p_add_mon" "jsonb", "p_drop_name" "text", "p_bid_amount" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."submit_private_free_agent_claim"("p_league_id" "uuid", "p_team_index" integer, "p_add_name" "text", "p_add_mon" "jsonb", "p_drop_name" "text", "p_bid_amount" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."toggle_daily_poll_comment_upvote"("p_comment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."toggle_daily_poll_comment_upvote"("p_comment_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."toggle_daily_poll_comment_upvote"("p_comment_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."transition_league_to_new_season"("p_league_id" "uuid", "p_state" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."transition_league_to_new_season"("p_league_id" "uuid", "p_state" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."transition_league_to_new_season"("p_league_id" "uuid", "p_state" "jsonb") TO "authenticated";

GRANT ALL ON TABLE "public"."leagues" TO "anon";

GRANT ALL ON TABLE "public"."leagues" TO "authenticated";

GRANT ALL ON TABLE "public"."leagues" TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_league_access"("p_league_id" "uuid", "p_visibility" "text", "p_is_practice" boolean, "p_practice_expires_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_league_access"("p_league_id" "uuid", "p_visibility" "text", "p_is_practice" boolean, "p_practice_expires_at" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."update_league_access"("p_league_id" "uuid", "p_visibility" "text", "p_is_practice" boolean, "p_practice_expires_at" timestamp with time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_league_details"("p_league_id" "uuid", "p_name" "text", "p_description" "text", "p_season_label" "text", "p_draft_starts_at" timestamp with time zone, "p_is_public" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_league_details"("p_league_id" "uuid", "p_name" "text", "p_description" "text", "p_season_label" "text", "p_draft_starts_at" timestamp with time zone, "p_is_public" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."update_league_details"("p_league_id" "uuid", "p_name" "text", "p_description" "text", "p_season_label" "text", "p_draft_starts_at" timestamp with time zone, "p_is_public" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_league_draft_time"("p_league_id" "uuid", "p_draft_starts_at" timestamp with time zone) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_league_draft_time"("p_league_id" "uuid", "p_draft_starts_at" timestamp with time zone) TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_league_draft_time"("p_league_id" "uuid", "p_draft_starts_at" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_league_image"("p_league_id" "uuid", "p_image_url" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_league_image"("p_league_id" "uuid", "p_image_url" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_league_image"("p_league_id" "uuid", "p_image_url" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."upvote_daily_game_comment"("p_comment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."upvote_daily_game_comment"("p_comment_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."upvote_daily_game_comment"("p_comment_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_live_auction_snapshot"() TO "anon";

GRANT ALL ON FUNCTION "public"."validate_live_auction_snapshot"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_live_auction_snapshot"() TO "service_role";

GRANT ALL ON TABLE "public"."auction_team_owners" TO "authenticated";

GRANT ALL ON TABLE "public"."auction_team_owners" TO "service_role";

GRANT ALL ON TABLE "public"."badge_award_events" TO "anon";

GRANT ALL ON TABLE "public"."badge_award_events" TO "authenticated";

GRANT ALL ON TABLE "public"."badge_award_events" TO "service_role";

GRANT ALL ON TABLE "public"."badge_catalog" TO "anon";

GRANT ALL ON TABLE "public"."badge_catalog" TO "authenticated";

GRANT ALL ON TABLE "public"."badge_catalog" TO "service_role";

GRANT ALL ON TABLE "public"."daily_bracket_matchups" TO "anon";

GRANT ALL ON TABLE "public"."daily_bracket_matchups" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_bracket_matchups" TO "service_role";

GRANT ALL ON TABLE "public"."daily_draft_brackets" TO "anon";

GRANT ALL ON TABLE "public"."daily_draft_brackets" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_draft_brackets" TO "service_role";

GRANT ALL ON TABLE "public"."daily_game_comment_upvotes" TO "anon";

GRANT ALL ON TABLE "public"."daily_game_comment_upvotes" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_game_comment_upvotes" TO "service_role";

GRANT ALL ON TABLE "public"."daily_game_comments" TO "anon";

GRANT ALL ON TABLE "public"."daily_game_comments" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_game_comments" TO "service_role";

GRANT ALL ON TABLE "public"."daily_poll_answers" TO "anon";

GRANT ALL ON TABLE "public"."daily_poll_answers" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_poll_answers" TO "service_role";

GRANT ALL ON TABLE "public"."daily_poll_comment_upvotes" TO "anon";

GRANT ALL ON TABLE "public"."daily_poll_comment_upvotes" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_poll_comment_upvotes" TO "service_role";

GRANT ALL ON TABLE "public"."daily_poll_comments" TO "anon";

GRANT ALL ON TABLE "public"."daily_poll_comments" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_poll_comments" TO "service_role";

GRANT ALL ON TABLE "public"."daily_poll_email_deliveries" TO "anon";

GRANT ALL ON TABLE "public"."daily_poll_email_deliveries" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_poll_email_deliveries" TO "service_role";

GRANT ALL ON TABLE "public"."daily_polls" TO "anon";

GRANT ALL ON TABLE "public"."daily_polls" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_polls" TO "service_role";

GRANT ALL ON TABLE "public"."daily_quiz_answers" TO "anon";

GRANT ALL ON TABLE "public"."daily_quiz_answers" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_quiz_answers" TO "service_role";

GRANT ALL ON TABLE "public"."daily_quizzes" TO "anon";

GRANT ALL ON TABLE "public"."daily_quizzes" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_quizzes" TO "service_role";

GRANT ALL ON TABLE "public"."daily_three_completions" TO "anon";

GRANT ALL ON TABLE "public"."daily_three_completions" TO "authenticated";

GRANT ALL ON TABLE "public"."daily_three_completions" TO "service_role";

GRANT ALL ON TABLE "public"."discord_oauth_states" TO "service_role";

GRANT ALL ON TABLE "public"."draft_picks" TO "anon";

GRANT ALL ON TABLE "public"."draft_picks" TO "authenticated";

GRANT ALL ON TABLE "public"."draft_picks" TO "service_role";

GRANT ALL ON TABLE "public"."draft_queues" TO "anon";

GRANT ALL ON TABLE "public"."draft_queues" TO "authenticated";

GRANT ALL ON TABLE "public"."draft_queues" TO "service_role";

GRANT ALL ON TABLE "public"."draft_sessions" TO "anon";

GRANT ALL ON TABLE "public"."draft_sessions" TO "authenticated";

GRANT ALL ON TABLE "public"."draft_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."integration_configs" TO "anon";

GRANT ALL ON TABLE "public"."integration_configs" TO "authenticated";

GRANT ALL ON TABLE "public"."integration_configs" TO "service_role";

GRANT ALL ON TABLE "public"."league_events" TO "anon";

GRANT ALL ON TABLE "public"."league_events" TO "authenticated";

GRANT ALL ON TABLE "public"."league_events" TO "service_role";

GRANT ALL ON SEQUENCE "public"."league_events_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."league_events_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."league_events_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."league_free_agent_claims" TO "service_role";

GRANT ALL ON TABLE "public"."league_invites" TO "anon";

GRANT ALL ON TABLE "public"."league_invites" TO "authenticated";

GRANT ALL ON TABLE "public"."league_invites" TO "service_role";

GRANT ALL ON TABLE "public"."league_live_streams" TO "service_role";

GRANT ALL ON TABLE "public"."league_move_rules" TO "anon";

GRANT ALL ON TABLE "public"."league_move_rules" TO "authenticated";

GRANT ALL ON TABLE "public"."league_move_rules" TO "service_role";

GRANT ALL ON TABLE "public"."league_pokemon" TO "anon";

GRANT ALL ON TABLE "public"."league_pokemon" TO "authenticated";

GRANT ALL ON TABLE "public"."league_pokemon" TO "service_role";

GRANT ALL ON TABLE "public"."league_state_snapshots" TO "anon";

GRANT ALL ON TABLE "public"."league_state_snapshots" TO "authenticated";

GRANT ALL ON TABLE "public"."league_state_snapshots" TO "service_role";

GRANT ALL ON TABLE "public"."matches" TO "anon";

GRANT ALL ON TABLE "public"."matches" TO "authenticated";

GRANT ALL ON TABLE "public"."matches" TO "service_role";

GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";

GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";

GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";

GRANT ALL ON TABLE "public"."operational_health_events" TO "service_role";

GRANT ALL ON SEQUENCE "public"."operational_health_events_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."operational_health_events_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."operational_health_events_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."payment_obligations" TO "anon";

GRANT ALL ON TABLE "public"."payment_obligations" TO "authenticated";

GRANT ALL ON TABLE "public"."payment_obligations" TO "service_role";

GRANT ALL ON TABLE "public"."personal_teams" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."personal_teams" TO "authenticated";

GRANT ALL ON TABLE "public"."pokemon_catalogue" TO "anon";

GRANT ALL ON TABLE "public"."pokemon_catalogue" TO "authenticated";

GRANT ALL ON TABLE "public"."pokemon_catalogue" TO "service_role";

GRANT ALL ON TABLE "public"."pokemon_game_versions" TO "anon";

GRANT ALL ON TABLE "public"."pokemon_game_versions" TO "authenticated";

GRANT ALL ON TABLE "public"."pokemon_game_versions" TO "service_role";

GRANT ALL ON TABLE "public"."pokemon_move_learnsets" TO "anon";

GRANT ALL ON TABLE "public"."pokemon_move_learnsets" TO "authenticated";

GRANT ALL ON TABLE "public"."pokemon_move_learnsets" TO "service_role";

GRANT ALL ON TABLE "public"."private_draft_queue_items" TO "service_role";

GRANT SELECT ON TABLE "public"."private_draft_queue_items" TO "authenticated";

GRANT ALL ON TABLE "public"."private_league_team_notebooks" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."private_league_team_notebooks" TO "authenticated";

GRANT ALL ON TABLE "public"."public_match_predictions" TO "anon";

GRANT ALL ON TABLE "public"."public_match_predictions" TO "authenticated";

GRANT ALL ON TABLE "public"."public_match_predictions" TO "service_role";

GRANT ALL ON TABLE "public"."roster_entries" TO "anon";

GRANT ALL ON TABLE "public"."roster_entries" TO "authenticated";

GRANT ALL ON TABLE "public"."roster_entries" TO "service_role";

GRANT ALL ON TABLE "public"."team_assignments" TO "anon";

GRANT ALL ON TABLE "public"."team_assignments" TO "authenticated";

GRANT ALL ON TABLE "public"."team_assignments" TO "service_role";

GRANT ALL ON TABLE "public"."teams" TO "anon";

GRANT ALL ON TABLE "public"."teams" TO "authenticated";

GRANT ALL ON TABLE "public"."teams" TO "service_role";

GRANT ALL ON TABLE "public"."transaction_items" TO "anon";

GRANT ALL ON TABLE "public"."transaction_items" TO "authenticated";

GRANT ALL ON TABLE "public"."transaction_items" TO "service_role";

GRANT ALL ON TABLE "public"."transactions" TO "anon";

GRANT ALL ON TABLE "public"."transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."transactions" TO "service_role";

GRANT ALL ON TABLE "public"."user_badge_progress" TO "anon";

GRANT ALL ON TABLE "public"."user_badge_progress" TO "authenticated";

GRANT ALL ON TABLE "public"."user_badge_progress" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
