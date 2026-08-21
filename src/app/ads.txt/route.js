import { getAdsTxt } from "../../lib/googleAdsense.js";

export const dynamic = "force-dynamic";

export function GET() {
  const body = getAdsTxt();
  if (!body) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
