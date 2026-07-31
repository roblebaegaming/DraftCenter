import { getPublicLeagueCards } from "../lib/supabase/publicServer";
import { FORMATS, GUIDES } from "../lib/seoContent";

const routes = [
  ["", "daily", 1],
  ["/explore", "daily", 0.9],
  ["/leagues", "daily", 0.9],
  ["/pokemon", "weekly", 0.9],
  ["/resources", "monthly", 0.7],
  ["/manuals", "monthly", 0.8],
  ["/manuals/commissioner", "monthly", 0.8],
  ["/manuals/manager", "monthly", 0.8],
  ["/support", "monthly", 0.5],
  ["/guides", "monthly", 0.9],
  ["/formats", "monthly", 0.9],
  ["/legal", "yearly", 0.3],
];

async function pokemonRoutes() {
  try {
    const response = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000", { next: { revalidate: 86400 } });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((pokemon) => ({
      url: `https://www.draftcentral.gg/pokemon/${pokemon.name}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const [leagues, pokemon] = await Promise.all([getPublicLeagueCards(), pokemonRoutes()]);
  const staticRoutes = routes.map(([path, changeFrequency, priority]) => ({
    url: `https://www.draftcentral.gg${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
  const leagueRoutes = leagues.map((league) => ({
    url: `https://www.draftcentral.gg/league/${league.slug}`,
    lastModified: league.updated_at ? new Date(league.updated_at) : new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const guideRoutes = Object.keys(GUIDES).map((slug) => ({
    url: `https://www.draftcentral.gg/guides/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  const formatRoutes = FORMATS.map((format) => ({
    url: `https://www.draftcentral.gg/formats/${format.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...staticRoutes, ...guideRoutes, ...formatRoutes, ...leagueRoutes, ...pokemon];
}
