export const dynamic = "force-static";

export function GET() {
  return Response.json({
    name: "Pokédex Tracker by DraftCenter",
    short_name: "Dex Tracker",
    description: "Private Pokédex checklists, individual collection records, portable backups, and collector workbooks.",
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
  }, {
    headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "application/manifest+json" },
  });
}
