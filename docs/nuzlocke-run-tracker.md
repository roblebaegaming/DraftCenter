# Nuzlocke Run Tracker

The public `/nuzlocke` experience combines DraftCenter's verified encounter generator with a route-by-route run tracker. It supports all games already present in the reviewed Nuzlocke catalog without changing encounter sourcing or making unsupported claims about game-specific boss rules.

## Player workflow

1. Choose a verified game and the generator rules.
2. Build a compact run or one encounter for every eligible route or area.
3. Record each route as not encountered, caught, active, boxed, missed, or deceased.
4. Add optional nicknames, encounter notes, run notes, badges, bosses, other milestones, and user-defined level caps.
5. Save privately to My Teams for cross-device access or download a progress image.

The tracker checks evolutionary families across caught, active, boxed, and deceased encounters. A missed encounter does not reserve its family. These warnings help players apply a common species or dupes clause; they do not enforce one universal Nuzlocke ruleset.

## Persistence and privacy

- Recent progress for up to ten generated builds is stored in the player's browser. The generated encounter roster is part of the local key so changing a game or rules cannot apply progress to a different build that happens to reuse the same seed.
- Signed-in players can save a run in the existing owner-only `personal_teams.nuzlocke_run` JSON document.
- The private tracker URL is `/nuzlocke?run=<personal-team-id>`. Row-level security restricts the lookup and update to the owner.
- My Teams backup, restore, export, archive, and account-deletion behavior already includes the saved JSON document.
- Recreation links contain generator settings and the seed, but never tracker status, nicknames, notes, milestones, or history.

No new database migration, public sharing permission, or production-data write is required for this feature.

## Stored tracker contract

`nuzlocke_run.tracker` is normalized before local or account persistence:

- `version`: current tracker schema version.
- `run_state`: `active`, `completed`, or `failed`.
- `encounters`: route-keyed status, nickname, and notes for the generated team.
- `milestones`: up to 32 user-defined badge, boss, or other entries with an optional level cap from 1–100.
- `notes`: up to 5,000 characters of run notes.
- `history`: the newest 100 status, milestone, and run-state events.
- `updated_at`: a validated ISO timestamp.

The full Nuzlocke JSON remains subject to the existing 500 KB database constraint and 251-encounter limit. Older Run Cards without a tracker normalize to an untouched active run, so no migration of existing saved records is needed.

## Product boundaries

- Encounter catalogs remain the authoritative source for route, method, level, condition, form, evolution-family, and encounter-rate data. The tracker retains and displays the reviewed rate for each generated encounter.
- Level caps and milestone names are entered by the player. DraftCenter does not present them as verified boss data.
- The tracker records player decisions; it does not mutate a hosted league, draft, roster, queue, membership, provider, or production configuration.
- Progress-image and text exports are snapshots. The private My Teams tracker is the editable cross-device record.

## Validation expectations

Changes to this feature should run `npm run test:nuzlocke`, `npm run test:seo`, and the standard release gates. Browser review should cover a generated full-route run, encounter status and nickname edits, a species-family warning, milestone completion, mobile layout, browser reload, signed-in My Teams save/reopen, recreation-link privacy, and the progress-image download.
