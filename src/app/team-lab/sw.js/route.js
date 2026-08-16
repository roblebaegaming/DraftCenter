export const dynamic = "force-static";

const serviceWorker = `
const CACHE = "draftcenter-team-lab-shell-v1";
const PUBLIC_SHELL = [
  "/team-lab/offline",
  "/draftcenter-logo.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("draftcenter-team-lab-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/team-lab")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/team-lab/offline")));
});
`;

export function GET() {
  return new Response(serviceWorker, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/team-lab/",
    },
  });
}
