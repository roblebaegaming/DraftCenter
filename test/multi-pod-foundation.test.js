import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createChampionshipQualifierSnapshot,
  createMultiPodOrganizationDraft,
  createMultiPodSeasonDraft,
  multiPodAdministratorInviteUrl,
  multiPodAttachmentRpcArguments,
  multiPodOrganizationUpdateRpcArguments,
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
const workspaceUi = fs.readFileSync(
  new URL("../src/components/LeagueOrganizationWorkspace.jsx", import.meta.url),
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
    tiebreakers: ["wins", "differential", "head-to-head"],
  });
  assert.throws(() => normalizeMultiPodQualificationRules({ topPerPod: 0 }), /between 1 and 16/);
  assert.throws(() => normalizeMultiPodQualificationRules({ tiebreakers: ["coin-flip"] }), /supported tiebreakers/);
  assert.throws(() => normalizeMultiPodQualificationRules({ tiebreakers: ["wins", "wins"] }), /only once/);
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
    p_tiebreakers: ["wins", "differential", "head-to-head"],
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
