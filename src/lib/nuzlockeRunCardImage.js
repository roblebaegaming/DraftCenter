import { normalizeSavedNuzlockeResult } from "./nuzlockeRunExports.js";

const WIDTH = 1200;
const PAGE_PADDING = 54;
const COLUMN_COUNT = 3;
const CARD_GAP = 16;
const CARD_HEIGHT = 164;

const cleanText = (value, maxLength = 180) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
const titleCase = (value) => cleanText(value, 80).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function nuzlockeRunCardImageFilename(runName, gameName) {
  const base = cleanText(runName, 80) || `${cleanText(gameName, 80) || "nuzlocke"} run card`;
  const slug = base.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "nuzlocke-run-card"}.png`;
}

function roundedRect(context, x, y, width, height, radius = 14) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fitText(context, value, maxWidth) {
  const text = cleanText(value);
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened.trim()}…`;
}

function wrapText(context, value, maxWidth, maxLines = 2) {
  const words = cleanText(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.join(" ") !== words.join(" ") && lines.length) lines[lines.length - 1] = fitText(context, `${lines.at(-1)}…`, maxWidth);
  return lines;
}

function safeArtworkUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "raw.githubusercontent.com" ? url.toString() : "";
  } catch {
    return "";
  }
}

function loadArtwork(url) {
  const safeUrl = safeArtworkUrl(url);
  if (!safeUrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = safeUrl;
  });
}

async function loadTeamArtwork(team) {
  const artwork = new Array(team.length).fill(null);
  for (let start = 0; start < team.length; start += 10) {
    const batch = team.slice(start, start + 10);
    const loaded = await Promise.all(batch.map((entry) => loadArtwork(entry.artwork_url)));
    loaded.forEach((image, index) => { artwork[start + index] = image; });
  }
  return artwork;
}

function encounterDetails(entry) {
  if (entry.method === "starter") return "Starter Pokémon";
  const levels = entry.min_level == null
    ? ""
    : `Lv. ${entry.min_level}${entry.max_level != null && entry.max_level !== entry.min_level ? `–${entry.max_level}` : ""}`;
  return [titleCase(entry.method) || "Encounter", levels].filter(Boolean).join(" · ");
}

function drawCard(context, entry, artwork, index, x, y, width) {
  roundedRect(context, x, y, width, CARD_HEIGHT, 15);
  context.fillStyle = "#171d36";
  context.fill();
  context.strokeStyle = "#34446f";
  context.lineWidth = 2;
  context.stroke();

  context.beginPath();
  context.arc(x + 27, y + 27, 17, 0, Math.PI * 2);
  context.fillStyle = "#ffd23f";
  context.fill();
  context.fillStyle = "#151207";
  context.font = "900 15px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(String(index + 1), x + 27, y + 32);
  context.textAlign = "left";

  if (artwork) {
    context.drawImage(artwork, x + 20, y + 49, 88, 88);
  } else {
    context.fillStyle = "#232c4b";
    context.beginPath();
    context.arc(x + 64, y + 93, 39, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#9ca7cc";
    context.font = "800 30px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(cleanText(entry.pokemon_name, 1).toUpperCase(), x + 64, y + 103);
    context.textAlign = "left";
  }

  const textX = x + 120;
  const textWidth = width - 138;
  const displayedName = `${entry.pokemon_name}${entry.form_name ? ` (${entry.form_name})` : ""}`;
  context.fillStyle = "#ffffff";
  context.font = "800 20px Inter, Arial, sans-serif";
  context.fillText(fitText(context, displayedName, textWidth), textX, y + 34);

  context.fillStyle = "#4fd1c5";
  context.font = "700 14px Inter, Arial, sans-serif";
  wrapText(context, entry.area_name, textWidth, 2).forEach((line, lineIndex) => context.fillText(line, textX, y + 59 + lineIndex * 17));

  context.fillStyle = "#c2cae8";
  context.font = "600 13px Inter, Arial, sans-serif";
  context.fillText(fitText(context, encounterDetails(entry), textWidth), textX, y + 101);

  const catchName = entry.encounter_pokemon_name && entry.encounter_pokemon_name !== entry.pokemon_name
    ? `Catch ${entry.encounter_pokemon_name}${entry.encounter_form_name ? ` (${entry.encounter_form_name})` : ""}`
    : "";
  const note = catchName || (entry.conditions.length ? entry.conditions.map(titleCase).join(", ") : "No special conditions");
  context.fillStyle = "#8f9ac4";
  context.font = "500 11px Inter, Arial, sans-serif";
  wrapText(context, note, textWidth, 2).forEach((line, lineIndex) => context.fillText(line, textX, y + 125 + lineIndex * 14));
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The visual Run Card could not be created.")), "image/png"));
}

export async function downloadNuzlockeRunCardImage({ runName, result, rules = [], shareUrl = "" }) {
  if (typeof document === "undefined") throw new Error("The visual Run Card is only available in a browser.");
  const savedResult = normalizeSavedNuzlockeResult(result);
  if (!savedResult || !savedResult.team.length) throw new Error("A generated Nuzlocke team is required.");

  const safeRules = rules.map((rule) => cleanText(rule, 180)).filter(Boolean).slice(0, 18);
  const ruleRows = Math.ceil(safeRules.length / 2);
  const headerHeight = 194 + (ruleRows ? 50 + ruleRows * 25 : 0);
  const rowCount = Math.ceil(savedResult.team.length / COLUMN_COUNT);
  const height = headerHeight + rowCount * (CARD_HEIGHT + CARD_GAP) + 86;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The visual Run Card could not be created.");

  const background = context.createLinearGradient(0, 0, WIDTH, height);
  background.addColorStop(0, "#0d2530");
  background.addColorStop(0.38, "#0b1022");
  background.addColorStop(1, "#080b18");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, height);

  context.fillStyle = "#ffd23f";
  context.font = "900 18px Inter, Arial, sans-serif";
  context.fillText("DRAFTCENTER · NUZLOCKE RUN CARD", PAGE_PADDING, 52);
  context.fillStyle = "#ffffff";
  context.font = "900 46px Inter, Arial, sans-serif";
  context.fillText(fitText(context, cleanText(runName, 80) || `${savedResult.game.display_name} Nuzlocke Run`, WIDTH - PAGE_PADDING * 2), PAGE_PADDING, 108);
  context.fillStyle = "#4fd1c5";
  context.font = "700 21px Inter, Arial, sans-serif";
  context.fillText(`${savedResult.game.display_name} · ${savedResult.team.length} encounter${savedResult.team.length === 1 ? "" : "s"}`, PAGE_PADDING, 145);
  context.fillStyle = "#9fa9cf";
  context.font = "500 14px Inter, Arial, sans-serif";
  context.fillText(fitText(context, shareUrl ? "Share this image or use the saved run link in My Teams to recreate it." : "Generated from verified, game-specific encounters.", WIDTH - PAGE_PADDING * 2), PAGE_PADDING, 174);

  if (safeRules.length) {
    context.fillStyle = "#dce3ff";
    context.font = "800 15px Inter, Arial, sans-serif";
    context.fillText("RUN RULES", PAGE_PADDING, 218);
    context.font = "600 13px Inter, Arial, sans-serif";
    safeRules.forEach((rule, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = PAGE_PADDING + column * ((WIDTH - PAGE_PADDING * 2) / 2);
      const y = 248 + row * 25;
      context.fillStyle = "#ffd23f";
      context.fillText("•", x, y);
      context.fillStyle = "#b9c3e7";
      context.fillText(fitText(context, rule, (WIDTH - PAGE_PADDING * 2) / 2 - 28), x + 16, y);
    });
  }

  const artwork = await loadTeamArtwork(savedResult.team);
  const gridTop = headerHeight;
  const usableWidth = WIDTH - PAGE_PADDING * 2;
  const cardWidth = (usableWidth - CARD_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
  savedResult.team.forEach((entry, index) => {
    const column = index % COLUMN_COUNT;
    const row = Math.floor(index / COLUMN_COUNT);
    drawCard(context, entry, artwork[index], index, PAGE_PADDING + column * (cardWidth + CARD_GAP), gridTop + row * (CARD_HEIGHT + CARD_GAP), cardWidth);
  });

  const footerY = height - 38;
  context.fillStyle = "#7f8ab1";
  context.font = "600 13px Inter, Arial, sans-serif";
  context.fillText("draftcentral.gg/nuzlocke", PAGE_PADDING, footerY);
  context.textAlign = "right";
  context.fillText(`Team code: ${cleanText(savedResult.seed, 80)}`, WIDTH - PAGE_PADDING, footerY);
  context.textAlign = "left";

  const blob = await canvasBlob(canvas);
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = nuzlockeRunCardImageFilename(runName, savedResult.game.display_name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return anchor.download;
}
