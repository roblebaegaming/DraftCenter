export function pokemonDirectoryFragment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function pokemonDirectoryHref(value) {
  const fragment = pokemonDirectoryFragment(value);
  return fragment ? `/pokemon#${fragment}` : "/pokemon";
}
