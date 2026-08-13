import Link from "next/link";

const items = [
  { id: "overview", label: "Worlds Home", status: "All games", href: "/worlds/2026" },
  { id: "vgc", label: "VGC", status: "Picks open", href: "/worlds/2026/vgc" },
  { id: "tcg", label: "TCG", status: "Picks open", href: "/worlds/2026/tcg" },
  { id: "go", label: "Pokémon GO", status: "Picks open", href: "/worlds/2026/go" },
  { id: "unite", label: "Pokémon UNITE", status: "Not Live", href: "/worlds/2026/unite" },
];

const italianLabels = {
  overview: { label: "Home Mondiali", status: "Tutti i giochi" },
  vgc: { label: "VGC", status: "Pronostici aperti" },
  tcg: { label: "TCG", status: "Pronostici aperti" },
  go: { label: "Pokémon GO", status: "Pronostici aperti" },
  unite: { label: "Pokémon UNITE", status: "Non disponibile" },
};

export default function WorldsDisciplineNav({ current = "overview", locale = "en" }) {
  const isItalian = locale === "it";
  return <nav className="worlds-discipline-nav" aria-label={isItalian ? "Competizioni pronostici Mondiali 2026" : "2026 Worlds prediction competitions"}>
    {items.map((item) => {
      const copy = isItalian ? italianLabels[item.id] : item;
      const href = isItalian && item.id === "vgc" ? "/it/worlds/2026" : item.href;
      return href
      ? <Link key={item.id} href={href} aria-current={current === item.id ? "page" : undefined}>
        <span>{copy.label}</span><small>{copy.status}</small>
      </Link>
      : <span className="is-planned" key={item.id} aria-disabled="true">
        <span>{copy.label}</span><small>{copy.status}</small>
      </span>;
    })}
  </nav>;
}
