import {
  buildPublicBracketRounds,
  publicBracketCardStyle,
  publicBracketEntrantLabel,
  publicBracketFont,
  publicBracketRoundLabel,
  publicBracketTheme,
} from "./publicBracketBuilder.js";

function fitText(context, value, maxWidth) {
  const text = String(value || "");
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 2 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function fillRoundedRect(context, x, y, width, height, radius, fill, stroke, lineWidth = 2) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

function safeFilename(value) {
  const slug = String(value || "my-bracket")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${slug || "my-bracket"}.png`;
}

export function renderPublicBracketCanvas({
  title,
  subtitle,
  size,
  entrants,
  picks,
  themeId,
  fontId,
  cardStyleId,
}) {
  const bracket = buildPublicBracketRounds({ size, entrants, picks });
  const theme = publicBracketTheme(themeId);
  const font = publicBracketFont(fontId);
  const cardStyle = publicBracketCardStyle(cardStyleId);
  const canvas = document.createElement("canvas");
  const side = 72;
  const cardWidth = 232;
  const cardHeight = 72;
  const gap = 78;
  const columnCount = bracket.rounds.length + 1;
  const firstRoundMatches = bracket.rounds[0].length;
  const bracketHeight = Math.max(620, firstRoundMatches * 102);
  const top = 205;
  canvas.width = side * 2 + columnCount * cardWidth + (columnCount - 1) * gap;
  canvas.height = top + bracketHeight + 105;
  const context = canvas.getContext("2d");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, theme.background);
  background.addColorStop(1, theme.backgroundAlt);
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.13;
  context.fillStyle = theme.accent;
  context.beginPath();
  context.arc(canvas.width - 110, 65, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = theme.winner;
  context.beginPath();
  context.arc(30, canvas.height - 10, 230, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = theme.accent;
  context.fillRect(side, 50, 7, 91);
  context.fillStyle = theme.text;
  context.font = `900 42px ${font.canvas}`;
  context.textBaseline = "alphabetic";
  context.fillText(fitText(context, title || "My Tournament Bracket", canvas.width - side * 2 - 35), side + 25, 92);
  context.fillStyle = theme.muted;
  context.font = `600 19px ${font.canvas}`;
  context.fillText(fitText(context, subtitle || `${size}-competitor single elimination`, canvas.width - side * 2 - 35), side + 25, 130);

  const centerFor = (roundIndex, matchIndex) => {
    const matchCount = bracket.rounds[roundIndex].length;
    return top + ((matchIndex + 0.5) * bracketHeight) / matchCount;
  };
  const xFor = (columnIndex) => side + columnIndex * (cardWidth + gap);

  context.strokeStyle = theme.line;
  context.lineWidth = 3;
  bracket.rounds.slice(0, -1).forEach((round, roundIndex) => {
    const fromX = xFor(roundIndex) + cardWidth;
    const toX = xFor(roundIndex + 1);
    const elbowX = fromX + gap / 2;
    round.forEach((match, matchIndex) => {
      const fromY = centerFor(roundIndex, matchIndex);
      const toY = centerFor(roundIndex + 1, Math.floor(matchIndex / 2));
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(elbowX, fromY);
      context.lineTo(elbowX, toY);
      context.lineTo(toX, toY);
      context.stroke();
    });
  });
  const finalX = xFor(bracket.rounds.length - 1) + cardWidth;
  const championX = xFor(bracket.rounds.length);
  const championY = centerFor(bracket.rounds.length - 1, 0);
  context.beginPath();
  context.moveTo(finalX, championY);
  context.lineTo(championX, championY);
  context.stroke();

  const labels = bracket.rounds.map((_, index) => publicBracketRoundLabel(size, index + 1));
  labels.push("Champion");
  labels.forEach((label, index) => {
    context.fillStyle = index === labels.length - 1 ? theme.winner : theme.accent;
    context.font = `800 15px ${font.canvas}`;
    context.textAlign = "left";
    context.fillText(label.toUpperCase(), xFor(index), 178);
  });

  bracket.rounds.forEach((round, roundIndex) => {
    round.forEach((match, matchIndex) => {
      const x = xFor(roundIndex);
      const y = centerFor(roundIndex, matchIndex) - cardHeight / 2;
      fillRoundedRect(context, x, y, cardWidth, cardHeight, cardStyle.radius, theme.card, theme.line);
      [match.a, match.b].forEach((entrant, slotIndex) => {
        const selected = Boolean(entrant && entrant.id === match.winnerId);
        const rowY = y + slotIndex * (cardHeight / 2);
        if (selected) {
          context.globalAlpha = 0.18;
          context.fillStyle = theme.winner;
          context.fillRect(x + 2, rowY + 2, cardWidth - 4, cardHeight / 2 - 4);
          context.globalAlpha = 1;
        }
        if (slotIndex) {
          context.strokeStyle = theme.line;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x + 11, rowY);
          context.lineTo(x + cardWidth - 11, rowY);
          context.stroke();
        }
        context.fillStyle = selected ? theme.winner : entrant ? theme.text : theme.muted;
        context.font = `${selected ? "800" : "650"} 16px ${font.canvas}`;
        context.textBaseline = "middle";
        context.fillText(fitText(context, entrant ? publicBracketEntrantLabel(entrant) : "Winner TBD", cardWidth - 30), x + 14, rowY + cardHeight / 4);
      });
    });
  });

  const champion = bracket.champion;
  fillRoundedRect(context, championX, championY - 44, cardWidth, 88, cardStyle.radius, theme.cardAlt, champion ? theme.winner : theme.line, champion ? 3 : 2);
  context.fillStyle = champion ? theme.winner : theme.muted;
  context.font = `900 21px ${font.canvas}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fitText(context, champion ? publicBracketEntrantLabel(champion) : "Choose a champion", cardWidth - 28), championX + cardWidth / 2, championY);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = theme.muted;
  context.font = `600 14px ${font.canvas}`;
  context.fillText("MADE WITH DRAFTCENTER BRACKET STUDIO", side, canvas.height - 45);
  context.textAlign = "right";
  context.fillText("DRAFTCENTRAL.GG/TOOLS/BRACKET-BUILDER", canvas.width - side, canvas.height - 45);
  return canvas;
}

export function downloadPublicBracketPng(configuration) {
  const canvas = renderPublicBracketCanvas(configuration);
  const filename = safeFilename(configuration.title);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, "image/png");
}
