export default function manifest() {
  return {
    name: "DraftCenter",
    short_name: "DraftCenter",
    description: "Pokémon draft leagues, community data, and shared teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#10121c",
    theme_color: "#182542",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
