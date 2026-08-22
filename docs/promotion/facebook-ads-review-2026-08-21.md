# Facebook and Instagram ads review

Date: August 21, 2026 Pacific

This is a read-only review of the signed-in Meta Ads Manager account and
DraftCenter's aggregate, anonymous Vercel Web Analytics. No campaign, budget,
billing, dataset, or provider setting was changed.

## What the current data says

For July 22 through August 20, the eight active campaigns spent $389.10 and
produced 3,112 landing-page views, or about $0.125 per landing-page view.

The two broad campaigns were the clear traffic winners:

| Creative | Spend | Landing-page views | Cost per landing-page view |
| --- | ---: | ---: | ---: |
| Complete DraftCenter website | $151.77 | 1,523 | $0.10 |
| Worlds winner prediction | $143.56 | 1,306 | $0.11 |

Together they used 76% of spend and produced 91% of landing-page views. The
other six campaigns averaged about $0.33 per landing-page view.

The account-creation event provides the stronger answer. In Vercel's last
seven-day Production view, DraftCenter recorded 80 anonymous `Account Created`
events from 77 visitors. Instagram-tagged sources accounted for 37 events
(46%), compared with search at 16, direct at 13, and Reddit at 11. This is
strong evidence that the Instagram advertising is contributing real accounts,
although it is aggregate first-touch evidence rather than Meta pixel
attribution and should not be treated as proof that every tagged account was
caused by an ad.

The source labels also show inconsistent historical tagging, including
`instagram:<numeric-id>`, `instagram-paid:<numeric-id>:<numeric-id>`, and the
newer readable `instagram-paid-social:worlds-2026-italy:<creative-id>` format.
All future placements should use the same four-field convention so campaign
comparisons remain readable.

## Recommended decision sequence

1. Keep the two broad traffic winners running at their present settings while
   the new conversion funnel gathers data.
2. Keep the Italian Worlds campaign; its $0.12 landing-page view is close to
   the broad winners and it already appears in account-source attribution.
3. Give the six-market Pick 10 campaign at least three complete days before a
   budget decision. Its current $0.33 landing-page view is early evidence, not
   enough for a reliable conversion decision.
4. Do not increase the tracker, favorite-Pokémon, or draft-league campaign
   budgets yet. Their current landing-page-view costs are $0.72, $0.48, and
   $0.53. Reassess after the application has collected at least three days of
   attributed Worlds saves and league creations; pause or redesign them if
   they still fail to produce downstream conversions.
5. Review the Pokémon Bank campaign separately. Its 3.59% link CTR shows the
   creative attracts attention, but its $0.36 landing-page view needs a clear
   product outcome before more spend.

## Standardized destinations

Use a separate `utm_content` value for each materially different language,
image/video, or message. Change `utm_source` to `facebook` for Facebook-only
placements.

| Purpose | Instagram destination |
| --- | --- |
| Complete DraftCenter website | `https://www.draftcentral.gg/?utm_source=instagram&utm_medium=paid-social&utm_campaign=run-a-complete-league&utm_content=en-complete-site-1` |
| English Worlds Pick 10 | `https://www.draftcentral.gg/worlds/2026/vgc?utm_source=instagram&utm_medium=paid-social&utm_campaign=worlds-2026&utm_content=en-player-picks-1` |
| Italian Worlds Pick 10 | `https://www.draftcentral.gg/it/worlds/2026?utm_source=instagram&utm_medium=paid-social&utm_campaign=worlds-2026&utm_content=it-player-picks-1` |
| Pokédex tracker | `https://www.draftcentral.gg/pokedex-tracker?utm_source=instagram&utm_medium=paid-social&utm_campaign=collector-founding-beta&utm_content=en-progress-1` |
| Favorite-Pokémon profile | `https://www.draftcentral.gg/pokemon?utm_source=instagram&utm_medium=paid-social&utm_campaign=pokemon-profile-research&utm_content=en-favorites-1` |
| Create a draft league | `https://www.draftcentral.gg/?utm_source=instagram&utm_medium=paid-social&utm_campaign=run-a-complete-league&utm_content=en-create-league-1` |

## Conversion foundation

DraftCenter uses Vercel Web Analytics rather than adding a Meta pixel. The
events remain anonymous and cookie-free and send exactly two coarse properties:
`source` and `journey`.

- `Account Created` remains the verified signup event.
- `Worlds Entry Saved` fires after the first successful Pick, Meta, or Top Cut
  save per browser and competition.
- `League Created` fires after successful league creation and visibility setup.
- Edits do not inflate either downstream conversion.
- Picks, account IDs, league IDs, emails, usernames, IP addresses, Pokémon,
  notes, and raw browsing histories are never sent.

Publishing URL edits, changing campaign state or budget, and adding a Meta
dataset remain separate owner-approved actions because they can affect live
delivery and spend.
