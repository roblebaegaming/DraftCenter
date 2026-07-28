const origin = new URL(process.env.DRAFTCENTER_SMOKE_ORIGIN || "https://www.draftcentral.gg");
const leagueSlug = String(process.env.DRAFTCENTER_SMOKE_LEAGUE || "").trim();
const paths = ["/", "/calendar", "/resources", "/legal"];

if (leagueSlug) paths.push(`/league/${encodeURIComponent(leagueSlug)}`);

const results = [];
for (const path of paths) {
  const url = new URL(path, origin);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "DraftCenter production smoke" },
    });
    results.push({
      path,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    results.push({
      path,
      status: null,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.name : "request_failed",
    });
  }
}

console.table(results);
if (results.some((result) => !result.ok)) process.exitCode = 1;
