# Draft pricing presets

DraftCenter stores a pricing preset ID with each league. Preset IDs are
immutable version identifiers: updating a public board requires adding a new
preset rather than changing the values behind an existing ID.

## Default policy

- New Regulation M-B, F, G, and H leagues use the matching source board below.
- Every other regulation, regional Pokédex, National Dex generation, and
  Custom format starts with `bst-v1` unless a commissioner chooses an optional
  matching preset or imports a spreadsheet.
- BST starter values are finite 1–20 estimates calculated from base stat total.
  They are labeled `BST ESTIMATE` in Setup and are never presented as curated.
- Existing leagues created before versioned presets retain their prior
  DraftCenter pricing behavior under a `legacy:<regulation>` compatibility ID.
  A commissioner can explicitly opt into a new board.
- Commissioner overrides remain authoritative. Changing either the format or
  the pricing preset is confirmation-gated because it clears those overrides.

Coverage shown in Setup is calculated after the league's active legality,
bans, Mega toggle, and commissioner additions. The full-catalog source mapping
counts below therefore may be larger than the number shown in a particular
league.

## Exact VGC presets

| Preset ID | Format and source | Source date | Imported coverage | Handling of gaps |
| --- | --- | --- | ---: | --- |
| `smogon-vgc-reg-mb-2026-06-28` | [Smogon Draft League Tiering Council M-B board](https://docs.google.com/spreadsheets/d/10QIAlXDipcczT8UoKxH81KNWXyWWLsUJ8QXqm7dxR3w/edit?gid=1369457093) | June 28, 2026 | 302 of 307 | Five unlisted catalog entries use BST estimates. The public 19–1 board is imported; a hidden/staging 20-point column is excluded. |
| `stc-vgc-reg-f-s4-2025-03-18` | [Sitrus Tournament Circuit Season 4 Regulation F board](https://docs.google.com/spreadsheets/d/1cnfxoNeF2Cm-RssL8Ze6zZ515R89zp9q09XlZ2RGcME/edit?gid=0) | March 18, 2025 | 524 of 566 | Unlisted entries use BST estimates. |
| `wbg-vgc-reg-g-2024` | [World Battle Guild Regulation G board](https://docs.google.com/spreadsheets/d/1ibLVMQTQ6ttACiUxPAmtRb1S_E6JdBOe9TkwSt0yMP0/edit?gid=162447210) | 2024 season | 523 of 590 | The exact normal 22–1 board is imported. WBG's restricted Pokémon use a separate -30 to 50 budget adjustment that DraftCenter's ordinary price model cannot represent faithfully, so restricted and unlisted entries are explicitly labeled BST estimates. |
| `wbg-vgc-reg-h-2024` | [World Battle Guild Regulation H board](https://docs.google.com/spreadsheets/d/1UtkHXoQvnafIKgoXmcbX53RMrt4bWSZHQ6Ld-VMXTYo/edit?usp=sharing) | 2024 season | 484 of 526 | Unlisted entries use BST estimates. |

DraftCenter currently shares one catalog slot for a few source-board forms,
including Ogerpon masks, Ursaluna forms, and Indeedee sexes. When those source
forms have different prices, the preset uses the highest source price for the
shared slot. This is conservative for budget validation and is disclosed in
the preset description.

## Optional generational singles presets

These are pricing-only options for commissioners deliberately running a
matching singles ruleset. They are not universal National Dex defaults, and
selecting one does not apply the source's bans, clauses, roster rules, or legal
pool. Any unmatched DraftCenter species remains a visible BST estimate.

| Preset ID | Offered for | Source |
| --- | --- | --- |
| `smogon-usum-cup-singles-v1` | National Dex through Gen 7 | [Smogon USUM Cup staff sample](https://docs.google.com/spreadsheets/d/13CTcPK0yvjTtajG3xVswkTVNKc-fwrdjSa-fEKk0Z7s/edit?gid=1369457093) |
| `smogon-oras-cup-singles-v1` | National Dex through Gen 6 | [Smogon ORAS Cup staff sample](https://docs.google.com/spreadsheets/d/1OwYmmrr9IOuPAKNfAVxXQ4q0kv1JRBur6JRgkIsB7Ts/edit?usp=sharing) |
| `ztl-bw-singles-v1` | National Dex through Gen 5 | [ZTL Classic Smogon community workbook](https://docs.google.com/spreadsheets/d/1YT4HYxXTws9_YQEP1sLSxAd6fzTqcoRjQ7ZvywSfcLI/edit?gid=930730424) |
| `ztl-dpp-singles-v1` | National Dex through Gen 4 | [ZTL Classic Smogon community workbook](https://docs.google.com/spreadsheets/d/1YT4HYxXTws9_YQEP1sLSxAd6fzTqcoRjQ7ZvywSfcLI/edit?gid=930730424) |
| `ztl-adv-singles-v1` | National Dex through Gen 3 | [ZTL Classic Smogon community workbook](https://docs.google.com/spreadsheets/d/1YT4HYxXTws9_YQEP1sLSxAd6fzTqcoRjQ7ZvywSfcLI/edit?gid=930730424) |

The source access date for these optional boards is August 9, 2026. National
Dex Gen 1, 2, 8, and 9 remain on BST/import because no validated matching board
is included in this version.

## Validation contract

`test/draft-pricing-presets.test.js` verifies that source metadata and pinned
coverage remain intact, that optional singles presets do not become defaults,
and that every Pokémon in every catalog format resolves to a finite positive
price. This includes regional Pokédex and Custom formats.
