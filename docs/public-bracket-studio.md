# Public Bracket Studio

Last reviewed: August 16, 2026

## Purpose

Bracket Studio at `/tools/bracket-builder` is the no-account, download-only
side of DraftCenter's bracket work. It is for visitors who want a polished
bracket for their own competition without creating a hosted event, public URL,
or DraftCenter account.

It is intentionally separate from:

- `/tournaments/predictions`, where DraftCenter publishes official prediction events at
  permanent public URLs;
- `/tournaments`, where signed-in commissioners operate persistent tournament
  registrations and results; and
- `/tools/mega-bracket`, the replayable Pokémon preference game.

## Current free experience

- 4, 8, 16, or 32 competitors in single elimination;
- individual or bulk name entry, including common numbered-list formats;
- click-to-advance winner selection with automatic downstream cleanup when an
  earlier choice changes;
- three complete color themes, three browser-safe font choices, and three
  matchup-card shapes;
- automatic draft recovery in that browser's local storage; and
- a high-resolution PNG containing the complete bracket and champion.

Names, design choices, and winner picks are not sent to Supabase or another
DraftCenter service. The builder does not create a share URL. The route requires
JavaScript but does not require authentication.

## Product boundary

There is no paywall, billing integration, public price, subscription,
entitlement, or locked paid control in this milestone. The released free tool
must remain useful on its own.

The current code keeps themes, fonts, and matchup shapes as small data catalogs
so future design packs can be added without rewriting bracket progression or
image export. Possible later work includes participant images, uploaded brand
assets, more layouts, double elimination, print/PDF output, reusable brand kits,
and a separate standalone product surface. Those are roadmap ideas, not current
promises or paid entitlements.

Any monetization milestone should follow measurement of real builder use,
download completion, repeat use, and direct willingness-to-pay evidence. It
must also preserve a clear privacy explanation and a genuinely functional free
experience.

## Validation contract

`npm run test:public-bracket-builder` covers supported sizes, round labels,
winner propagation, downstream invalidation, bulk parsing, local-only behavior,
discoverability, and PNG export wiring. The test is part of `npm run test:all`.

Before release, visually exercise at least one complete 8-competitor bracket,
change all three design dimensions, download the PNG, refresh the route, and
confirm the local draft recovers. Review the layout at desktop and mobile
widths. This workflow must never create a real hosted tournament or prediction
event.
