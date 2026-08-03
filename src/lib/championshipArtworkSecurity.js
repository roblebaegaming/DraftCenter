export function selectArchivedArtworkSeason(state, seasonNumber) {
  const season = (state?.seasonHistory || []).find((entry) => Number(entry?.seasonNumber) === Number(seasonNumber));
  if (!season?.champion?.teamName) return { error: "That completed season is no longer available.", status: 404 };
  const encoded = JSON.stringify(season);
  if (Buffer.byteLength(encoded, "utf8") > 1024 * 1024 || (season.standings || []).length > 64 || (season.rosters || []).length > 64) {
    return { error: "That season is too large to render safely.", status: 413 };
  }
  return { season };
}

export function normalizeArtworkOptions(body, season) {
  const cleanText = (value, max) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return {
    season,
    title: cleanText(body.title, 80),
    subtitle: cleanText(body.subtitle, 120),
    coachName: cleanText(body.coachName, 80),
    themeKey: ["night", "legacy", "electric"].includes(body.themeKey) ? body.themeKey : "night",
  };
}
