# DraftCenter data retention and recovery

This document is an operational policy draft. The owner should review it with
applicable legal and privacy requirements before publishing it as a promise to
users.

## Data ownership and exports

- Commissioners can download a readable league spreadsheet and a restorable
  league JSON recovery file.
- Users can download a private account export from Profile.
- Users can download readable and restorable My Teams exports from My Teams.
- Private exports may contain emails, notes, Discord identifiers, team plans,
  and other personal information. Store and transmit them accordingly.

## Backup responsibilities

Record these values after verifying them in the Supabase dashboard:

- Production project: Supabase project `eukexfqpiuidwygllaye` in AWS `us-west-2`
- Supabase plan: Pro
- Automated backup frequency: Daily, around midnight in the project's region
- Backup retention: The dashboard displayed seven daily physical backups from July 26 through August 1, 2026; the exact contractual retention window still needs confirmation before making a public promise
- Point-in-time recovery enabled: No; the dashboard offers it as a separate add-on
- People with restore access: One organization member, the owner account
- Off-account encrypted backup location: Google Drive, exact archive name `draftcenter-recovery-2026-08-02.zip`
- Last successful restore drill: August 2, 2026 — passed in isolated project `phvlvcuxulzhrqrmfndz`
- Restore-project cleanup: owner approved permanent deletion on August 2, 2026; the exact project URL redirected to the organization list and the project ID was absent from both accessible organization project lists, confirming it was already removed before the final delete action
- Next scheduled restore drill: November 2, 2026

Dashboard verification on August 1, 2026 confirmed that the newest scheduled physical backup was created at 13:17:29 UTC. The dashboard provides a restore action for each backup and a beta **Restore to new project** path. Storage objects are not included in database backups; only their database metadata is covered.

## Restore drill record — August 2, 2026

- Source project: production project `eukexfqpiuidwygllaye`
- Source backup: physical backup created August 1, 2026 at 13:17:29 UTC
- Restore target: isolated project `phvlvcuxulzhrqrmfndz`, named `DraftCenter Restore Drill 2026-08-01`
- Restore requested: August 2, 2026 at 06:17:51 UTC
- Completion observed: August 2, 2026 by 06:27 UTC
- Additional monthly compute shown before creation: $0
- Additional monthly disk shown before creation: $0
- Production impact: none; the dashboard's **Restore to new project** workflow was used
- Provider result: `COMPLETED`

Read-only validation in the restored project passed:

- 72 public tables were present and all 72 retained row-level security.
- 177 public functions and 126 foreign keys were present.
- Representative restored counts were 17 Auth users, 17 profiles, 13 leagues,
  34 league memberships, 13 league state snapshots, 5 draft sessions,
  299 roster entries, 13 automatic recovery snapshots, 3 notification
  preference records, 2,463 league-Pokémon rows, 4 team archives, and 2
  private team notebooks.
- The restored project reported a current physical backup and a responsive
  primary database in `us-west-2`.

This drill validates database schema, data, roles, permissions, users, indexes,
and relational recovery. It does not validate Storage objects or settings,
Edge Functions, Auth settings and API keys, project-specific database settings,
or read replicas because Supabase explicitly lists those as manual
reconfiguration items for this workflow. After explicit owner approval, the
exact restore project ID was checked directly and across both accessible
Supabase organizations. It was already absent, so no additional destructive
action was required and production remained untouched.

Database-provider backups and user-downloaded exports serve different needs.
Provider backups recover the service; user exports provide portability and an
additional copy outside the production project.

## Off-account encrypted archive — August 2, 2026

- A recovery bundle containing the private account export, My Teams workbook,
  league workbook, and league recovery JSON was packaged as an AES-256 encrypted
  ZIP file.
- Every archive member was decrypted and compared with its source using SHA-256;
  all four hashes matched.
- The archive was uploaded to the owner's Google Drive and verified by its exact
  filename. A duplicate upload was cancelled so only the intended copy remains.
- The passphrase is intentionally not stored in this repository or this
  document. It is delivered separately to the owner and should be kept in a
  password manager distinct from the Google account.

## Application export and recovery validation — August 2, 2026

Application-level recovery was exercised in a temporary production practice
league and isolated account state after the provider restore drill:

- The private account export downloaded as valid, versioned JSON with the
  expected personal workspace, five league memberships, and one discussion.
- The My Teams spreadsheet contained separate team and planning sheets. Both
  rendered cleanly and a workbook-wide formula-error scan returned no matches.
- The league spreadsheet contained 12 worksheets covering current and archived
  teams, rosters, standings, schedule/results, transactions, playoffs, and
  draft history. All worksheets rendered successfully and contained no formula
  errors; manager columns were widened after the visual review found clipping.
- The league recovery JSON restored all meaningful protected state into the
  practice league. The only expected difference was the new snapshot revision.
- The owner-only My Teams recovery operation passed insert and update restores,
  preserved all 19 supported fields, rejected signed-out callers, and prevented
  one user from restoring over another user's workspace.
- The full regular season, playoff, champion, archive, and clean-new-season
  lifecycle passed before cleanup, confirming that the restored data remained
  usable rather than merely parseable.
- The temporary practice league and three dedicated Auth users were removed
  after validation. Exact preflight checks showed zero owned leagues and zero
  memberships for the temporary users; the final checks showed zero remaining
  league rows and zero remaining temporary Auth users.

These checks complement the provider restore drill: provider backups protect
the service as a whole, while the downloaded files and owner-scoped restore
functions give commissioners and users portable, independently testable copies.

## Safe restore drill

Never test restoration over production.

1. Record the production commit, migration number, and schema version.
2. Create or select an isolated non-production Supabase project.
3. Confirm that it contains no real user data or active integrations.
4. Restore the selected backup into that isolated project using the supported
   Supabase restore workflow.
5. point a local DraftCenter instance at the restored project using temporary
   local environment settings.
6. Verify authentication, league counts, snapshots, archived seasons, draft
   sessions, rosters, memberships, private workspaces, and notification
   preferences.
7. Run the lifecycle and privacy portions of the stabilization checklist.
8. Record the backup timestamp, restore duration, failures, tester, and result.
9. Remove or lock down the temporary restored project after verification.

## Suggested retention rules

- Active account and league data: retain while the account or league is active.
- Archived league seasons: retain until the league owner deletes the league or
  an applicable deletion request requires removal.
- Expired OAuth state and short-lived security records: delete on a recurring
  schedule after they are no longer needed.
- Notification delivery and diagnostic errors: retain only long enough to
  investigate reliability, initially 30 days.
- User-downloaded exports: DraftCenter does not control copies after download.
- Backups: follow the verified provider retention window and maintain at least
  one encrypted copy outside the production project/account when feasible.

Do not silently promise a specific retention period until the operational
configuration has been verified.

## Account deletion procedure

Self-service account deletion is available from Profile after downloading a
private export. The user must enter their account email and `DELETE MY ACCOUNT`.
The request waits seven days and remains cancellable during that period.

Deletion is blocked while the account remains the primary commissioner of any
league. The commissioner must first use League Tools to transfer ownership to
an existing manager or co-commissioner, or permanently delete the league.
Daily server processing removes avatar storage, deletes the Auth user and
cascading private records, and writes a de-identified completion audit.

The operational procedure remains:

1. Verify the request through the signed-in account or verified account email.
2. Offer a private account export before deletion.
3. Identify leagues where the user is the only commissioner and arrange a
   transfer or league closure.
4. Remove user-owned avatar objects and other storage objects.
5. Delete the Supabase Auth user through the approved administrative workflow.
   Foreign-key cascades should remove owner-scoped rows, but verify the result.
6. Confirm removal of personal teams, notebooks, preferences, Discord
   connection metadata, memberships, comments, votes, badges, and other
   owner-scoped rows.
7. Preserve only data that must remain for league integrity or legal reasons,
   and remove or de-identify personal attribution where appropriate.
8. Record completion without retaining unnecessary identity information.
9. Explain that provider backups expire according to the verified backup
   retention schedule rather than being rewritten immediately.

Migration `237-commissioner-transfer-and-account-deletion.sql` provides the
transfer function, cooling-off request record, and de-identified completion
audit used by this workflow.

## Recovery incident record

- Incident date:
- Detection source:
- Affected project and leagues:
- Last known good backup:
- Restore target:
- Restore started/completed:
- Data-loss window:
- Verification performed:
- Owner approval:
- Follow-up actions:
