import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      { source: "/tools/team-builder", destination: "/team-lab", permanent: true },
      { source: "/my-teams", destination: "/team-lab/teams", permanent: true },
    ];
  },
  async headers() {
    return [{
      source: "/it/:path*",
      headers: [
        { key: "Content-Language", value: "it-IT" },
      ],
    }, {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://pokeapi.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; media-src 'self' https:; worker-src 'self' blob:; upgrade-insecure-requests" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ],
    }];
  },
};
