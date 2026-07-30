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

function playoffRows(playoffs) {
  const rows = [];
  function walk(value, path = []) {
    if (!value || typeof value !== "object") return;
    if (Number.isFinite(value.gamesA) && Number.isFinite(value.gamesB)) {
      rows.push({
        label: path.filter((part) => !/results|rounds/i.test(part)).slice(-2).join(" / ") || "Playoffs",
        teamA: value.teamA ?? value.a ?? value.teamAId,
        teamB: value.teamB ?? value.b ?? value.teamBId,
        score: `${value.gamesA}-${value.gamesB}`,
      });
    }
    Object.entries(value).forEach(([key, child]) => {
      if (child && typeof child === "object") walk(child, [...path, key]);
    });
  }
  walk(playoffs);
  return rows.slice(-8);
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
  const matches = playoffRows(season.playoffs);
  const teamName = (id) => season.teams?.[id]?.name || season.standings?.find((row) => row.id === id)?.name || "";
  const record = championStanding ? `${championStanding.w}-${championStanding.l} regular-season record` : "Season champion";

  const standingSvg = standings.map((row, index) => {
    const y = 1115 + index * 92;
    const active = row.id === championId;
    return `<rect x="170" y="${y - 52}" width="970" height="72" rx="12" fill="${active ? theme.accent : theme.text}" opacity="${active ? ".15" : index % 2 ? ".05" : "0"}"/>
      ${textPath(`${index + 1}. ${String(row.name || "").slice(0, 28)}`, 200, y, { size: 36, weight: active ? 900 : 700, fill: active ? theme.accent : theme.text })}
      ${textPath(`${row.w}-${row.l}  ${(row.differential || 0) > 0 ? "+" : ""}${row.differential || 0}`, 1090, y, { size: 34, weight: 700, fill: active ? theme.accent : theme.text, anchor: "end" })}`;
  }).join("");

  const matchSvg = (matches.length ? matches : [{ label: "Championship", score: "Complete" }]).map((match, index) => {
    const y = 1115 + index * 110;
    const names = [teamName(match.teamA), teamName(match.teamB)].filter(Boolean);
    return `<rect x="1260" y="${y - 60}" width="970" height="88" rx="14" fill="${theme.text}" opacity=".06"/>
      ${textPath(match.label, 1290, y - 20, { size: 24, weight: 400, fill: theme.muted })}
      ${textPath(names.length === 2 ? names.join(" vs ") : "Playoff matchup", 1290, y + 17, { size: 28, weight: 700, fill: theme.text })}
      ${textPath(match.score, 2195, y, { size: 38, weight: 900, fill: theme.accent, anchor: "end" })}`;
  }).join("");

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
    <rect x="150" y="980" width="1010" height="1080" rx="36" fill="${theme.panel}" opacity=".96"/>
    <rect x="1240" y="980" width="1010" height="1080" rx="36" fill="${theme.panel}" opacity=".96"/>
    ${textPath("FINAL STANDINGS", 200, 1045, { size: 44, weight: 700, fill: theme.accent })}
    ${textPath(matches.length ? "PLAYOFF BRACKET" : "CHAMPIONSHIP RUN", 1290, 1045, { size: 44, weight: 700, fill: theme.accent })}
    <g>${standingSvg}${matchSvg}</g>
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
