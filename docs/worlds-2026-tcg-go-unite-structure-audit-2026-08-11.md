# 2026 Worlds TCG, GO, and UNITE structure audit

> Historical checkpoint: the official Qualified Competitors page later
> published cross-region invitation-earned lists. TCG and Pokémon GO opened
> through migrations 376-377 and pull requests #160-161. See
> [`CURRENT-STATUS.md`](CURRENT-STATUS.md) and the
> [current handoff](handoffs/DraftCenter-agent-handoff-2026-08-11-worlds-tcg-go-live.md)
> for the verified live state. UNITE remains closed.

- Review date: August 11, 2026 (America/Los_Angeles)
- Scope: Pokémon TCG Masters, Pokémon GO, and Pokémon UNITE
- Outcome: tournament formats are now published; final registered rosters are
  not published
- Production action: none

## Decision

The newly published competitor pages are sufficient to update DraftCenter's
public format guidance, but not to activate TCG or GO Pick 10 or create the
UNITE team bracket. No activation migration, roster row, prediction entry,
result source, environment variable, scheduler, or provider setting should
change from this review.

All three routes remain fail-closed. A qualification list or empty bracket
shell is not a final registered field.

## Pokémon TCG Masters

### Reconciliation completed on August 11

DraftCenter has captured all **425** published Championship Point cutoff rows
from the five TPCi Masters leaderboards. A separate event-results review found
45 unique direct-invite earners: 33 already appear in those cutoff rows and 12
are additional competitors. The current deduplicated working field is therefore
**437** competitors before the separately managed programs are added.

The two reviewed snapshots are stored in:

- `src/data/worlds-2026-tcg-masters-cp.json`; and
- `src/data/worlds-2026-tcg-masters-direct-invites.json`.

The direct-invite results are corroborating public event records, not a claim
that every invite earner registered or will attend. The final activation roster
must come from an official complete Worlds roster or an owner-supplied official
registration export.

The official competitor page confirms:

- all divisions begin Friday, August 28, and conclude Sunday, August 30;
- Swiss rounds are determined by attendance and can span at most two days;
- Masters has no scheduled meal break; and
- the Standard format uses regulation mark H and onward.

The page does not publish the final registered Masters roster, the
attendance-dependent round count, or pairings. The TPCi cutoff and direct-invite
reconciliation is complete, but the following regional identity work remains:

- **Japan:** the official invitation paths are published, including event,
  Championship Series, and Championship Point awards, but the published player
  identifiers still require a final identity and duplicate reconciliation;
- **South Korea:** a final official invite or registration roster is required;
- **mainland China:** the official notice says qualified players were contacted
  through private mini-program messages and does not publish their names; and
- **Asia-Pacific:** final Leaderboard Point standings are exposed through each
  player's My Page, not as a public complete roster.

Because those identities are not available in a complete public official
source, opening voting now would knowingly omit valid competitors. TCG remains
closed until the complete roster is reviewable.

Official source:
<https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo>

Qualification and regional sources:

- <https://championships.pokemon.com/en-us/about/>
- <https://www.pokemon.com/us/play-pokemon/leaderboards/tcg-masters/>
- <https://www.pokemon-card.com/info/005256.html>
- <https://www.pokemon.cn/tcg/event/21473.html>
- <https://pacs.portal-pokemon.com/2025-26/sg/about/>

## Pokémon GO

The official competitor page confirms:

- Friday Pools Phase in double-elimination groups;
- Saturday Final Phase in double elimination until two Trainers remain;
- Sunday Grand Final;
- best-of-three matches by default; and
- best-of-five Winners Final, Losers Final, and Grand Final.

The competitor page links the Pokémon GO Championships Challonge organizer.
Its 2026 Worlds shell is configured as **32 groups advancing two Trainers each,
then double elimination**. At the August 11 review it contained zero players.
The shell therefore verifies the structure but does not supply a registered
roster, pool assignments, pairings, or exact match schedule.

Official and officially linked sources:

- <https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/012gocompetitorinfo>
- <https://pokemongochampionshipseries.challonge.com/2026_GO_WCS>

## Pokémon UNITE

The official competitor page confirms:

- five-on-five draft pick on Theia Sky Ruins with three bans;
- Friday single round-robin groups;
- Saturday single-elimination playoffs;
- Sunday Final;
- best-of-three matches by default; and
- best-of-five Top Four matches and Final.

It explicitly leaves the number of teams per group and the Group Stage match
length to an on-site announcement. The final registered teams, group
assignments, advancement count, elimination pairings, and prediction deadline
remain unpublished. The existing 15-award registry is a TPCi-managed subtotal,
not a complete global roster.

Official source:
<https://reg.rainfocus.com/flow/pokemon/26sanfrancisco/landing/page/014unitecompetitorinfo>

## Activation gate

When a final official roster or structure appears:

1. preserve the exact public source and retrieval time;
2. reconcile stable identities, qualification paths, aliases, withdrawals,
   replacements, and duplicates;
3. create a new forward-only migration after 375;
4. rehearse the affected roster, RLS, grants, privacy, scoring, and cleanup
   matrices in an isolated Supabase Preview;
5. review the exact hosted Preview at desktop and narrow mobile widths; and
6. release through a protected pull request, then confirm the deployed commit
   and run the signed-out production smoke sweep.
