import guideCatalog from "../../../../lib/nuzlockeGameGuides.json";

const GAME_SLUG = /^[a-z0-9-]{1,64}$/;
const AREA_KEY = /^[a-z0-9_-]{1,128}$/;
const guidesBySlug = Object.fromEntries(guideCatalog.games.map((guide) => [guide.slug, guide]));

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game") || "";
  const areaKey = searchParams.get("area") || "";
  if (!GAME_SLUG.test(game) || !AREA_KEY.test(areaKey)) {
    return Response.json({ error: "A valid game and encounter area are required." }, { status: 400 });
  }
  const area = guidesBySlug[game]?.areas.find((candidate) => candidate.areaKey === areaKey);
  if (!area) return Response.json({ error: "Encounter area not found." }, { status: 404 });
  return Response.json({ area }, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
