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
- Backup retention: The dashboard displayed eight daily physical backups from July 25 through August 1, 2026; the exact contractual retention window still needs confirmation before making a public promise
- Point-in-time recovery enabled: No; the dashboard offers it as a separate add-on
- People with restore access: One organization member, the owner account
- Off-account encrypted backup location: Not yet established
- Last successful restore drill: Not yet completed
- Next scheduled restore drill: Not yet scheduled

Dashboard verification on August 1, 2026 confirmed that the newest scheduled physical backup was created at 13:17:29 UTC. The dashboard provides a restore action for each backup and a beta **Restore to new project** path. Storage objects are not included in database backups; only their database metadata is covered.

Database-provider backups and user-downloaded exports serve different needs.
Provider backups recover the service; user exports provide portability and an
additional copy outside the production project.

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
