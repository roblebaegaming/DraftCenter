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

const spanishLabels = {
  overview: { label: "Inicio del Mundial", status: "Todos los juegos" },
  vgc: { label: "VGC", status: "Pronósticos abiertos" },
  tcg: { label: "TCG", status: "Pronósticos abiertos" },
  go: { label: "Pokémon GO", status: "Pronósticos abiertos" },
  unite: { label: "Pokémon UNITE", status: "No disponible" },
};

const germanLabels = {
  overview: { label: "Worlds-Startseite", status: "Alle Spiele" },
  vgc: { label: "VGC", status: "Tipps offen" },
  tcg: { label: "TCG", status: "Tipps offen" },
  go: { label: "Pokémon GO", status: "Tipps offen" },
  unite: { label: "Pokémon UNITE", status: "Nicht verfügbar" },
};

const japaneseLabels = {
  overview: { label: "世界大会ホーム", status: "全ゲーム" },
  vgc: { label: "VGC", status: "予想受付中" },
  tcg: { label: "TCG", status: "予想受付中" },
  go: { label: "Pokémon GO", status: "予想受付中" },
  unite: { label: "Pokémon UNITE", status: "未公開" },
};

const koreanLabels = {
  overview: { label: "월드 챔피언십 홈", status: "모든 게임" },
  vgc: { label: "VGC", status: "예측 접수 중" },
  tcg: { label: "TCG", status: "예측 접수 중" },
  go: { label: "Pokémon GO", status: "예측 접수 중" },
  unite: { label: "Pokémon UNITE", status: "준비 중" },
};

const localizedLabelsByLocale = { it: italianLabels, es: spanishLabels, de: germanLabels, ja: japaneseLabels, ko: koreanLabels };
const navLabels = {
  en: "2026 Worlds prediction competitions",
  it: "Competizioni pronostici Mondiali 2026",
  es: "Competiciones de pronósticos del Mundial 2026",
  de: "Worlds-Tippwettbewerbe 2026",
  ja: "2026年世界大会予想",
  ko: "2026 월드 챔피언십 예측 대회",
};
const localizedVgcHrefs = { it: "/it/worlds/2026", es: "/es/worlds/2026", de: "/de/worlds/2026", ja: "/ja/worlds/2026", ko: "/ko/worlds/2026" };

export default function WorldsDisciplineNav({ current = "overview", locale = "en" }) {
  const localizedLabels = localizedLabelsByLocale[locale] || null;
  return <nav className="worlds-discipline-nav" aria-label={navLabels[locale] || navLabels.en}>
    {items.map((item) => {
      const copy = localizedLabels ? localizedLabels[item.id] : item;
      const href = item.id === "vgc" && localizedVgcHrefs[locale] ? localizedVgcHrefs[locale] : item.href;
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
