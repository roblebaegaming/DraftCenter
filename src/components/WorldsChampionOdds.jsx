"use client";

import {
  buildWorldsChampionOdds,
  WORLDS_2026_ODDS_LEADERS,
  WORLDS_2026_ODDS_WEIGHTS,
  WORLDS_2026_POINTS_URL,
} from "../lib/worlds2026";

const COPY = {
  en: {
    eyebrow: "MODELLED CHAMPION OUTLOOK",
    title: "Top 10 Worlds favorites",
    body: "A transparent, non-betting forecast across the complete invite-earned field. It will evolve as published results and enough community entries become available.",
    standings: "Official VGC Masters standings ↗",
    method: "How the model is weighted",
    note: "Every invitee keeps a probability. The complete field totals 100%, and no player can exceed 5% before Worlds begins.",
    communityReady: (count) => `Community signal active · ${count} entries`,
    communityWaiting: "Aggregate community signal activates at 25 entries · lineups stay private until lock",
    labels: ["Season standing and form", "Event wins", "International wins", "Worlds titles", "Community picks and Champion choices"],
    wins: (season, international, worlds) => `${season} event win${season === 1 ? "" : "s"} · ${international} International win${international === 1 ? "" : "s"} · ${worlds} Worlds title${worlds === 1 ? "" : "s"}`,
  },
  it: {
    eyebrow: "PROIEZIONE DEL MODELLO",
    title: "I 10 favoriti per il Mondiale",
    body: "Una previsione trasparente e non legata alle scommesse sull’intero gruppo degli invitati. Si aggiorna con i risultati pubblicati e con un campione sufficiente di pronostici della community.",
    standings: "Classifica ufficiale VGC Masters ↗",
    method: "Pesi del modello",
    note: "Ogni invitato mantiene una probabilità. L’intero gruppo totalizza il 100% e nessun giocatore può superare il 5% prima dell’inizio del Mondiale.",
    communityReady: (count) => `Segnale della community attivo · ${count} pronostici`,
    communityWaiting: "Il segnale aggregato della community si attiva a 25 pronostici · le singole scelte restano private fino alla chiusura",
    labels: ["Classifica e forma stagionale", "Vittorie negli eventi", "Vittorie agli Internazionali", "Titoli mondiali", "Scelte della community e Campione"],
    wins: (season, international, worlds) => `${season} ${season === 1 ? "vittoria nell’evento" : "vittorie negli eventi"} · ${international} ${international === 1 ? "vittoria all’Internazionale" : "vittorie agli Internazionali"} · ${worlds} ${worlds === 1 ? "titolo mondiale" : "titoli mondiali"}`,
  },
};

export default function WorldsChampionOdds({ competitors, entryCount = 0, sampleReady = false, locale = "en" }) {
  const copy = COPY[locale] || COPY.en;
  const odds = buildWorldsChampionOdds(competitors, sampleReady ? entryCount : 0);
  const leaders = odds.slice(0, WORLDS_2026_ODDS_LEADERS);
  const percentage = new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  if (!leaders.length) return null;

  return <section className="worlds-odds-card" id="champion-odds">
    <header className="section-heading">
      <div>
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>
      <a className="quiet-button" href={WORLDS_2026_POINTS_URL} target="_blank" rel="noreferrer">{copy.standings}</a>
    </header>
    <div className="worlds-odds-layout">
      <ol className="worlds-odds-list">
        {leaders.map((competitor, index) => <li key={competitor.slug}>
          <span className="worlds-odds-rank">{index + 1}</span>
          <div className="worlds-odds-player">
            <div><strong>{competitor.displayName}</strong><span>{competitor.countryCode}</span></div>
            <small>{copy.wins(competitor.seasonWins, competitor.internationalWins, competitor.worldsTitles)}</small>
            <div className="worlds-odds-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, competitor.probability / 0.05 * 100).toFixed(4)}%` }} /></div>
          </div>
          <b className="worlds-odds-value">{percentage.format(competitor.probability)}</b>
        </li>)}
      </ol>
      <aside className="worlds-odds-method">
        <span>{sampleReady ? copy.communityReady(entryCount) : copy.communityWaiting}</span>
        <h3>{copy.method}</h3>
        <ul>{Object.values(WORLDS_2026_ODDS_WEIGHTS).map((weight, index) => <li key={copy.labels[index]}><span>{copy.labels[index]}</span><strong>{percentage.format(weight)}</strong></li>)}</ul>
        <p>{copy.note}</p>
      </aside>
    </div>
  </section>;
}
