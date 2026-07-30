import { notFound } from "next/navigation";
import { getPublicPokemonDraftProfile } from "../../../lib/supabase/publicServer";

function titleCase(value) {
  return String(value || "").split("-").map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "").join(" ");
}

async function loadPokemon(name) {
  const safeName = String(name || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!safeName) return null;
  const [pokemonResponse, speciesResponse, draftProfile] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon/${safeName}`, { next: { revalidate: 86400 } }),
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${safeName}`, { next: { revalidate: 86400 } }),
    getPublicPokemonDraftProfile(titleCase(safeName)),
  ]);
  if (!pokemonResponse.ok || !speciesResponse.ok) return null;
  const [pokemon, species] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);
  return { pokemon, species, draftProfile };
}

export async function generateMetadata({ params }) {
  const { name } = await params;
  const data = await loadPokemon(name);
  if (!data) return { title: "Pokémon Not Found", robots: { index: false, follow: true } };
  const displayName = titleCase(data.pokemon.name);
  const genus = data.species.genera?.find((entry) => entry.language.name === "en")?.genus || "Pokémon";
  const types = data.pokemon.types.map(({ type }) => titleCase(type.name)).join("/");
  const description = `${displayName} Pokédex profile: ${types} typing, base stats, abilities, generation, and Pokémon draft-league research on DraftCenter.`;
  const artwork = data.pokemon.sprites?.other?.["official-artwork"]?.front_default;
  return {
    title: `${displayName} Pokédex, Stats and Draft Profile`,
    description,
    alternates: { canonical: `/pokemon/${data.pokemon.name}` },
    openGraph: {
      type: "article",
      title: `${displayName} — ${genus}`,
      description,
      url: `/pokemon/${data.pokemon.name}`,
      images: artwork ? [{ url: artwork, alt: `${displayName} official artwork` }] : undefined,
    },
  };
}

export default async function PokemonDetailPage({ params }) {
  const { name } = await params;
  const data = await loadPokemon(name);
  if (!data) notFound();
  const { pokemon, species, draftProfile } = data;
  const displayName = titleCase(pokemon.name);
  const genus = species.genera?.find((entry) => entry.language.name === "en")?.genus || "Pokémon";
  const entry = species.flavor_text_entries?.find((item) => item.language.name === "en")?.flavor_text?.replace(/[\n\f]/g, " ");
  const artwork = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${displayName} Pokédex, Stats and Draft Profile`,
        url: `https://www.draftcentral.gg/pokemon/${pokemon.name}`,
        description: `${displayName} stats, typing, abilities, and Pokémon draft-league profile.`,
        primaryImageOfPage: artwork ? { "@type": "ImageObject", url: artwork } : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pokédex", item: "https://www.draftcentral.gg/pokemon" },
          { "@type": "ListItem", position: 3, name: displayName, item: `https://www.draftcentral.gg/pokemon/${pokemon.name}` },
        ],
      },
    ],
  };
  return <main className="explore-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon">← Full Pokédex</a><a className="quiet-button" href="/">DraftCenter Home</a></div>
      <span className="eyebrow">DRAFTCENTER POKÉDEX · #{String(pokemon.id).padStart(4, "0")}</span>
      <h1>{displayName}</h1>
      <p>{genus} · Generation {titleCase(species.generation?.name || "").replace("Generation ", "")}</p>
    </header>
    <section className="explore-card pokemon-seo-profile">
      <div className="pokemon-title">
        {artwork && <img src={artwork} alt={`${displayName} official artwork`} />}
        <div>
          <h2>{pokemon.types.map(({ type }) => titleCase(type.name)).join(" / ")} type</h2>
          <p>{entry || `Explore ${displayName}'s battle profile and draft-league potential.`}</p>
          <div className="pokemon-tags">{pokemon.abilities.map(({ ability, is_hidden }) => <span key={ability.name}>{titleCase(ability.name)}{is_hidden ? " (Hidden)" : ""}</span>)}</div>
        </div>
      </div>
    </section>
    <section className="explore-card">
      <h2>{displayName} base stats</h2>
      <div className="pokemon-stats">{pokemon.stats.map(({ base_stat, stat }) => <div key={stat.name}><span>{titleCase(stat.name.replace("special-", "sp-"))}</span><strong>{base_stat}</strong></div>)}</div>
    </section>
    <section className="explore-card">
      <h2>{displayName} DraftCenter community statistics</h2>
      <p>Anonymous aggregates include all DraftCenter leagues, public and private. Every percentage is shown with its current sample size.</p>
      <div className="career-record-grid">
        <article><strong>{draftProfile?.eligible_drafts ? `${draftProfile.draft_rate || 0}%` : "—"}</strong><span>Draft rate</span><small>{draftProfile?.drafted_in || 0} of {draftProfile?.eligible_drafts || 0} eligible drafts</small></article>
        <article><strong>{draftProfile?.average_pick != null ? `#${draftProfile.average_pick}` : "—"}</strong><span>Eligibility-aware ADP</span><small>Undrafted eligible pools count after the final pick</small></article>
        <article><strong>{draftProfile?.average_auction_price ?? "—"}</strong><span>Average auction price</span><small>{draftProfile?.auction_samples || 0} auction samples</small></article>
        <article><strong>{draftProfile?.games ? `${draftProfile.win_rate || 0}%` : "—"}</strong><span>Team win rate</span><small>{draftProfile?.games ? `${draftProfile.wins || 0}-${draftProfile.games - (draftProfile.wins || 0)} across ${draftProfile.games} matches` : "No confirmed matches yet"}</small></article>
      </div>
      {draftProfile?.adp_by_format?.length ? <><h3>ADP by legal format</h3><div className="public-pick-list">{draftProfile.adp_by_format.map((format) => <div key={format.regulation_id}><strong><a href={`/formats/${format.regulation_id}`}>{titleCase(format.regulation_id)}</a></strong><span>ADP {format.average_pick != null ? `#${format.average_pick}` : "—"} · drafted in {format.drafted_in || 0} of {format.eligible_drafts || 0} eligible pools</span></div>)}</div></> : <p className="muted">Format-specific ADP will appear after {displayName} is eligible in completed snake drafts.</p>}
      {draftProfile?.partners?.length ? <><h3>Most common teammates</h3><div className="pokemon-tags">{draftProfile.partners.map((teammate) => <a key={teammate.pokemon} href={`/pokemon/${String(teammate.pokemon).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}>{teammate.pokemon} · {teammate.teams} roster{teammate.teams === 1 ? "" : "s"}</a>)}</div></> : null}
    </section>
    <section className="explore-card">
      <h2>Study {displayName} in DraftCenter</h2>
      <p>Open the interactive Pokédex to review moves by game, format legality, DraftCenter community results, draft rate, ADP, auction prices, win rate, and common teammates as the sample grows.</p>
      <a className="primary-button inline-link-button" href={`/pokemon?pokemon=${encodeURIComponent(displayName)}`}>Open {displayName} in the interactive Pokédex</a>
    </section>
  </main>;
}
