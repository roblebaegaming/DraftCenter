export function sampleUnique(items, count, random = Math.random) {
  const copy = [...(items || [])];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, Math.max(0, count));
}

export function pickHomepageAdp(rows, random = Math.random) {
  const candidates = (rows || [])
    .filter((row) => row?.pokemon && Number(row.eligible_drafts || row.drafts) > 0 && Number.isFinite(Number(row.average_pick)))
    .slice(0, 12);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}

export function pickHomepageLeague(rows, random = Math.random) {
  const candidates = (rows || []).filter((row) => row?.name && row?.slug);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
