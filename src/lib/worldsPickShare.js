export const WORLDS_SHARE_CARD_WIDTH = 1080;
export const WORLDS_SHARE_CARD_HEIGHT = 1350;

const SHARE_DISCIPLINES = new Set(["vgc", "tcg", "go"]);
const PRODUCTION_ORIGIN = "https://www.draftcentral.gg";

function safeText(value, limit = 100) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function disciplineKey(value) {
  const key = safeText(value, 12).toLowerCase();
  if (!SHARE_DISCIPLINES.has(key)) throw new Error("This Worlds competition cannot create an individual Pick 10 card.");
  return key;
}

export function normalizeWorldsSharePicks(picks, championSlug, pickCount = 10) {
  if (!Number.isInteger(pickCount) || pickCount < 1 || pickCount > 16) throw new Error("The share-card pick count is invalid.");
  if (!Array.isArray(picks) || picks.length !== pickCount) throw new Error(`Choose all ${pickCount} picks before creating a share card.`);
  const normalized = picks.map((pick) => {
    const slug = safeText(pick?.slug, 100);
    const displayName = safeText(pick?.displayName ?? pick?.display_name, 80);
    if (!slug || !displayName) throw new Error("Every shared pick needs a reviewed competitor name.");
    return {
      slug,
      displayName,
      countryCode: safeText(pick?.countryCode ?? pick?.country_code, 4).toUpperCase(),
      qualificationRegion: safeText(pick?.qualificationRegion ?? pick?.qualification_region, 48),
    };
  });
  if (new Set(normalized.map(({ slug }) => slug)).size !== normalized.length) throw new Error("A share card cannot contain duplicate picks.");
  const champion = safeText(championSlug, 100);
  if (!normalized.some(({ slug }) => slug === champion)) throw new Error("Choose Your Champion before creating a share card.");
  return normalized;
}

export function worldsSharePath(discipline) {
  return `/worlds/2026/${disciplineKey(discipline)}`;
}

export function worldsShareUrl(discipline, origin = PRODUCTION_ORIGIN) {
  return new URL(worldsSharePath(discipline), origin).toString();
}

export function worldsShareFileName(discipline) {
  return `draftcenter-2026-worlds-${disciplineKey(discipline)}-pick-10.png`;
}

export function worldsShareText(gameLabel = "VGC") {
  const label = safeText(gameLabel, 40) || "VGC";
  return `My 2026 Pok\u00e9mon Worlds ${label} picks.`;
}

export function worldsTwitterShareUrl(discipline, gameLabel = "VGC") {
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", worldsShareText(gameLabel));
  intent.searchParams.set("url", worldsShareUrl(discipline));
  return intent.toString();
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fitText(context, text, maxWidth, startSize, minimumSize, weight = 800) {
  let size = startSize;
  do {
    context.font = `${weight} ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return text;
    size -= 1;
  } while (size > minimumSize);
  context.font = `${weight} ${minimumSize}px Arial, sans-serif`;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}\u2026`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}\u2026`;
}

async function localImage(source) {
  try {
    const response = await fetch(source, { credentials: "same-origin" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      image.src = url;
    });
  } catch {
    return null;
  }
}

function drawPick(context, pick, index, championSlug, x, y) {
  const champion = pick.slug === championSlug;
  const width = 456;
  const height = 142;
  roundedRect(context, x, y, width, height, 24);
  context.fillStyle = champion ? "#2d2919" : "#121a34";
  context.fill();
  context.lineWidth = champion ? 4 : 2;
  context.strokeStyle = champion ? "#ffd23f" : "#33446f";
  context.stroke();

  context.beginPath();
  context.arc(x + 48, y + 71, 27, 0, Math.PI * 2);
  context.fillStyle = champion ? "#ffd23f" : "#4fd1c5";
  context.fill();
  context.fillStyle = "#0b1020";
  context.font = "900 23px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1), x + 48, y + 72);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#f7f8ff";
  const pickName = fitText(context, pick.displayName, 330, 31, 22, 800);
  context.fillText(pickName, x + 91, y + 65);

  const location = [pick.countryCode, pick.qualificationRegion].filter(Boolean).join("  \u00b7  ");
  context.font = "700 18px Arial, sans-serif";
  context.fillStyle = "#aab6d6";
  context.fillText(location || "Reviewed Worlds roster", x + 91, y + 101, 330);

  if (champion) {
    roundedRect(context, x + 270, y + 111, 160, 22, 11);
    context.fillStyle = "#ffd23f";
    context.fill();
    context.fillStyle = "#171306";
    context.font = "900 13px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("YOUR CHAMPION \u00d72", x + 350, y + 127);
  }
}

export async function createWorldsPickShareCard({ discipline, gameLabel, picks, championSlug, displayName = "", pickCount = 10 }) {
  const key = disciplineKey(discipline);
  const normalized = normalizeWorldsSharePicks(picks, championSlug, pickCount);
  if (typeof document === "undefined") throw new Error("Share cards can only be created in a browser.");
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WORLDS_SHARE_CARD_WIDTH;
  canvas.height = WORLDS_SHARE_CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the share image.");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#0a1022");
  background.addColorStop(.55, "#151735");
  background.addColorStop(1, "#17101f");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ef5350";
  context.fillRect(0, 0, canvas.width, 16);
  context.fillStyle = "#4fd1c5";
  context.fillRect(0, 16, canvas.width, 8);

  const logo = await localImage("/draftcenter-logo.png");
  if (logo) context.drawImage(logo, 72, 67, 80, 80);
  context.fillStyle = "#f7f8ff";
  context.font = "900 29px Arial, sans-serif";
  context.fillText("DRAFTCENTER", logo ? 174 : 72, 105);
  context.fillStyle = "#9da9ca";
  context.font = "800 20px Arial, sans-serif";
  context.fillText("2026 POK\u00c9MON WORLD CHAMPIONSHIPS", logo ? 174 : 72, 137);

  const label = safeText(gameLabel, 40).toUpperCase() || key.toUpperCase();
  context.fillStyle = "#ffd23f";
  context.font = "900 24px Arial, sans-serif";
  context.fillText(`${label} \u00b7 MY PREDICTIONS`, 72, 213);
  context.fillStyle = "#ffffff";
  context.font = "900 68px Arial, sans-serif";
  context.fillText("MY PICK 10", 72, 282);

  const owner = safeText(displayName, 50);
  if (owner) {
    context.textAlign = "right";
    context.fillStyle = "#d7def4";
    const ownerName = fitText(context, owner, 360, 25, 18, 700);
    context.fillText(ownerName, 1008, 268);
    context.textAlign = "left";
  }

  normalized.forEach((pick, index) => {
    const column = index < 5 ? 0 : 1;
    const row = index % 5;
    drawPick(context, pick, index, championSlug, 72 + (column * 480), 330 + (row * 158));
  });

  roundedRect(context, 72, 1150, 936, 2, 1);
  context.fillStyle = "#334166";
  context.fill();
  context.fillStyle = "#f1f4ff";
  context.font = "900 25px Arial, sans-serif";
  context.fillText("draftcentral.gg" + worldsSharePath(key), 72, 1210);
  context.fillStyle = "#98a5c5";
  context.font = "700 18px Arial, sans-serif";
  context.fillText("Unofficial fan prediction  \u00b7  Share yours at DraftCenter", 72, 1244);
  context.textAlign = "right";
  context.fillStyle = "#ffd23f";
  context.font = "900 24px Arial, sans-serif";
  context.fillText("WHO MAKES YOUR 10?", 1008, 1240);
  context.textAlign = "left";

  return canvas;
}

export async function worldsPickShareBlob(options) {
  const canvas = await createWorldsPickShareCard(options);
  return await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The share image could not be encoded.")), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

export function downloadWorldsPickShareBlob(blob, filename) {
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
