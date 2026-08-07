import { getPublicLeagueCards } from "../lib/supabase/publicServer";
import { FORMATS, GUIDES } from "../lib/seoContent";
import { getAllPokemonProfiles, POKEMON_GENERATIONS, POKEMON_TYPES } from "../lib/publicPokemonIndex";
import nuzlockeGameGuides from "../lib/nuzlockeGameGuides.json";

const routes = [
  ["", "daily", 1],
  ["/explore", "daily", 0.9],
  ["/leagues", "daily", 0.9],
  ["/pokemon", "weekly", 0.9],
  ["/pokemon/a-z", "monthly", 0.8],
  ["/pokemon/types", "monthly", 0.8],
  ["/pokemon/generations", "monthly", 0.8],
  ["/nuzlocke", "weekly", 0.9],
  ["/nuzlocke/guides", "monthly", 0.9],
  ["/tournaments", "daily", 0.8],
  ["/resources", "monthly", 0.7],
  ["/resources/daily-games", "daily", 1],
  ["/about", "monthly", 0.7],
  ["/manuals", "monthly", 0.8],
  ["/manuals/commissioner", "monthly", 0.8],
  ["/manuals/manager", "monthly", 0.8],
  ["/guides", "monthly", 0.9],
  ["/formats", "monthly", 0.9],
  ["/legal", "yearly", 0.3],
];

// Update this only when the authored guide or format catalog materially changes.
const AUTHORED_CONTENT_LAST_MODIFIED = new Date("2026-08-03T00:00:00.000Z");
const NUZLOCKE_GUIDES_LAST_MODIFIED = new Date("2026-08-07T00:00:00.000Z");

async function pokemonRoutes() {
  const pokemon = await getAllPokemonProfiles();
  return pokemon.map((name) => ({
      url: `https://www.draftcentral.gg/pokemon/${name}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
}

export default async function sitemap() {
  const [leagues, pokemon] = await Promise.all([getPublicLeagueCards(), pokemonRoutes()]);
  const staticRoutes = routes.map(([path, changeFrequency, priority]) => ({
    url: `https://www.draftcentral.gg${path}`,
    changeFrequency,
    priority,
  }));
  const leagueRoutes = leagues.map((league) => ({
    url: `https://www.draftcentral.gg/league/${league.slug}`,
    ...(league.updated_at ? { lastModified: new Date(league.updated_at) } : {}),
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const guideRoutes = Object.keys(GUIDES).map((slug) => ({
    url: `https://www.draftcentral.gg/guides/${slug}`,
    lastModified: AUTHORED_CONTENT_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  const formatRoutes = FORMATS.map((format) => ({
    url: `https://www.draftcentral.gg/formats/${format.slug}`,
    lastModified: AUTHORED_CONTENT_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  const pokemonIndexRoutes = [
    ...POKEMON_TYPES.map((type) => `/pokemon/type/${type}`),
    ...POKEMON_GENERATIONS.map(({ id }) => `/pokemon/generation/${id}`),
  ].map((path) => ({
    url: `https://www.draftcentral.gg${path}`,
    lastModified: AUTHORED_CONTENT_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const nuzlockeGuideRoutes = nuzlockeGameGuides.games.map(({ slug }) => ({
    url: `https://www.draftcentral.gg/nuzlocke/${slug}`,
    lastModified: NUZLOCKE_GUIDES_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...nuzlockeGuideRoutes, ...guideRoutes, ...formatRoutes, ...pokemonIndexRoutes, ...leagueRoutes, ...pokemon];
}
