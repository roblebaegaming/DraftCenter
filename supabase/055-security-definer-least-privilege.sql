-- DraftCenter SECURITY DEFINER least-privilege cleanup.
-- Keeps intentional public read APIs available, removes unintended anonymous
-- mutation access, and retires historical browser entry points no longer used
-- by the current application.

begin;

-- These mutations require auth.uid() and must never be callable while signed
-- out. Explicitly revoking anon is necessary because revoking "public" does
-- not remove a historical grant made directly to anon.
revoke execute on function public.create_co_commissioner_invite(uuid, text)
  from public, anon;
revoke execute on function public.submit_local_daily_poll_answer(uuid, text, date, text)
  from public, anon;
revoke execute on function public.save_public_match_prediction(text, text, integer)
  from public, anon;

grant execute on function public.create_co_commissioner_invite(uuid, text)
  to authenticated;
grant execute on function public.submit_local_daily_poll_answer(uuid, text, date, text)
  to authenticated;
grant execute on function public.save_public_match_prediction(text, text, integer)
  to authenticated;

-- Retired browser RPCs. Current DraftCenter uses join_open_league, explicit
-- invite acceptance, claim_live_setup_team, the seven-argument create_league,
-- provision_live_snake_draft, and the newer poll-comment function instead.
revoke execute on function public.assign_team_to_username(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.auto_assign_open_team(uuid)
  from public, anon, authenticated;
revoke execute on function public.auto_assign_setup_team(uuid)
  from public, anon, authenticated;
revoke execute on function public.join_public_league(text)
  from public, anon, authenticated;
revoke execute on function public.set_my_profile(text, text)
  from public, anon, authenticated;
revoke execute on function public.get_daily_poll(date)
  from public, anon, authenticated;
revoke execute on function public.create_daily_poll_comment(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.create_league(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.create_league(text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.start_snake_draft(uuid, uuid[])
  from public, anon, authenticated;

-- Public read-only APIs intentionally remain available to signed-out visitors.
-- Listing them here makes the public surface explicit and reviewable.
grant execute on function public.get_local_daily_poll(date)
  to anon, authenticated;
grant execute on function public.get_local_poll_history(date, integer)
  to anon, authenticated;
grant execute on function public.get_pokemon_poll_placements(text)
  to anon, authenticated;
grant execute on function public.get_public_draft_trends()
  to anon, authenticated;
grant execute on function public.get_public_explore()
  to anon, authenticated;
grant execute on function public.get_public_league(text)
  to anon, authenticated;
grant execute on function public.get_public_league_cards()
  to anon, authenticated;
grant execute on function public.get_public_market_trends()
  to anon, authenticated;
grant execute on function public.get_public_pokemon_draft_profile(text)
  to anon, authenticated;
grant execute on function public.get_public_poll_history(integer)
  to anon, authenticated;

-- Prevent functions created by future SQL Editor migrations under the current
-- database owner from automatically becoming executable by everyone. Each new
-- function must receive an intentional role grant in its own migration.
alter default privileges in schema public
  revoke execute on functions from public;

commit;
