import { pokemonDisplayName, pokemonProfileSlugCandidates, pokemonRouteSlug } from "./publicPokemonIndex.js";
import {
  localizedPokeApiName,
  localizedPokemonProfileName,
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

  const resources = await Promise.all([
    ...pokemon.types.map(({ type }) => pokeApiJson(type.url)),
    ...pokemon.abilities.map(({ ability }) => pokeApiJson(ability.url)),
  ]);
  const typeResources = resources.slice(0, pokemon.types.length);
  const abilityResources = resources.slice(pokemon.types.length);
  const profileName = localizedPokemonProfileName(pokemon.name, language.code, pokemonDisplayName(pokemon.name));
  const speciesLocalization = pokemonSpeciesLocalization(speciesSlug, language.code);
  const types = pokemon.types.map(({ type }, index) => localizedPokeApiName(typeResources[index], language.code, pokemonDisplayName(type.name)));
  const abilities = pokemon.abilities.map(({ ability, is_hidden }, index) => ({
    name: localizedPokeApiName(abilityResources[index], language.code, pokemonDisplayName(ability.name)),
    isHidden: is_hidden,
  }));
  const entries = (species.flavor_text_entries || []).filter((entry) => String(entry?.language?.name || "").toLowerCase() === language.pokeApiLanguage);
  const entry = entries.at(-1)?.flavor_text?.replace(/[\n\f]/g, " ") || null;

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
