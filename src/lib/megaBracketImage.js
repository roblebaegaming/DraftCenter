import { evaluateMegaBracket, megaBracketFormatLabel, top64BracketFromRounds } from "./megaBracket.js";
import { loadPokemonArtwork } from "./pokemonArtwork.js";

const REGION_NAMES = ["Region One", "Region Two", "Region Three", "Region Four"];

function fitText(context, value, maxWidth) {
  const text = String(value || "");
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 3 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function roundedRect(context, x, y, width, height, radius = 8) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function drawNameColumn(context, names, x, top, width, height, accent, align = "left") {
  const count = Math.max(1, names.length);
  const boxHeight = Math.min(31, height / count - 3);
  return names.map((name, index) => {
    const centerY = top + ((index + 0.5) * height) / count;
    context.fillStyle = name ? "#151d36" : "#0e1428";
    context.strokeStyle = name ? `${accent}88` : "#303958";
    context.lineWidth = 1;
    roundedRect(context, x, centerY - boxHeight / 2, width, boxHeight, 6);
    context.fillStyle = name ? "#f3f5ff" : "#667092";
    context.font = "600 13px Arial, sans-serif";
    context.textAlign = align;
    context.textBaseline = "middle";
    context.fillText(fitText(context, name || "Awaiting pick", width - 18), align === "left" ? x + 9 : x + width - 9, centerY);
    return centerY;
  });
}

function drawContainedImage(context, image, x, y, width, height) {
  if (!image) return;
  const sourceWidth = image.naturalWidth || image.width || width;
  const sourceHeight = image.naturalHeight || image.height || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function loadCanvasImage(url) {
  if (!url || typeof globalThis.Image === "undefined") return null;
  return new Promise((resolve) => {
    const image = new globalThis.Image();
    const timer = globalThis.setTimeout(() => resolve(null), 8000);
    image.crossOrigin = "anonymous";
    image.onload = () => { globalThis.clearTimeout(timer); resolve(image); };
    image.onerror = () => { globalThis.clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

async function loadArtworkMap(names, artworkLoader) {
  const unique = [...new Set(names.filter(Boolean))];
  const loaded = await Promise.all(unique.map(async (name) => {
    try {
      const url = await artworkLoader(name);
      return [name, await loadCanvasImage(url)];
    } catch {
      return [name, null];
    }
  }));
  return new Map(loaded);
}

function drawArtworkNameCard(context, name, image, x, y, width, height, accent) {
  context.fillStyle = "#121a32";
  context.strokeStyle = `${accent}88`;
  context.lineWidth = 1;
  roundedRect(context, x, y, width, height, 12);
  if (image) drawContainedImage(context, image, x + 6, y + 6, height - 12, height - 12);
  context.fillStyle = "#f2f4ff";
  context.font = "800 15px Arial, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(fitText(context, name || "Awaiting pick", width - (image ? height + 8 : 18)), x + (image ? height + 2 : 9), y + height / 2);
}

function drawRegion(context, region, x, y, width, height, direction, accent) {
  context.fillStyle = "#0c1225";
  context.strokeStyle = `${accent}77`;
  context.lineWidth = 2;
  roundedRect(context, x, y, width, height, 18);
  context.fillStyle = accent;
  context.font = "800 19px Arial, sans-serif";
  context.textAlign = direction === "right" ? "right" : "left";
  context.fillText(REGION_NAMES[region.id - 1], direction === "right" ? x + width - 24 : x + 24, y + 38);

  const padding = 24;
  const labelHeight = 47;
  const availableHeight = height - labelHeight - padding;
  const columnWidth = 218;
  const columns = [
    { label: "Top 64", names: region.entrants },
    { label: "Top 32", names: region.round64Winners },
    { label: "Sweet 16", names: region.round32Winners },
    { label: "Elite Eight", names: region.sweet16Winners },
    { label: "Region champ", names: [region.champion] },
  ];
  const gap = (width - padding * 2 - columnWidth * columns.length) / (columns.length - 1);
  const ordered = direction === "right" ? [...columns].reverse() : columns;
  ordered.forEach((column, index) => {
    const columnX = x + padding + index * (columnWidth + gap);
    context.fillStyle = "#8792b7";
    context.font = "700 11px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(column.label.toUpperCase(), columnX + columnWidth / 2, y + 61);
    drawNameColumn(context, column.names, columnX, y + 72, columnWidth, availableHeight, accent, "left");
  });
}

function baseCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#080c19");
  gradient.addColorStop(0.55, "#101832");
  gradient.addColorStop(1, "#080c19");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

export async function renderMegaBracketCanvas(attempt, artworkLoader = loadPokemonArtwork) {
  const progress = evaluateMegaBracket(attempt.entrants, attempt.winners);
  if (!progress.hasVisualTop64) throw new Error("Reach a 64-entry field before downloading the full Mega Bracket.");
  const bracket = top64BracketFromRounds(progress.rounds);
  const format = megaBracketFormatLabel(attempt).toUpperCase();
  const selectionMode = attempt.selection_mode || "favorite";
  const artwork = await loadArtworkMap([...bracket.finalFour, progress.champion], artworkLoader);
  const { canvas, context } = baseCanvas(3200, 2050);
  context.fillStyle = "#ffd23f";
  context.font = "900 58px Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(`${format} MEGA BRACKET`, 58, 76);
  context.fillStyle = "#f2f4ff";
  context.font = "800 29px Arial, sans-serif";
  context.fillText(`The Top 64 · ${selectionMode === "worst" ? "voting for the worst" : "picking a favorite"} from ${progress.entrantCount.toLocaleString()} entries`, 60, 119);
  context.fillStyle = "#8e99be";
  context.font = "17px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("DRAFTCENTER · DRAFTCENTRAL.GG", 3140, 76);
  context.fillText(progress.complete ? "COMPLETE" : `${progress.choicesCompleted.toLocaleString()} OF ${progress.totalChoices.toLocaleString()} CHOICES`, 3140, 111);

  drawRegion(context, bracket.regions[0], 45, 160, 1370, 835, "left", "#4fd1c5");
  drawRegion(context, bracket.regions[1], 45, 1035, 1370, 835, "left", "#82aaff");
  drawRegion(context, bracket.regions[2], 1785, 160, 1370, 835, "right", "#f4b860");
  drawRegion(context, bracket.regions[3], 1785, 1035, 1370, 835, "right", "#c792ea");

  context.fillStyle = "#111a34";
  context.strokeStyle = "#ffd23f";
  context.lineWidth = 3;
  roundedRect(context, 1445, 500, 310, 1020, 24);
  context.fillStyle = "#ffd23f";
  context.font = "900 24px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("FINAL FOUR", 1600, 555);
  context.fillStyle = "#98a3c6";
  context.font = "700 11px Arial, sans-serif";
  context.fillText("REGION CHAMPIONS", 1600, 589);
  bracket.finalFour.forEach((name, index) => drawArtworkNameCard(context, name, artwork.get(name), 1480, 615 + index * 103, 240, 88, "#ffd23f"));
  context.fillStyle = "#98a3c6";
  context.fillText("FINALISTS", 1600, 1065);
  drawNameColumn(context, bracket.semifinalWinners, 1480, 1082, 240, 150, "#ffd23f", "left");
  context.fillStyle = "#98a3c6";
  context.fillText(selectionMode === "worst" ? "WORST PICK" : "CHAMPION", 1600, 1267);
  context.fillStyle = progress.champion ? "#ffd23f" : "#26304f";
  context.strokeStyle = "#ffd23f";
  roundedRect(context, 1480, 1285, 240, 190, 14);
  if (progress.champion && artwork.get(progress.champion)) drawContainedImage(context, artwork.get(progress.champion), 1535, 1295, 130, 125);
  context.fillStyle = progress.champion ? "#09101f" : "#7883a6";
  context.font = "900 18px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, progress.champion || "Still playing", 214), 1600, progress.champion ? 1448 : 1380);
  context.fillStyle = "#7f8aad";
  context.font = "15px Arial, sans-serif";
  context.textBaseline = "alphabetic";
  context.fillText(`${progress.totalChoices.toLocaleString()} choices. One ${selectionMode === "worst" ? "dubious winner" : "champion"}.`, 1600, 1975);
  return canvas;
}

export async function renderMegaChampionCanvas(attempt, artworkLoader = loadPokemonArtwork) {
  const progress = evaluateMegaBracket(attempt.entrants, attempt.winners);
  if (!progress.complete) throw new Error("Finish the Mega Bracket before downloading the champion card.");
  const bracket = top64BracketFromRounds(progress.rounds);
  const format = megaBracketFormatLabel(attempt);
  const selectionMode = attempt.selection_mode || "favorite";
  const artwork = await loadArtworkMap([...bracket.finalFour, progress.champion], artworkLoader);
  const { canvas, context } = baseCanvas(1080, 1350);
  context.fillStyle = "#4fd1c5";
  context.font = "900 26px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(`DRAFTCENTER · ${format.toUpperCase()} MEGA BRACKET`, 540, 90);
  context.fillStyle = "#f4f6ff";
  context.font = "900 58px Arial, sans-serif";
  context.fillText(`${progress.totalChoices.toLocaleString()} choices.`, 540, 184);
  context.fillStyle = "#ffd23f";
  context.fillText(selectionMode === "worst" ? "One worst pick." : "One champion.", 540, 249);
  context.fillStyle = "#111a34";
  context.strokeStyle = "#ffd23f";
  context.lineWidth = 4;
  roundedRect(context, 90, 285, 900, 500, 30);
  context.fillStyle = "#8e99be";
  context.font = "800 18px Arial, sans-serif";
  context.fillText(selectionMode === "worst" ? "MY WORST-OF BRACKET PICK" : "MY MEGA BRACKET CHAMPION", 540, 345);
  if (artwork.get(progress.champion)) drawContainedImage(context, artwork.get(progress.champion), 340, 360, 400, 300);
  context.fillStyle = "#ffd23f";
  context.font = "900 76px Arial, sans-serif";
  context.fillText(fitText(context, progress.champion, 790), 540, 700);
  context.fillStyle = "#c7cee7";
  context.font = "22px Arial, sans-serif";
  context.fillText(`Chosen from ${progress.entrantCount.toLocaleString()} ${format} entries`, 540, 752);
  context.fillStyle = "#8e99be";
  context.font = "800 16px Arial, sans-serif";
  context.fillText("FINAL FOUR", 540, 835);
  bracket.finalFour.forEach((name, index) => {
    const x = 115 + (index % 2) * 435;
    const y = 870 + Math.floor(index / 2) * 112;
    context.fillStyle = name === progress.champion ? "#3a331d" : "#121a32";
    context.strokeStyle = name === progress.champion ? "#ffd23f" : "#3b466d";
    roundedRect(context, x, y, 415, 94, 14);
    if (artwork.get(name)) drawContainedImage(context, artwork.get(name), x + 5, y + 5, 84, 84);
    context.fillStyle = name === progress.champion ? "#ffd23f" : "#edf0ff";
    context.font = "800 22px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(fitText(context, name, artwork.get(name) ? 290 : 370), x + (artwork.get(name) ? 245 : 207), y + 47);
  });
  context.textBaseline = "alphabetic";
  context.fillStyle = "#a7b0d0";
  context.font = "20px Arial, sans-serif";
  context.fillText(`I completed a ${format} ${selectionMode === "worst" ? "worst-of" : "favorite"} bracket.`, 540, 1130);
  context.fillStyle = "#4fd1c5";
  context.font = "900 24px Arial, sans-serif";
  context.fillText("DRAFTCENTRAL.GG/TOOLS/MEGA-BRACKET", 540, 1232);
  return canvas;
}

export function downloadMegaBracketCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
