# Twitch automatic Live Now setup

DraftCenter can automatically change a scheduled Twitch match to **Live**, publish it on the website, post the league's enabled Discord announcement, and end the website listing when Twitch reports the channel offline.

## Owner setup

1. In the Twitch Developer Console, create an application named `DraftCenter`.
2. Use `https://www.draftcentral.gg` as the application website when requested.
3. Add these server-only Production, Preview, and Development environment variables in Vercel:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_EVENTSUB_SECRET` (a randomly generated value of at least 32 characters)
   - `TWITCH_EVENTSUB_CALLBACK_URL=https://www.draftcentral.gg/api/twitch/eventsub`
4. Apply `supabase/227-automatic-twitch-live-detection.sql` in the DraftCenter Supabase project.
5. Redeploy production after saving the variables.

Never place the Twitch client secret or EventSub secret in source, screenshots, issue text, or browser-visible `NEXT_PUBLIC_*` variables.

## User behavior

- A coach publishes a direct channel URL such as `https://twitch.tv/channelname`.
- DraftCenter verifies the channel through Twitch and subscribes to its online and offline events.
- Twitch signs every webhook request. DraftCenter verifies the signature and rejects messages older than ten minutes.
- A Twitch online event atomically changes matching scheduled broadcasts to Live and queues the existing deduplicated Discord announcement.
- A Twitch offline event ends matching live broadcasts.
- The existing **Go live** button remains available if Twitch is unavailable.
- YouTube continues using the manual status until its OAuth and quota-aware provider are implemented.

## Production verification

1. Connect a test league to a Discord test channel and enable `Scheduled streams and Live Now`.
2. Schedule a public Twitch match with a direct channel URL.
3. Confirm DraftCenter reports that Twitch monitoring is connected.
4. Start a short Twitch test stream.
5. Confirm the website changes to Live and Discord receives exactly one message.
6. Stop the test stream and confirm the website listing ends.
7. Repeat once with Discord Live Now announcements disabled and confirm the website still updates without posting to Discord.
