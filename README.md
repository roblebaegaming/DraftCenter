# DraftCenter

DraftCenter is a production Pokémon draft-league platform for league setup,
hosted snake and auction drafts, team management, schedules, results,
transactions, playoffs, season archives, recovery, community activities, and
Discord/Twitch integrations.

- Production: https://www.draftcentral.gg
- Public manuals: https://www.draftcentral.gg/manuals
- Owner operations: https://www.draftcentral.gg/operations
- Current status: [`docs/CURRENT-STATUS.md`](docs/CURRENT-STATUS.md)
- Current detailed handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-04-final.md`](docs/handoffs/DraftCenter-agent-handoff-2026-08-04-final.md)
- Permanent agent rules: [`AGENTS.md`](AGENTS.md)

## Local development

Requirements: Node.js 20.9 or newer and pnpm.

1. Run `pnpm install`.
2. Copy `.env.local.example` to `.env.local`.
3. Add the public Supabase URL and publishable key.
4. Keep every server-only key in the deployment environment; never commit it
   or expose it through a `NEXT_PUBLIC_*` variable.
5. Run `pnpm dev` and open `http://localhost:3000`.

## Release checks

```powershell
pnpm audit --prod --audit-level high
npm run test:regulations
npm run test:national-dex
npm run build
npm run smoke:production
```

The production build needs the public Supabase variables. The smoke test checks
14 public routes and confirms that five protected APIs reject signed-out
requests.

## Operational documentation

- [`docs/draft-lab.md`](docs/draft-lab.md)
- [`docs/project-organization.md`](docs/project-organization.md)
- [`docs/handoffs/README.md`](docs/handoffs/README.md)
- `docs/launch-stabilization-checklist.md`
- `docs/multi-account-hardening-test-record.md`
- `docs/data-retention-and-recovery.md`
- `docs/owner-league-operations.md`
- `docs/standalone-tournaments.md`
- `docs/twitch-live-detection-setup.md`

Preserve the local untracked `.vercel/` directory. It contains deployment
linkage and downloaded environment configuration and must not be committed.
