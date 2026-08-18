# Confirmed Showdown replay result import

DraftCenter can analyze one to five public, password-free Pokémon Showdown
replays for a scheduled regular-season matchup. This workflow fills verified
result facts only after a league participant or commissioner confirms which
Showdown player controlled each scheduled team. The reporter must still review
the normal result editor and choose **Save**.

The implementation follows Pokémon Showdown's official replay and simulator
contracts:

- [Replay API](https://github.com/smogon/pokemon-showdown-client/blob/master/WEB-API.md): a public replay URL can be requested with `.json` to retrieve its replay data.
- [Simulator protocol](https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md): replay messages declare players, team sizes, game type, switches, faints, and the winner.

## Supported facts

For completed two-player singles or doubles replays, DraftCenter can preserve:

- canonical replay ID and public URL;
- format, game type, and upload timestamp;
- the two Showdown player names after explicit team mapping;
- game winner;
- declared team sizes, faint counts, and remaining counts; and
- Pokémon actually revealed through battle switch/drag/replace messages.

The confirmed games must form a completed best-of-1, best-of-3, or best-of-5
series and must agree exactly with the score and winner-side remaining totals
saved in the result.

DraftCenter does **not** infer knockout attribution. A faint message does not
authoritatively identify which opposing Pokémon earned the knockout. It also
does not claim an unrevealed team-preview Pokémon entered battle or was
"brought." These statistics remain manual until the source provides facts that
support them.

## Authorization and network boundary

Replay analysis is server-side. The endpoint:

- requires a current bearer-authenticated DraftCenter session;
- rate-limits each account to 30 analyses per hour;
- verifies direct league membership;
- permits league staff or a manager controlling one of the scheduled teams;
- rechecks that the week and matchup still exist;
- accepts only exact `https://replay.pokemonshowdown.com/...` URLs without
  query strings, passwords, alternate hosts, redirects, or duplicate IDs;
- uses an eight-second request timeout and bounded response size; and
- prevents one replay from being attached to a different league result.

The endpoint returns parsed facts, not the raw replay log. Responses are
private and non-cacheable.

## Storage and database safeguards

Forward migration 438 replaces `save_regular_season_result` without changing
its signature. The security-definer function keeps an explicit `public`
search path, verifies the reporting member and scheduled matchup, locks the
authoritative snapshot row, and validates every confirmed replay again.

Only a fixed allowlist of replay fields is rebuilt into league state. Extra
input such as a raw log, guessed knockouts, or arbitrary metadata is discarded.
Replay IDs must be unique within the series and across other league results.
The saved facts must match the submitted series score and differential.

The audit event is aggregate-only: league, actor, week number, match number,
and replay count. It contains no replay ID, URL, Showdown name, Pokémon, or raw
log. Function execution is revoked from `public` and `anon`, then granted only
to `authenticated` and `service_role`.

Manual changes to series format, game winners, remaining counts, or replay
links clear the confirmed replay payload in the editor. The user must analyze
and map the replays again before the result can retain confirmed status.

## Validation

Pure parsing tests cover canonical URL enforcement, supported facts, explicit
mapping, completed-series rules, and rejection of private, tied, incomplete,
or unsupported multi-player replays. Source-level API and migration tests cover
authentication, rate limiting, team authorization, duplicate protection,
raw-log exclusion, explicit grants, and aggregate audit history.

The disposable SQL regression in
[`supabase/tests/438-confirmed-showdown-replay-results-regression.sql`](../supabase/tests/438-confirmed-showdown-replay-results-regression.sql)
must run only in an isolated Preview database. It rolls back its fixtures and
tests field whitelisting, duplicate reuse, invalid hosts, anonymous denial,
row-level security, and function grants.
