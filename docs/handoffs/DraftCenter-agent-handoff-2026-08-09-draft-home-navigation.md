# DraftCenter handoff - persistent Draft Home navigation

- Date: August 9, 2026 (America/Denver)
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Implementation branch: `codex/draft-home-navigation-2026-08-09`
- Base commit: `e8fc9471743c1c7cec147b017f6a2b5e37c5581b`
- Release state: clean local implementation validated; not yet deployed

## Purpose

The drafting dashboard is DraftCenter's primary product surface, but the global
navigation did not provide an equally explicit route back to it. This change
makes **Draft Home** the first global action on every route while preserving the
current discovery, account, owner, feature, and reference navigation.

Read this handoff with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) and
[`../../AGENTS.md`](../../AGENTS.md).

## Implemented navigation contract

- The existing DraftCenter brand action is now a visible **Draft Home** button.
- It links to `/?view=dashboard`, which restores the drafting dashboard and
  remains a valid homepage destination for signed-out visitors.
- The established global header is sticky rather than introducing a second
  competing header.
- The button retains the DraftCenter logo on desktop and mobile, a minimum
  44-pixel touch target, a visible keyboard-focus ring, and safe-area spacing.
- The primary Pokédex and Community links, account controls, owner tools, and
  fixed feature bar retain their current behavior and active-route treatment.

## Files

- `src/components/SiteQuickLinks.jsx`
- `src/app/globals.css`
- `test/draft-experience.test.js`
- `docs/handoffs/DraftCenter-agent-handoff-2026-08-09-draft-home-navigation.md`
- `docs/handoffs/README.md`

## Release gates

Local validation passed from the clean release worktree:

- full application test suite;
- focused Draft Home, help, Daily Games, Trainer Dex, and release-integration
  regressions;
- 1,027-row National Dex verification;
- production dependency audit with no known vulnerabilities; and
- production build with 180 generated pages.

Before merge, run the full repository checks, review desktop and 390-pixel
mobile layouts in Preview, verify keyboard focus begins with Draft Home, and
confirm the sticky header does not cover content or dialogs. This release has
no database migration and needs no production data, league, draft, provider,
or environment mutation. After deployment, confirm the exact commit and run
the signed-out production smoke sweep.

## Definition of done

Draft Home remains visible and operable on public and signed-in routes, returns
an active-league user to the drafting dashboard, preserves every existing
shortcut, passes accessibility and regression checks, and completes the
protected Preview and pull-request flow.
