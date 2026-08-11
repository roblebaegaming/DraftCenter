import Link from "next/link";

const items = [
  { id: "overview", label: "Worlds Home", status: "All games", href: "/worlds/2026" },
  { id: "vgc", label: "VGC", status: "Picks open", href: "/worlds/2026/vgc" },
  { id: "tcg", label: "TCG", status: "Not Live", href: "/worlds/2026/tcg" },
  { id: "go", label: "Pokémon GO", status: "Not Live", href: "/worlds/2026/go" },
  { id: "unite", label: "Pokémon UNITE", status: "Not Live", href: "/worlds/2026/unite" },
];

export default function WorldsDisciplineNav({ current = "overview" }) {
  return <nav className="worlds-discipline-nav" aria-label="2026 Worlds prediction competitions">
    {items.map((item) => item.href
      ? <Link key={item.id} href={item.href} aria-current={current === item.id ? "page" : undefined}>
        <span>{item.label}</span><small>{item.status}</small>
      </Link>
      : <span className="is-planned" key={item.id} aria-disabled="true">
        <span>{item.label}</span><small>{item.status}</small>
      </span>)}
  </nav>;
}
