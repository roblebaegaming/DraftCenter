const REPLAY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,119}$/;
const MAX_LOG_BYTES = 1_000_000;

export function showdownId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeShowdownReplayUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.hostname !== "replay.pokemonshowdown.com" || url.port || url.username || url.password || url.search || url.hash) return null;
    const rawId = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.(?:json|log)$/i, "").toLowerCase();
    if (!REPLAY_ID_PATTERN.test(rawId)) return null;
    return { id: rawId, url: `https://replay.pokemonshowdown.com/${rawId}`, jsonUrl: `https://replay.pokemonshowdown.com/${rawId}.json` };
  } catch {
    return null;
  }
}

function detailSpecies(value) {
  return String(value || "").split(",", 1)[0].trim().replace(/-\*$/, "").slice(0, 120);
}

function playerFromPokemonIdent(value) {
  return String(value || "").trim().match(/^(p[1-4])[a-z]?:/)?.[1] || "";
}

function uniquePush(map, key, value) {
  if (value && !map[key].includes(value)) map[key].push(value);
}

export function parseShowdownReplay(payload, source = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Replay data is malformed.");
  const normalizedUrl = normalizeShowdownReplayUrl(source.url || `https://replay.pokemonshowdown.com/${payload.id || ""}`);
  if (!normalizedUrl || normalizedUrl.id !== String(payload.id || "").toLowerCase()) throw new Error("Replay identity did not match the requested URL.");
  const log = String(payload.log || "");
  if (!log || new TextEncoder().encode(log).byteLength > MAX_LOG_BYTES) throw new Error("Replay log is empty or too large.");
  if (payload.password || Number(payload.private || 0) !== 0) throw new Error("Only public, password-free replays are supported in this release.");

  const players = { p1: "", p2: "" };
  const teamSize = { p1: 0, p2: 0 };
  const preview = { p1: [], p2: [] };
  const revealed = { p1: [], p2: [] };
  const fainted = { p1: 0, p2: 0 };
  let gameType = "";
  let format = String(payload.format || "").trim().slice(0, 120);
  let winnerName = "";
  let tie = false;

  for (const line of log.split(/\r?\n/).slice(0, 30000)) {
    const parts = line.split("|");
    const type = parts[1];
    if (type === "player" && (parts[2] === "p1" || parts[2] === "p2")) players[parts[2]] = String(parts[3] || "").trim().slice(0, 100);
    else if (type === "teamsize" && (parts[2] === "p1" || parts[2] === "p2")) teamSize[parts[2]] = Math.max(0, Math.min(6, Number(parts[3]) || 0));
    else if (type === "gametype") gameType = String(parts[2] || "").toLowerCase();
    else if (type === "tier" && !format) format = String(parts[2] || "").trim().slice(0, 120);
    else if (type === "poke" && preview[parts[2]]) uniquePush(preview, parts[2], detailSpecies(parts[3]));
    else if (["switch", "drag", "replace"].includes(type)) {
      const player = playerFromPokemonIdent(parts[2]);
      if (revealed[player]) uniquePush(revealed, player, detailSpecies(parts[3]));
    } else if (type === "faint") {
      const player = playerFromPokemonIdent(parts[2]);
      if (Object.prototype.hasOwnProperty.call(fainted, player)) fainted[player] += 1;
    } else if (type === "win") winnerName = String(parts[2] || "").trim().slice(0, 100);
    else if (type === "tie") tie = true;
  }

  if (!players.p1 || !players.p2 || !["singles", "doubles"].includes(gameType)) throw new Error("Only completed two-player Showdown singles and doubles replays are supported.");
  if (tie || !winnerName) throw new Error(tie ? "Tied replays require manual result entry." : "The replay does not contain a completed winner.");
  const winnerPlayer = showdownId(winnerName) === showdownId(players.p1) ? "p1" : showdownId(winnerName) === showdownId(players.p2) ? "p2" : "";
  if (!winnerPlayer) throw new Error("The replay winner did not match either recorded player.");
  if (!teamSize.p1 || !teamSize.p2) throw new Error("The replay does not declare both team sizes.");

  return {
    id: normalizedUrl.id,
    url: normalizedUrl.url,
    format,
    gameType,
    uploadedAt: Math.max(0, Number(payload.uploadtime) || 0),
    players,
    winnerPlayer,
    teamSize,
    fainted,
    remaining: {
      p1: Math.max(0, teamSize.p1 - fainted.p1),
      p2: Math.max(0, teamSize.p2 - fainted.p2),
    },
    preview,
    revealed,
    broughtComplete: false,
    koAttributionAvailable: false,
  };
}

function teamAliases(team) {
  return new Set([team?.name, team?.claimedBy, ...(team?.showdownNames || [])].map(showdownId).filter(Boolean));
}

export function matchReplayParticipants(replay, teamA, teamB) {
  const a = teamAliases(teamA);
  const b = teamAliases(teamB);
  const p1 = showdownId(replay?.players?.p1);
  const p2 = showdownId(replay?.players?.p2);
  const direct = a.has(p1) && b.has(p2);
  const reversed = a.has(p2) && b.has(p1);
  return {
    status: direct !== reversed ? "matched" : direct && reversed ? "ambiguous" : "needs-confirmation",
    mapping: direct !== reversed ? (direct ? "p1-is-a" : "p1-is-b") : null,
  };
}

export function buildShowdownSeries(replays, mappings) {
  if (!Array.isArray(replays) || replays.length < 1 || replays.length > 5) throw new Error("Analyze one to five completed replays.");
  const seen = new Set();
  const games = replays.map((replay, index) => {
    if (seen.has(replay.id)) throw new Error("The same replay cannot be used twice.");
    seen.add(replay.id);
    const mapping = mappings?.[index];
    if (!['p1-is-a', 'p1-is-b'].includes(mapping)) throw new Error(`Confirm the participants for game ${index + 1}.`);
    const p1Side = mapping === "p1-is-a" ? "A" : "B";
    const winnerSide = replay.winnerPlayer === "p1" ? p1Side : (p1Side === "A" ? "B" : "A");
    const playerA = mapping === "p1-is-a" ? replay.players.p1 : replay.players.p2;
    const playerB = mapping === "p1-is-a" ? replay.players.p2 : replay.players.p1;
    const keyA = mapping === "p1-is-a" ? "p1" : "p2";
    const keyB = keyA === "p1" ? "p2" : "p1";
    return {
      id: replay.id, url: replay.url, format: replay.format, gameType: replay.gameType, uploadedAt: replay.uploadedAt,
      playerA, playerB, winnerSide,
      remainingA: replay.remaining[keyA], remainingB: replay.remaining[keyB],
      faintedA: replay.fainted[keyA], faintedB: replay.fainted[keyB],
      revealedA: replay.revealed[keyA], revealedB: replay.revealed[keyB],
      mappingConfirmed: true,
    };
  });
  const gamesA = games.filter((game) => game.winnerSide === "A").length;
  const gamesB = games.length - gamesA;
  const bestOf = games.length === 1 ? 1 : Math.max(gamesA, gamesB) === 2 && games.length <= 3 ? 3 : 5;
  const winsNeeded = (bestOf + 1) / 2;
  if (!((gamesA === winsNeeded && gamesB < winsNeeded) || (gamesB === winsNeeded && gamesA < winsNeeded))) throw new Error("These replays do not form a completed best-of-1, best-of-3, or best-of-5 series.");
  return {
    bestOf,
    gamesA,
    gamesB,
    monsAliveA: games.filter((game) => game.winnerSide === "A").reduce((sum, game) => sum + game.remainingA, 0),
    monsAliveB: games.filter((game) => game.winnerSide === "B").reduce((sum, game) => sum + game.remainingB, 0),
    games: games.map((game) => ({ winner: game.winnerSide, alive: game.winnerSide === "A" ? game.remainingA : game.remainingB })),
    showdownReplays: games,
  };
}

export const SHOWDOWN_REPLAY_CONTRACT = Object.freeze({
  host: "replay.pokemonshowdown.com",
  maximumReplays: 5,
  maximumLogBytes: MAX_LOG_BYTES,
  supportedGameTypes: ["singles", "doubles"],
  storesRawLog: false,
  infersKnockouts: false,
  infersUnrevealedPokemon: false,
});
