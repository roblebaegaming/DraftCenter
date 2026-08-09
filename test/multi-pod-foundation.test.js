import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createChampionshipQualifierSnapshot,
  createMultiPodOrganizationDraft,
  createMultiPodSeasonDraft,
  multiPodAdministratorInviteUrl,
  multiPodAttachmentRpcArguments,
  multiPodChampionshipRpcArguments,
  multiPodOrganizationUpdateRpcArguments,
  multiPodQualificationDrawRpcArguments,
  multiPodSeasonRpcArguments,
  normalizeMultiPodQualificationRules,
} from "../src/lib/multiPodLeague.js";

const sql = fs.readFileSync(
  new URL("../supabase/350-multi-pod-league-organizations.sql", import.meta.url),
  "utf8",
);
const cleanupSql = fs.readFileSync(
  new URL("../supabase/351-fix-multi-pod-championship-qualifier-delete.sql", import.meta.url),
  "utf8",
);
const hardeningSql = fs.readFileSync(
  new URL("../supabase/352-harden-multi-pod-season-rule-boundaries.sql", import.meta.url),
  "utf8",
);
const workspaceSql = fs.readFileSync(
  new URL("../supabase/353-multi-pod-commissioner-workspace.sql", import.meta.url),
  "utf8",
);
const qualificationSql = fs.readFileSync(
  new URL("../supabase/356-multi-pod-qualification-automation.sql", import.meta.url),
  "utf8",
);
const qualificationDigestFixSql = fs.readFileSync(
  new URL("../supabase/357-fix-multi-pod-qualification-digest-path.sql", import.meta.url),
  "utf8",
);
const qualificationCleanupFixSql = fs.readFileSync(
  new URL("../supabase/358-fix-multi-pod-qualification-candidate-cleanup.sql", import.meta.url),
  "utf8",
);
const championshipSql = fs.readFileSync(
  new URL("../supabase/359-multi-pod-connected-championships.sql", import.meta.url),
  "utf8",
);
const championshipSyncFixSql = fs.readFileSync(
  new URL("../supabase/360-fix-connected-championship-manager-sync.sql", import.meta.url),
  "utf8",
);
const podAccessSql = fs.readFileSync(
  new URL("../supabase/366-multi-pod-manager-and-spectator-access.sql", import.meta.url),
  "utf8",
);
const podAccessPortabilitySql = fs.readFileSync(
  new URL("../supabase/367-fix-pod-access-metadata-portability.sql", import.meta.url),
  "utf8",
);
const podPredictionMatchSql = fs.readFileSync(
  new URL("../supabase/368-create-missing-league-prediction-match.sql", import.meta.url),
  "utf8",
);
const workspaceUi = fs.readFileSync(
  new URL("../src/components/LeagueOrganizationWorkspace.jsx", import.meta.url),
  "utf8",
);
const tournamentWorkspaceUi = fs.readFileSync(
  new URL("../src/components/TournamentWorkspace.jsx", import.meta.url),
  "utf8",
);
const leagueUi = fs.readFileSync(
  new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url),
  "utf8",
);
const authUi = fs.readFileSync(
  new URL("../src/components/AuthGate.jsx", import.meta.url),
  "utf8",
);
const publicLeagueUi = fs.readFileSync(
  new URL("../src/components/PublicLeaguePage.jsx", import.meta.url),
  "utf8",
);
const leagueHubUi = fs.readFileSync(
  new URL("../src/components/LeagueHub.jsx", import.meta.url),
  "utf8",
);

test("multi-pod seasons retain regular-season teams and permit cross-pod duplicates", () => {
  const season = createMultiPodSeasonDraft({
    name: "Premier League 2027",
    regulations: { format: "National Dex", rosterSize: 12 },
  });
  assert.equal(season.allowCrossPodSpeciesDuplicates, true);
  assert.equal(season.rosterPolicy, "retain-regular-season-roster");
  assert.equal(season.replacementPolicy, "inherit-source-league");

  const podA = createChampionshipQualifierSnapshot({
    podId: "pod-a",
    leagueId: "league-a",
    teamKey: 0,
    team: { id: 0, name: "Alphas", claimedByUserId: "manager-a" },
    roster: [{ name: "Garchomp" }, { name: "Rotom-Wash" }],
    sourceStateRevision: 10,
    sourceStateRev: 20,
  });
  const podB = createChampionshipQualifierSnapshot({
    podId: "pod-b",
    leagueId: "league-b",
    teamKey: 3,
    team: { id: 3, name: "Betas", claimedByUserId: "manager-b" },
    roster: [{ name: "Garchomp" }, { name: "Dragonite" }],
    sourceStateRevision: 11,
    sourceStateRev: 21,
  });

  assert.equal(podA.rosterSnapshot[0].name, "Garchomp");
  assert.equal(podB.rosterSnapshot[0].name, "Garchomp");
  assert.notEqual(podA.sourceLeagueId, podB.sourceLeagueId);
});

test("qualification settings are bounded and deterministic", () => {
  assert.deepEqual(normalizeMultiPodQualificationRules(), {
    topPerPod: 2,
    wildcardSlots: 0,
    tiebreakers: ["wins", "differential", "head-to-head", "commissioner-draw"],
  });
  assert.throws(() => normalizeMultiPodQualificationRules({ topPerPod: 0 }), /between 1 and 16/);
  assert.throws(() => normalizeMultiPodQualificationRules({ tiebreakers: ["coin-flip"] }), /supported tiebreakers/);
  assert.throws(() => normalizeMultiPodQualificationRules({ tiebreakers: ["wins", "wins"] }), /only once/);
  assert.throws(() => normalizeMultiPodQualificationRules({ tiebreakers: ["commissioner-draw", "wins"] }), /final tiebreaker/);
});

test("organization branding and administrator invitation arguments are bounded", () => {
  const draft = createMultiPodOrganizationDraft({
    name: "  Premier Draft Association  ",
    description: "Four independent pods.",
    visibility: "public",
    imageUrl: "https://example.com/organization.png",
    brandColor: "#4FD1C5",
  });
  assert.deepEqual(draft, {
    name: "Premier Draft Association",
    description: "Four independent pods.",
    visibility: "public",
    imageUrl: "https://example.com/organization.png",
    brandColor: "#4fd1c5",
  });
  assert.equal(multiPodAdministratorInviteUrl("https://www.draftcentral.gg/", "a".repeat(48)), `https://www.draftcentral.gg/organizations?administrator_invite=${"a".repeat(48)}`);
  assert.deepEqual(multiPodOrganizationUpdateRpcArguments("organization-id", 4, draft), {
    p_organization_id: "organization-id",
    p_expected_revision: 4,
    p_name: draft.name,
    p_description: draft.description,
    p_visibility: draft.visibility,
    p_image_url: draft.imageUrl,
    p_brand_color: draft.brandColor,
  });
  assert.throws(() => createMultiPodOrganizationDraft({ name: "Org", imageUrl: "http://example.com/image.png" }), /secure HTTPS/);
  assert.throws(() => multiPodAdministratorInviteUrl("https://www.draftcentral.gg", "visible-token"), /token is invalid/);
});

test("application service arguments match the bounded database functions", () => {
  assert.deepEqual(multiPodSeasonRpcArguments("organization-id", {
    name: "Season One",
    regulations: { format: "Paldea Dex" },
    qualificationRules: { topPerPod: 2, wildcardSlots: 1 },
  }), {
    p_organization_id: "organization-id",
    p_name: "Season One",
    p_regulations: { format: "Paldea Dex" },
    p_top_per_pod: 2,
    p_wildcard_slots: 1,
    p_tiebreakers: ["wins", "differential", "head-to-head", "commissioner-draw"],
  });
  assert.deepEqual(multiPodAttachmentRpcArguments({
    seasonId: "season-id",
    leagueId: "league-id",
    label: "  Pod A  ",
    sortOrder: 1,
    leagueSeasonNumber: 3,
  }), {
    p_season_id: "season-id",
    p_league_id: "league-id",
    p_label: "Pod A",
    p_sort_order: 1,
    p_league_season_number: 3,
    p_qualification_spots: null,
  });
});

test("qualification draw arguments preserve the recorded order and revision", () => {
  assert.deepEqual(multiPodQualificationDrawRpcArguments("run-id", 4, [{ id: "candidate-b" }, { id: "candidate-a" }]), {
    p_run_id: "run-id",
    p_expected_revision: 4,
    p_candidate_ids: ["candidate-b", "candidate-a"],
  });
  assert.throws(() => multiPodQualificationDrawRpcArguments("run-id", 4, ["candidate-a", "candidate-a"]), /exactly once/);
});

test("organization tables are private-by-default and browser writes use bounded RPCs", () => {
  const tables = [
    "league_organizations",
    "league_organization_memberships",
    "league_organization_seasons",
    "league_organization_pods",
    "league_organization_qualifiers",
    "league_organization_championships",
    "league_organization_championship_entrants",
    "league_organization_audit_events",
  ];
  for (const table of tables) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`));
  }
  assert.match(sql, /revoke all on[\s\S]*league_organizations[\s\S]*from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]+to authenticated/i);
  for (const rpc of [
    "create_league_organization",
    "create_league_organization_season",
    "attach_league_organization_pod",
    "get_league_organization_workspace",
  ]) assert.ok(sql.includes(`function public.${rpc}`));
});

test("pod and championship edges cannot cross organization seasons", () => {
  assert.match(sql, /foreign key \(pod_id, season_id, source_league_id\)[\s\S]*references public\.league_organization_pods\(id, season_id, league_id\)/i);
  assert.match(sql, /foreign key \(championship_id, season_id, tournament_id\)[\s\S]*references public\.league_organization_championships\(id, season_id, tournament_id\)/i);
  assert.match(sql, /foreign key \(qualifier_id, season_id\)[\s\S]*references public\.league_organization_qualifiers\(id, season_id\)/i);
  assert.match(sql, /foreign key \(tournament_entrant_id, tournament_id\)[\s\S]*references public\.tournament_entrants\(id, tournament_id\)/i);
});

test("organization cleanup cascades championship mappings without weakening season identity", () => {
  assert.match(cleanupSql, /foreign key \(qualifier_id, season_id\)/i);
  assert.match(cleanupSql, /references public\.league_organization_qualifiers\(id, season_id\)/i);
  assert.match(cleanupSql, /on delete cascade/i);
});

test("database season rules reject malformed tiebreakers and keep the audit sequence private", () => {
  assert.match(hardeningSql, /array_ndims\(p_tiebreakers\) is distinct from 1/i);
  assert.match(hardeningSql, /where value is null[\s\S]*value not in/i);
  assert.match(hardeningSql, /count\(distinct value\)/i);
  assert.match(
    hardeningSql,
    /revoke all on sequence public\.league_organization_audit_events_id_seq[\s\S]*from public, anon, authenticated/i,
  );
});

test("qualifier storage freezes source identity and roster without species uniqueness", () => {
  const qualifierTable = sql.slice(
    sql.indexOf("create table public.league_organization_qualifiers"),
    sql.indexOf("create table public.league_organization_championships"),
  );
  assert.match(qualifierTable, /source_state_revision bigint not null/);
  assert.match(qualifierTable, /source_state_rev bigint not null/);
  assert.match(qualifierTable, /team_snapshot jsonb not null/);
  assert.match(qualifierTable, /roster_snapshot jsonb not null/);
  assert.doesNotMatch(qualifierTable, /unique[^;]*(pokemon|species)/i);
  assert.match(sql, /check \(allow_cross_pod_species_duplicates\)/i);
  assert.match(sql, /check \(qualified_teams_keep_rosters\)/i);
});

test("pod attachment verifies both organization and source-league authority", () => {
  const start = sql.indexOf("create or replace function public.attach_league_organization_pod");
  const end = sql.indexOf("create or replace function public.list_my_league_organizations");
  const fn = sql.slice(start, end);
  assert.match(fn, /is_league_organization_admin/);
  assert.match(fn, /is_league_staff\(p_league_id\)/);
  assert.match(fn, /for update/);
  assert.match(fn, /seasonNumber/);
  assert.match(fn, /already belongs to another active organization season/i);
});

test("commissioner workspace migration keeps invitations private and one-time", () => {
  assert.match(workspaceSql, /create table public\.league_organization_administrator_invites/i);
  assert.match(workspaceSql, /alter table public\.league_organization_administrator_invites enable row level security/i);
  assert.match(workspaceSql, /revoke all on public\.league_organization_administrator_invites from public, anon, authenticated/i);
  assert.match(workspaceSql, /token_hash text not null unique/i);
  assert.doesNotMatch(workspaceSql.slice(workspaceSql.indexOf("create table public.league_organization_administrator_invites"), workspaceSql.indexOf("create index league_organization_admin_invites_active_idx")), /\btoken text\b/i);
  assert.match(workspaceSql, /encode\(digest\(v_token, 'sha256'\), 'hex'\)/i);
  assert.match(workspaceSql, /only the organization owner can invite administrators/i);
  assert.match(workspaceSql, /for update[\s\S]*accepted_at is not null[\s\S]*invalid or expired/i);
  assert.match(workspaceSql, /administrator_invite_(created|accepted|revoked)/i);
  assert.match(workspaceSql, /only the organization owner can remove administrators/i);
  assert.match(workspaceSql, /and role = 'administrator'/i);
});

test("shared-rule confirmation and launch remain bounded by both authorities", () => {
  const confirmStart = workspaceSql.indexOf("create or replace function public.confirm_league_organization_pod_regulations");
  const launchStart = workspaceSql.indexOf("create or replace function public.launch_league_organization_season");
  const confirmFunction = workspaceSql.slice(confirmStart, launchStart);
  const launchFunction = workspaceSql.slice(launchStart, workspaceSql.indexOf("create or replace function public.get_league_organization_workspace"));
  assert.match(confirmFunction, /is_league_organization_admin/);
  assert.match(confirmFunction, /is_league_staff/);
  assert.match(confirmFunction, /p_expected_season_revision/);
  assert.match(confirmFunction, /attached_state_revision = v_snapshot\.revision/i);
  assert.match(launchFunction, /v_pod_count < 2/i);
  assert.match(launchFunction, /regulations_status <> 'confirmed'/i);
  assert.match(launchFunction, /snapshot\.revision <> pod\.attached_state_revision/i);
  assert.match(launchFunction, /season_launched/i);
});

test("the organization hub exposes the planned commissioner workflow without mutating source rosters", () => {
  for (const rpc of ["createOrganization", "createSeason", "attachPod", "confirmPodRegulations", "launchSeason", "createAdministratorInvite", "removeAdministrator"]) assert.ok(workspaceUi.includes(`MULTI_POD_RPCS.${rpc}`));
  for (const label of ["League organizations", "Administrators", "Confirm shared rules", "Launch season", "Cross-pod duplicate Pokémon are allowed"]) assert.match(workspaceUi, new RegExp(label));
  assert.doesNotMatch(workspaceUi, /createChampionshipQualifierSnapshot|league_organization_qualifiers/);
  assert.match(fs.readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8"), /href="\/organizations">Open organization hub/);
});

test("qualification automation keeps locked standings and rosters behind bounded RPCs", () => {
  for (const table of ["league_organization_qualification_runs", "league_organization_qualification_candidates"]) {
    assert.match(qualificationSql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(qualificationSql, /revoke all on[\s\S]*league_organization_qualification_runs[\s\S]*from public, anon, authenticated/i);
  assert.match(qualificationSql, /locking pod standings requires organization and source-league authority/i);
  assert.match(qualificationSql, /public\.is_league_staff\(v_pod\.league_id\)/i);
  assert.match(qualificationSql, /source_state_revision[\s\S]*source_state_rev[\s\S]*team_snapshot[\s\S]*roster_snapshot_hash/i);
  assert.match(qualificationSql, /encode\(digest\(\(v_state #> array\['rosters'/i);
  assert.doesNotMatch(qualificationSql.slice(qualificationSql.indexOf("create table public.league_organization_qualification_candidates"), qualificationSql.indexOf("create index league_organization_qualification_candidates_run_idx")), /unique[^;]*(pokemon|species)/i);
});

test("qualification ranking refines configured criteria and records only boundary draws", () => {
  for (const criterion of ["wins", "differential", "game-win-percentage", "head-to-head", "commissioner-draw"]) {
    assert.ok(qualificationSql.includes(`v_rule = '${criterion}'`) || qualificationSql.includes(`? '${criterion}'`));
  }
  assert.match(qualificationSql, /ranking_path = array_append/i);
  assert.match(qualificationSql, /boundary\.ranking_path = next_candidate\.ranking_path/i);
  assert.match(qualificationSql, /where run_id = v_run\.id and unresolved and draw_rank is null/i);
  assert.match(qualificationSql, /draw order must contain every unresolved candidate exactly once/i);
});

test("qualification finalization is revision-aware and preserves replacement roster identity", () => {
  assert.match(qualificationSql, /snapshot\.revision <> candidate\.source_state_revision/i);
  assert.match(qualificationSql, /source pod changed after its standings were locked/i);
  assert.match(qualificationSql, /insert into public\.league_organization_qualifiers/i);
  assert.match(qualificationSql, /selected_kind is not null/i);
  const syncStart = qualificationSql.indexOf("create or replace function public.sync_league_organization_qualifier_manager");
  const syncEnd = qualificationSql.indexOf("create or replace function public.get_league_organization_qualification_workspace");
  const syncFunction = qualificationSql.slice(syncStart, syncEnd);
  assert.match(syncFunction, /roster_snapshot_hash/i);
  assert.match(syncFunction, /set manager_user_id = v_manager_id/i);
  assert.doesNotMatch(syncFunction, /set roster_snapshot/i);
  assert.match(qualificationDigestFixSql, /lock_league_organization_pod_standings\(uuid, bigint\)[\s\S]*set search_path = public, extensions/i);
  assert.match(qualificationDigestFixSql, /sync_league_organization_qualifier_manager\(uuid\)[\s\S]*set search_path = public, extensions/i);
  assert.match(qualificationCleanupFixSql, /foreign key \(pod_id, season_id, source_league_id\)[\s\S]*on delete cascade/i);
});

test("commissioner UI stages pod locks, draw review, finalization, and replacement sync", () => {
  for (const rpc of ["beginQualification", "lockPodStandings", "recordQualificationDraw", "finalizeQualification", "cancelQualification", "syncQualifierManager"]) {
    assert.ok(workspaceUi.includes(`MULTI_POD_RPCS.${rpc}`));
  }
  for (const label of ["Begin qualification", "Lock final standings", "Record the commissioner draw", "Finalize qualifiers", "Sync replacement manager"]) {
    assert.match(workspaceUi, new RegExp(label));
  }
  assert.match(workspaceUi, /qualificationResult\.error\.code !== "PGRST202"/);
});

test("connected championship arguments keep format, seeding, and visibility bounded", () => {
  assert.deepEqual(multiPodChampionshipRpcArguments("season-1", 8, {
    format: "double-elimination",
    seedingPolicy: "pod-finish-avoid-rematches",
    bestOf: 3,
    visibility: "public",
  }), {
    p_season_id: "season-1",
    p_expected_season_revision: 8,
    p_format: "double-elimination",
    p_seeding_policy: "pod-finish-avoid-rematches",
    p_best_of: 3,
    p_visibility: "public",
  });
  assert.throws(() => multiPodChampionshipRpcArguments("season-1", 8, { format: "round-robin" }), /single or double/i);
  assert.throws(() => multiPodChampionshipRpcArguments("season-1", 8, { bestOf: 2 }), /best of 1 or best of 3/i);
});

test("connected championship creation atomically promotes and locks finalized qualifiers", () => {
  assert.match(championshipSql, /only the organization owner can create its championship/i);
  assert.match(championshipSql, /where season_id = v_season\.id and status = 'finalized'/i);
  assert.match(championshipSql, /every qualifier needs a claimed manager/i);
  assert.match(championshipSql, /one manager cannot control multiple championship entrants/i);
  assert.match(championshipSql, /insert into public\.league_organization_championship_entrants/i);
  assert.match(championshipSql, /perform public\.lock_double_elimination_tournament/i);
  assert.match(championshipSql, /perform public\.lock_single_elimination_tournament/i);
  assert.match(championshipSql, /connected championship entrants come only from finalized qualifiers/i);
});

test("championship mapping retains roster identity and exposes only bounded public facts", () => {
  const projectionStart = championshipSql.indexOf("create or replace function public.get_connected_championship_tournament");
  const projection = championshipSql.slice(projectionStart, championshipSql.indexOf("revoke all on function", projectionStart));
  assert.match(projection, /roster_size/i);
  assert.doesNotMatch(projection, /roster_snapshot['"]/i);
  assert.doesNotMatch(championshipSyncFixSql, /sync_league_organization_qualifier_manager\(p_qualifier_id\)/i);
  assert.match(championshipSyncFixSql, /championship play has begun for this entrant/i);
  assert.match(championshipSyncFixSql, /encode\(digest\(v_roster::text, 'sha256'\), 'hex'\) <> v_qualifier\.roster_snapshot_hash/i);
  assert.match(championshipSyncFixSql, /set user_id = v_manager_id/i);
  assert.doesNotMatch(championshipSyncFixSql, /set roster_snapshot/i);
});

test("organization and Tournament UIs present the connected bracket without open replacement", () => {
  for (const label of ["Create & lock championship", "Public playoff coverage", "avoid same-pod openers", "Open championship bracket"]) {
    assert.match(workspaceUi, new RegExp(label, "i"));
  }
  assert.match(tournamentWorkspaceUi, /CONNECTED CHAMPIONSHIP/);
  assert.match(tournamentWorkspaceUi, /Replacement managers must first take over the same source-league team/);
  assert.match(tournamentWorkspaceUi, /!connectedChampionship && <details className="tournament-replacement-tools">/);
  assert.match(workspaceUi, /\["active", "qualification", "championship", "complete"\]/);
});

test("linked pod managers receive a virtual read-only pod role", () => {
  assert.match(podAccessSql, /function public\.is_linked_pod_manager\(p_league_id uuid\)/i);
  assert.match(podAccessSql, /source_pod\.league_id <> target_pod\.league_id/i);
  assert.match(podAccessSql, /source_membership\.role::text in \('commissioner', 'co_commissioner', 'coach'\)/i);
  assert.match(podAccessSql, /function public\.get_my_league_access\(p_league_key text\)/i);
  assert.match(podAccessSql, /v_access_role := 'pod_manager'/i);
  assert.match(authUi, /rpc\("get_my_league_access",\{p_league_key:key\}\)/);
});

test("linked pod access tolerates optional league metadata on retained Preview branches", () => {
  assert.match(podAccessPortabilitySql, /create or replace function public\.get_my_league_access\(p_league_key text\)/i);
  assert.match(podAccessPortabilitySql, /to_jsonb\(v_league\) -> 'draft_start_visibility'/i);
  assert.match(podAccessPortabilitySql, /to_jsonb\(v_league\) -> 'lifecycle_archived_at'/i);
  assert.match(podAccessPortabilitySql, /to_jsonb\(v_league\) -> 'workspace_kind'/i);
  assert.match(podAccessPortabilitySql, /grant execute on function public\.get_my_league_access\(text\) to authenticated/i);
});

test("a league's first prediction creates the missing matchup object", () => {
  assert.match(podPredictionMatchSql, /create or replace function public\.save_league_prediction\(/i);
  assert.match(podPredictionMatchSql, /coalesce\(v_state -> 'predictions', '\{\}'::jsonb\)/i);
  assert.match(podPredictionMatchSql, /jsonb_build_object\(\s*v_key,/i);
  assert.match(podPredictionMatchSql, /coalesce\(v_state #> array\['predictions', v_key\], '\{\}'::jsonb\)/i);
  assert.match(podPredictionMatchSql, /grant execute on function public\.save_league_prediction\(uuid, integer, integer, jsonb\) to authenticated/i);
});

test("spectators and sibling managers receive explicit safe state projections", () => {
  const projectionStart = podAccessSql.indexOf("create or replace function public.project_league_observer_state");
  const projectionEnd = podAccessSql.indexOf("create or replace function public.get_my_league_state", projectionStart);
  const projection = podAccessSql.slice(projectionStart, projectionEnd);
  for (const allowed of ["'teams'", "'rosters'", "'schedule'", "'matchResults'", "'predictions'", "'playoffs'"]) {
    assert.ok(projection.includes(allowed));
  }
  assert.match(projection, /'direct', '\{\}'::jsonb/i);
  assert.match(projection, /coalesce\(item\.value ->> 'status', 'pending'\) <> 'pending'/i);
  assert.doesNotMatch(projection, /pendingClaims|queues|lastClaimResults|waiverPriority/);
  assert.match(podAccessSql, /create policy "league participants read snapshots"[\s\S]*membership\.role::text in \('commissioner', 'co_commissioner', 'coach'\)/i);
});

test("sibling pod managers can comment and predict without transaction or DM authority", () => {
  const communicationStart = podAccessSql.indexOf("create or replace function public.mutate_league_communication");
  const predictionStart = podAccessSql.indexOf("create or replace function public.save_league_prediction", communicationStart);
  const communication = podAccessSql.slice(communicationStart, predictionStart);
  assert.match(communication, /p_action not in \('board_post', 'board_delete', 'board_read'\)/i);
  assert.match(communication, /cannot send direct messages/i);
  assert.match(podAccessSql.slice(predictionStart), /v_linked_manager := public\.is_linked_pod_manager\(p_league_id\)/i);
  assert.match(podAccessSql, /list_private_free_agent_claims[\s\S]*membership\.role::text in \('commissioner', 'co_commissioner', 'coach'\)/i);
  assert.match(podAccessSql, /function public\.league_actor_can_control_snapshot_team[\s\S]*membership\.role::text in \('commissioner', 'co_commissioner', 'coach'\)/i);
  assert.match(podAccessSql, /function public\.auction_actor_can_control_team[\s\S]*membership\.role::text in \('commissioner', 'co_commissioner', 'coach'\)/i);
  assert.match(podAccessSql, /revoke all on function public\.auction_actor_can_control_team\(uuid, jsonb, integer\) from public, anon, authenticated/i);
});

test("pod links and spectator navigation expose only the clarified surfaces", () => {
  assert.match(leagueUi, /get_my_league_pod_navigation/);
  assert.match(leagueUi, /href=\{`\/\?league=\$\{encodeURIComponent\(pod\.league_slug\)\}&tab=league&section=activity`\}/);
  assert.match(leagueUi, /POD MANAGER ACCESS/);
  assert.match(leagueUi, /SPECTATOR ACCESS/);
  assert.match(leagueUi, /displayIsLimitedObserver \? \[[\s\S]*\["draft", "Draft Board"\][\s\S]*\["playoffs", "Playoffs"\][\s\S]*\["standings", "Standings"\]/);
  assert.match(leagueUi, /displayIsPodManager \? \[\["activity", "League Activity"\]\]/);
  assert.match(authUi, /Spectators<\/strong> can see standings, predictions, the draft board, and playoffs only/);
  assert.match(leagueHubUi, /entry\.role !== "viewer"/);
  assert.match(leagueHubUi, /participantLeagueIds\.map/);
  assert.doesNotMatch(publicLeagueUi, /LiveNowList|Saved replays|League clock/);
  for (const heading of ["Standings", "Predictions", "Official draft board", "Playoffs"]) assert.match(publicLeagueUi, new RegExp(`<h2>${heading}</h2>`));
});
