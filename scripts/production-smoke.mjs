const origin = (process.env.DRAFTCENTER_SMOKE_ORIGIN || "https://www.draftcentral.gg").replace(/\/$/, "");

const publicRoutes = [
  "/",
  "/explore",
  "/leagues",
  "/guides",
  "/formats",
  "/resources",
  "/pokemon",
  "/pokedex-tracker",
  "/team-lab",
  "/worlds/2026/vgc/victory-road-to-san-francisco",
  "/manuals",
  "/manuals/commissioner",
  "/manuals/manager",
  "/support",
  "/legal",
  "/robots.txt",
  "/sitemap.xml",
];

const protectedRoutes = [
  "/api/operations/overview",
  "/api/operations/daily-three",
  "/api/support-access",
  "/api/league-recovery?league_id=00000000-0000-4000-8000-000000000000",
  "/api/account-deletion",
];

let failed = false;

for (const path of publicRoutes) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: "follow" });
    const passed = response.status >= 200 && response.status < 400;
    console.log(`${passed ? "PASS" : "FAIL"} public ${response.status} ${path}`);
    failed ||= !passed;
  } catch (error) {
    console.log(`FAIL public network ${path}: ${error.message}`);
    failed = true;
  }
}

for (const path of protectedRoutes) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    const passed = response.status === 401;
    console.log(`${passed ? "PASS" : "FAIL"} protected ${response.status} ${path}`);
    failed ||= !passed;
  } catch (error) {
    console.log(`FAIL protected network ${path}: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
