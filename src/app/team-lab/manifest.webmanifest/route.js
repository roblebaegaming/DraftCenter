export const dynamic = "force-static";

export function GET() {
  return Response.json({
    name: "Team Lab by DraftCenter",
    short_name: "Team Lab",
    description: "Pokémon team building, private matchup planning, and a closed- or open-team-sheet Battle Room.",
    id: "/team-lab/",
    start_url: "/team-lab/?source=pwa",
    scope: "/team-lab/",
    display: "standalone",
    background_color: "#090c18",
    theme_color: "#17213b",
    categories: ["games", "utilities"],
    icons: [
      { src: "/draftcenter-logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  }, {
    headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "application/manifest+json" },
  });
}
