import { pokemonDisplayName, pokemonProfileSlugCandidates, pokemonRouteSlug } from "./publicPokemonIndex.js";
import {
  localizedPokemonProfileName,
  localizedPokemonResource,
  localizedPokemonResourceName,
  pokemonCopy,
  pokemonProfileAlternates,
  pokemonProfilePath,
  pokemonSpeciesLocalization,
} from "./pokemonI18n.js";
import { siteLanguage } from "./siteLanguages.js";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

async function pokeApiJson(url) {
  try {
    const response = await fetch(url.startsWith("https://") ? url : `${POKEAPI_BASE}${url}`, { next: { revalidate: 86400 } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}
export async function loadLocalizedPokemonPage(name, locale = "en") {
  const language = siteLanguage(locale);
  const safeName = pokemonRouteSlug(name);
  if (!safeName) return null;

  let pokemon = null;
  for (const candidate of pokemonProfileSlugCandidates(safeName)) {
    pokemon = await pokeApiJson(`/pokemon/${candidate}`);
    if (pokemon) break;
  }
  if (!pokemon) return null;

  const speciesSlug = String(pokemon.species?.name || "").replace(/[^a-z0-9-]/g, "");
  const species = await pokeApiJson(`/pokemon-species/${speciesSlug}`);
  if (!species) return null;

  const profileName = localizedPokemonProfileName(pokemon.name, language.code, pokemonDisplayName(pokemon.name));
  const speciesLocalization = pokemonSpeciesLocalization(speciesSlug, language.code);
  const types = pokemon.types.map(({ type }) => localizedPokemonResourceName("types", type.name, language.code, pokemonDisplayName(type.name)));
  const abilities = pokemon.abilities.map(({ ability, is_hidden }) => ({
    name: localizedPokemonResourceName("abilities", ability.name, language.code, pokemonDisplayName(ability.name)),
    source: localizedPokemonResource("abilities", ability.name, language.code).source,
    isHidden: is_hidden,
  }));
  const entries = (species.flavor_text_entries || []).filter((entry) => String(entry?.language?.name || "").toLowerCase() === language.pokeApiLanguage);
  const entry = entries.at(-1)?.flavor_text?.replace(/[\n\f]/g, " ") || null;
  const localizedEntries = [...new Map(entries.map((item) => [item.version.name, item])).values()]
    .slice(-8)
    .reverse()
    .map((item) => ({
      version: localizedPokemonResourceName("versions", item.version.name, language.code, pokemonDisplayName(item.version.name)),
      versionSource: localizedPokemonResource("versions", item.version.name, language.code).source,
      text: item.flavor_text.replace(/[\n\f]/g, " "),
    }));
  const collator = new Intl.Collator(language.locale, { sensitivity: "base" });
  const moves = (pokemon.moves || [])
    .map(({ move }) => {
      const localized = localizedPokemonResource("moves", move.name, language.code, pokemonDisplayName(move.name));
      return { slug: move.name, name: localized.name, source: localized.source };
    })
    .sort((left, right) => collator.compare(left.name, right.name));

  return {
    pokemon,
    species,
    speciesSlug,
    displayName: profileName.name,
    nameSource: profileName.source,
    genus: speciesLocalization?.genus || "Pokémon",
    generation: speciesLocalization?.generation || null,
    types,
    abilities,
    entry,
    entries: localizedEntries,
    moves,
  };
}
export async function localizedPokemonPageMetadata(name, locale = "en") {
  const language = siteLanguage(locale);
  const copy = pokemonCopy(language.code);
  const data = await loadLocalizedPokemonPage(name, language.code);
  if (!data) return { title: copy.notFound, robots: { index: false, follow: true } };
  const canonical = pokemonProfilePath(language.code, data.pokemon.name);
  const description = copy.description(data.displayName, data.types.join(" / "));
  const artwork = data.pokemon.sprites?.other?.["official-artwork"]?.front_default;
  return {
    title: copy.title(data.displayName),
    description,
    alternates: { canonical, languages: pokemonProfileAlternates(data.pokemon.name) },
    openGraph: {
      type: "article",
      locale: language.openGraphLocale,
      url: canonical,
      title: copy.title(data.displayName),
      description,
      images: artwork ? [{ url: artwork, alt: data.displayName }] : undefined,
    },
  };
}
