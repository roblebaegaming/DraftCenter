export const PUBLIC_BRACKET_SIZES = [4, 8, 16, 32];

export const PUBLIC_BRACKET_THEMES = [
  {
    id: "midnight",
    label: "Midnight",
    background: "#07111f",
    backgroundAlt: "#10233c",
    card: "#13243a",
    cardAlt: "#0d1a2c",
    text: "#f7fbff",
    muted: "#9fb0c8",
    accent: "#64e6d2",
    winner: "#ffd45c",
    line: "#3c5572",
  },
  {
    id: "paper",
    label: "Paper",
    background: "#f5f0e5",
    backgroundAlt: "#e6dfd0",
    card: "#fffdf8",
    cardAlt: "#eee7da",
    text: "#1d2730",
    muted: "#67727a",
    accent: "#0a7f75",
    winner: "#b75b17",
    line: "#b9b2a6",
  },
  {
    id: "berry",
    label: "Berry",
    background: "#210d2f",
    backgroundAlt: "#4a174e",
    card: "#3a1845",
    cardAlt: "#291033",
    text: "#fff7ff",
    muted: "#d3afd8",
    accent: "#ff8bd7",
    winner: "#8ff3c9",
    line: "#7d477d",
  },
];

export const PUBLIC_BRACKET_FONTS = [
  { id: "modern", label: "Modern", css: "Arial, Helvetica, sans-serif", canvas: "Arial, sans-serif" },
  { id: "rounded", label: "Rounded", css: "Trebuchet MS, Arial, sans-serif", canvas: "Trebuchet MS, sans-serif" },
  { id: "classic", label: "Classic", css: "Georgia, Times New Roman, serif", canvas: "Georgia, serif" },
];

export const PUBLIC_BRACKET_CARD_STYLES = [
  { id: "soft", label: "Soft", radius: 14 },
  { id: "pill", label: "Pill", radius: 30 },
  { id: "square", label: "Square", radius: 3 },
];

export function publicBracketMatchKey(round, match) {
  return `r${round}-m${match}`;
}

export function publicBracketEntrantId(index) {
  return `entrant-${index + 1}`;
}

export function createPublicBracketEntrants(size, current = []) {
  validatePublicBracketSize(size);
  return Array.from({ length: size }, (_, index) => ({
    id: publicBracketEntrantId(index),
    name: String(current[index]?.name || "").slice(0, 80),
  }));
}

export function normalizePublicBracketEntrants(size, values) {
  const current = Array.isArray(values)
    ? values.map((value) => typeof value === "string" ? { name: value } : value)
    : [];
  return createPublicBracketEntrants(size, current);
}

export function publicBracketEntrantLabel(entrant, fallback = "TBD") {
  const name = String(entrant?.name || "").trim();
  if (name) return name;
  const seed = Number(String(entrant?.id || "").replace("entrant-", ""));
  return Number.isInteger(seed) && seed > 0 ? `Seed ${seed}` : fallback;
}

export function validatePublicBracketSize(size) {
  if (!PUBLIC_BRACKET_SIZES.includes(Number(size))) throw new Error("Bracket size must be 4, 8, 16, or 32.");
  return Number(size);
}

function entrantById(entrants, id) {
  return entrants.find((entrant) => entrant.id === id) || null;
}

export function buildPublicBracketRounds({ size, entrants, picks = {} }) {
  const bracketSize = validatePublicBracketSize(size);
  const normalizedEntrants = normalizePublicBracketEntrants(bracketSize, entrants);
  const cleanPicks = {};
  const rounds = [];
  let previous = null;
  const roundCount = Math.log2(bracketSize);

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const roundNumber = roundIndex + 1;
    const matchCount = bracketSize / (2 ** roundNumber);
    const matches = Array.from({ length: matchCount }, (_, matchIndex) => {
      const a = roundNumber === 1
        ? normalizedEntrants[matchIndex * 2]
        : entrantById(normalizedEntrants, previous[matchIndex * 2]?.winnerId);
      const b = roundNumber === 1
        ? normalizedEntrants[matchIndex * 2 + 1]
        : entrantById(normalizedEntrants, previous[matchIndex * 2 + 1]?.winnerId);
      const key = publicBracketMatchKey(roundNumber, matchIndex + 1);
      const requestedWinner = String(picks?.[key] || "");
      const winnerId = requestedWinner && (requestedWinner === a?.id || requestedWinner === b?.id)
        ? requestedWinner
        : "";
      if (winnerId) cleanPicks[key] = winnerId;
      return { key, round: roundNumber, match: matchIndex + 1, a, b, winnerId };
    });
    rounds.push(matches);
    previous = matches;
  }

  const championId = rounds.at(-1)?.[0]?.winnerId || "";
  return {
    size: bracketSize,
    entrants: normalizedEntrants,
    rounds,
    picks: cleanPicks,
    champion: entrantById(normalizedEntrants, championId),
  };
}

export function choosePublicBracketWinner({ size, entrants, picks = {}, round, match, winnerId }) {
  const current = buildPublicBracketRounds({ size, entrants, picks });
  const target = current.rounds[Number(round) - 1]?.[Number(match) - 1];
  if (!target || (target.a?.id !== winnerId && target.b?.id !== winnerId)) {
    throw new Error("Choose one of the competitors in this matchup.");
  }
  return buildPublicBracketRounds({
    size,
    entrants,
    picks: { ...current.picks, [target.key]: winnerId },
  }).picks;
}

export function publicBracketRoundLabel(size, roundNumber) {
  const remaining = validatePublicBracketSize(size) / (2 ** (Number(roundNumber) - 1));
  if (remaining === 2) return "Final";
  if (remaining === 4) return "Semifinals";
  if (remaining === 8) return "Quarterfinals";
  return `Round of ${remaining}`;
}

export function parsePublicBracketNames(text, size) {
  const bracketSize = validatePublicBracketSize(size);
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((row) => row.replace(/^\s*\d+(?:\s*[.)-]\s*|\s+)/, "").trim())
    .filter(Boolean)
    .slice(0, bracketSize);
  return normalizePublicBracketEntrants(bracketSize, rows);
}

export function publicBracketTheme(id) {
  return PUBLIC_BRACKET_THEMES.find((theme) => theme.id === id) || PUBLIC_BRACKET_THEMES[0];
}

export function publicBracketFont(id) {
  return PUBLIC_BRACKET_FONTS.find((font) => font.id === id) || PUBLIC_BRACKET_FONTS[0];
}

export function publicBracketCardStyle(id) {
  return PUBLIC_BRACKET_CARD_STYLES.find((style) => style.id === id) || PUBLIC_BRACKET_CARD_STYLES[0];
}
