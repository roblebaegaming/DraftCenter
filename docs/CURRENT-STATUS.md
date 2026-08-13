# DraftCenter current status

- Last updated: August 13, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production application commit: `077f582cf006b414cc603dfbcf6bd53846416663`
- Latest production migration: 387

## Deployed state

The August 12 release wave shipped through pull requests
[#170](https://github.com/roblebaegaming/DraftCenter/pull/170),
[#171](https://github.com/roblebaegaming/DraftCenter/pull/171), and
[#172](https://github.com/roblebaegaming/DraftCenter/pull/172). Pokémon
Connections is restored across the signed-in home, Community, and Daily Games
hub; Operations now includes active-league Worlds and format insights plus
owner-only, aggregate Vercel website traffic; inaccurate Worlds event schema
was replaced with collection/page schema; and the private Calendar is now a
standalone global tool combining DraftCenter league dates, personal reminders,
and a maintained read-only schedule of major VGC events. Production migration
382 is applied with owner-only calendar policies.

Pull request [#174](https://github.com/roblebaegaming/DraftCenter/pull/174)
added revocable private calendar subscriptions. Signed-in users can create a
read-only URL for Google Calendar that automatically includes league dates,
personal reminders, and the maintained VGC schedule without granting
DraftCenter access to a Google account. Only a SHA-256 token hash is stored;
the link can be rotated or revoked. Production migration 383 is applied with
forced RLS and no client-role table access.

The August 13 follow-up wave shipped through pull requests
[#176](https://github.com/roblebaegaming/DraftCenter/pull/176) through
[#179](https://github.com/roblebaegaming/DraftCenter/pull/179). The public
Pokedex filter panel is readable and responsive; Daily Games sharing and
bracket-image exports are simplified and corrected; Italian Worlds predictions
are available at `/it/worlds/2026`; and commissioners can explicitly expand a
league from the 16-team default to 32 teams or use validated multi-pod play up
to 128 teams. Migration 384 enforces the same limits for snapshots, initial
setup, hosted snake drafts, and scheduled auctions while preserving RLS and
client-role denials.

Pull request [#181](https://github.com/roblebaegaming/DraftCenter/pull/181)
made tournament format and roster building independent choices. Commissioners
can run single elimination, double elimination, or Swiss; elimination events
may use brought teams or a shared draft, while Swiss currently requires the
shared draft. New Swiss events use three rounds for 4-8 managers and four for
9-16, then finish on standings without a top cut. Migration 385 preserves
historical Draft Tournaments as Swiss and reuses the existing elimination and
Swiss engines while retaining RLS and client-role write denials.

Pull request [#183](https://github.com/roblebaegaming/DraftCenter/pull/183)
added aggregate Pokemon Connections usage and a five-minute active-visitor
estimate to owner Operations. Connections reports signed-in players,
completions, account adoption, and a 30-day trend without names, puzzles,
guesses, or answers. Active now uses anonymized production Web Analytics and
excludes Operations and private workspace paths; it is a recent-visitor
estimate, not an exact connected-user count. Migration 386 exposes only the
service-role aggregate and preserves completion-table RLS and client denials.

Pull request [#185](https://github.com/roblebaegaming/DraftCenter/pull/185)
made the Worlds Home cards distinguish player Pick 10 from the separate
Pokemon team or deck prediction game before a visitor enters a discipline.
Each choice links directly to its page section and shows its current public
saved-entry count, while each card also shows the combined total. At production
verification, VGC showed 14 player entries and 13 team entries, TCG showed two
player entries and zero deck entries, and GO showed zero entries with its team
game explicitly marked not open. No database or migration changed.

Pull request [#187](https://github.com/roblebaegaming/DraftCenter/pull/187)
renamed the persistent global action to **DraftCenter Home**, uses the concise
**Home** label in the mobile/tablet header while retaining the full accessible
name, and exposes a selected/current-page state on the root route. The 44px
target and visible focus treatment remain intact. The release also advanced the
transitive `nanoid` override to patched version 3.3.18 after a new audit
advisory; no database, provider setting, environment variable, or secret
changed.

Pull request [#189](https://github.com/roblebaegaming/DraftCenter/pull/189)
turned the organization workspace into **League Operations** for large seasons.
Administrators can atomically create 2-32 independent divisions, coordinate a
different draft time for each division, and place managers from private draft-
availability notes while preserving each division commissioner's authority.
Migration 387 adds the private RLS-protected planning layer and authenticated
RPC workflow; direct browser table access remains denied. The isolated Preview
matrix, protected checks, exact Production deployment, live workspace review,
and signed-out production smoke sweep passed without changing a real league.

The August 9 release wave is complete. Pull requests
[#95](https://github.com/roblebaegaming/DraftCenter/pull/95) through
[#99](https://github.com/roblebaegaming/DraftCenter/pull/99) shipped, in order:

- standalone tournaments scaled to 512 single-elimination or 256
  double-elimination entrants;
- 16-player Draft Tournaments with registration, check-in, a hidden event
  draft, roster snapshots and locks, Swiss rounds, corrections, and an optional
  2/4/8-player top cut;
- Pokémon Connections and the four-game Daily Games experience, including
  completion-gated discussions and updated badges;
- private Nuzlocke Run Card saves in My Teams, profile-linked encounter
  artwork, and branded PNG exports; and
- a persistent, accessible Draft Home action in the global sticky header.

The evidence-led product-alignment SEO release also shipped through pull
request [#101](https://github.com/roblebaegaming/DraftCenter/pull/101). The
public tournament landing now covers single elimination, double elimination,
Draft Tournaments, and connected championships with current metadata,
structured data, server-readable guidance, and internal links. Daily Games FAQ
content and structured data now cover completion-gated discussions, and the
sitemap and `llms.txt` reflect the current public products. Tournament and
organization detail workspaces, My Teams, and saved Nuzlocke Run Cards remain
non-indexed and outside the sitemap.

The consolidated discovery, pricing, and pod-access release shipped through
pull request [#103](https://github.com/roblebaegaming/DraftCenter/pull/103).
The public Pokédex now has combinable color, Egg Group, and shape filters plus
42 canonical category routes. Draft commissioners can opt into sourced,
versioned pricing boards with explicit BST estimates and provenance, while
existing leagues retain their stored pricing. Managers may visit sibling pods
to follow activity, use the League Board, and predict without receiving team,
transaction, claim, trade, draft, or direct-message authority; spectators
remain limited to standings, predictions, the official draft board, and
playoffs.

The crawl-integrity follow-up shipped through pull request
[#106](https://github.com/roblebaegaming/DraftCenter/pull/106). It repairs the
live Paldean Tauros 404 and redirecting tournament links, gives ambiguous
Meowstic and Zygarde forms unique public metadata, replaces invalid Nuzlocke
software rich-result markup with accurate page/article data, shortens the
flagged titles, and server-renders direct links to eligible public leagues.
The GitHub security-email finding was also confirmed as an already-remediated
false positive involving public catalog provenance hashes; the regression
fixture now covers the exact allowlist paths.

The league-save reconciliation release shipped through pull request
[#108](https://github.com/roblebaegaming/DraftCenter/pull/108). Manual
commissioner checkpoints now advance the snapshot revision instead of falsely
resubmitting an already-saved revision. Stale conflicts refresh and safely
reapply the functional edit with bounded retries, genuine failures receive a
four-second neutral verification grace period, and background polling can no
longer overwrite unsaved work or relabel a real failure as success. The
database stale-session guard remains unchanged.

The conversation release confirmation shipped through pull request
[#110](https://github.com/roblebaegaming/DraftCenter/pull/110). The Semrush
crawl-remediation release then shipped through pull request
[#111](https://github.com/roblebaegaming/DraftCenter/pull/111). It repairs the
reproduced broken and redirecting internal targets, reduces Nuzlocke guide HTML
by loading full area encounters on demand, removes internal `nofollow` query
links, and strengthens thin or weakly linked public templates without adding
filler for the low text-to-HTML heuristic.

The privacy-safe League Pulse shipped through pull request
[#112](https://github.com/roblebaegaming/DraftCenter/pull/112). Owner
Operations now shows aggregate results, completed transactions, meaningful
activity age, season state, open support requests, and recent unexpected
system failures for post-draft leagues. It does not expose teams, Pokemon,
matchups, scores, managers, messages, request text, error text, or transaction
contents.

The scheduled full-history scan repair shipped through pull request
[#113](https://github.com/roblebaegaming/DraftCenter/pull/113). It narrowly
covers reviewed public catalog identifiers under seven obsolete migration paths
and four exact historical prose fingerprints. It does not change application
behavior, production data, provider settings, or secrets.

The SEO and AI answer-resource release shipped through pull request
[#114](https://github.com/roblebaegaming/DraftCenter/pull/114). Five focused
guides now cover ADP, transactions and free agency, standings/tiebreakers and
playoffs, Pokemon form/stat/data comparison, and dedicated league management
versus spreadsheets. They include direct answers, truthful guide dates,
internal links, guide-collection structured data, sitemap freshness, and
`llms.txt` coverage. Search Console accepted the refreshed sitemap and all five
new URLs into its priority crawl queue.

Migrations 361-368 are applied to the exact core production project. The
previous multi-pod organization, qualification, and connected championship
release remains live through migrations 350-360 and production record pull
request [#94](https://github.com/roblebaegaming/DraftCenter/pull/94).

The 2026 VGC Worlds Pick 16 release shipped through pull request
[#116](https://github.com/roblebaegaming/DraftCenter/pull/116). The public
competition contains only the VGC Masters invite-earned list: 438 competitors
in the August 10 snapshot. A signed-in member chooses 16 competitors and one
Ace Pick whose placement score counts twice. The winner is worth 30 points,
entries lock at midnight Pacific on August 28, and other users' selections stay
private until the lock. The sitewide leaderboard is live with zero initial
entries. The bracket challenge remains closed until official pairings exist.
Migrations 369-370 are applied to the exact core production project.

The VGC roster-provenance clarification shipped through pull request
[#118](https://github.com/roblebaegaming/DraftCenter/pull/118). The qualified-
player section now names Victory Road's 2026 invite tracker, links directly to
it, explains that the tracker combines Championship Point standings and
qualifying event results, and repeats that an invite-earned list is not
confirmed attendance or registration. The source-check date is not presented
as player-facing roster copy.

The Worlds navigation and account-gate refinement shipped through pull request
[#121](https://github.com/roblebaegaming/DraftCenter/pull/121). The global
feature link is now named **Worlds Predictions** and lives in the sticky top
header instead of the bottom tools bar. Signed-out visitors may browse the
Masters roster, scoring, sources, and leaderboard, but the prediction builder and
all competitor-selection controls remain locked behind a DraftCenter account.

The competitor-search clarification shipped through pull request
[#123](https://github.com/roblebaegaming/DraftCenter/pull/123). Its placeholder
now uses the complete names of the two latest VGC Masters World Champions,
Giovanni Cischke and Luca Ceribelli, followed by Wolfe Glick. It no longer
mixes a partial player name, country code, and qualification path.

The final Worlds Predictions hub shipped through pull request
[#125](https://github.com/roblebaegaming/DraftCenter/pull/125) as production
application commit `1ef57ebd4cda6a49eb1a68dfcf94be47a1da0f31`. The public
hub now separates VGC, TCG, Pokémon GO, and Pokémon UNITE, with discipline
leaderboards and a normalized overall leaderboard that opens after two games
score. VGC lives at `/worlds/2026/vgc`. At that release, TCG remained a
`noindex` source audit; pull requests #160 and #161 later opened reviewed TCG
and GO Pick 10 competitions. The release also names the
Moscone Center and Chase Center venue split and adds full Worlds search
metadata, structured data, sitemap freshness, and `llms.txt` coverage.

The Worlds live-scoring and prediction-infrastructure release shipped through
pull request [#128](https://github.com/roblebaegaming/DraftCenter/pull/128) as
production application commit
`e5dca23b9da09d3a557e485443e7dc5a207b4e20`. VGC now uses **Pick 10** with
**Your Champion** worth double placement points and a maximum raw score of 140.
Migration 371 adds the fail-closed provisional-results importer, migration 372
adds the configurable Top Cut challenge, and migration 373 performs the guarded
Pick 10 change. Production had zero VGC entries immediately before and after
the change. The importer is disabled with no feed URL or scheduler, and the Top
Cut challenge is empty and waiting for an official reviewed field. At that
release, the public GO and UNITE source-audit routes were live with no names,
saving, or polling;
TCG and GO use Pick 10 plus Your Champion as their post-roster-audit contract,
while UNITE remains team-bracket based.

The Worlds event-day operations follow-up shipped through pull request
[#130](https://github.com/roblebaegaming/DraftCenter/pull/130) as production
application commit `eb951de33bd4ace0463cb9ea57fab9a0e460b188`. After an
official field size is known, owner Operations can download a blank or partially
completed Top Cut setup JSON, review it offline, and load it back without
publishing. The stable guides now reflect the deployed state and include the
announcement checklist plus a ready-to-send results-feed permission request.
The request has not been sent, the importer remains disabled, and no database,
provider, field, entry, or scheduler changed in the follow-up.

The TCG, GO, and UNITE staged-infrastructure release shipped through pull request
[#132](https://github.com/roblebaegaming/DraftCenter/pull/132). It adds
owner-only local setup-file preparation for all three games and reusable Pick
10/Your Champion screens for reviewed TCG and GO rosters. Migration 374 is
applied to the exact core production project: at that checkpoint, TCG Masters
and GO were `draft`,
Pick 10, individual events with zero competitors and zero entries; their result
sources are disabled with no feed URL or external event identifier; VGC still
has zero entries; browser table reads remain denied; and the privacy-safe
overall leaderboard is closed. UNITE remains an offline team/group/bracket
preparation contract with no database event. The isolated migration rehearsal
and 371-374 database matrices passed, and both exact disposable Preview branches
were permanently deleted.

The reusable VGC, TCG, and GO Pick 10 screen includes a compact **Share your
picks** panel once a lineup and Your Champion are complete. It has one honest
**Download** action for the 1080 by 1350 PNG. Browsers cannot reliably attach a
generated file directly to an Instagram or Twitter web composer, so the panel
does not claim to share to those services. Downloading never saves or changes
an entry and clearly states that the image is public.

The one-action sharing interface shipped through pull request
[#144](https://github.com/roblebaegaming/DraftCenter/pull/144) as production
application commit `c944308742cfff250fd910c8331d71ff0f8e2208`. It replaces
the prior download, app, and X/Twitter button stack without changing entries,
rosters, scoring, or database state. Pull request #152 later restored concise
platform choices after the owner clarified that the problem was the cluttered
layout and writing, not the platforms themselves.

The corrected compact platform-sharing release shipped through pull request
[#152](https://github.com/roblebaegaming/DraftCenter/pull/152) as production
application commit `36614e727b81201c479622bc5c4a03d05b744baa`.
It keeps the simple **Share your picks** heading and uses only **Download**,
**Instagram**, and **Twitter** buttons. Browsers with native file sharing can
send the generated PNG through the device share sheet; other browsers download
the PNG and open the selected platform. No prediction entry or database state
changes when a member shares. Pull request #158 later replaced those unreliable
platform actions with one Download button.

The scoring-card copy cleanup shipped through pull request
[#146](https://github.com/roblebaegaming/DraftCenter/pull/146) as production
application commit `c72e76f5905526116fe4874f691f7e54043d9e17`. It removes
the redundant scoring tagline while preserving the explanation and point table.

The unfinished Pick 10 preservation release shipped through pull request
[#148](https://github.com/roblebaegaming/DraftCenter/pull/148) as production
application commit `dd36c7152e4b87e63c92be0a4ec4efac16ea457b`.
The two-minute event and leaderboard refresh no longer replaces a member's
dirty local selections with the last saved entry. A saved entry is reloaded
after a successful save or an actual account change. Save remains disabled
until all 10 choices and Your Champion are selected, and the authenticated
database function independently rejects incomplete entries.

The unavailable-competition copy cleanup shipped through pull request
[#150](https://github.com/roblebaegaming/DraftCenter/pull/150) as production
application commit `472752bec6214aeb5fd85db12f36ed4ac59ce4ec`.
At that release, TCG, Pokémon GO, and Pokémon UNITE used the same plain **Not
Live** status in the Worlds navigation, competition cards, and unavailable
leaderboard states. TCG and GO now use **Picks open**; UNITE remains **Not
Live**.

Forward-only migration 375 is applied in production. It makes final Pick 10
ties use the lower average finish of the six best-finishing picks, then the
lower average finish of all 10. Provisional ranks remain points-only; exact
final ties share a rank. Finalization fails closed if any saved selection lacks
a reviewed placement, and no-valid-placing results count as one position after
the published field for the two averages. The matching interface and server
release shipped through protected pull request
[#136](https://github.com/roblebaegaming/DraftCenter/pull/136).

The isolated migration-375 rehearsal applied the same minimal Worlds baseline
used by the prior release, then passed the new final-ranking matrix and the
current live-scoring, Top Cut, Pick 10, and future-event compatibility matrices.
Its read-only postflight confirmed all three individual events carry the new
rules, zero fixture entries remained, placement-table RLS stayed enabled, and
the public/service function grants were unchanged. The exact disposable
Preview branch was permanently deleted after verification.

The production migration-375 postflight confirmed the same three Pick 10
events and tiebreaker keys, zero entries, disabled and unconfigured result
sources, public hub access, and service-only finalization. No entry, score,
roster, bracket, result snapshot, or provider setting changed during release.

The Worlds navigation copy follow-up shipped through pull request
[#141](https://github.com/roblebaegaming/DraftCenter/pull/141). The competition
navigation introduced **Worlds Home** and **Picks open** and replaced its
original internal build terminology with direct calls to action. Pull request
#150 later simplified all three unavailable competition statuses to
**Not Live**.

The bracket-waiting copy cleanup shipped through pull request
[#154](https://github.com/roblebaegaming/DraftCenter/pull/154) as production
application commit `899e854036c0337efba397ce8af3ebd04cf250c9`. The public
VGC Top Cut waiting screen now keeps only its headline, short explanation, and
official competitor-information link. The four numbered backend-process cards
are removed.

The Pick 10 sharing-instruction cleanup shipped through pull request
[#156](https://github.com/roblebaegaming/DraftCenter/pull/156) as production
application commit `2b4e5bdf11df8b2f11f3a228a89de45a00d86001`.
The incomplete state now says **Choose your top 10, then choose your champion.**
The reusable wording also applies to TCG and GO when those events open.

The download-only sharing correction shipped through pull request
[#158](https://github.com/roblebaegaming/DraftCenter/pull/158) as production
application commit `b5cecc84d7dcbacf4fe6a78af1c9f8ed4dffe7f1`.
The panel now exposes only **Download** and removes the Instagram, Twitter,
native-share, and popup paths that could not guarantee an attached image.

The published TCG Masters reconciliation shipped through pull request
[#142](https://github.com/roblebaegaming/DraftCenter/pull/142) as production
application commit `4f781e9c081a3771499baab490bf2c28f355e407`.
DraftCenter captured all 425 official Championship Point cutoff rows and
reconciled 45 unique direct-invite earners. Thirty-three direct earners are
already in the cutoff rows and 12 are additional, producing a deduplicated
437-player working field before Japan, South Korea, mainland China, and
Asia-Pacific. TCG voting remained closed at that checkpoint. No database
migration, production roster, entry, provider, environment, or scheduler
changed in that release.

The official Qualified Competitors page then supplied a single cross-region
Masters invitation list. Pull request
[#160](https://github.com/roblebaegaming/DraftCenter/pull/160) shipped as
production application commit
`c0191099d335d3eac5fa799d426a88143296def2`. Migration 376 replaced the empty
staged TCG event with 880 unique Masters competitors from 882 source rows,
excluded two duplicate identities, and opened Pick 10 plus Your Champion. The
public TCG route is indexable and entries stay editable until the published
lock. The page describes the roster precisely as invitation-earned, not as
confirmed registration or attendance. Production had zero TCG entries at
activation. Its result source remains disabled and has no feed URL or external
event identifier.

Pull request [#161](https://github.com/roblebaegaming/DraftCenter/pull/161)
shipped the comparable Pokémon GO activation as production application commit
`5b07d274e31d914d7095005d78af878025422851`. Migration 377 published 369 unique
Trainers from 370 official source rows after excluding one duplicate identity,
then opened Pick 10 plus Your Champion. The public GO route is indexable and
states that the source is an invitation-earned list, not confirmed attendance,
registration, or pool assignments. Pool assignments are not required to score
the full-field placement game, so their absence does not prevent Pick 10 from
opening. Production had zero GO entries at activation. Its result source also
remains disabled and unconfigured.

The final Worlds public-copy follow-ups shipped through pull requests
[#163](https://github.com/roblebaegaming/DraftCenter/pull/163) and
[#164](https://github.com/roblebaegaming/DraftCenter/pull/164). VGC and TCG now
say **Masters Division only — Senior and Junior Division qualifiers are
excluded.** The combined leaderboard now says only **The combined table appears
when at least two games have official scored results.** Vercel reports exact
`main` commit `29bd86d` Ready in Production, and the post-deployment smoke
sweep passed all 19 public and protected routes.

The separate Worlds Meta Picks competition shipped through pull request
[#166](https://github.com/roblebaegaming/DraftCenter/pull/166) as production
application commit `bdc8349822e16fadff02dd73b48030c13dbddae5`. VGC Meta
Picks are open: members rank six Pokémon from the reviewed 235-option official
Regulation M-B pool, with 24 explicitly unofficial community-trend signals.
Pull request [#168](https://github.com/roblebaegaming/DraftCenter/pull/168)
then opened TCG Meta Picks with a reviewed 49-archetype taxonomy, 12 trend
signals, five deck choices, and one Champion Deck. The official 2026 Worlds
competitor packet confirms Standard Format with regulation marks H and onward;
forward-only migration 381 records that source and is already applied. GO
remains `draft` until its official eligibility pool can be reviewed; do not
seed placeholder options. Meta
Picks have separate discipline and overall leaderboards
from player Pick 10; the Meta overall requires two finalized disciplines.
Migrations 378-381 are applied to production. Results automation remains
disabled, and finalization is service-only from an owner-reviewed official
source.

Pokémon UNITE remains **Not Live** and has no production database event. The
same official page currently exposes 185 player rows with team labels. A
case-and-whitespace-normalized audit resolves them to 31 unique teams: 30
six-player rosters and one five-player roster, with no blank team labels or
duplicate player rows within a team. This is still an invitation-earned source,
not proof of final registration or attendance, and it does not publish group
assignments, advancement details, or playoff pairings. The safe product remains
team-based rather than 185 individual-player picks.

## Release verification

- Pull request #187 passed the protected secret scan, security/audit, CodeQL,
  Vercel, and review checks. Vercel reports exact merged commit `5005663` Ready
  in Production. Focused navigation/help/release tests passed 17/17, the
  dependency audit is clean, the 1,027-row National Dex verification and
  242-page optimized build passed, and live desktop accessibility/visual review
  confirmed the current-page treatment. The post-deployment signed-out
  19-route smoke sweep passed. The complete suite reached only the unchanged
  current-main migration-379 snapshot mismatch after all preceding suites.
- Pull request #183 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `7a0c1a6` Ready in Production. The
  isolated Preview passed all five migration assertions with no retained
  fixtures. Production migration 386 returned success; postflight confirmed a
  30-day aggregate, service-only execution, denied client roles, completion
  RLS, and intact migration 385. The signed-in live dashboard passed desktop
  and 390px review without browser warnings or horizontal overflow, and the
  signed-out 19-route production smoke sweep passes. Focused Operations tests
  passed 27/27, release integration passed 5/5, the 1,027-row National Dex
  check and 242-route build passed, and the complete suite stopped only at the
  unchanged current-main migration-379 snapshot mismatch after Calendar.
- Pull request #181 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `72d7988` Ready in Production. Migration
  385 returned success on the verified production project; postflight confirmed
  the format and draft-first routes, existing tournament engines, triggers,
  RLS, grants, and migration 384. The isolated Preview passed the seven-part
  migration matrix and all 12 backward-compatibility assertions without
  retained fixtures. The live selector behavior and signed-out 19-route
  production smoke sweep pass.
- Pull requests #176-#179 passed their protected checks and hosted Previews.
  Vercel reports exact merged commit `727f1ed` Ready in Production. Migration
  384 returned success on the verified production project; postflight confirmed
  the 16/32/128 limits, snapshot trigger, RLS, hosted snake/setup/auction guards,
  expanded pick cap, and intended function privileges. Its exact disposable
  Preview branch was deleted after the rollback-only regression matrix passed.
  The signed-out 19-route production smoke sweep passes.
- Pull request #174 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `813b3b6` Ready in Production. Migration
  383 returned success on the verified production project; its postflight
  confirmed forced RLS, denied anon/authenticated reads, service-only CRUD,
  zero client policies, and zero pre-launch tokens. The live private feed
  returns a valid non-indexed 31-event iCalendar response, Google Calendar is
  privately subscribed, unknown tokens fail with 404, and the 19-route
  production smoke sweep passes.
- The complete application tests, National Dex verification across 1,027
  rows, production dependency audit, and production builds passed for the
  applicable releases.
- The destructive tournament, Draft Tournament, Daily Games, and Nuzlocke
  database matrices passed only in the isolated Supabase Preview environment.
- Protected pull-request security, dependency, secret-scan, CodeQL, and Vercel
  checks passed for the release pull requests.
- Pull request #142 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, dependency audit,
  and production build passed locally. Vercel reports exact `main` commit
  `4f781e9` Ready in Production, the signed-out smoke sweep passed all 19
  public and protected routes, and the live TCG page exposes the reviewed
  425 / 45 / 437 reconciliation while keeping voting closed.
- Pull request #148 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, focused Worlds
  regression suite, dependency audit, and production build passed locally.
  Vercel reports exact application commit `dd36c71` Ready in Production, and
  the signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #150 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `472752b` Ready in Production. The live Worlds Home
  returned only **Not Live** for unavailable status labels, and the signed-out
  smoke sweep passed all 19 public and protected routes.
- Pull request #152 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `36614e7` Ready in Production. The deployed client
  bundle contains the compact heading, Instagram destination, Twitter intent,
  and public-sharing warning, and the signed-out smoke sweep passed all 19
  public and protected routes.
- Pull request #154 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `899e854` Ready in Production. The live VGC bracket
  page contains the retained headline and official competitor-information link
  with none of the four removed workflow descriptions, and the signed-out
  smoke sweep passed all 19 public and protected routes.
- Pull request #156 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `2b4e5bd` Ready in Production. Its live client
  bundle contains the new Pick 10 instruction and not the old wording, and the
  signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #158 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `b5cecc8` Ready in Production. Its live client
  bundle contains the Download panel with no Instagram or Twitter action, and
  the signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #160 passed all six protected checks, the focused Worlds and SEO
  tests, the complete application suite, the 1,027-row National Dex check,
  dependency audit, optimized build, isolated migration-376 regression, and
  exact Preview review. Production postflight confirmed TCG open with 880
  unique competitors, zero initial entries, official provenance, denied direct
  table reads, intact RPC grants, and disabled/unconfigured results polling.
- Pull request #161 passed all six protected checks, the 50-test Worlds suite,
  SEO tests, complete application suite, 1,027-row National Dex check,
  dependency audit, optimized 236-page build, isolated migration-377
  regression, and exact Preview review. Vercel reports exact `main` commit
  `5b07d27` Ready in Production. Production postflight confirmed GO open with
  369 unique Trainers and zero initial entries while TCG remained open with
  880. Both result sources are disabled and unconfigured. The sitemap contains
  both public routes, and the signed-out production smoke sweep passed all 19
  public and protected routes.
- Pull request #166 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, 61-test Worlds suite, source-integrity
  checks, optimized production build, CodeQL, protected checks, and Vercel
  Preview. Migrations 378-380 and their regression matrices passed on an exact
  disposable Supabase Preview branch, which was deleted after verification.
  Vercel reports exact `main` commit `bdc8349` Ready in Production. Read-only
  production postflight confirmed VGC `open` with 235 reviewed options and 24
  trend signals, TCG `draft` with 49 options and 12 signals, GO `draft` with
  zero options, and zero Meta entries. Live signed-out checks confirmed the VGC
  lock, both fail-closed gates, and separate competition wording. The final
  production smoke sweep passed all 19 public and protected routes.
- Signed-in Preview walkthroughs covered the new database-backed workflows.
- The SEO release passed all protected security, dependency, secret-scan,
  CodeQL, and Vercel checks. Its exact Preview passed desktop and 390px mobile
  review without browser errors or horizontal overflow.
- Pull request #103 passed protected security, dependency, full-history secret
  scan, CodeQL, and Vercel checks. Its exact Preview and production deployment
  passed desktop and 390px mobile Pokédex review without browser errors or
  horizontal overflow. The retained Supabase Preview observer-access matrix
  passed every RLS, grant, allow, denial, full-staff, and cleanup assertion.
- Vercel reports exact application commit `b5cecc8` Ready in Production on the public
  production domains.
- The signed-out production smoke sweep passes, including protected 401
  boundaries. Focused live checks also pass for tournament metadata and JSON-LD,
  Daily Games FAQ structured data, sitemap modification dates, `llms.txt`, and
  private-route `noindex` behavior. The new color, Egg Group, and shape category
  routes also return their expected canonical metadata and structured data,
  combine correctly in the directory, and appear in the production sitemap.
- Pull request #106 passed all protected checks. Its exact Preview and live
  production pages passed focused canonical, title, JSON-LD, redirect,
  `nofollow`, and direct-link checks. The signed-out production smoke sweep
  passed after deployment, including every protected 401 boundary.
- Pull request #108 passed all protected checks, its exact Vercel Preview was
  Ready, and the post-deployment signed-out smoke sweep passed every public
  route and protected 401 boundary. Focused tests cover manual checkpoints,
  two bounded conflict recoveries, non-replay of timeouts, delayed failure,
  polling ownership, and retained Retry Save behavior.
- Pull request #111 passed all protected checks, its production build, and a
  signed-out built-output crawl covering 1,537 sitemap URLs with zero broken
  pages or targets, redirects, oversized documents, H1 defects, internal
  `nofollow` links, sub-200-word pages, orphans, one-link pages, or URLs over
  three clicks deep.
- Pull request #112 passed all protected checks, the complete application
  suite, the 1,027-row National Dex verification, the production build, and
  the post-deployment smoke sweep across all 19 public and protected routes.
- Pull request #113 passed its authoritative full-history scan and every
  protected check. Pinned Gitleaks 8.30.1 scanned 852 commits and approximately
  691.80 MB with no leaks.
- Pull request #114 passed the complete application suite, 1,027-row National
  Dex verification, dependency audit, 227-page build, protected checks, exact
  Preview review, and the post-deployment 19-route smoke sweep. All five live
  guides return 200 with one H1, the expected canonical, and their direct answer;
  the guide directory, sitemap, and `llms.txt` contain the complete set.
- Pull request #116 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, protected security and
  deployment checks, and post-deployment 19-route smoke sweep. Its isolated
  Preview matrix passed roster, RLS, grants, privacy, duplicate-entry, lock,
  validation, Ace-scoring, and fixture-cleanup assertions. The connected hosted
  Preview and production route passed desktop and 390px mobile review with all
  438 competitors, no browser warnings or errors, and no horizontal overflow.
- Pull request #118 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, and every protected
  check. Its exact Preview and production source panel passed desktop and
  390px review with the intended Victory Road link and no horizontal overflow;
  the post-deployment signed-out smoke sweep passed all 19 routes.
- Pull request #121 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized production build, and all six
  protected checks. Its exact Preview and production route passed signed-out
  desktop and 390px review with Worlds Predictions in the top header, five
  balanced bottom-tool slots, zero enabled pick buttons, all 438 roster cards,
  no browser errors, and no horizontal overflow. The post-deployment signed-out
  smoke sweep passed all 19 routes.
- Pull request #123 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized build, all six protected
  checks, and exact hosted desktop and 390px review. Production shows the three
  complete player names without horizontal overflow, and the post-deployment
  signed-out smoke sweep passed all 19 routes.
- Pull request #125 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized 230-page build, every protected
  check, and exact hosted desktop and 390px review without browser errors or
  horizontal overflow. Vercel reports exact `main` commit `1ef57eb` deployed.
  Live postflight confirmed the hub, VGC, and TCG routes; intended canonical,
  structured-data, sitemap, `llms.txt`, and TCG `noindex` behavior; and a clean
  signed-out 19-route production smoke sweep.
- Pull request #128 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 37-test Worlds suite, optimized
  236-page build, protected security/CodeQL/secret-scan checks, and Vercel
  Preview. Because automatic Supabase PR branches are disabled, the exact
  migrations and all three matrices were validated on a manually created
  disposable Preview branch. Every live-scoring, Top Cut, Pick 10, RLS, grant,
  privacy, locking, scoring, cleanup, and fail-closed assertion passed. The
  branch was deleted by its exact identifier after release. Desktop and 390px
  hosted review and the live signed-out route sweep passed with no browser
  errors; the post-deployment 19-route production smoke sweep also passed.
- Pull request #130 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 38-test Worlds suite, optimized
  236-page build, all six protected checks, and Vercel Preview. The hosted
  signed-out Operations gate remained closed and logged no browser errors. The
  exact `main` commit `eb951de` reached Ready in Production, and the
  post-deployment 19-route production smoke sweep passed.
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, roster, tournament, Daily Games discussion, saved
  team, provider setting, or production account was changed to test the
  releases.
- No Pokemon Connections completion row or player identity was created,
  changed, or exposed while verifying the Operations aggregates.
- Disposable Preview fixtures were removed by exact recorded identifiers.
- The disposable TCG and GO activation Preview branches were permanently
  deleted by exact project reference after their migration and privacy
  regressions passed.
- The Worlds production seed created the intended event and 438 public
  invite-earned competitors; it created no user entry or synthetic account.
- The guarded Pick 10 migration changed only the zero-entry VGC event contract.
  The result importer remains disabled without a feed URL, permission approval,
  or scheduler, and the Top Cut seed remains empty and unpublished.
- The disposable `worlds-live-scoring-pr-128` Preview branch and its fixtures
  were permanently deleted after production verification, stopping its compute
  billing.
- The release-wave Preview branch remains available for owner-approved
  cleanup. The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The original DraftCenter workspace's pre-existing changes remain unstaged
  and untouched.
- No production provider configuration, environment variable, or secret was
  changed.
- The PokeData permission request is a repository draft only. It has not been
  sent and does not authorize polling or manual feed use.
- The Meta Picks production seed created only the three intended event records
  and reviewed VGC/TCG options. It created no user, entry, score, or synthetic
  result. The exact Meta Picks Preview branch was deleted after its migration
  matrices passed; the retained `multi-pod-pr-82` branch was not changed.

## Remaining work

Continue normal monitoring of the tournament, Daily Games, Nuzlocke,
navigation, pricing, pod-observer, League Pulse, metadata, indexing, and
commissioner-save paths. Treat historical Operations events by timestamp and
current authoritative state before declaring a recurrence.

Refresh any Worlds invite-earned snapshot only after reviewing current source
changes, and publish every post-386 database change as a new forward-only
migration. Do not describe invite-earned competitors as confirmed attendees.
Keep UNITE team predictions closed until the official team field is reconciled
and its group assignments, advancement rules, and playoff pairings are
published. Model UNITE predictions by team, not by individual player.
Keep the Worlds bracket challenge closed until official pairings exist.

Keep VGC and TCG Meta Picks open through their published locks and preserve
private pre-lock selections plus the separate player Pick 10 competitions.
Migration 381 is already applied and must not be replayed. Keep GO Meta Picks
closed until an official eligibility pool is reviewed and seeded; do not fill
that gate with placeholder guesses. Finalize Meta results only from an
owner-reviewed official source, with no automated result writer.

Do not enable the live importer until the exact structured Masters results feed,
permission, attribution, and event identifier are reviewed. Scheduler creation
is a separate production-provider action; keep polling off until that action is
explicitly authorized. Preserve the last-known-good snapshot and require the
owner-reviewed official source before final scoring.

Repeat the comparable Semrush crawl after production cache replacement with a
5,000-page ceiling. It may stop below that ceiling when it exhausts the
discoverable canonical inventory; compare issue URL exports rather than only
aggregate counts. Use roughly August 23 for the early Search Console read and
September 6 for the normal 28-day content/indexing decision. Redirect,
alternate-canonical, and intentional `noindex` examples should not be treated
as defects merely because Search Console excludes them.

The five new guide URLs are already in Google's priority crawl queue. Do not
submit them repeatedly. Semrush Prompt Tracking remains unavailable under the
current account access; do not buy an upgrade or override the multiple-session
guard merely to remove that measurement gap.

## Authoritative records

- Current continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-13-global-release-final.md`](handoffs/DraftCenter-agent-handoff-2026-08-13-global-release-final.md)
- Preceding Worlds public-launch handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-11-worlds-public-launch-final.md`](handoffs/DraftCenter-agent-handoff-2026-08-11-worlds-public-launch-final.md)
- Historical Worlds Pick 16 operating record:
  [`docs/worlds-2026-pick-sixteen.md`](worlds-2026-pick-sixteen.md)
- Worlds live-scoring operating record:
  [`docs/worlds-vgc-live-scoring.md`](worlds-vgc-live-scoring.md)
- Worlds Top Cut operating record:
  [`docs/worlds-vgc-top-cut-bracket.md`](worlds-vgc-top-cut-bracket.md)
- Worlds Top Cut announcement checklist:
  [`docs/worlds-vgc-top-cut-announcement-checklist.md`](worlds-vgc-top-cut-announcement-checklist.md)
- Worlds results-feed permission request:
  [`docs/worlds-vgc-results-feed-permission-request.md`](worlds-vgc-results-feed-permission-request.md)
- GO and UNITE activation record:
  [`docs/worlds-2026-go-and-unite.md`](worlds-2026-go-and-unite.md)
- SEO and AI answer-resource release:
  [`docs/seo-ai-answer-resources-2026-08-10.md`](seo-ai-answer-resources-2026-08-10.md)
- League-save implementation detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md)
- Consolidated application release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md)
- External SEO measurement:
  [`docs/seo-measurement-2026-08-08.md`](seo-measurement-2026-08-08.md)
- Draft Tournament architecture and status:
  [`docs/draft-tournament-concept.md`](draft-tournament-concept.md)
- Multi-pod production detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md)
- Pokémon profile canonical policy:
  [`docs/pokemon-profile-canonical-policy.md`](pokemon-profile-canonical-policy.md)
- Public indexing policy:
  [`docs/public-indexing-policy.md`](public-indexing-policy.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified production record
and the current repository state take precedence.
