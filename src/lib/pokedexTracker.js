export const POKEDEX_TRACKER_PAGE_SIZE = 120;
export const POKEAPI_SPRITES_COMMIT = "5841d46f1a0d2b8918a29a7376b1424878b86b59";
export const POKEMON_HOME_BOX_SIZE = 30;
export const POKEMON_HOME_BOXES_PER_PAGE = 30;

export function pokedexHomePlacement(dexNumber) {
  const number = Number(dexNumber);
  if (!Number.isInteger(number) || number < 1) return null;
  const zeroBased = number - 1;
  const globalBox = Math.floor(zeroBased / POKEMON_HOME_BOX_SIZE) + 1;
  const position = (zeroBased % POKEMON_HOME_BOX_SIZE) + 1;
  return {
    page: Math.floor((globalBox - 1) / POKEMON_HOME_BOXES_PER_PAGE) + 1,
    box: ((globalBox - 1) % POKEMON_HOME_BOXES_PER_PAGE) + 1,
    globalBox,
    position,
    row: Math.floor((position - 1) / 6) + 1,
    slot: ((position - 1) % 6) + 1,
  };
}

export function pokedexArtworkUrl(pokemonId, shiny = false) {
  const id = Number(pokemonId);
  if (!Number.isInteger(id) || id < 1) return "";
  const shinyPath = shiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/${POKEAPI_SPRITES_COMMIT}/sprites/pokemon/other/home/${shinyPath}${id}.png`;
}

export function pokedexTrackerProgress(entries = [], mode = "standard") {
  const field = mode === "shiny" ? "shiny_caught" : "caught";
  const total = entries.length;
  const caught = entries.reduce((count, entry) => count + (entry[field] ? 1 : 0), 0);
  return { caught, total, percentage: total ? Math.round((caught / total) * 100) : 0 };
}

export function filterPokedexEntries(entries = [], { query = "", status = "all", mode = "standard" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const numberNeedle = needle.replace(/^#/, "");
  const field = mode === "shiny" ? "shiny_caught" : "caught";
  return entries.filter((entry) => {
    const matchesQuery = !needle
      || String(entry.pokemon || "").toLocaleLowerCase().includes(needle)
      || String(entry.dex_number ?? "").includes(numberNeedle)
      || String(entry.dex_number ?? "").padStart(4, "0").includes(numberNeedle);
    const matchesStatus = status === "all"
      || (status === "caught" && entry[field])
      || (status === "missing" && !entry[field]);
    return matchesQuery && matchesStatus;
  });
}

export function groupPokedexCatalogs(catalogs = []) {
  return catalogs.reduce((groups, catalog) => {
    const label = catalog.key === "home" ? "Pokémon HOME" : `Generation ${catalog.generation}`;
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.catalogs.push(catalog);
    else groups.push({ label, catalogs: [catalog] });
    return groups;
  }, []);
}
