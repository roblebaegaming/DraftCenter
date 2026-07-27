export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/my-teams", "/calendar"] },
    sitemap: "https://draftcentral.gg/sitemap.xml",
    host: "https://draftcentral.gg",
  };
}
