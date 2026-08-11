# VGC Masters results-feed permission request

## Status

This is a ready-to-send request and approval-record template. It has not been
sent, and it does not record permission. Production polling remains disabled
until the provider replies affirmatively and the exact approved terms are
recorded below.

## Request draft

**Subject:** Permission to poll and attribute 2026 VGC Masters standings

Hello,

DraftCenter is an independent, noncommercial Pokémon fan project preparing a
community Pick 10 prediction game for the 2026 VGC Masters World Championships.
We would like permission to use the exact PokeData Masters JSON standings
download for provisional live scoring during the event.

The proposed use is:

- server-to-server polling of one exact Masters JSON URL every three to five
  minutes during an agreed event window;
- a 5 MiB response limit, conditional requests, and content-hash deduplication;
- storage only of the source name and country, placing, win/loss/tie record,
  normalized score, response hash, and fetch metadata needed for the public
  leaderboard and audit history;
- discarding decklists, teams, moves, opponents, tables, and round-by-round
  details before database insertion;
- visible PokeData attribution, a direct public source link, last-updated time,
  and an explicit warning that live results are unofficial and provisional;
- no resale of the feed and no publication of the raw JSON; and
- immediate disabling of polling if permission is withdrawn or the feed owner
  asks us to change the interval or attribution.

Would you please confirm whether this use is permitted and, if so:

1. the exact approved 2026 VGC Masters event identifier and JSON URL;
2. the minimum polling interval or other rate limits;
3. the required attribution name, wording, and public link;
4. any storage, retention, caching, or deletion requirements;
5. whether a manual-download-only workflow is required instead of polling; and
6. the appropriate contact for event-day feed changes or permission revocation?

We will keep the integration disabled until those terms are confirmed. Final
results will be checked against an official Pokémon-published source rather than
treating provisional PokeData standings as official.

Thank you.

## Approval record

- Provider contact route:
- Request sent by:
- Request sent at:
- Reply received from:
- Reply received at:
- Permission status: `pending`
- Approved exact event identifier:
- Approved exact JSON URL:
- Approved polling interval:
- Approved active window:
- Required attribution name:
- Required attribution URL:
- Required unofficial-results wording:
- Storage or retention restrictions:
- Revocation or event-day contact route:
- Internal reviewer:
- Internal review time:
- Evidence location:

Do not place private email addresses, credentials, tokens, or message contents
containing personal information in the repository. Store private correspondence
in an owner-controlled system and record only the operational terms and a safe
evidence reference here.

## Activation boundary after approval

An affirmative reply authorizes only the reviewed terms. It does not itself
authorize a production configuration change or scheduler. After approval:

1. validate the exact event URL and identifier in an isolated Preview;
2. save the reviewed attribution and approved interval in owner Operations;
3. run a supervised manual import and review every Top 64 alias;
4. verify provisional, delayed-update, last-known-good, and alert behavior;
5. separately authorize and create the scheduler; and
6. retain owner-only finalization against an official Pokémon source.
