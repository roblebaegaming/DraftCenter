import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isTournamentFeatureEnabled } from "../src/lib/tournament-feature.js";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("tournament feature flag is default-off and requires an explicit true value", () => {
  assert.equal(isTournamentFeatureEnabled(undefined), false);
  assert.equal(isTournamentFeatureEnabled("false"), false);
  assert.equal(isTournamentFeatureEnabled("TRUE"), false);
  assert.equal(isTournamentFeatureEnabled("true"), true);
});

test("disabled tournament routes fail closed and navigation entry points are gated", async () => {
  const [page, hub, quickLinks] = await Promise.all([
    readSource("../src/app/tournaments/page.js"),
    readSource("../src/components/LeagueHub.jsx"),
    readSource("../src/components/SiteQuickLinks.jsx"),
  ]);

  assert.match(page, /if \(!TOURNAMENTS_ENABLED\) notFound\(\)/);
  assert.match(hub, /\{TOURNAMENTS_ENABLED && <section className="hub-card tournament-preview-card">/);
  assert.match(quickLinks, /\{TOURNAMENTS_ENABLED && <a href="\/tournaments">Tournaments \(Preview\)<\/a>\}/);
});

test("tournament schema remains isolated and activation uses guarded server functions", async () => {
  const [foundation, hardening, roleSeparation] = await Promise.all([
    readSource("../supabase/200-tournament-platform-foundation.sql"),
    readSource("../supabase/202-tournament-activation-hardening.sql"),
    readSource("../supabase/203-tournament-preview-auth-and-role-separation.sql"),
  ]);

  assert.match(foundation, /create table if not exists public\.tournaments/i);
  assert.match(foundation, /create table if not exists public\.tournament_pairings/i);
  assert.match(foundation, /create or replace function public\.start_tournament_round/i);
  assert.match(hardening, /create table if not exists public\.tournament_staff/i);
  assert.match(hardening, /create table if not exists public\.tournament_penalties/i);
  assert.match(hardening, /create or replace function public\.accept_tournament_invite/i);
  assert.match(roleSeparation, /create or replace function public\.appoint_tournament_staff/i);
  assert.match(roleSeparation, /check \(role = 'judge'\)/i);
  assert.match(roleSeparation, /security definer/i);
});
