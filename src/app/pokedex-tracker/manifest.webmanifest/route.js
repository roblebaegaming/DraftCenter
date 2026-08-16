export const dynamic = "force-static";

export function GET() {
  return Response.json({
    name: "Pokédex Tracker by DraftCenter",
    short_name: "Dex Tracker",
    description: "Game and DLC Pokédex checklists with correct regional numbers, linked National Dex progress, Pokémon search, and box layouts.",
    id: "/pokedex-tracker/",
    start_url: "/pokedex-tracker/?source=pwa",
    scope: "/pokedex-tracker/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#182542",
    categories: ["games", "utilities"],
    icons: [
      { src: "/pokedex-collector-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pokedex-collector-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    shortcuts: [
      { name: "Find a Pokémon", short_name: "Find", url: "/pokedex-tracker/#pokemon-finder", icons: [{ src: "/pokedex-collector-icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Collection inventory", short_name: "Collection", url: "/pokedex-tracker/#collection-inventory", icons: [{ src: "/pokedex-collector-icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Pokédex box layout", short_name: "Boxes", url: "/pokedex-tracker/#game-box-planner", icons: [{ src: "/pokedex-collector-icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "application/manifest+json" },
  });
}
