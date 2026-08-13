# DraftCenter handoff: League Operations production release

- Date: August 13, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Feature pull request: [#189](https://github.com/roblebaegaming/DraftCenter/pull/189)
- Verified production application commit: `077f582cf006b414cc603dfbcf6bd53846416663`
- Latest production migration: 387

## Start here

The concurrent-division League Operations release is merged, migrated,
deployed, and verified. Start future work from a fresh `origin/main`; do not
continue the release branch or replay migration 387.

Read this file with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../../AGENTS.md`](../../AGENTS.md),
[`../multi-pod-league-organizations.md`](../multi-pod-league-organizations.md),
and [`../multi-pod-organizer-guide.md`](../multi-pod-organizer-guide.md). The
preceding broad release record remains
[`DraftCenter-agent-handoff-2026-08-13-global-release-final.md`](DraftCenter-agent-handoff-2026-08-13-global-release-final.md).

The original long-lived DraftCenter workspace still contains unrelated owner
work. It was not staged, discarded, hidden, or modified for this release. Use
a clean short-lived `codex/` branch or worktree for the next change.

## What shipped

The `/organizations` workspace is now presented as **League Operations** and
supports large seasons as concurrent, independently operated divisions:

- An organization administrator can create 2-32 divisions in one atomic
  season operation.
- Every division is provisioned as an ordinary private league with its own
  label, commissioner boundary, roster, draft, and lifecycle.
- Each division can have a different optional draft time at creation and can
  be rescheduled later from the organization workspace.
- Every division links to its normal Draft Setup screen for snake or auction
  details. A planned time does not silently arm automatic draft start.
- Administrators can record a manager's private draft-availability note before
  assigning them, then place, move, or remove the manager by username.
- Division selectors display planned draft times so commissioners can group
  managers around mutual availability.
- Managers may remain unassigned while availability is collected.
- Season launch requires every planned division to exist and the shared rules
  to be confirmed.

This is the foundation for massive public leagues and organizations that run
many league programs. It does not merge division drafts into one shared draft
and does not create authority across sibling divisions.

## Authority and lifecycle contracts

- Division changes and manager placement retain dual authority: the actor must
  administer the organization and staff the affected division.
- Organization administration alone does not silently grant commissioner
  powers inside a division.
- Moving or removing a manager is blocked after the affected draft starts.
- Moving or removing a manager is also blocked once the manager owns, is
  assigned to, or claims a team in the affected league.
- If a scheduled snake or auction start exists, cancel it in Draft Setup before
  changing the central planned time.
- A planned draft time is coordination data. Automatic start must still be
  explicitly armed through Draft Setup.
- Do not test these rules by changing a real league, draft, roster, membership,
  queue, deadline, or scheduled start. Use exact isolated practice identifiers.

## Database release

Forward-only migration
`supabase/387-organization-division-and-draft-planning.sql` is applied to the
exact core production project. It adds:

- `league_organization_seasons.planned_pod_count`, constrained to 2-32;
- private `league_organization_manager_assignments` planning rows;
- atomic planned-season creation;
- division label and draft-time updates;
- availability-first manager assignment, movement, and removal;
- a private planning-workspace read model; and
- launch validation for the complete planned division set.

The manager-assignment table has RLS enabled. `anon` and `authenticated` have
no direct select, insert, update, or delete access. Browser access is through
the authenticated security-definer planning RPCs only. The draft-start status
helper remains private and checks for both scheduled-draft table variants
portably.

Production preflight confirmed that migration 387 was absent. The first SQL
Editor submission was rejected at parse time because the editor had appended
the migration to the preflight query; it did not execute and made no change.
The exact 639-line migration was then loaded into a clean query, completed in
one transaction, and returned `Success. No rows returned`.

The read-only production postflight confirmed:

- manager table present: true;
- planned pod-count column present: true;
- create, division-plan, manager-assignment, and planning-workspace RPCs
  present: true;
- assignment-table RLS enabled: true;
- direct `anon` table access: false;
- direct `authenticated` table access: false;
- start-status helper private: true;
- authenticated planning-workspace execution: true; and
- portable scheduled-start checks present: true.

Any new database change must use migration 388 or later. Never rewrite or
replay migration 387.

## Validation and release evidence

The release used a clean worktree and passed:

- `npm run test:multi-pod`: 31/31;
- `npm run test:all`: complete pass, including 63/63 Worlds tests and 5/5
  release-integration tests;
- `npm run test:national-dex`: 1,027 Pokémon rows;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run build`: optimized Next.js 16.2.12 build with 242 static pages;
- `git diff --check`;
- signed-out local and hosted Preview review of `/organizations`; and
- all protected secret-scan, security/dependency, CodeQL, Vercel, and review
  checks on pull request #189.

Migration 387 was rehearsed on the retained isolated `multi-pod-pr-82`
Preview branch. The focused transaction matrix proved three independent
practice divisions, pod-specific draft times, availability before placement,
atomic manager movement, membership creation, denial of non-staff mutations,
audit history, RPC-only grants, RLS, and complete fixture cleanup. Failed
development attempts rolled back transactionally. The retained Preview branch
was not deleted.

The release also updated the two Worlds option validators to compare normalized
line endings, updated stale localization-aware Worlds assertions, and advanced
the existing transitive `nanoid` override to 3.3.18 for the current advisory.
No historical migration was rewritten.

Pull request #189 was squash-merged as
`077f582cf006b414cc603dfbcf6bd53846416663`. Vercel showed that exact commit as
the Ready Production Deployment. The live `/organizations` workspace displayed
the new League Operations hero, concurrent-division selector, and per-division
draft-time controls. No form was submitted during live review.

The post-deployment signed-out production smoke sweep passed all 19 checks:
14 public routes returned 200 and five protected API routes returned 401.

## Preserved boundaries

- No real organization, league, draft, pick, roster, team, membership, manager
  assignment, queue, deadline, scheduled start, or provider configuration was
  changed for testing.
- No secret, Supabase key, Vercel credential, session token, user email address,
  or private channel identifier was written to the repository or this record.
- The retained `multi-pod-pr-82` Preview branch remains available and must not
  be deleted.
- Mushroom Cup and the intentionally paused historical Mushroom Hut drafts
  were not touched.
- The original dirty DraftCenter workspace remains untouched.

## Next-agent checklist

1. Fetch `origin/main` and create a clean short-lived branch or worktree.
2. Preserve the authority, draft-start, team-ownership, and RPC-only boundaries
   above.
3. Use migration 388 or later for any database change and rehearse it on an
   isolated Preview database with focused RLS/grant coverage.
4. Run the narrowest relevant tests during development, then the required
   audit, full suite, National Dex verification, and build before release.
5. Review the hosted Preview and wait for every protected check before merge.
6. Confirm the exact merged commit is Ready in Production, then run the
   signed-out production smoke sweep.

There is no pending application or migration step for this feature. A future
end-to-end adoption exercise should use a newly created isolated practice
organization, never an existing commissioner league.
