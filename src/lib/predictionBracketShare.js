export const PREDICTION_BRACKET_SHARE_MIN_WIDTH = 1920;
export const PREDICTION_BRACKET_SHARE_MIN_HEIGHT = 1350;

function safeText(value, limit = 120) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function slugPart(value, fallback) {
  return safeText(value, 80)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

export function predictionBracketShareFileName(eventId, displayName) {
  return `draftcenter-${slugPart(eventId, "bracket")}-${slugPart(displayName, "trainer")}.png`;
}

export function predictionBracketShareDimensions(rounds) {
  const roundCount = Array.isArray(rounds) ? rounds.length : 0;
  const firstRoundMatches = Number(rounds?.[0]?.length || 0);
  if (roundCount < 2 || roundCount > 6 || firstRoundMatches < 2 || firstRoundMatches > 32) {
    throw new Error("This bracket size cannot be exported yet.");
  }
  return {
    width: Math.max(PREDICTION_BRACKET_SHARE_MIN_WIDTH, 220 + (roundCount * 390)),
    height: Math.max(PREDICTION_BRACKET_SHARE_MIN_HEIGHT, 410 + (firstRoundMatches * 92)),
  };
}

export function normalizePredictionBracketShareData({
  title,
  bracketLabel,
  displayName,
  rounds,
  roundPoints = {},
  choices = {},
  resultNames = {},
  score,
  maximumScore,
  status,
  publicUrl,
}) {
  const dimensions = predictionBracketShareDimensions(rounds);
  const normalizedRounds = rounds.map((round, roundIndex) => round.map((match, matchIndex) => {
    const competitors = [match?.a, match?.b].filter(Boolean).map((competitor) => ({
      id: safeText(competitor.id, 100),
      displayName: safeText(competitor.displayName, 80) || "Trainer",
      countryCode: safeText(competitor.countryCode, 4).toUpperCase(),
      sourceSeed: competitor.sourceSeed == null ? null : Number(competitor.sourceSeed),
    }));
    const isBye = Boolean(match?.isBye);
    if ((!isBye && competitors.length !== 2) || (isBye && competitors.length !== 1)) {
      throw new Error("Finish the bracket before downloading its image.");
    }
    const pickedId = safeText(match?.pickedId ?? choices?.[match?.key], 100);
    if (!isBye && !competitors.some(({ id }) => id === pickedId)) {
      throw new Error("Finish the bracket before downloading its image.");
    }
    const resultWinnerId = safeText(match?.result?.winner_id, 100);
    return {
      round: roundIndex + 1,
      match: Number(match?.match || matchIndex + 1),
      competitors,
      isBye,
      pickedId: isBye ? competitors[0]?.id : pickedId,
      resultWinnerId,
      resultWinnerName: safeText(resultNames?.[resultWinnerId], 80),
    };
  }));

  return {
    ...dimensions,
    title: safeText(title, 120) || "Tournament bracket",
    bracketLabel: safeText(bracketLabel, 80) || "My bracket",
    displayName: safeText(displayName, 80) || "Trainer",
    rounds: normalizedRounds,
    roundPoints: Object.fromEntries(Object.entries(roundPoints || {}).map(([round, points]) => [String(Number(round)), Number(points) || 0])),
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    maximumScore: Number.isFinite(Number(maximumScore)) ? Number(maximumScore) : null,
    status: safeText(status, 30).toLowerCase(),
    publicUrl: safeText(publicUrl, 180).replace(/^https?:\/\//, "") || "draftcentral.gg",
  };
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

function drawCompetitor(context, competitor, { x, y, width, picked, officialWinner }) {
  roundedRect(context, x, y, width, 26, 7);
  context.fillStyle = picked ? "#ffd23f" : "#171f39";
  context.fill();
  context.lineWidth = officialWinner ? 4 : 1;
  context.strokeStyle = officialWinner ? "#4fd1c5" : "#344268";
  context.stroke();

  context.fillStyle = picked ? "#171306" : "#8897bb";
  context.font = "800 14px Arial, sans-serif";
  const seed = competitor.sourceSeed ? `#${competitor.sourceSeed}` : "";
  context.fillText(seed, x + 10, y + 19);
  context.fillStyle = picked ? "#171306" : "#f3f6ff";
  const name = fitText(context, competitor.displayName, width - 100, 18, 13, 800);
  context.fillText(name, x + 50, y + 19);
  context.textAlign = "right";
  context.fillStyle = picked ? "#5c4d13" : "#8d9abc";
  context.font = "800 13px Arial, sans-serif";
  context.fillText(competitor.countryCode, x + width - 10, y + 19);
  context.textAlign = "left";
}

function drawMatch(context, match, { x, y, width }) {
  roundedRect(context, x, y, width, 82, 13);
  context.fillStyle = "#10172d";
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = "#304064";
  context.stroke();
  context.fillStyle = "#7f8caf";
  context.font = "800 11px Arial, sans-serif";
  context.fillText(`MATCH ${match.match}`, x + 12, y + 16);
  if (match.resultWinnerName && !match.competitors.some(({ id }) => id === match.resultWinnerId)) {
    context.textAlign = "right";
    context.fillStyle = "#72e3d6";
    const official = fitText(context, `OFFICIAL: ${match.resultWinnerName}`, width - 105, 11, 9, 800);
    context.fillText(official, x + width - 12, y + 16);
    context.textAlign = "left";
  }

  const rowWidth = width - 24;
  match.competitors.forEach((competitor, index) => drawCompetitor(context, competitor, {
    x: x + 12,
    y: y + 22 + (index * 30),
    width: rowWidth,
    picked: competitor.id === match.pickedId,
    officialWinner: competitor.id === match.resultWinnerId,
  }));

  if (match.isBye) {
    context.textAlign = "right";
    context.fillStyle = "#9aa7c6";
    context.font = "800 11px Arial, sans-serif";
    context.fillText("BYE", x + width - 14, y + 75);
    context.textAlign = "left";
  }
}

export async function createPredictionBracketShareCanvas(options) {
  if (typeof document === "undefined") throw new Error("Bracket images can only be created in a browser.");
  const data = normalizePredictionBracketShareData(options);
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the bracket image.");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#080e1d");
  background.addColorStop(.55, "#111a34");
  background.addColorStop(1, "#151124");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ef5350";
  context.fillRect(0, 0, canvas.width, 18);
  context.fillStyle = "#4fd1c5";
  context.fillRect(0, 18, canvas.width, 8);

  const logo = await localImage("/draftcenter-logo.png");
  if (logo) context.drawImage(logo, 70, 62, 76, 76);
  context.fillStyle = "#f7f8ff";
  context.font = "900 28px Arial, sans-serif";
  context.fillText("DRAFTCENTER", logo ? 166 : 70, 100);
  context.fillStyle = "#9da9ca";
  context.font = "800 17px Arial, sans-serif";
  context.fillText("TOURNAMENT BRACKET", logo ? 166 : 70, 128);

  context.fillStyle = "#ffd23f";
  context.font = "900 21px Arial, sans-serif";
  context.fillText(data.bracketLabel.toUpperCase(), 70, 195);
  context.fillStyle = "#ffffff";
  const title = fitText(context, data.title, canvas.width - 640, 48, 28, 900);
  context.fillText(title, 70, 246);
  context.fillStyle = "#d7def4";
  context.font = "800 22px Arial, sans-serif";
  context.fillText(data.displayName, 70, 283);

  context.textAlign = "right";
  if (data.score != null && data.maximumScore != null) {
    context.fillStyle = "#ffd23f";
    context.font = "900 42px Arial, sans-serif";
    context.fillText(`${data.score}/${data.maximumScore}`, canvas.width - 70, 218);
    context.fillStyle = "#9da9ca";
    context.font = "800 15px Arial, sans-serif";
    context.fillText("POINTS", canvas.width - 70, 246);
  }
  context.textAlign = "left";

  const legendY = 315;
  context.fillStyle = "#ffd23f";
  context.fillRect(70, legendY, 18, 18);
  context.fillStyle = "#b7c1da";
  context.font = "800 14px Arial, sans-serif";
  context.fillText("SAVED PICK", 100, legendY + 15);
  context.strokeStyle = "#4fd1c5";
  context.lineWidth = 4;
  context.strokeRect(220, legendY, 18, 18);
  context.fillText("OFFICIAL WINNER", 250, legendY + 15);

  const left = 70;
  const top = 390;
  const right = 70;
  const bottom = 105;
  const columnGap = 24;
  const columnWidth = (canvas.width - left - right - (columnGap * (data.rounds.length - 1))) / data.rounds.length;
  const availableHeight = canvas.height - top - bottom;

  data.rounds.forEach((round, roundIndex) => {
    const x = left + (roundIndex * (columnWidth + columnGap));
    context.fillStyle = "#9ba8c7";
    context.font = "900 15px Arial, sans-serif";
    context.fillText(`ROUND ${roundIndex + 1}`, x, top - 22);
    context.textAlign = "right";
    context.fillStyle = "#ffd23f";
    context.fillText(`${data.roundPoints[String(roundIndex + 1)] || 0} PTS`, x + columnWidth, top - 22);
    context.textAlign = "left";
    const step = availableHeight / round.length;
    round.forEach((match, matchIndex) => drawMatch(context, match, {
      x,
      y: top + (matchIndex * step) + Math.max(0, (step - 82) / 2),
      width: columnWidth,
    }));
  });

  context.fillStyle = "#344268";
  context.fillRect(70, canvas.height - 73, canvas.width - 140, 2);
  context.fillStyle = "#f0f3ff";
  context.font = "900 18px Arial, sans-serif";
  context.fillText(data.publicUrl, 70, canvas.height - 35);
  context.textAlign = "right";
  context.fillStyle = "#9aa7c6";
  context.font = "700 15px Arial, sans-serif";
  context.fillText(data.status === "final" ? "Final reviewed results" : "Unofficial fan prediction", canvas.width - 70, canvas.height - 35);
  context.textAlign = "left";
  return canvas;
}

export async function predictionBracketShareBlob(options) {
  const canvas = await createPredictionBracketShareCanvas(options);
  return await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The bracket image could not be encoded.")), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

export function downloadPredictionBracketShareBlob(blob, filename) {
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
