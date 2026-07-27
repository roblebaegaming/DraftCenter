const routes = [
  ["", "daily", 1],
  ["/explore", "daily", 0.9],
  ["/leagues", "daily", 0.9],
  ["/pokemon", "weekly", 0.9],
  ["/resources", "monthly", 0.7],
  ["/legal", "yearly", 0.3],
];

export default function sitemap() {
  return routes.map(([path, changeFrequency, priority]) => ({
    url: `https://draftcentral.gg${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
