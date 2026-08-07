import { notFound, permanentRedirect } from "next/navigation";
import { getPublicPokemonCompetitiveProfile, getPublicPokemonDraftProfile, getPublicPokemonTournamentProfile } from "../../../lib/supabase/publicServer";
import { getAllPokemonProfiles, pokemonProfileCanonicalPath, pokemonProfileSlugCandidates, pokemonProfileSlugForName, pokemonRouteSlug } from "../../../lib/publicPokemonIndex";
import { pokemonDirectoryHref } from "../../../lib/pokemonNavigation";
import CompetitivePokemonProfile from "../../../components/CompetitivePokemonProfile";
import TournamentPokemonProfile from "../../../components/TournamentPokemonProfile";

function titleCase(value) {
  return String(value || "").split("-").map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "").join(" ");
}

function formatHeight(decimeters) {
  const meters = Number(decimeters || 0) / 10;
  const totalInches = Math.round(meters * 39.3701);
  return meters ? `${meters.toFixed(1)} m (${Math.floor(totalInches / 12)} ft ${totalInches % 12} in)` : "Unknown";
}

function formatWeight(hectograms) {
  const kilograms = Number(hectograms || 0) / 10;
  return kilograms ? `${kilograms.toFixed(1)} kg (${(kilograms * 2.20462).toFixed(1)} lb)` : "Unknown";
}

async function loadPokemon(name) {
  const safeName = pokemonRouteSlug(name);
  if (!safeName) return null;
  let pokemonResponse = null;
  for (const candidate of pokemonProfileSlugCandidates(safeName)) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${candidate}`, { next: { revalidate: 86400 } });
    if (response.ok) { pokemonResponse = response; break; }
  }
  if (!pokemonResponse) return null;
  const pokemon = await pokemonResponse.json();
  const speciesName = String(pokemon.species?.name || "").replace(/[^a-z0-9-]/g, "");
  const formName = String(pokemon.forms?.[0]?.name || safeName).replace(/[^a-z0-9-]/g, "");
  const [speciesResponse, formResponse] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}`, { next: { revalidate: 86400 } }),
    fetch(`https://pokeapi.co/api/v2/pokemon-form/${formName}`, { next: { revalidate: 86400 } }),
  ]);
  if (!speciesResponse.ok) return null;
  const [species, form] = await Promise.all([
    speciesResponse.json(),
    formResponse.ok ? formResponse.json() : null,
  ]);
  const displayName = form?.names?.find((entry) => entry.language.name === "en")?.name || titleCase(pokemon.name);
  const [draftProfile, competitiveProfile, tournamentProfile] = await Promise.all([
    getPublicPokemonDraftProfile(displayName),
    getPublicPokemonCompetitiveProfile(pokemon.name),
    getPublicPokemonTournamentProfile(pokemon.name),
  ]);
  return { pokemon, species, form, displayName, draftProfile, competitiveProfile, tournamentProfile };
}

export async function generateMetadata({ params }) {
  const { name } = await params;
  const data = await loadPokemon(name);
  if (!data) return { title: "Pokémon Not Found", robots: { index: false, follow: true } };
  const displayName = data.displayName;
  const genus = data.species.genera?.find((entry) => entry.language.name === "en")?.genus || "Pokémon";
  const types = data.pokemon.types.map(({ type }) => titleCase(type.name)).join("/");
  const description = `${displayName} Pokédex profile: ${types} typing, base stats, abilities, generation, and Pokémon draft-league research on DraftCenter.`;
  const artwork = data.pokemon.sprites?.other?.["official-artwork"]?.front_default;
  return {
    title: `${displayName} Pokédex, Stats and Draft Profile`,
    description,
    alternates: { canonical: pokemonProfileCanonicalPath(data.pokemon.name) },
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
  if (pokemonRouteSlug(name) !== data.pokemon.name) permanentRedirect(pokemonProfileCanonicalPath(data.pokemon.name));
  const { pokemon, species, displayName, draftProfile, competitiveProfile, tournamentProfile } = data;
  const generationNumber = String(species.generation?.url || "").match(/generation\/(\d+)\//)?.[1];
  const availableProfiles = draftProfile?.partners?.length ? new Set(await getAllPokemonProfiles()) : null;
  const baseStatTotal = pokemon.stats.reduce((total, { base_stat }) => total + base_stat, 0);
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
    {species.varieties?.length > 1 && <section className="explore-card">
      <h2>{titleCase(species.name)} forms and varieties</h2>
      <p>Open each battle or stat variety as a separate DraftCenter profile.</p>
      <div className="pokemon-tags">{species.varieties.map(({ is_default, pokemon: variety }) => <a href={`/pokemon/${variety.name}`} key={variety.name}>{titleCase(variety.name)}{is_default ? " (Default)" : ""}</a>)}</div>
    </section>}
    {pokemon.forms?.length > 1 && <section className="explore-card">
      <details>
        <summary>Cosmetic appearances ({pokemon.forms.length})</summary>
        <p>These appearances share this battle profile, so they are grouped here instead of creating duplicate stat pages.</p>
        <div className="pokemon-tags">{pokemon.forms.map((appearance) => <span key={appearance.name}>{titleCase(appearance.name)}</span>)}</div>
      </details>
    </section>}
    <section className="explore-card">
      <h2>{displayName} base stats</h2>
      <div className="pokemon-stats">{pokemon.stats.map(({ base_stat, stat }) => <div key={stat.name}><span>{titleCase(stat.name.replace("special-", "sp-"))}</span><strong>{base_stat}</strong></div>)}<div className="pokemon-bst-total"><span>Base stat total</span><strong>{baseStatTotal}</strong></div></div>
    </section>
    <section className="explore-card">
      <h2>{displayName} Pokédex measurements</h2>
      <div className="career-record-grid pokemon-measurements">
        <article><strong>{formatHeight(pokemon.height)}</strong><span>Height</span></article>
        <article><strong>{formatWeight(pokemon.weight)}</strong><span>Weight</span></article>
        <article><strong>#{String(pokemon.id).padStart(4, "0")}</strong><span>National Pokédex</span></article>
        <article><strong>{titleCase(species.generation?.name || "").replace("Generation ", "")}</strong><span>Introduced</span></article>
      </div>
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
      {draftProfile?.partners?.length ? <><h3>Most common teammates</h3><div className="pokemon-tags">{draftProfile.partners.map((teammate) => { const profileSlug = pokemonProfileSlugForName(teammate.pokemon, availableProfiles); return profileSlug ? <a key={teammate.pokemon} href={`/pokemon/${profileSlug}`}>{teammate.pokemon} · {teammate.teams} roster{teammate.teams === 1 ? "" : "s"}</a> : <span key={teammate.pokemon}>{teammate.pokemon} · {teammate.teams} roster{teammate.teams === 1 ? "" : "s"}</span>; })}</div></> : null}
    </section>
    <section className="explore-card">
      <h2>{displayName} competitive format results</h2>
      <CompetitivePokemonProfile observations={competitiveProfile} pokemonName={displayName} />
    </section>
    <section className="explore-card">
      <h2>{displayName} tournament performance</h2>
      <TournamentPokemonProfile formats={tournamentProfile} pokemonName={displayName} />
    </section>
    <section className="explore-card">
      <h2>Study {displayName} in DraftCenter</h2>
      <p>Open the interactive Pokédex to review moves by game, format legality, DraftCenter community results, draft rate, ADP, auction prices, win rate, and common teammates as the sample grows.</p>
      <a className="primary-button inline-link-button" href={pokemonDirectoryHref(displayName)}>Open {displayName} in the interactive Pokédex</a>
    </section>
    <section className="explore-card">
      <h2>Related {displayName} research</h2>
      <p>Compare this profile with Pokémon that share its types, generation, and supported draft formats.</p>
      <div className="pokemon-tags">{pokemon.types.map(({ type }) => <a key={type.name} href={`/pokemon/type/${type.name}`}>{titleCase(type.name)}-type Pokémon</a>)}{generationNumber ? <a href={`/pokemon/generation/${generationNumber}`}>{titleCase(species.generation?.name)} profiles</a> : null}<a href="/pokemon/a-z">All Pokémon A–Z</a><a href="/formats">Compare draft formats</a></div>
    </section>
    <section className="explore-card pokemon-profile-sources">
      <h2>Sources and methodology</h2>
      <p>Core Pokédex facts, measurements, abilities, and artwork are retrieved from <a href="https://pokeapi.co/" rel="noreferrer">PokéAPI</a> and refreshed daily. DraftCenter community statistics are anonymous aggregates calculated from eligible DraftCenter leagues.</p>
      <p>Draft rate and ADP include eligibility and show their current sample sizes. Auction averages use completed auction samples, while team win rate uses confirmed match results. Small samples should be treated as early evidence, not a definitive ranking.</p>
    </section>
  </main>;
}
