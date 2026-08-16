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
is cleared after a confirmed new email identity is created. A browser blocker
can prevent an event, so owner Operations shows attributed events beside the
authoritative aggregate Supabase Authentication creation counts.

Vercel receives two custom properties, matching the Pro-plan limit:

| Event | Property | Example |
| --- | --- | --- |
| `Signup Started` | `journey` | `team-lab>team-lab` |
| `Signup Started` | `source` | `discord:team-lab-launch` |
| `Account Created` | `journey` | `collector>team-lab` |
| `Account Created` | `source` | `reddit:collector-founding-beta` |

`Signup Started` is deduplicated within a browser tab. `Account Created` is
sent only when Supabase returns a real newly created identity; the
enumeration-safe existing-account response is not counted.

## Feature buckets

| Public path | Bucket |
| --- | --- |
| `/pokedex-tracker` | `collector` |
| `/tools/team-builder` | `team-lab` |
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

Use lowercase `utm_source`, `utm_medium=social` (or the real medium), and one
stable lowercase `utm_campaign` slug. Example:

```text
https://www.draftcentral.gg/tools/team-builder?utm_source=discord&utm_medium=social&utm_campaign=team-lab-launch
```

Recommended source slugs are `discord`, `reddit`, `x`, `instagram`, `youtube`,
`facebook`, `bluesky`, `email`, and `partner`. Untagged recognized referrers are
reduced to the same coarse channel; unknown external domains become
`referral`, not a stored hostname.

## Owner Operations

The owner-only acquisition panel shows:

- actual accounts created today, in seven days, and in 30 days;
- attributed account creations and signup starts in 30 days;
- top campaign sources; and
- top first-to-last feature journeys.

The report uses the authenticated, server-only Vercel Web Analytics API token
already used by Website Traffic. It fails softly without exposing the token or
interrupting the rest of Operations.

References: [Vercel custom events](https://vercel.com/docs/analytics/custom-events),
[Web Analytics API](https://vercel.com/changelog/web-analytics-api), and
[Web Analytics privacy](https://vercel.com/docs/analytics/privacy-policy).
