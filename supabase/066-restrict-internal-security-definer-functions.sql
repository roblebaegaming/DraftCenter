-- Restrict internal SECURITY DEFINER helpers and remove anonymous access from
-- authenticated livestream mutations without breaking intentional public reads.

begin;

-- Internal badge and Daily Three helpers are invoked only by trusted database
-- functions/triggers. Browser roles must not call them directly, especially
-- set_badge_progress, which accepts an arbitrary target user and progress value.
revoke execute on function public.set_badge_progress(uuid, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.refresh_daily_three(uuid, date)
  from public, anon, authenticated;
revoke execute on function public.daily_three_activity_trigger()
  from public, anon, authenticated;

-- These are active browser mutations, but only for signed-in league members.
-- Their function bodies enforce creator/staff authorization with auth.uid().
revoke execute on function public.publish_league_live_stream(
  uuid, uuid, text, text, text, timestamptz, text, text
) from public, anon;
revoke execute on function public.end_league_live_stream(uuid)
  from public, anon;

grant execute on function public.publish_league_live_stream(
  uuid, uuid, text, text, text, timestamptz, text, text
) to authenticated;
grant execute on function public.end_league_live_stream(uuid)
  to authenticated;

-- Continue the least-privilege default established by migration 055. Future
-- functions must receive an intentional role grant in their own migration.
alter default privileges in schema public
  revoke execute on functions from public;

-- Fail the migration rather than report success if any internal helper remains
-- executable through either browser-facing role.
do $$
begin
  if has_function_privilege('anon', 'public.set_badge_progress(uuid,text,text,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.set_badge_progress(uuid,text,text,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.refresh_daily_three(uuid,date)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.refresh_daily_three(uuid,date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.daily_three_activity_trigger()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.daily_three_activity_trigger()', 'EXECUTE')
  then
    raise exception 'Internal SECURITY DEFINER function privileges were not fully removed.';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
