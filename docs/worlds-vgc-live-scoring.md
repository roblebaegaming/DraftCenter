# Worlds VGC live scoring

## Status and release boundary

The VGC Masters live-scoring importer is deployed through pull request
[#128](https://github.com/roblebaegaming/DraftCenter/pull/128) and production
application commit `e5dca23b9da09d3a557e485443e7dc5a207b4e20`. Forward-only
migration 371 is applied to the exact core production project. Migrations 372
and 373 subsequently added the empty Top Cut challenge and changed the public
competition to Pick 10 plus Your Champion.

The production source remains deliberately disabled with permission pending,
no feed URL, no external event identifier, and no scheduler. No provider
schedule or environment variable was changed by the release. Deployment of the
importer does not authorize polling or use of an external results feed.

Migration `371-worlds-vgc-live-scoring.sql` creates the disabled-by-default
source, import audit, reviewed alias, immutable snapshot, placement, mapping
issue, and finalization boundaries. The public VGC page gains waiting,
**Live — provisional**, delayed-update, and **Final** states. League Operations
gains owner-only source review, manual fetch/upload, alias approval, audit, and
finalization controls.

The first implementation is VGC Masters only. It does not ingest Junior,
Senior, TCG, Pokémon GO, Pokémon UNITE, or bracket data.

## Import flow

The accepted path is:

1. A scheduled request presents the existing `CRON_SECRET` bearer credential,
   or the owner explicitly starts a fetch/upload from League Operations.
2. A database function checks the source approval, event window, final state,
   and two-minute overlap lock before creating a running audit record.
   Expired locks mark the abandoned run failed, are recovered explicitly, and
   produce an owner alert instead of leaving a misleading running audit row.
3. The server fetches only the exact reviewed PokeData Masters JSON URL. The
   URL validator rejects other hosts, ports, credentials, queries, fragments,
   divisions, and mismatched event identifiers.
4. The response is capped at 5 MiB, requires JSON, and is hashed before
   processing. Conditional request validators and the content hash make
   unchanged delivery idempotent.
5. Every row must contain a bounded placing, record, rounds object, and a full
   name with a supported two- or three-letter country code. The complete row
   count must stay inside owner-reviewed bounds. PokeData's observed `9999`
   no-valid-placing sentinel is retained for audit and always scores zero.
6. Exact reviewed aliases map source identities to the existing 438-player
   Masters roster. Unicode folding is used only to suggest a candidate. It does
   not approve a match.
7. Any unresolved Top 64 identity, ambiguous alias, or duplicate target rejects
   the entire publication. Unmatched rows below Top 64 are quarantined for
   review but cannot change a score and therefore do not block a snapshot.
8. One database transaction inserts or reuses the immutable content snapshot,
   inserts normalized placements, resets and reapplies competitor placement
   points, advances the event to scoring, and moves the public current-snapshot
   pointer.

Failures and rejected mappings never update competitor scores or the public
snapshot pointer. The last accepted leaderboard remains visible.

## Stored source data

The sample PokeData feed is roughly 2 MiB and includes decklists and individual
round details that DraftCenter does not need for Pick 10 scoring. Each snapshot
therefore stores:

- the SHA-256 hash of the complete fetched response;
- the exact reviewed source URL and HTTP update metadata;
- parser version, fetch/update timestamps, and row count; and
- normalized source identity, country, placing, scoring points, and win/loss/tie
  record for each standings row.

Decklists, moves, teams, screen names, opponents, tables, and round-by-round
detail are discarded before database insertion. Snapshot and placement tables
have no browser grants. Public clients receive only the current status,
attribution, last accepted time, competitor result labels/points, and derived
leaderboard.

## Source approval and scheduling

The seeded source has no feed URL, `permission_status = pending`, and
`enabled = false`. Enabling scheduled polling requires all of the following in
the owner UI:

- an exact PokeData Masters JSON URL and matching event identifier;
- an HTTPS public attribution link;
- explicit confirmation that polling and attribution are approved;
- a three-to-thirty-minute interval;
- an event window; and
- reviewed minimum and maximum row counts.

Saving that configuration does not create a Vercel or Supabase schedule. Choose
and authorize the provider only after confirming the production plan. The
secured route is `GET /api/operations/worlds-results/import`. It is compatible
with the repository's existing Vercel bearer-secret pattern and can also be
called by an approved Supabase-scheduled server function. Do not put a provider
credential in a public variable.

The owner may use **Fetch approved feed now** to prepare mappings before the
live window. **Upload reviewed JSON** is the manual fallback and is available
only after the source is marked polling-approved or manual-use-approved.

## Mapping review

The first feed run will normally reject because no source aliases have been
reviewed. League Operations shows only the unresolved source identities and
their placement impact. A unique accent-insensitive name plus mapped country
may appear as a suggestion. The owner can review suggestions in bulk or choose
an exact seeded roster slug manually.

Approved aliases retain the original source name and country, reviewer, time,
and optional note. One source identity cannot have two active aliases. Multiple
explicit aliases may point to the same competitor across history, but two such
identities appearing together in one payload reject publication.

After approving the required mappings, run the same feed again. Rejected runs
do not adopt the rejected response's `ETag` or `Last-Modified` value, so the
corrected mapping set can process the unchanged upstream payload.

## Public states and alerting

- **Waiting for live results:** no accepted snapshot exists.
- **Live — provisional:** a PokeData-derived snapshot is current. The source
  link, unofficial warning, and last successful update are visible.
- **Live — provisional · updates delayed:** the last accepted snapshot is older
  than twice the configured polling interval. Scores remain unchanged.
- **Final:** the owner supplied an official HTTPS result source, typed the exact
  confirmation, and created a separate immutable final snapshot.

Failed, rejected, and overlapping scheduled runs use the existing owner email
delivery path with hourly deduplication. Alerts contain only event, status, and
issue category. They do not include selections, account identifiers, email
addresses in message content, secrets, or raw source rows.

## Finalization

Final Pick 10 ranking uses total points first, then the lower average finish of
the entry's six best-finishing picks, then the lower average finish of all 10
picks. These tiebreakers are derived only from the owner-approved final result
snapshot; provisional ranks remain points-only and exact final ties share a
rank. Finalization stops if any competitor in a saved entry lacks a reviewed
placement. A `9999` no-valid-placing result continues to score zero and counts
as one position after the published field for the average calculations.

The owner must compare the completed placement set with an official Pokémon
published result outside DraftCenter. The **Finalize results** action requires
that official URL and the exact phrase `FINALIZE 2026 VGC MASTERS`. It copies
the current provisional snapshot and placements into a new final snapshot,
records the approving owner and source, changes the event/public state to
final, clears any lock, and disables further imports.

Finalization does not relabel a PokeData snapshot as an official source in
place. Any post-final correction must be a new audited correction snapshot and
finalization record; never update or delete the existing final history.

## Validation

Focused tests cover the scoring boundaries and Your Champion multiplier, source schema,
country conversion, accent suggestions, homonyms, duplicate aliases and
targets, missing competitors, response size, conditional/duplicate delivery,
timeouts, non-200 responses, malformed/empty payloads, schema drift, overlap,
authorization, public status text, and static RLS/grant boundaries.

`supabase/tests/371-worlds-vgc-live-scoring-preview-regression.sql` is the
isolated database matrix. It verifies seven RLS tables, browser denials,
service/public function grants, disabled polling, atomic scores, hash
idempotency, overlap rejection, last-known-good preservation, owner
finalization, post-final import rejection, and exact fixture cleanup.

`supabase/tests/375-worlds-pick-ten-final-tiebreakers-preview-regression.sql`
adds a transactional final-ranking matrix. It verifies the finalization
coverage guard, provisional point-only ranks, both average-finish tiebreakers,
exact shared ranks, the no-valid-placing fallback, public projections, and the
unchanged result-table and function-grant boundary.

Before activation or a future importer change, use an isolated Preview branch,
run the database matrix, configure a permission-safe reviewed sample, exercise
repeated imports, and review desktop/mobile public and owner states. The release
matrix and full repository gates passed before migrations 371-373 reached
production. Source configuration and scheduler setup remain separate production
actions that require explicit authorization and verification.

The permission request and approval-record template is
[`worlds-vgc-results-feed-permission-request.md`](worlds-vgc-results-feed-permission-request.md).
