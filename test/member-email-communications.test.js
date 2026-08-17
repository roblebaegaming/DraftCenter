import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  escapeMemberEmailHtml,
  memberEmailChunks,
  memberEmailContent,
  normalizeMemberEmailRequest,
} from "../src/lib/memberEmail.js";

const migration = readFileSync(new URL("../supabase/migrations/20260818003000_430_organization_membership_and_member_email.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/member-email/route.js", import.meta.url), "utf8");
const composer = readFileSync(new URL("../src/components/MemberEmailComposer.jsx", import.meta.url), "utf8");
const directory = readFileSync(new URL("../src/components/OrganizationDirectory.jsx", import.meta.url), "utf8");
const organizationWorkspace = readFileSync(new URL("../src/components/LeagueOrganizationWorkspace.jsx", import.meta.url), "utf8");
const authGate = readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");

test("member email requests are bounded and header-safe", () => {
  const normalized = normalizeMemberEmailRequest({
    request_id: "00000000-0000-4000-8000-000000000001",
    scope_type: "organization",
    scope_id: "00000000-0000-4000-8000-000000000002",
    subject: "Update\r\nBcc: hidden@example.test",
    message: "A sufficiently long member update.",
  });
  assert.equal(normalized.subject, "Update Bcc: hidden@example.test");
  assert.equal(normalizeMemberEmailRequest({ ...normalized, request_id: "bad" }).status, 400);
  assert.equal(normalizeMemberEmailRequest({ ...normalized, message: "short" }).status, 400);
});

test("member email content escapes commissioner text and explains recipient privacy", () => {
  assert.equal(escapeMemberEmailHtml(`<img src=x onerror="bad">`), "&lt;img src=x onerror=&quot;bad&quot;&gt;");
  const content = memberEmailContent({
    subject: "<Schedule>", message: "Line one\n<script>bad()</script>",
    scopeName: "Kanto <Cup>", scopeType: "league", senderName: "Commissioner & Coach",
    scopeUrl: "https://www.draftcentral.gg/?league=kanto",
    profileUrl: "https://www.draftcentral.gg/?profile=open",
  });
  assert.doesNotMatch(content.html, /<script>/);
  assert.match(content.html, /Recipient email addresses were not shared/);
  assert.match(content.text, /Change announcement email preferences/);
});

test("member email batches keep every provider request at 100 or fewer", () => {
  const chunks = memberEmailChunks(Array.from({ length: 205 }, (_, index) => ({ email: `${index}@example.test` })));
  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 5]);
});

test("migration preserves the organization privacy boundary", () => {
  assert.match(migration, /check \(role in \('owner', 'administrator', 'member'\)\)/);
  assert.match(migration, /membership_policy = 'open' and organization\.visibility = 'public'/);
  assert.match(migration, /membership\.role in \('owner', 'administrator'\)/);
  assert.match(migration, /membership\.role in \('owner', 'administrator'\)\s*\n\s*\) then/);
  assert.match(migration, /email_member_announcements boolean not null default true/);
  assert.match(migration, /account\.email_confirmed_at is not null/);
  assert.match(migration, /coalesce\(preference\.email_member_announcements, true\)/);
  assert.match(migration, /where membership\.user_id = auth\.uid\(\)\s*\n\s*and membership\.role in \('owner', 'administrator'\)/);
  assert.match(migration, /alter table public\.member_email_broadcasts enable row level security/);
  assert.match(migration, /revoke all on table public\.member_email_broadcasts from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.resolve_member_email_audience\(uuid, text, uuid\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.resolve_member_email_audience\(uuid, text, uuid\) to authenticated/);
});

test("member email route rechecks authorization, rate limits, and keeps recipients private", () => {
  assert.match(route, /\["commissioner", "co_commissioner"\]\.includes\(membership\.role\)/);
  assert.match(route, /\["owner", "administrator"\]\.includes\(membership\.role\)/);
  assert.match(route, /consumeUserRateLimit\(supabase, "member-email-scope"/);
  assert.match(route, /consumeUserRateLimit\(supabase, "member-email-account"/);
  assert.match(route, /https:\/\/api\.resend\.com\/emails\/batch/);
  assert.match(route, /"Idempotency-Key": idempotencyKey/);
  assert.match(route, /to: \[recipient\.email\]/);
  assert.match(route, /DRAFTCENTER_PUBLIC_ORIGIN/);
  assert.match(route, /updateBroadcast\(supabase, payload\.requestId/);
  assert.doesNotMatch(route, /NextResponse\.json\(\{[^}]*recipients/s);
});

test("directory, commissioner tools, and profile expose only intended controls", () => {
  assert.match(directory, /get_league_organization_directory/);
  assert.match(directory, /join_open_league_organization/);
  assert.match(directory, /leave_league_organization/);
  assert.match(directory, /update_league_organization_membership_policy/);
  assert.match(composer, /Email addresses and the recipient list are never revealed/);
  assert.match(organizationWorkspace, /scopeType="organization"/);
  assert.match(authGate, /scopeType="league"/);
  assert.match(authGate, /email_member_announcements/);
});
