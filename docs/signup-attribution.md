# Signup attribution

DraftCenter measures which public product and tagged campaign brought someone
to the account-creation flow without attaching analytics to an identity.
Measurement starts with the August 2026 signup-attribution release; historical
accounts cannot be assigned to a source retroactively.

## Privacy contract

The browser keeps one coarse attribution record for at most 30 days. It
contains only:

- the first public feature bucket;
- the last non-home public feature bucket; and
- a normalized campaign source.

The record never contains an email, user or account ID, username, IP address,
Pokémon, notes, a raw path, a full referrer URL, or a page-by-page history. It
keeps its original expiry after account creation so one later successful
Worlds save or league creation can be attributed to the same anonymous source.
A browser blocker can prevent an event, so owner Operations shows attributed
events beside the authoritative aggregate Supabase creation counts.

Vercel receives two custom properties, matching the Pro-plan limit:

| Event | Property | Example |
| --- | --- | --- |
| `Signup Started` | `journey` | `team-lab>team-lab` |
| `Signup Started` | `source` | `discord:team-lab-launch` |
| `Account Created` | `journey` | `collector>team-lab` |
| `Account Created` | `source` | `reddit:collector-founding-beta` |
| `Worlds Entry Saved` | `journey` | `worlds>worlds` |
| `Worlds Entry Saved` | `source` | `instagram-paid-social:worlds-2026:it-odds-1` |
| `League Created` | `journey` | `home>home` |
| `League Created` | `source` | `facebook-paid-social:draft-league:en-create-1` |

`Signup Started` is deduplicated within a browser tab. `Account Created` is
sent only when Supabase returns a real newly created identity; the
enumeration-safe existing-account response is not counted.
`Worlds Entry Saved` is sent only after a successful Pick, Meta, or Top Cut
save and is deduplicated per browser and competition. `League Created` is sent
only after the league and its visibility plan are successfully created and is
deduplicated per browser and league. Competition and league identifiers remain
local deduplication keys and are never included in analytics properties.

## Feature buckets

| Public path | Bucket |
| --- | --- |
| `/pokedex-tracker` | `collector` |
| `/team-lab` and legacy `/tools/team-builder` | `team-lab` |
| `/tools/mega-bracket` | `mega-bracket` |
| `/resources/daily-games` | `daily-games` |
| `/nuzlocke` | `nuzlocke` |
| `/tournaments` | `tournaments` |
| `/worlds/*` | `worlds` |
| `/pokemon/*` | `pokedex` |
| `/leagues` or `/explore` | `community` |
| guides, formats, manuals, and general resources | `resources` |
| `/` | `home` |
| any other path | `other` |

Returning to the home account panel does not erase the last meaningful public
feature, so a Team Lab visitor who chooses Sign in remains a Team Lab journey.

## Promotional-link convention

Every published placement uses all four lowercase fields:

- `utm_source`: platform or partner;
- `utm_medium`: `community`, `social`, `paid-social`, `paid-search`, `video`,
  `email`, or `referral`;
- `utm_campaign`: one stable product campaign; and
- `utm_content`: language, creative, and variant, such as `it-odds-1`.

Example:

```text
https://www.draftcentral.gg/it/worlds/2026?utm_source=instagram&utm_medium=paid-social&utm_campaign=worlds-2026&utm_content=it-odds-1
```

Recommended source slugs are `discord`, `reddit`, `x`, `instagram`, `youtube`,
`facebook`, `bluesky`, `email`, and `partner`. Untagged recognized referrers are
reduced to the same coarse channel; unknown external domains become
`referral`, not a stored hostname.

The account-creation event keeps the complete normalized placement in its
existing coarse `source` property—for example
`instagram-paid-social:worlds-2026:it-odds-1`. This preserves the two-property
privacy contract while distinguishing organic from paid traffic and one
language/creative placement from another. Never place a name, account, email,
league, team, opponent, Pokémon, note, or other personal detail in UTM fields.

The shared builder in `src/lib/campaignLinks.js` is the canonical source for
campaign destinations, allowed media, localized Worlds routes, and the
four-field link contract.

## Owner Operations

The owner-only acquisition panel shows:

- actual accounts created today, in seven days, and in 30 days;
- attributed account creations and signup starts in 30 days;
- attributed first Worlds saves and successful league creations in 30 days;
- top campaign sources; and
- top first-to-last feature journeys;
- campaign sources that reached a Worlds save; and
- campaign sources that reached league creation.

The report uses the authenticated, server-only Vercel Web Analytics API token
already used by Website Traffic. It fails softly without exposing the token or
interrupting the rest of Operations.

Custom-event summaries use Vercel's aggregate event endpoint, grouped by
`eventName`, with exact Pacific-time starts for today, the last 7 days, and the
last 30 days. Grouping the complete event set matches Vercel's dashboard data
model without depending on the separate count endpoint's bucket behavior.
This keeps Pacific-evening events in the current reporting window instead of
losing them at a UTC date boundary. Account-created source and journey
leaderboards and the downstream conversion source lists use Vercel's
structured `eventData/source` and `eventData/journey` dimensions. Aggregate
groupings use a bounded 20-row limit; Operations displays at most eight values.
When a conversion total is positive but its property grouping is empty,
Operations labels the breakdown temporarily unavailable instead of presenting
the absence as zero attribution. The Web Analytics API reads the Production
dataset for these project queries, so the report does not add an unsupported
environment filter.

References: [Vercel custom events](https://vercel.com/docs/analytics/custom-events),
[Web Analytics API](https://vercel.com/changelog/web-analytics-api), and
[Web Analytics privacy](https://vercel.com/docs/analytics/privacy-policy).
