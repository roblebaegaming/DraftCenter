export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/my-teams"] },
    sitemap: "https://www.draftcentral.gg/sitemap.xml",
    host: "https://www.draftcentral.gg",
  };
}
