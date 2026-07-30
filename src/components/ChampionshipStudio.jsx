"use client";

import React, { useMemo, useState } from "react";

const THEMES = {
  night: { name: "Championship Night", bg: "#10121C", panel: "#171A2C", accent: "#FFD23F", secondary: "#4FD1C5", text: "#EDEBFA", muted: "#9A9FBD" },
  legacy: { name: "Legacy Gold", bg: "#17130D", panel: "#261E12", accent: "#E6B94A", secondary: "#F5E6B3", text: "#FFF9E8", muted: "#C4B78F" },
  electric: { name: "Electric Teal", bg: "#07191B", panel: "#0C292C", accent: "#4FD1C5", secondary: "#FFD23F", text: "#EEFFFF", muted: "#91B9BC" },
};

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function splitLines(ctx, text, maxWidth) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

async function downloadCanvas(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function pokemonApiSlug(name) {
  let value = safeText(name).toLowerCase();
  const regionalPatterns = [
    [/^alolan (.+)/, "$1-alola"],
    [/^galarian (.+)/, "$1-galar"],
    [/^hisuian (.+)/, "$1-hisui"],
    [/^paldean tauros \(water\)$/, "tauros-paldea-aqua-breed"],
    [/^paldean tauros \(fire\)$/, "tauros-paldea-blaze-breed"],
    [/^paldean tauros$/, "tauros-paldea-combat-breed"],
    [/^paldean (.+)/, "$1-paldea"],
  ];
  for (const [pattern, replacement] of regionalPatterns) {
    if (pattern.test(value)) {
      value = value.replace(pattern, replacement);
      break;
    }
  }
  if (/^mega /.test(value)) {
    value = value.replace(/^mega /, "");
    if (/ x$/.test(value)) value = value.replace(/ x$/, "") + "-mega-x";
    else if (/ y$/.test(value)) value = value.replace(/ y$/, "") + "-mega-y";
    else value += "-mega";
  }
  return value.replace(/[().:'’%]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

async function loadImage(url) {
  if (!url) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function loadRosterArtwork(roster) {
  return await Promise.all((roster || []).map(async (mon) => {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonApiSlug(mon.name)}`);
      if (!response.ok) return null;
      const data = await response.json();
      const url = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
      return await loadImage(url);
    } catch {
      return null;
    }
  }));
}

function collectPlayoffMatches(playoffs, championId, championName) {
  const results = [];
  const seen = new Set();
  function walk(value, path = []) {
    if (!value || typeof value !== "object") return;
    const hasScore = Number.isFinite(value.gamesA) && Number.isFinite(value.gamesB);
    if (hasScore) {
      const teamA = value.teamA ?? value.a ?? value.teamAId;
      const teamB = value.teamB ?? value.b ?? value.teamBId;
      const winner = value.winner ?? value.winnerId;
      const key = `${path.join("-")}-${value.gamesA}-${value.gamesB}`;
      if (!seen.has(key)) {
        seen.add(key);
        const involvesChampion = [teamA, teamB, winner].some((entry) => entry === championId || entry === championName);
        results.push({
          label: path.filter((part) => !/results|rounds/i.test(part)).slice(-2).join(" / ") || "Playoffs",
          score: `${value.gamesA}-${value.gamesB}`,
          teamA,
          teamB,
          winner,
          involvesChampion,
        });
      }
    }
    Object.entries(value).forEach(([key, child]) => {
      if (child && typeof child === "object") walk(child, [...path, key]);
    });
  }
  walk(playoffs);
  return results.slice(-8);
}

async function drawArtwork({ season, title, subtitle, coachName, themeKey, format }) {
  const isSocial = format === "social";
  const width = isSocial ? 1080 : 2400;
  const height = isSocial ? 1080 : 3000;
  const scale = width / 1080;
  const px = (value) => value * scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const theme = THEMES[themeKey] || THEMES.night;
  const champion = season.champion || {};
  const championId = champion.teamId;
  const team = season.teams?.[championId] || season.standings?.find((row) => row.id === championId) || {};
  const roster = championId == null ? [] : (season.rosters?.[championId] || []);
  const standings = (season.standings || []).slice();
  const championStanding = standings.find((row) => row.id === championId);
  const playoffMatches = collectPlayoffMatches(season.playoffs, championId, champion.teamName);
  const rosterArtwork = await loadRosterArtwork(roster);
  const pad = px(isSocial ? 64 : 76);
  const innerWidth = width - pad * 2;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.bg);
  gradient.addColorStop(1, theme.panel);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = px(2);
  for (let x = -height; x < width; x += px(70)) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, width, px(12));
  ctx.font = `800 ${px(isSocial ? 22 : 24)}px Arial, sans-serif`;
  ctx.fillStyle = theme.secondary;
  ctx.fillText("DRAFTCENTER  •  SEASON CHAMPIONSHIP", pad, pad + px(18));

  ctx.font = `900 ${px(isSocial ? 66 : 78)}px Arial, sans-serif`;
  ctx.fillStyle = theme.text;
  let y = pad + px(110);
  splitLines(ctx, title, innerWidth).slice(0, 2).forEach((line) => {
    ctx.fillText(line, pad, y);
    y += px(isSocial ? 72 : 86);
  });
  ctx.font = `500 ${px(isSocial ? 22 : 25)}px Arial, sans-serif`;
  ctx.fillStyle = theme.muted;
  ctx.fillText(subtitle, pad, y + px(4));
  y += px(isSocial ? 38 : 64);

  roundedRect(ctx, pad, y, innerWidth, px(isSocial ? 190 : 286), px(28));
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}99`;
  ctx.lineWidth = px(2);
  ctx.stroke();

  const markSize = px(isSocial ? 104 : 168);
  const markX = pad + px(30);
  const markY = y + px(isSocial ? 34 : 34);
  ctx.fillStyle = team.color || theme.accent;
  ctx.beginPath();
  ctx.arc(markX + markSize / 2, markY + markSize / 2, markSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.bg;
  ctx.textAlign = "center";
  ctx.font = `900 ${px(isSocial ? 50 : 78)}px Arial, sans-serif`;
  ctx.fillText(safeText(champion.teamName, "?")[0].toUpperCase(), markX + markSize / 2, markY + markSize * 0.72);
  ctx.textAlign = "left";

  const championX = markX + markSize + px(36);
  ctx.fillStyle = theme.accent;
  ctx.font = `800 ${px(isSocial ? 20 : 23)}px Arial, sans-serif`;
  ctx.fillText("LEAGUE CHAMPION", championX, y + px(isSocial ? 48 : 58));
  ctx.fillStyle = theme.text;
  ctx.font = `900 ${px(isSocial ? 36 : 54)}px Arial, sans-serif`;
  splitLines(ctx, safeText(champion.teamName, "Champion"), innerWidth - (championX - pad) - px(30)).slice(0, 2).forEach((line, index) => {
    ctx.fillText(line, championX, y + px((isSocial ? 92 : 112) + index * (isSocial ? 42 : 55)));
  });
  ctx.fillStyle = theme.muted;
  ctx.font = `500 ${px(isSocial ? 18 : 22)}px Arial, sans-serif`;
  const record = championStanding ? `${championStanding.w}-${championStanding.l} regular-season record` : "Season champion";
  ctx.fillText(coachName ? `${coachName}  •  ${record}` : record, championX, y + px(isSocial ? 158 : 244));
  y += px(isSocial ? 212 : 330);

  const sectionGap = px(22);
  const boxWidth = isSocial ? innerWidth : (innerWidth - sectionGap) / 2;
  const standingsHeight = px(isSocial ? 218 : 610);
  roundedRect(ctx, pad, y, boxWidth, standingsHeight, px(22));
  ctx.fillStyle = `${theme.panel}EE`;
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.font = `800 ${px(22)}px Arial, sans-serif`;
  ctx.fillText("FINAL STANDINGS", pad + px(28), y + px(44));
  const maxRows = isSocial ? 4 : 10;
  standings.slice(0, maxRows).forEach((row, index) => {
    const rowY = y + px((isSocial ? 76 : 82) + index * (isSocial ? 34 : 48));
    ctx.fillStyle = row.id === championId ? `${theme.accent}22` : index % 2 ? `${theme.text}08` : "transparent";
    ctx.fillRect(pad + px(18), rowY - px(isSocial ? 24 : 28), boxWidth - px(36), px(isSocial ? 31 : 42));
    ctx.fillStyle = row.id === championId ? theme.accent : theme.text;
    ctx.font = `${row.id === championId ? "800" : "600"} ${px(isSocial ? 16 : 20)}px Arial, sans-serif`;
    ctx.fillText(`${index + 1}. ${safeText(row.name)}`.slice(0, 34), pad + px(30), rowY);
    ctx.textAlign = "right";
    ctx.fillText(`${row.w}-${row.l}  ${(row.differential || 0) > 0 ? "+" : ""}${row.differential || 0}`, pad + boxWidth - px(30), rowY);
    ctx.textAlign = "left";
  });

  if (!isSocial) {
    const rightX = pad + boxWidth + sectionGap;
    roundedRect(ctx, rightX, y, boxWidth, standingsHeight, px(22));
    ctx.fillStyle = `${theme.panel}EE`;
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = `800 ${px(22)}px Arial, sans-serif`;
    ctx.fillText(playoffMatches.length ? "PLAYOFF BRACKET" : "CHAMPIONSHIP RUN", rightX + px(28), y + px(44));
    const teamName = (teamId) => season.teams?.[teamId]?.name || season.standings?.find((row) => row.id === teamId)?.name || "";
    const facts = playoffMatches.length
      ? playoffMatches.map((result) => {
        const names = [teamName(result.teamA), teamName(result.teamB)].filter(Boolean);
        return `${result.label}${names.length === 2 ? ` • ${names.join(" vs ")}` : ""}: ${result.score}`;
      })
      : [
        "Playoff bracket completed",
        season.playoffMVP ? `Playoff MVP: ${season.playoffMVP}` : null,
        season.regularSeasonChampions?.some((entry) => entry.teamId === championId) ? "Regular-season champion" : null,
        season.dynasty ? `Dynasty: ${season.dynasty}` : null,
      ].filter(Boolean);
    facts.forEach((fact, index) => {
      const factY = y + px(96 + index * 64);
      ctx.fillStyle = index === facts.length - 1 && /MVP|champion|Dynasty/i.test(fact) ? theme.secondary : theme.text;
      ctx.font = `600 ${px(20)}px Arial, sans-serif`;
      ctx.fillText("◆", rightX + px(30), factY);
      splitLines(ctx, fact, boxWidth - px(95)).slice(0, 2).forEach((line, lineIndex) => {
        ctx.fillText(line, rightX + px(62), factY + lineIndex * px(25));
      });
    });
  }
  y += standingsHeight + sectionGap;

  const rosterHeight = height - y - pad - px(44);
  roundedRect(ctx, pad, y, innerWidth, rosterHeight, px(22));
  ctx.fillStyle = `${theme.panel}EE`;
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.font = `800 ${px(22)}px Arial, sans-serif`;
  ctx.fillText("CHAMPIONSHIP ROSTER", pad + px(28), y + px(44));
  const columns = isSocial ? 3 : 4;
  const cellWidth = (innerWidth - px(56)) / columns;
  const cellHeight = px(isSocial ? 48 : 72);
  roster.slice(0, isSocial ? 9 : 20).forEach((mon, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cellX = pad + px(28) + col * cellWidth;
    const cellY = y + px(78) + row * cellHeight;
    ctx.fillStyle = `${theme.text}0A`;
    roundedRect(ctx, cellX, cellY, cellWidth - px(12), cellHeight - px(12), px(12));
    ctx.fill();
    const artSize = px(isSocial ? 38 : 58);
    if (rosterArtwork[index]) {
      ctx.drawImage(rosterArtwork[index], cellX + px(4), cellY - px(2), artSize, artSize);
    } else {
      ctx.fillStyle = theme.secondary;
      ctx.beginPath();
      ctx.arc(cellX + px(20), cellY + (cellHeight - px(12)) / 2, px(6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = theme.text;
    ctx.font = `700 ${px(isSocial ? 14 : 20)}px Arial, sans-serif`;
    ctx.fillText(safeText(mon.name).slice(0, 22), cellX + px(isSocial ? 46 : 67), cellY + (cellHeight - px(12)) / 2 + px(isSocial ? 5 : 7));
  });

  ctx.fillStyle = theme.muted;
  ctx.font = `500 ${px(16)}px Arial, sans-serif`;
  ctx.fillText(`Generated from the final DraftCenter Season ${season.seasonNumber} record`, pad, height - px(30));
  ctx.textAlign = "right";
  ctx.fillText("draftcentral.gg", width - pad, height - px(30));
  ctx.textAlign = "left";
  return canvas;
}

export default function ChampionshipStudio({ season }) {
  const championId = season?.champion?.teamId;
  const championRow = season?.standings?.find((row) => row.id === championId);
  const defaultCoach = championRow?.claimedBy || season?.teams?.[championId]?.claimedBy || "";
  const defaults = useMemo(() => ({
    title: safeText(season?.homepage?.title, `Season ${season?.seasonNumber || ""} Champions`),
    subtitle: `Season ${season?.seasonNumber || ""} • Official Championship Record`,
    coachName: defaultCoach,
  }), [season, defaultCoach]);
  const [title, setTitle] = useState(defaults.title);
  const [subtitle, setSubtitle] = useState(defaults.subtitle);
  const [coachName, setCoachName] = useState(defaults.coachName);
  const [themeKey, setThemeKey] = useState("night");
  const [exporting, setExporting] = useState("");
  const [message, setMessage] = useState("");

  if (!season?.champion?.teamName) {
    return <p className="text-sm" style={{ color: "#9A9FBD" }}>This season does not have a recorded champion, so championship artwork cannot be generated yet.</p>;
  }

  async function exportArtwork(format) {
    setExporting(format);
    setMessage("Loading Pokémon artwork…");
    try {
      const canvas = await drawArtwork({ season, title, subtitle, coachName, themeKey, format });
      if (!canvas) throw new Error("Canvas unavailable");
      const slug = safeText(season.champion.teamName, "champion").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await downloadCanvas(canvas, `${slug}-season-${season.seasonNumber}-${format === "social" ? "social-1080" : "print-8x10-300dpi"}.png`);
      setMessage("Download created.");
    } catch {
      setMessage("The artwork could not be downloaded. Please try again.");
    } finally {
      setExporting("");
    }
  }

  return (
    <section className="rounded-lg p-5 mt-5" style={{ background: "#171A2C", border: "1px solid #FFD23F66" }}>
      <span className="eyebrow">PRO LEAGUE WORKSHOP</span>
      <h3 className="display-font text-2xl mt-1" style={{ color: "#FFD23F" }}>CHAMPIONSHIP STUDIO</h3>
      <p className="text-sm mt-1 mb-5" style={{ color: "#9A9FBD" }}>Review the presentation details, choose a design, and create artwork directly from this archived season. Nothing here changes the official results.</p>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3">
          <label className="text-sm" style={{ color: "#EDEBFA" }}>Artwork title<input value={title} maxLength={70} onChange={(event) => setTitle(event.target.value)} className="w-full rounded px-3 py-2 mt-1" style={{ background: "#10121C", border: "1px solid rgba(255,255,255,0.12)" }} /></label>
          <label className="text-sm" style={{ color: "#EDEBFA" }}>Season line<input value={subtitle} maxLength={80} onChange={(event) => setSubtitle(event.target.value)} className="w-full rounded px-3 py-2 mt-1" style={{ background: "#10121C", border: "1px solid rgba(255,255,255,0.12)" }} /></label>
          <label className="text-sm" style={{ color: "#EDEBFA" }}>Champion / coach name<input value={coachName} maxLength={50} onChange={(event) => setCoachName(event.target.value)} placeholder="Optional" className="w-full rounded px-3 py-2 mt-1" style={{ background: "#10121C", border: "1px solid rgba(255,255,255,0.12)" }} /></label>
        </div>
        <div>
          <p className="text-sm mb-2" style={{ color: "#EDEBFA" }}>Design</p>
          <div className="grid gap-2">
            {Object.entries(THEMES).map(([key, theme]) => <button type="button" key={key} onClick={() => setThemeKey(key)} className="rounded p-3 text-left" style={{ background: theme.bg, color: theme.text, border: `2px solid ${themeKey === key ? theme.accent : "rgba(255,255,255,0.08)"}` }}><span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: theme.accent }} /><strong>{theme.name}</strong></button>)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" disabled={Boolean(exporting)} onClick={() => exportArtwork("print")} className="px-4 py-2 rounded font-semibold disabled:opacity-60" style={{ background: "#FFD23F", color: "#10121C" }}>{exporting === "print" ? "Creating print…" : "Download 8×10 print PNG"}</button>
        <button type="button" disabled={Boolean(exporting)} onClick={() => exportArtwork("social")} className="px-4 py-2 rounded font-semibold disabled:opacity-60" style={{ background: "#4FD1C5", color: "#10121C" }}>{exporting === "social" ? "Creating social image…" : "Download square social PNG"}</button>
      </div>
      {message && <p className="text-sm mt-3" role="status" style={{ color: message.includes("could not") ? "#F0555A" : "#4FD1C5" }}>{message}</p>}
      <p className="text-xs mt-3" style={{ color: "#5B5F7E" }}>Print export: 2400×3000 pixels (8×10 inches at 300 DPI). Social export: 1080×1080 pixels.</p>
    </section>
  );
}
