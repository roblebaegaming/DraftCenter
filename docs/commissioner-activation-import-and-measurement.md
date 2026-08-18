# Commissioner activation, league import, and measurement

This is the operating contract for DraftCenter's commissioner-first adoption
phase beginning August 18, 2026. It keeps the product focused on one promise:

> Run your whole Pokémon draft league in one place.

The public path is **Run a league**, **Join a league**, or **Prepare for a
match**. A first-time commissioner can choose a private practice walkthrough,
create a league, select a recommended setup preset, and follow one five-step
launch checklist. Public Pokémon tools remain available, but no longer compete
with the primary league path.

## Commissioner and manager next actions

The signed-in dashboard derives a private weekly agenda from league state the
member can already access. It shows at most one next action per active league,
prioritized across:

1. make an on-clock pick;
2. claim an open team;
3. finish rules, invitations, and draft scheduling;
4. follow an active draft;
5. create the schedule or prepare for the next unreported match;
6. record the first result; and
7. review ongoing league progress.

The agenda never exposes an opponent's private preparation, queues, messages,
Pokémon choices, or a league the member cannot already open.

## Safe spreadsheet import

Commissioners can download a documented `.xlsx` workbook or `.csv` template
from pre-draft Setup. The accepted semantic columns are:

| Column | Purpose | Safety boundary |
| --- | --- | --- |
| `Team` | Team identity and row grouping | Maximum 80 characters; existing claimed teams must keep their count, names, and order. |
| `Manager` | Planning label | Never creates an account, sends an invitation, or claims a team. |
| `Pokémon` | Exact DraftCenter form name | Must match the current legal pool exactly; aliases cannot silently select a different form. |
| `Price` | Optional commissioner override | Whole number from 1–100 and tied to an exact Pokémon. |

Files are limited to 5 MB and 5,000 data rows. DraftCenter rejects unknown
forms, duplicate Pokémon, conflicting labels or prices, undocumented data-only
columns, roster-size violations, regulation caps, budget overruns, and claimed
team conflicts. It also provides a downloadable error report.

Uploading creates only a preview. No league write occurs until the commissioner
reviews the counts, checks the confirmation box, and confirms. A setup-only
import keeps the draft unlocked. A complete-roster import additionally requires
typing the exact league name, stores the imported rosters as one revision, and
locks the draft as complete. It does not fabricate historical picks, matches,
transactions, invitations, or account ownership. The latest import can be
undone in the same page session; durable recovery history remains the fallback.

## Aggregate commissioner activation measurement

Owner Operations reports these aggregate-only measures for real leagues;
practice leagues are excluded:

| Measure | Definition |
| --- | --- |
| Created · 30 days | Real leagues created in the trailing 30 days. |
| Completed a draft | Distinct real leagues whose authoritative session completed or whose locked roster state is complete, including confirmed complete-roster imports. |
| Recorded a result | Distinct real leagues with at least one regular-season or playoff result. |
| Completed seasons | Frozen season-history records across real leagues. |
| 7-day retention | Of leagues old enough to be eligible, the share with meaningful saved activity at least seven days after creation. |
| 30-day retention | The equivalent 30-day cohort measure. |

These numbers contain no commissioner, manager, team, matchup, Pokémon, replay,
message, or private-preparation identity. They are product-health measures, not
claims about an individual commissioner.

Privacy-safe Vercel events supplement the authoritative database milestones:
Commissioner Path Started, Practice Path Started, League Created, First Invite
Copied, Draft Scheduled, Draft Started, Draft Completed, First Result Recorded,
League Import Confirmed, Showdown Result Confirmed, and Season Completed. Event
properties are limited to coarse source, practice status, draft style, import
mode, and stage. League IDs are used only for local browser deduplication and
are never sent as event properties.

## Lighthouse commissioner program

No invitation has been sent. External recruitment requires the owner's exact
approval of the audience, message, destination, and reply path.

After approval, recruit a small group of commissioners who are planning a real
season and can test different switching paths: new setup, spreadsheet import,
snake or budget draft, auction, and an existing Discord-centered league. Keep
the group small enough for direct support; five to eight commissioners is a
reasonable first cohort.

Record only the minimum program state needed for support and aggregate review:
consent, intended start window, import path, draft style, milestone dates,
blocking category, and permission status for any quote or logo. Never publish
names, league details, results, or feedback without separate permission.

Review the cohort weekly against the same durable milestones:

- league created;
- invitations sent and teams claimed;
- draft scheduled and completed;
- first result recorded;
- meaningful activity after 7 and 30 days;
- season frozen with a champion; and
- commissioner-reported blocker or support need.

Qualitative feedback should answer three questions: what was unclear in the
first minute, what existing workflow was hardest to move, and what the
commissioner expected DraftCenter to do next. Fix shared activation blockers
before opening unrelated product areas.

## Reliability continuation

Every release still requires focused tests, dependency audit, the full
repository suite, National Dex verification, and a complete build with the
public Supabase URL and publishable key. Production smoke testing is valid only
after an authorized deployment. Database changes remain forward-only and must
verify affected grants and row-level security.

Restore drills, Production data changes, provider settings, external outreach,
and public proof using real leagues remain owner-approved actions. The next
scheduled restore drill is tracked in
[`data-retention-and-recovery.md`](data-retention-and-recovery.md); this feature
slice does not authorize running it early or changing Production.
