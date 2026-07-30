import sharp from "sharp";
import opentype from "opentype.js";
import { readFile } from "node:fs/promises";
import { createAdminClient } from "../../../lib/supabase/admin.js";

export const runtime = "nodejs";
export const maxDuration = 30;

const embeddedFonts = Promise.all([
  readFile(new URL("../../../assets/fonts/inter-400.ttf", import.meta.url)),
  readFile(new URL("../../../assets/fonts/inter-700.ttf", import.meta.url)),
  readFile(new URL("../../../assets/fonts/inter-900.ttf", import.meta.url)),
]).then(([regular, bold, black]) => {
  const parse = (buffer) => opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  return { regular: parse(regular), bold: parse(bold), black: parse(black) };
});

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function pokemonApiSlug(name) {
  let value = String(name || "").toLowerCase().trim();
  const regionalPatterns = [
    [/^alolan (.+)/, "$1-alola"], [/^galarian (.+)/, "$1-galar"], [/^hisuian (.+)/, "$1-hisui"],
    [/^paldean tauros \(water\)$/, "tauros-paldea-aqua-breed"],
    [/^paldean tauros \(fire\)$/, "tauros-paldea-blaze-breed"],
    [/^paldean tauros$/, "tauros-paldea-combat-breed"], [/^paldean (.+)/, "$1-paldea"],
  ];
  for (const [pattern, replacement] of regionalPatterns) {
    if (pattern.test(value)) { value = value.replace(pattern, replacement); break; }
  }
  if (/^mega /.test(value)) {
    value = value.replace(/^mega /, "");
    if (/ x$/.test(value)) value = value.replace(/ x$/, "") + "-mega-x";
    else if (/ y$/.test(value)) value = value.replace(/ y$/, "") + "-mega-y";
    else value += "-mega";
  }
  return value.replace(/[().:'’%]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

async function artworkDataUri(name) {
  try {
    const pokemon = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiSlug(name)}`, { cache: "force-cache" });
    if (!pokemon.ok) return "";
    const data = await pokemon.json();
    const imageUrl = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
    if (!imageUrl) return "";
    const image = await fetch(imageUrl, { cache: "force-cache" });
    if (!image.ok) return "";
    const type = image.headers.get("content-type") || "image/png";
    return `data:${type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  } catch {
    return "";
  }
}

function seedPairOrder(bracketSize) {
  let order = [1, 2];
  while (order.length < bracketSize) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order;
}

function playoffRounds(playoffs) {
  if (!playoffs?.bracketSize || !Array.isArray(playoffs.seeds)) return [];
  const order = seedPairOrder(playoffs.bracketSize);
  let currentTeams = order.map((seed) => ({ teamId: playoffs.seeds[seed - 1] ?? null, seed }));
  const rounds = [];
  let roundIndex = 0;
  while (currentTeams.length >= 2) {
    const matches = [];
    const winners = [];
    for (let index = 0; index < currentTeams.length; index += 2) {
      const left = currentTeams[index] || {};
      const right = currentTeams[index + 1] || {};
      const result = playoffs.results?.[`${roundIndex}-${index / 2}`];
      let winner = null;
      if (left.teamId != null && right.teamId != null && result) {
        winner = result.gamesA > result.gamesB ? left : result.gamesB > result.gamesA ? right : null;
      } else if (roundIndex === 0 && left.teamId != null && right.teamId == null) {
        winner = left;
      } else if (roundIndex === 0 && right.teamId != null && left.teamId == null) {
        winner = right;
      }
      matches.push({ a: left.teamId ?? null, b: right.teamId ?? null, seedA: left.seed, seedB: right.seed, result });
      winners.push(winner);
    }
    rounds.push(matches);
    if (matches.length === 1) break;
    currentTeams = winners.map((winner) => winner || { teamId: null, seed: null });
    roundIndex++;
  }
  return rounds;
}

function winnerOfRounds(rounds) {
  const final = rounds.at(-1)?.[0];
  if (!final) return null;
  if (final.a != null && final.b == null) return final.a;
  if (final.b != null && final.a == null) return final.b;
  if (!final.result) return null;
  return final.result.gamesA > final.result.gamesB ? final.a : final.result.gamesB > final.result.gamesA ? final.b : null;
}

function posterPlayoffRounds(playoffs) {
  if (!playoffs) return [];
  if (playoffs.mode !== "divisions") return playoffRounds(playoffs);

  const divisionBrackets = Array.isArray(playoffs.divisionBrackets) ? playoffs.divisionBrackets : [];
  const divisionRounds = divisionBrackets.map((bracket) => playoffRounds(bracket));
  const divisionChampions = divisionRounds.map(winnerOfRounds);
  const divisionOrder = playoffs.championBracket?.divisionOrder || divisionBrackets.map((_, index) => index);
  const orderedDivisionRounds = divisionOrder.map((divisionIndex) => divisionRounds[divisionIndex]).filter((rounds) => rounds?.length);
  const combinedDivisionRounds = [];
  const divisionRoundCount = Math.max(0, ...orderedDivisionRounds.map((rounds) => rounds.length));
  for (let roundIndex = 0; roundIndex < divisionRoundCount; roundIndex++) {
    combinedDivisionRounds.push(orderedDivisionRounds.flatMap((rounds) => rounds[roundIndex] || []));
  }

  const championBracket = playoffs.championBracket || {};
  const championSeeds = divisionOrder.map((divisionIndex) => divisionIndex == null ? null : divisionChampions[divisionIndex]);
  const championshipRounds = playoffRounds({ ...championBracket, seeds: championSeeds });
  return [...combinedDivisionRounds, ...championshipRounds];
}

export async function renderPoster({ season, title, subtitle, coachName, themeKey }) {
  const fonts = await embeddedFonts;
  const themes = {
    night: { bg: "#10121C", panel: "#171A2C", accent: "#FFD23F", secondary: "#4FD1C5", text: "#EDEBFA", muted: "#9A9FBD" },
    legacy: { bg: "#17130D", panel: "#261E12", accent: "#E6B94A", secondary: "#F5E6B3", text: "#FFF9E8", muted: "#C4B78F" },
    electric: { bg: "#07191B", panel: "#0C292C", accent: "#4FD1C5", secondary: "#FFD23F", text: "#EEFFFF", muted: "#91B9BC" },
  };
  const theme = themes[themeKey] || themes.night;
  const textPath = (value, x, y, { size, weight = 700, fill = theme.text, anchor = "start" } = {}) => {
    const font = Number(weight) >= 850 ? fonts.black : Number(weight) >= 600 ? fonts.bold : fonts.regular;
    const text = String(value ?? "");
    const width = font.getAdvanceWidth(text, size);
    const startX = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
    return `<path d="${font.getPath(text, startX, y, size).toPathData(2)}" fill="${fill}"/>`;
  };
  const championId = season.champion?.teamId;
  const championName = season.champion?.teamName || "Champion";
  const team = season.teams?.[championId] || season.standings?.find((row) => row.id === championId) || {};
  const standings = (season.standings || []).slice(0, 10);
  const championStanding = standings.find((row) => row.id === championId);
  const roster = (season.rosters?.[championId] || []).slice(0, 20);
  const artwork = await Promise.all(roster.map((mon) => artworkDataUri(mon.name)));
  const teamName = (id) => season.teams?.[id]?.name || season.standings?.find((row) => row.id === id)?.name || "";
  const record = championStanding ? `${championStanding.w}-${championStanding.l} regular-season record` : "Season champion";
  const placement = Math.max(1, standings.findIndex((row) => row.id === championId) + 1);
  const ordinal = (value) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
  const differential = Number(championStanding?.differential) || 0;
  const rounds = posterPlayoffRounds(season.playoffs);

  const bracketSvg = (() => {
    if (!rounds.length) {
      return `${textPath("Championship complete", 1200, 1605, { size: 64, weight: 900, fill: theme.text, anchor: "middle" })}
        ${textPath("The final bracket was not saved for this season.", 1200, 1680, { size: 34, weight: 400, fill: theme.muted, anchor: "middle" })}`;
    }
    const panelX = 190;
    const panelY = 1330;
    const panelW = 2020;
    const panelH = 640;
    const columnGap = rounds.length > 2 ? 95 : 150;
    const boxW = Math.min(650, (panelW - columnGap * (rounds.length - 1)) / rounds.length);
    const boxH = 128;
    const columnStep = boxW + columnGap;
    const firstCount = rounds[0].length;
    const firstCenters = Array.from({ length: firstCount }, (_, index) => panelY + 90 + ((panelH - 130) * (index + .5)) / firstCount);
    const centers = [firstCenters];
    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      centers.push(rounds[roundIndex].map((_, matchIndex) => {
        const feeders = centers[roundIndex - 1];
        return (feeders[matchIndex * 2] + (feeders[matchIndex * 2 + 1] ?? feeders[matchIndex * 2])) / 2;
      }));
    }
    const connectors = [];
    for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
      const fromX = panelX + roundIndex * columnStep + boxW;
      const toX = panelX + (roundIndex + 1) * columnStep;
      const elbowX = (fromX + toX) / 2;
      centers[roundIndex].forEach((center, matchIndex) => {
        const nextCenter = centers[roundIndex + 1][Math.floor(matchIndex / 2)];
        connectors.push(`<path d="M ${fromX} ${center} H ${elbowX} V ${nextCenter} H ${toX}" fill="none" stroke="${theme.accent}" stroke-opacity=".42" stroke-width="5"/>`);
      });
    }
    const boxes = rounds.flatMap((round, roundIndex) => {
      const x = panelX + roundIndex * columnStep;
      const label = roundIndex === rounds.length - 1 ? "FINAL" : roundIndex === rounds.length - 2 ? "SEMIFINALS" : roundIndex === rounds.length - 3 ? "QUARTERFINALS" : `ROUND ${roundIndex + 1}`;
      const labelSvg = textPath(label, x + boxW / 2, 1320, { size: 30, weight: 900, fill: theme.accent, anchor: "middle" });
      const matchSvgs = round.map((match, matchIndex) => {
        const center = centers[roundIndex][matchIndex];
        const y = center - boxH / 2;
        const scoreA = Number.isFinite(match.result?.gamesA) ? String(match.result.gamesA) : "–";
        const scoreB = Number.isFinite(match.result?.gamesB) ? String(match.result.gamesB) : "–";
        const aWon = match.result && match.result.gamesA > match.result.gamesB;
        const bWon = match.result && match.result.gamesB > match.result.gamesA;
        const nameLimit = rounds.length >= 4 ? 18 : rounds.length === 3 ? 22 : 28;
        const row = (teamId, seed, score, won, rowY) => {
          const name = teamId == null ? "BYE" : teamName(teamId) || "Team";
          return `${won ? `<rect x="${x + 8}" y="${rowY - 39}" width="${boxW - 16}" height="54" rx="10" fill="${theme.accent}" opacity=".15"/>` : ""}
            ${seed ? textPath(seed, x + 30, rowY, { size: 24, weight: 700, fill: theme.muted }) : ""}
            ${textPath(name.slice(0, nameLimit), x + 72, rowY, { size: 27, weight: won ? 900 : 700, fill: won ? theme.accent : theme.text })}
            ${textPath(score, x + boxW - 28, rowY, { size: 30, weight: 900, fill: won ? theme.accent : theme.text, anchor: "end" })}`;
        };
        return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="18" fill="${theme.bg}" stroke="${theme.text}" stroke-opacity=".14" stroke-width="3"/>
          <line x1="${x + 15}" y1="${center}" x2="${x + boxW - 15}" y2="${center}" stroke="${theme.text}" stroke-opacity=".1" stroke-width="2"/>
          ${row(match.a, match.seedA, scoreA, aWon, center - 18)}
          ${row(match.b, match.seedB, scoreB, bWon, center + 48)}`;
      }).join("");
      return [labelSvg, matchSvgs];
    }).join("");
    return `${connectors.join("")}${boxes}`;
  })();

  const rosterSvg = roster.map((mon, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 170 + column * 535;
    const y = 2245 + row * 125;
    return `<rect x="${x}" y="${y}" width="500" height="98" rx="18" fill="${theme.text}" opacity=".06"/>
      ${artwork[index] ? `<image href="${artwork[index]}" x="${x + 8}" y="${y + 3}" width="90" height="90" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="${x + 48}" cy="${y + 49}" r="10" fill="${theme.secondary}"/>`}
      ${textPath(String(mon.name || "").slice(0, 24), x + 112, y + 61, { size: 30, weight: 700, fill: theme.text })}`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3000" viewBox="0 0 2400 3000">
    <rect width="2400" height="3000" fill="${theme.bg}"/>
    <defs><pattern id="lines" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="150" stroke="${theme.accent}" stroke-opacity=".07" stroke-width="4"/></pattern></defs>
    <rect width="2400" height="3000" fill="url(#lines)"/><rect width="2400" height="28" fill="${theme.accent}"/>
    ${textPath("DRAFTCENTER  •  SEASON CHAMPIONSHIP", 150, 165, { size: 50, weight: 700, fill: theme.secondary })}
    ${textPath(String(title || "").slice(0, 48), 150, 330, { size: 112, weight: 900, fill: theme.text })}
    ${textPath(String(subtitle || "").slice(0, 72), 150, 425, { size: 48, weight: 400, fill: theme.muted })}
    <rect x="150" y="520" width="2100" height="390" rx="42" fill="${theme.panel}" stroke="${theme.accent}" stroke-width="5"/>
    <circle cx="355" cy="715" r="125" fill="${safeColor(team.color, theme.accent)}"/>
    ${textPath(championName[0] || "?", 355, 760, { size: 125, weight: 900, fill: theme.bg, anchor: "middle" })}
    ${textPath("LEAGUE CHAMPION", 550, 650, { size: 48, weight: 700, fill: theme.accent })}
    ${textPath(championName.slice(0, 34), 550, 745, { size: 82, weight: 900, fill: theme.text })}
    ${textPath(coachName ? `${coachName}  •  ${record}` : record, 550, 825, { size: 40, weight: 400, fill: theme.muted })}
    <rect x="150" y="965" width="2100" height="185" rx="32" fill="${theme.panel}" opacity=".96"/>
    ${textPath("REGULAR SEASON", 200, 1035, { size: 38, weight: 900, fill: theme.accent })}
    ${textPath(`${ordinal(placement)} place`, 200, 1110, { size: 48, weight: 900, fill: theme.text })}
    ${textPath(championStanding ? `${championStanding.w}-${championStanding.l} record  •  ${differential > 0 ? "+" : ""}${differential} differential` : "Season record complete", 2195, 1107, { size: 40, weight: 700, fill: theme.muted, anchor: "end" })}
    <rect x="150" y="1190" width="2100" height="870" rx="36" fill="${theme.panel}" opacity=".96"/>
    ${textPath("PLAYOFF BRACKET", 200, 1260, { size: 44, weight: 900, fill: theme.accent })}
    <g>${bracketSvg}</g>
    <rect x="150" y="2130" width="2100" height="700" rx="36" fill="${theme.panel}" opacity=".96"/>
    ${textPath("CHAMPIONSHIP ROSTER", 200, 2205, { size: 44, weight: 700, fill: theme.accent })}
    <g>${rosterSvg}</g>
    ${textPath(`Generated from the final DraftCenter Season ${Number(season.seasonNumber) || ""} record`, 150, 2925, { size: 30, weight: 400, fill: theme.muted })}
    ${textPath("draftcentral.gg", 2250, 2925, { size: 30, weight: 400, fill: theme.muted, anchor: "end" })}
  </svg>`;
  return await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function POST(request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return Response.json({ error: "Sign in before creating championship artwork." }, { status: 401 });
    const body = await request.json();
    if (!body.leagueId || !body.season?.champion?.teamName) return Response.json({ error: "A completed league season is required." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: userResult } = await supabase.auth.getUser(token);
    if (!userResult?.user) return Response.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });
    const { data: membership } = await supabase.from("league_memberships").select("role").eq("league_id", body.leagueId).eq("user_id", userResult.user.id).maybeSingle();
    if (!membership) return Response.json({ error: "You no longer have access to this league." }, { status: 403 });

    const png = await renderPoster(body);
    const slug = String(body.season.champion.teamName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "champion";
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${slug}-season-${Number(body.season.seasonNumber) || 1}-print-8x10-300dpi.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Championship artwork generation failed", error);
    return Response.json({ error: "DraftCenter could not generate the print file." }, { status: 500 });
  }
}
