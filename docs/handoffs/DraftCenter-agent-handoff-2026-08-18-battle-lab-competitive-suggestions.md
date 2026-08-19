# DraftCenter agent handoff: Battle Lab competitive suggestions

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Previous Production application commit:
  `8887128`
- Released application commit:
  `49d1398464e3590b69885b873cf5b9f09998bad0`
- Feature implementation commit:
  `15f301476bebbeeebc541c310b83f900094b5fcd`
- Pull request: [#328](https://github.com/roblebaegaming/DraftCenter/pull/328)
- Production migration: unchanged at 439; canonical history version
  `20260818220437`
- Release state: merged, deployed, and application-verified

## Outcome

Battle Room now ranks move, item, and ability suggestions from evidence that
matches the selected Regulation M-B battle purpose. A ladder session uses
current Pokémon Champions Doubles battle data. An online tournament uses a
pinned anonymous aggregate of reviewed public open team sheets. Saved,
published, and already revealed values still appear before measured
suggestions, so the ranking never silently replaces a known fact.

The original dirty workspace remained untouched. This release changed no
database schema, Production row, RLS policy, grant, provider setting, secret,
or environment variable.

## Evidence sources and separation

### Current Champions ranked sessions

- Source: [Pokémon Champions Battle Data API](https://championsbattledata.com/api_guide).
- Scope: current Doubles move, item, and ability ordering for ladder,
  practice, casual, and draft-league Battle Room sessions.
- Refresh: server-cached for six hours, with a one-day stale-while-revalidate
  window.
- Exact Champions form metadata is checked for abilities, including Mega
  Raichu X's Electric Surge.

### Reviewed open tournaments

- Source: the existing reviewed Limitless Regulation M-B cohort in
  `data/competitive/tournaments/limitless-vgc-2026-08-reg-mb.json`.
- Scope: 10 events held August 1–6, 2026; 737 complete open team sheets; 185
  Pokémon in the compact suggestion artifact.
- Ranking: up to 12 moves, items, and non-Mega base abilities per battle form.
- Refresh: pinned for reproducibility and server-cached for one day, with a
  seven-day stale-while-revalidate window.
- Fallback: if a tournament Pokémon is absent from the cohort, the UI labels
  the current Champions ranked data as a tournament-sample fallback.

MunchStats and Pikalytics remain useful comparison interfaces, but DraftCenter
does not silently blend their displays into its rankings. MunchStats documents
that its Champions views cache the same Champions Battle Data source and its
tournament views use Limitless. DraftCenter uses the reviewed underlying
sources directly so every suggestion has one clear evidence type, period,
sample, and attribution.

## Reproducibility and privacy boundary

The generated artifact is
`data/competitive/tournaments/limitless-vgc-2026-08-reg-mb-team-lab-suggestions.json`.
Its builder re-fetches the exact details, standings, and pairings for every
reviewed event, recomputes their concatenated SHA-256 digests, and verifies the
complete-team counts. It fails instead of silently accepting a changed source.

The artifact contains aggregate suggestion counts and percentages only. It
does not retain player names, handles, countries, accounts, records, pairings,
or raw team sheets. The public endpoint returns only bounded suggestion names
and source context; it does not expose the stored counts, percentages, raw
upstream responses, or a bulk competitive-data feed.

Mega Stone holders are mapped to their Mega battle forms. Their pre-Mega
team-sheet ability is deliberately excluded rather than mislabeled as the Mega
form's ability. Exact Champions form metadata supplies the applicable Mega
ability. Move suggestions are still intersected with the exact selected
regulation move pool before display.

## Interface behavior

- Type-ahead remains native and accessible, and manual entry remains allowed.
- Saved, published, and revealed facts remain first.
- The measured source and Pokémon sample are linked directly below the field.
- Changing the report's Battle type changes the ranking source without
  changing stored battle facts.
- Non-Champions formats keep the previous exact move-pool, Pokémon-ability,
  and broad item fallbacks without claiming measured usage.

## Validation and release evidence

- The focused Team Lab and competitive-data tests passed: 44 tests total.
- `npm run competitive:check:team-lab-suggestions` re-fetched and verified all
  source hashes, 185 Pokémon, and 737 complete sheets.
- Local route checks returned reviewed tournament ordering for Garchomp and
  Mega Raichu X, current Champions ordering for ladder Garchomp, and Electric
  Surge for Mega Raichu X.
- A 390×844 Team Lab review found no horizontal overflow.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `npm run build`: passed, including TypeScript and all 319 generated static
  pages plus the new dynamic suggestion route.
- Pull request #328 passed the dependency/security audit, full-history secret
  scan, CodeQL, JavaScript security analysis, Vercel Preview, and Preview
  comments checks. No database migration was included.
- Vercel reported exact merged commit `49d1398` Ready in Production. All
  post-merge security checks passed.
- `npm run smoke:production`: all 17 public routes returned 200 and all five
  protected endpoints returned 401 signed out.
- Live Production endpoint checks confirmed the intended tournament/ladder
  source split and Mega form behavior.

## Continuation

Use the owner's August 19 Battle Room filming session to judge whether the new
ordering materially reduces typing within a real 45-second turn. Capture the
Pokémon, battle type, expected first choices, and observed first choices for
any ranking that feels wrong. Do not combine ladder and tournament evidence to
make one opaque list.

Future source expansion should be pinned by format, date, evidence type, and
sample, with explicit reuse terms and a reproducible importer. Preserve the
same fallback labels, privacy boundary, exact-form handling, and ability to
correct or manually enter any value.
