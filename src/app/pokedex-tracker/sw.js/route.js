export const dynamic = "force-static";

const serviceWorker = `
const CACHE = "draftcenter-collector-shell-v1";
const PUBLIC_SHELL = [
  "/pokedex-tracker/offline",
  "/pokedex-collector-icon-192.png",
  "/pokedex-collector-icon-512.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("draftcenter-collector-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/pokedex-tracker")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/pokedex-tracker/offline")));
});
`;

export function GET() {
  return new Response(serviceWorker, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/pokedex-tracker/",
    },
  });
}
