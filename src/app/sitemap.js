import { getPublicLeagueCards } from "../lib/supabase/publicServer";
import { FORMATS, GUIDES, GUIDE_UPDATED_DATE } from "../lib/seoContent";
import { getAllPokemonProfiles, POKEMON_GENERATIONS, POKEMON_TYPES } from "../lib/publicPokemonIndex";
import { POKEMON_COLOR_OPTIONS, POKEMON_EGG_GROUP_OPTIONS, POKEMON_SHAPE_OPTIONS } from "../lib/pokemonSpeciesTraits";
import nuzlockeGameGuides from "../lib/nuzlockeGameGuides.json";

const PRODUCT_DISCOVERY_LAST_MODIFIED = new Date("2026-08-09T00:00:00.000Z");
const WORLDS_2026_LAST_MODIFIED = new Date("2026-08-11T00:00:00.000Z");
const productRouteLastModified = new Map([
  ["/nuzlocke", PRODUCT_DISCOVERY_LAST_MODIFIED],
  ["/tournaments", PRODUCT_DISCOVERY_LAST_MODIFIED],
  ["/resources/daily-games", PRODUCT_DISCOVERY_LAST_MODIFIED],
  ["/worlds/2026", WORLDS_2026_LAST_MODIFIED],
  ["/worlds/2026/vgc", WORLDS_2026_LAST_MODIFIED],
  ["/worlds/2026/tcg", WORLDS_2026_LAST_MODIFIED],
  ["/worlds/2026/vgc/bracket", WORLDS_2026_LAST_MODIFIED],
]);

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
  ["/worlds/2026", "daily", 0.9],
  ["/worlds/2026/vgc", "daily", 0.9],
  ["/worlds/2026/tcg", "daily", 0.9],
  ["/worlds/2026/vgc/bracket", "daily", 0.8],
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
const POKEMON_TRAIT_CONTENT_LAST_MODIFIED = new Date("2026-08-09T00:00:00.000Z");

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
    ...(productRouteLastModified.has(path) ? { lastModified: productRouteLastModified.get(path) } : {}),
    changeFrequency,
    priority,
  }));
  const leagueRoutes = leagues.map((league) => ({
    url: `https://www.draftcentral.gg/league/${league.slug}`,
    ...(league.updated_at ? { lastModified: new Date(league.updated_at) } : {}),
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const guideRoutes = Object.entries(GUIDES).map(([slug, guide]) => ({
    url: `https://www.draftcentral.gg/guides/${slug}`,
    lastModified: new Date(`${guide.updatedDate || GUIDE_UPDATED_DATE}T00:00:00.000Z`),
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
  const pokemonTraitRoutes = [
    "/pokemon/colors",
    "/pokemon/egg-groups",
    "/pokemon/shapes",
    ...POKEMON_COLOR_OPTIONS.map(({ id }) => `/pokemon/color/${id}`),
    ...POKEMON_EGG_GROUP_OPTIONS.map(({ id }) => `/pokemon/egg-group/${id}`),
    ...POKEMON_SHAPE_OPTIONS.map(({ id }) => `/pokemon/shape/${id}`),
  ].map((path) => ({
    url: `https://www.draftcentral.gg${path}`,
    lastModified: POKEMON_TRAIT_CONTENT_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const nuzlockeGuideRoutes = nuzlockeGameGuides.games.map(({ slug }) => ({
    url: `https://www.draftcentral.gg/nuzlocke/${slug}`,
    lastModified: NUZLOCKE_GUIDES_LAST_MODIFIED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...nuzlockeGuideRoutes, ...guideRoutes, ...formatRoutes, ...pokemonIndexRoutes, ...pokemonTraitRoutes, ...leagueRoutes, ...pokemon];
}
