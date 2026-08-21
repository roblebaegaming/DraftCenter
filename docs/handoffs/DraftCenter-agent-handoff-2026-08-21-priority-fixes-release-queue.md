# DraftCenter agent handoff — priority fixes and release queue

- Date: August 21, 2026 Pacific
- Production: <https://www.draftcentral.gg>
- Production branch: `main`
- Application release base: `58d10e85809c679f8cc09e042f4005a81cb780e3`
- Verified Production application behavior: `58d10e85809c679f8cc09e042f4005a81cb780e3`
- Latest applied Production migration: 454 (`20260820180704`)

## Executive outcome

The priority application train is complete. Pull requests
[#373](https://github.com/roblebaegaming/DraftCenter/pull/373),
[#377](https://github.com/roblebaegaming/DraftCenter/pull/377),
[#378](https://github.com/roblebaegaming/DraftCenter/pull/378), and
[#379](https://github.com/roblebaegaming/DraftCenter/pull/379) were reconciled
and deployed sequentially at exact Production commits `42a2952`, `3788c37`,
`a29cf75`, and `8fb410a`.

The releases provide the compact scrolling phone league header and exact
Battle Mode opponent handoff, multilingual Pokédex search and localized
resource filters, the redesigned homepage with a complete guest Daily-to-Mega
path, and team-first Worlds choices with VGC standings selected by default.
Applicable dependency audits, complete test suites, 1,027-row National Dex
checks, 344-page builds, protected checks, hosted Preview interactions,
exact-commit Vercel deployments, and complete 22-check signed-out Production
smoke sweeps passed. The owner explicitly accepted checking the remaining
signed-in phone impression against Production after returning. No application
release changed the database schema, Production data, provider settings,
billing, or spend.

This outcome supersedes the unreleased-candidate wording retained below as
pre-release evidence. Pull request #380 is merged and superseded #140 is
closed. Operations pull request #364 released at exact Production commit
`5f4cca87b8dcc6026a0bd3cf5b54528326770577`; it groups repeated incidents and
separates the two verified fixed August 19–20 incidents from current failures.
Pull request #381 released the official-name refresh at exact Production
commit `58d10e85809c679f8cc09e042f4005a81cb780e3`, completing Italian and
Spanish at 97/97 and raising German to 66/97. Korean remains 0/97 and German
has 31 unresolved profiles. AdSense pull request #374 remains a separate,
fail-closed owner decision.

DraftCenter's seven-language Pokédex and French Worlds translation beta are
live. The checked official Mega-name supplement is also live, but missing
first-party names remain explicit English fallbacks and the multilingual Mega
bracket remains blocked. The original dirty checkout has not been edited,
cleaned, reset, or pushed.

The owner's two urgent reports—phone league pages consuming too much vertical
space and Battle Mode dropping the selected opponent—were released through
pull request [#373](https://github.com/roblebaegaming/DraftCenter/pull/373) at
exact Production commit `42a2952`. The league has been shared with the outside
commissioner; invitations and real-league changes now wait for her approval.

Four additional August 21 candidates are open and green: multilingual Pokédex
search, the public homepage and guest Daily-to-Mega funnel, Worlds prediction
choice ordering/default VGC standings, and the Search Console/release-policy
documentation. They must be integrated one at a time from current `main`; an
individually green PR does not prove it remains conflict-free after an earlier
candidate merges.

## Live Production baseline

- Pull request [#371](https://github.com/roblebaegaming/DraftCenter/pull/371)
  released the seven-language Pokédex and French Worlds beta at application
  commit `aa82ecc`, with Production migration 454.
- Pull request [#372](https://github.com/roblebaegaming/DraftCenter/pull/372)
  published the final multilingual Production status at `bb32556`.
- Pull requests [#375](https://github.com/roblebaegaming/DraftCenter/pull/375)
  and [#376](https://github.com/roblebaegaming/DraftCenter/pull/376) released
  and recorded the official Mega-name source supplement. Production behavior
  remains `a37d59c`; `ce97e78` is the current documentation commit on `main`.
- The complete release evidence, exact localized coverage, and missing-name
  matrix are in the
  [official Mega localization handoff](DraftCenter-agent-handoff-2026-08-21-official-mega-localization-sources.md).
- No open August 21 feature PR below is deployed merely because its Vercel
  Preview and repository checks pass.

## Open release candidates

### Priority 0 — owner-reported mobile and Battle Mode risk

Pull request [#373](https://github.com/roblebaegaming/DraftCenter/pull/373),
**Fix mobile league scrolling and preserve Battle Mode opponent**, is clean,
mergeable, and green. Its behavior commit is `6c532eb`; the current PR head is
`fee4c75` after documentation refreshes.

It:

- lets the league-specific phone header scroll away;
- keeps league tabs and pods in bounded horizontal rows;
- replaces the phone commissioner preview-button cluster with one selector;
- saves and verifies the exact selected opponent before Battle Mode opens; and
- withholds the blank ladder shortcut while an official matchup is pending.

Required before merge:

1. At 390 × 844 in the hosted Preview, sign in and open a real league with both
   official matchup rosters available.
2. Confirm the header scrolls away and both **My Team** and **League** are easy
   to scroll up and down.
3. In a private planning copy, select six Pokémon on each side and choose
   **Save both teams & open Battle Mode**.
4. Confirm the Battle Room receives both exact teams, refresh once, and confirm
   the saved battle still contains both teams.
5. Do not change either official roster merely to obtain test evidence.

After an authorized merge, confirm the exact Vercel Production commit, run the
complete signed-out Production smoke sweep, and perform one read-only signed-in
phone confirmation. The detailed candidate record is in the PR's
`DraftCenter-agent-handoff-2026-08-20-mobile-league-battle-preservation.md`.

### Priority 1 — multilingual Pokédex interaction

Pull request [#377](https://github.com/roblebaegaming/DraftCenter/pull/377),
**Add multilingual Pokédex search and resource filters**, is clean,
mergeable, and green at head `3b7ee76`.

It adds seven-language search by localized or English name, Pokédex number, or
stable identifier; localized type, generation, and ability filters; localized
move search; and up to eight localized Pokédex entries with localized game
names. It retains the released Mega supplement, stable URLs, beta notices,
Support correction links, and explicit English fallback labels.

Its full suite, 1,027-row Dex check, deterministic localization rebuild,
344-page build, protected checks, and French/Japanese hosted interaction checks
pass. Before release, rebase it onto the Production mainline created by any
earlier merge, resolve shared CSS/status documentation deliberately, rerun its
checks, review Preview, then follow the exact-commit deployment and smoke flow.
Native review is not a beta release blocker under the owner's accepted policy,
but the beta disclosure must remain.

### Priority 1 — homepage conversion path

Pull request [#378](https://github.com/roblebaegaming/DraftCenter/pull/378),
**Redesign homepage and add guest Daily-to-Mega funnel**, is clean,
mergeable, and green at `2d4be0d`.

It replaces only the signed-out homepage with the approved discovery-first
design. Guests can complete the seven-choice Daily Draft Bracket locally, then
receive the “try the Mega Bracket” invitation. The Mega Bracket remains
account-gated, and the return path survives sign-in and email confirmation.
The implementation uses real bounded public data, omits unsupported format
claims, preserves the signed-in League Hub, and records privacy-safe funnel
events.

The full release suite, 1,027-row Dex check, 344-page build, desktop/phone
review, and complete guest Daily-to-Mega walkthrough pass. Rebase after earlier
shared CSS/AuthGate/package changes, rerun conversion/SEO coverage, and review
the hosted guest and signed-in entry paths before an authorized release. After
Production deployment, verify the guest bracket, account gate, return path,
and aggregate conversion events without inspecting individual user behavior.

### Priority 1 — Worlds prediction presentation

Pull request [#379](https://github.com/roblebaegaming/DraftCenter/pull/379),
**Prioritize Worlds team picks and VGC standings**, is clean, mergeable, and
green at `bfd9f36`.

It shows VGC Pokémon Team Picks, TCG Deck Picks, and GO Pokémon Team Picks
before their Player/Trainer Pick 10 choices. The shared VGC page uses the same
team-first order in English, Italian, Spanish, French, German, Japanese, and
Korean. The leaderboard opens on VGC while preserving Overall as a selectable
tab, with an explicit loading/unavailable state so first render cannot fail.

The full suite, 1,027-row Dex check, 344-page build, protected checks, and all
seven localized-route checks pass. Preview infrastructure does not expose the
live Production entry set, so the post-deployment read-only check must confirm
that VGC is selected and the real VGC entries appear rather than the fallback.

### Final documentation integration

Pull request [#380](https://github.com/roblebaegaming/DraftCenter/pull/380)
records the August 21 Search Console action and adds the durable release rule
for material public-URL, sitemap, canonical, and language-alternative changes.
This handoff is being added to the same documentation branch.

Rebase and refresh #380 after the application release decisions above. Before
merging it, replace any now-stale “open” status with exact merged/deployed
commits, update `docs/CURRENT-STATUS.md`, and keep this handoff as the canonical
continuation pointer.

## Search Console completed August 21

The live sitemap and `robots.txt` both returned HTTP 200. The sitemap contained
9,716 URLs, including localized Pokédex and Worlds routes, and remained below
Google's single-file limit. Search Console reported Last read August 20,
Status Success, and 9,716 discovered pages before the existing sitemap was
resubmitted once. It then confirmed successful submission and recorded
Submitted August 21.

Do not submit it again for the current UI-only PRs. Monitor Last read, Status,
and discovered pages. Use roughly August 23 for an early directional indexing
read and 14–28 days for a meaningful cohort decision. The exact evidence is in
[`docs/seo-search-console-sitemap-2026-08-21.md`](../seo-search-console-sitemap-2026-08-21.md).

## Deferred or decision-gated pull requests

### AdSense readiness — #374

Pull request [#374](https://github.com/roblebaegaming/DraftCenter/pull/374) is
green but behind `main`. It adds only inert ownership verification and an exact
conditional `ads.txt` response. It does not enable scripts, placements, Auto
ads, consent changes, billing, or spend.

Do not merge it by momentum. First decide whether AdSense verification is
still desired. If yes, rebase, revalidate the public identifier and seller
record without exposing private account data, release the inert verification,
and treat site-review submission, consent, ad activation, and placement as
separate owner-authorized actions.

### Operations incident grouping — #364 released

Pull request [#364](https://github.com/roblebaegaming/DraftCenter/pull/364) is
released at exact Production commit `5f4cca8`. Read-only Production history
confirmed the tournament-lock incident ended before PR #349's exact merge
time and the empty-league initialization incident ended before PR #361's exact
merge time, with no later recurrence. A later identical recurrence would still
appear as a current failure. The release changed no database or Production
data and passed the complete Production smoke sweep.

### Superseded Worlds handoff — #140 closed

Pull request [#140](https://github.com/roblebaegaming/DraftCenter/pull/140) is
closed without merge. It was conflicting and superseded by later released
Worlds handoffs and #380's canonical continuation.

## External and editorial work still required

1. **Native translation review.** Italian, Spanish, French, German, Japanese,
   and Korean remain pending until real fluent reviewers respond. Keep beta
   notices and correction links. The ready packet is
   [`docs/localization-fluent-speaker-review-2026-08-20.md`](../localization-fluent-speaker-review-2026-08-20.md).
2. **Multilingual Mega bracket.** Official coverage still lacks 31 German and
   97 Korean profile names. Do not infer prefixes or
   machine-translate them. Complete official-source coverage, localized
   interface copy, responsive/accessibility checks, and native review before
   claiming the bracket is multilingual.
3. **Four-pod invitations.** Obtain outside commissioner approval, then use the
   controlled second account, one or two known managers in different pods,
   and only then an approved wider group. Keep the organization private and do
   not fabricate scores, picks, or teams.
4. **Worlds live window.** Feed permission, exact provider configuration, a
   reviewed isolated Preview import, and separate Production configuration
   authorization remain external gates. Top Cut remains waiting for the
   complete official field and pairings. GO Meta Picks stays closed until an
   official eligibility pool is reviewed.
5. **Optional Tournament Operator rehearsal.** It requires explicit approval
   to create a new private practice tournament. Never reset or modify the
   preserved completed 32-manager showcase.
6. **Acquisition and spend.** Use the released four-field UTM standard for any
   approved link. Audience choice, campaign publication, billing, ad
   activation, and spend require separate explicit authorization.

The smallest owner-only decision queue remains in
[`docs/owner-action-queue-2026-08-21.md`](../owner-action-queue-2026-08-21.md).

## Recommended execution order

1. Wait for the outside commissioner response before any invitation or real-
   league change.
2. Continue native review and source the remaining 31 German and 97 Korean
   official Mega names without weakening fallback disclosure.
3. Decide explicitly whether to release #374's inert AdSense verification.
   Treat Production verification settings, site review, consent, ads, billing,
   and spend as separate owner-authorized actions.
4. Continue Worlds live-window work only through its external gates.

## Validation and release boundaries

For each application release, run the narrow focused tests while integrating,
then the repository-required dependency audit, complete suite, 1,027-row Dex
check, and production build. Review the exact hosted Preview before merge.
After deployment, confirm the exact Vercel commit and run the complete
signed-out Production smoke sweep. Production smoke is never proof of an
undeployed branch.

No open August 21 candidate requires a database migration. Migration 454
remains the Production tip. Supabase currently has only `main`; do not create a
paid disposable Preview unless an actual database change requires it and the
owner authorizes that exact branch.

Preserve the original dirty checkout and all user-owned changes. Do not push it
wholesale, hide it, reset it, or use it as an integration source. Continue from
fresh `origin/main` worktrees. Do not modify Mushroom Cup or the intentionally
paused Mushroom Hut drafts, and do not resume PokeEarth without a direct owner
request.

## Definition of done

The urgent application train is deployed: #373 and #377–#379 passed their
postflight checks, #380 records the final commits, #140 is closed, and the
outside commissioner now has the league link. Further invitation or real-
league work waits for her response.

The translation program is not “fully reviewed” until native reviewers approve
it, and the Mega bracket is not multilingual until its missing official names
and interface gates are complete. External invitation, provider, tournament,
advertising, billing, and spend actions remain outside code completion.
