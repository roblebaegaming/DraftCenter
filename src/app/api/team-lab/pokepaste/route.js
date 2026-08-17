import { bearerToken, readBoundedJson } from "../../../../lib/apiSecurity";
import { createPublicServerClient } from "../../../../lib/supabase/publicServer";

export const runtime = "nodejs";
export const maxDuration = 10;

const POKEPASTE_PATTERN = /^https:\/\/pokepast\.es\/([A-Za-z0-9]{4,64})\/?$/;
const MAX_PASTE_BYTES = 60000;

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Sign in before importing a PokéPaste." }, { status: 401 });
  const supabase = createPublicServerClient();
  if (!supabase) return Response.json({ error: "Team Lab imports are temporarily unavailable." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return Response.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });

  const parsed = await readBoundedJson(request, {
    maxBytes: 512,
    maxDepth: 2,
    maxEntries: 3,
    maxArrayLength: 1,
    maxStringLength: 200,
  });
  if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status });
  const match = String(parsed.data?.url || "").trim().match(POKEPASTE_PATTERN);
  if (!match) return Response.json({ error: "Use a complete https://pokepast.es/... link." }, { status: 400 });

  try {
    const response = await fetch(`https://pokepast.es/${match[1]}/raw`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(7000),
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) {
      return Response.json(
        { error: "That PokéPaste could not be loaded." },
        { status: response.status === 404 ? 404 : 502 },
      );
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_PASTE_BYTES) {
      return Response.json({ error: "That PokéPaste is too large to import." }, { status: 413 });
    }
    const text = await response.text();
    if (!text.trim()) return Response.json({ error: "That PokéPaste is empty." }, { status: 422 });
    if (Buffer.byteLength(text, "utf8") > MAX_PASTE_BYTES) {
      return Response.json({ error: "That PokéPaste is too large to import." }, { status: 413 });
    }
    return Response.json(
      { text },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch {
    return Response.json({ error: "That PokéPaste could not be loaded right now." }, { status: 502 });
  }
}
