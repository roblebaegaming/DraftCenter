export function normalizeTournamentSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

export function isTournamentSlug(value) {
  return /^[a-z0-9-]{3,100}$/.test(String(value || ""));
}
