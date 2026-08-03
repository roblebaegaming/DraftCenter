-- The current application uses the live-stream-aware personal preference
-- function and the ten-argument league preference function. Remove the
-- deployment-transition overloads so old browser clients cannot keep using
-- superseded preference contracts indefinitely.

begin;

drop function if exists public.save_league_discord_preferences(
  uuid,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  time, time, text
);

drop function if exists public.save_my_discord_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  time, time, text
);

commit;

notify pgrst, 'reload schema';
