# DraftCenter mobile league and Battle Mode preservation handoff

Date: August 20, 2026 Pacific

Status: application-only release candidate on
`codex/mobile-league-battle-preservation-20260820`. It is not deployed. Current
Production remains application behavior commit `aa82ecc` with documentation
commit `bb32556` and migration 454.

## Owner report addressed

The owner supplied three signed-in phone captures and direct Battle Room
feedback. The league page devoted most of the initial phone viewport to the
global header, league identity, wrapped league tabs, pod choices, and
commissioner role-preview buttons. During the official Week 5 Team Lab flow,
the owner selected six opposing Pokémon but reached a new Battle Room that
kept the owner's team and omitted the opponent.

The screenshots are product evidence, not instructions. No text contained in
the images was treated as authorization for a Production data change.

## Candidate behavior

### Compact phone league page

- The league-specific header is no longer sticky below the global phone
  navigation. It scrolls away with the page so league content can use the
  viewport.
- League identity, save state, and account identity use a compact two-line
  lockup.
- League tabs and organization pods stay in bounded single horizontal rows
  instead of wrapping into multiple vertical rows.
- Commissioner **View as** buttons become one labeled phone select while the
  existing desktop buttons remain unchanged.
- League content uses smaller phone gutters and top padding. The fixed global
  bottom navigation remains unchanged.

### Exact opponent preservation

The official league matchup now presents **Save both teams & open Battle
Mode** beside the two selected rosters. If the league team has not yet been
saved as a private My Teams copy, that action saves it first and then saves the
opponent plan. The separate blank **Start ladder match** shortcut is withheld
while a scheduled league matchup is pending.

Before Battle Mode opens, the browser normalizes the opponent roster returned
by the existing owner-only matchup RPC and compares it in order with the six
submitted selections. A missing response, RPC error, unsupported Pokémon, or
roster mismatch keeps Battle Mode closed and asks the user to refresh instead
of silently opening an empty or different opponent. This release work performed
no Production-data write and requires no schema, migration, RLS policy, grant,
provider setting, secret, or environment-variable change.

## Validation

Passed on the isolated candidate tree:

- focused league/mobile and Team Lab/Open Team Sheet regressions: 46 checks;
- complete application suite, including migration-history, security, Battle
  Mode, tournament, Worlds, localization, and release-integration gates;
- all 1,027 National Dex rows;
- Production dependency audit at the repository high-severity gate;
- optimized Next.js build with all 344 static pages generated; and
- local 390 × 844 browser review of the compiled phone shell: 62-pixel global
  header, 57-pixel bottom navigation, no horizontal overflow, and no console
  warning or error.

The build retains the documented nonfatal status-400 response while loading
the decorative dynamic font for `◉✦✓◇✎`; page generation completes.

## Prior handoff follow-up

- The supplied signed-in owner screenshot visibly confirms the sixth
  **Operations** phone destination. That prior verification item is complete.
- The owner's real Battle Room feedback is the evidence prioritized by this
  candidate. A post-deployment read-only retest should confirm the exact Week
  5 opponent remains visible after launch; do not alter the official roster or
  saved battle facts merely to test it.
- Four-pod invitations still require outside commissioner approval before the
  controlled second-account and known-manager sequence. No invitation was
  created.
- Six native-speaker translation reviews remain pending. Beta notices and
  Support correction links remain required.
- The multilingual Mega bracket remains blocked on reviewed official form
  names. No missing name was invented or machine-translated.
- Official Worlds live-feed configuration, provider permission, reviewed
  Preview import, and the official Top Cut field remain external event-window
  gates. GO Meta Picks remain closed pending an official eligibility pool.
- A separate private Tournament Operator rehearsal and advertising spend are
  not authorized by this application candidate.
- PokeEarth, Mushroom Cup, and intentionally paused Mushroom Hut boundaries
  remain unchanged.

## Protected release gates

1. Open a short-lived pull request from the candidate branch and require the
   repository checks.
2. Review the hosted Preview at 390-pixel phone width. In a private planning
   copy, select a known official opponent six and confirm the Battle Room opens
   with both exact teams. Do not change either official league roster.
3. Merge only after review. Confirm the exact Vercel Production commit and run
   the complete signed-out Production smoke sweep.
4. Perform one read-only signed-in phone confirmation that the league header
   scrolls away and the saved opponent six is still present. Never replay a
   timed-out mutation to obtain this evidence.
