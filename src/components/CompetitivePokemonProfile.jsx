import { competitiveFormatLabel } from "../lib/competitivePokemon";

function displayPeriod(value) {
  if (!value) return "Unknown period";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default function CompetitivePokemonProfile({ observations = [], pokemonName = "This Pokémon" }) {
  if (!observations?.length) return <p className="muted">Competitive observations will appear after {pokemonName} is included in an imported, reviewed format snapshot.</p>;
  return <div className="competitive-profile">
    <p className="muted">Ladder usage is format-specific evidence, not a DraftCenter tier, price, legality rule, or tournament win rate.</p>
    <div className="competitive-observation-grid">
      {observations.map((item) => <article key={`${item.format_id}-${item.period_end}-${item.rating_cutoff}`}>
        <span className="eyebrow">{item.ruleset_family === "vgc" ? "VGC / DOUBLES" : item.battle_style.toUpperCase()}</span>
        <h3>{item.format_name}</h3>
        <strong>{Number(item.weighted_usage).toFixed(2)}% usage</strong>
        <p>Rank #{item.rank} · {Number(item.raw_uses).toLocaleString()} raw uses</p>
        <small>{competitiveFormatLabel(item)} · {displayPeriod(item.period_end)} · {Number(item.total_battles).toLocaleString()} battles</small>
        <a href={item.source_url} target="_blank" rel="noreferrer">View source data ↗</a>
      </article>)}
    </div>
  </div>;
}
