import { consumeUserRateLimit } from "../../../lib/apiRateLimit";
import { bearerToken, readBoundedJson, safeFailure, UUID_PATTERN } from "../../../lib/apiSecurity";
import { normalizeShowdownReplayUrl, parseShowdownReplay, matchReplayParticipants } from "../../../lib/showdownReplay";
import { createAdminClient } from "../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_REPLAY_BYTES = 1_100_000;

function identityFor(profile) {
  return String(profile?.display_name || profile?.username || "").trim().toLowerCase();
}

function userControlsTeam(team, user, profile) {
  if (team?.claimedByUserId) return team.claimedByUserId === user.id;
  return Boolean(identityFor(profile) && String(team?.claimedBy || "").trim().toLowerCase() === identityFor(profile));
}

function replayIdsInResults(matchResults) {
  const locations = new Map();
  for (const [matchKey, result] of Object.entries(matchResults || {})) {
    for (const replay of result?.showdownReplays || []) {
      if (replay?.id) locations.set(String(replay.id).toLowerCase(), matchKey);
    }
    for (const value of [result?.replayUrlA, result?.replayUrlB]) {
      const normalized = normalizeShowdownReplayUrl(value);
      if (normalized) locations.set(normalized.id, matchKey);
    }
  }
  return locations;
}

async function fetchReplay(normalized) {
  const response = await fetch(normalized.jsonUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? "That Showdown replay was not found." : "Showdown could not provide that replay right now.");
    error.publicStatus = response.status === 404 ? 404 : 502;
    throw error;
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_REPLAY_BYTES) {
    const error = new Error("That Showdown replay is too large to analyze.");
    error.publicStatus = 413;
    throw error;
  }
  const raw = await response.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_REPLAY_BYTES) {
    const error = new Error("That Showdown replay is too large to analyze.");
    error.publicStatus = 413;
    throw error;
  }
  let payload;
  try { payload = JSON.parse(raw); }
  catch {
    const error = new Error("Showdown returned malformed replay data.");
    error.publicStatus = 502;
    throw error;
  }
  return parseShowdownReplay(payload, { url: normalized.url });
}

export async function POST(request) {
  try {
    const token = bearerToken(request);
    if (!token) return Response.json({ error: "Sign in before analyzing a replay." }, { status: 401 });
    const parsed = await readBoundedJson(request, {
      maxBytes: 4_000,
      maxDepth: 3,
      maxEntries: 12,
      maxArrayLength: 5,
      maxStringLength: 240,
    });
    if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status });
    const leagueId = String(parsed.data.league_id || "");
    const week = Number(parsed.data.week);
    const match = Number(parsed.data.match);
    const values = parsed.data.urls;
    if (!UUID_PATTERN.test(leagueId) || !Number.isInteger(week) || week < 0 || !Number.isInteger(match) || match < 0 || !Array.isArray(values) || values.length < 1 || values.length > 5) {
      return Response.json({ error: "Choose one scheduled matchup and one to five replay URLs." }, { status: 400 });
    }
    const normalizedUrls = values.map(normalizeShowdownReplayUrl);
    if (normalizedUrls.some((value) => !value)) return Response.json({ error: "Use public https://replay.pokemonshowdown.com/... links without passwords or query strings." }, { status: 400 });
    if (new Set(normalizedUrls.map((value) => value.id)).size !== normalizedUrls.length) return Response.json({ error: "The same replay cannot be analyzed twice." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return Response.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });
    if (!await consumeUserRateLimit(supabase, "showdown-replay-analysis", user.id, 30, 3600)) {
      return Response.json({ error: "Too many replay analyses were requested. Try again later." }, { status: 429 });
    }

    const [{ data: membership }, { data: profile }, { data: snapshot }] = await Promise.all([
      supabase.from("league_memberships").select("role").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle(),
      supabase.from("league_state_snapshots").select("state").eq("league_id", leagueId).maybeSingle(),
    ]);
    if (!membership || !snapshot?.state) return Response.json({ error: "That league matchup is unavailable." }, { status: 403 });
    const state = snapshot.state;
    const pair = state.schedule?.[week]?.[match];
    if (!Array.isArray(pair) || pair.length !== 2) return Response.json({ error: "That scheduled matchup no longer exists. Refresh first." }, { status: 409 });
    const teamA = state.teams?.[pair[0]];
    const teamB = state.teams?.[pair[1]];
    const staff = membership.role === "commissioner" || membership.role === "co_commissioner";
    if (!staff && !userControlsTeam(teamA, user, profile) && !userControlsTeam(teamB, user, profile)) {
      return Response.json({ error: "You can only analyze a replay for your own scheduled matchup." }, { status: 403 });
    }

    const targetKey = `${week}-${match}`;
    const usedReplayIds = replayIdsInResults(state.matchResults);
    const duplicate = normalizedUrls.find((item) => usedReplayIds.has(item.id) && usedReplayIds.get(item.id) !== targetKey);
    if (duplicate) return Response.json({ error: "One of those replays is already attached to a different league result." }, { status: 409 });

    const replays = await Promise.all(normalizedUrls.map(fetchReplay));
    const responseReplays = replays.map((replay) => ({
      ...replay,
      participantMatch: matchReplayParticipants(replay, teamA, teamB),
    }));
    return Response.json({
      matchup: {
        teamA: { name: String(teamA?.name || "Team A").slice(0, 80) },
        teamB: { name: String(teamB?.name || "Team B").slice(0, 80) },
        existingResult: state.matchResults?.[targetKey]
          ? { gamesA: state.matchResults[targetKey].gamesA, gamesB: state.matchResults[targetKey].gamesB, bestOf: state.matchResults[targetKey].bestOf }
          : null,
      },
      replays: responseReplays,
      limits: { knockoutAttribution: false, unrevealedPokemon: false },
    }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error?.publicStatus) return Response.json({ error: error.message }, { status: error.publicStatus });
    if (/completed|winner|two-player|team sizes|public, password-free/i.test(String(error?.message || ""))) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return safeFailure(error, "The replay could not be analyzed right now. No league result was changed.", { status: 502, context: "showdown-replay" });
  }
}
