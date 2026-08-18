"use client";

import {
  buildWorldsChampionOdds,
  WORLDS_2026_ODDS_LEADERS,
  WORLDS_2026_POINTS_URL,
} from "../lib/worlds2026";

const COPY = {
  en: {
    eyebrow: "DRAFTCENTER · 2026 VGC MASTERS",
    title: "Top 10 Worlds Champion Odds",
    body: "Current pre-event, non-betting probabilities across the complete invite-earned Masters field.",
    standings: "Official VGC Masters standings ↗",
  },
  it: {
    eyebrow: "DRAFTCENTER · VGC MASTERS 2026",
    title: "Le 10 migliori probabilità di vittoria ai Mondiali",
    body: "Probabilità attuali pre-evento e non legate alle scommesse per l’intero gruppo Masters con invito.",
    standings: "Classifica ufficiale VGC Masters ↗",
  },
  es: {
    eyebrow: "DRAFTCENTER · VGC MÁSTER 2026",
    title: "Las 10 mejores probabilidades de ganar el Mundial",
    body: "Probabilidades actuales previas al evento, ajenas a las apuestas, para todo el grupo Máster con invitación.",
    standings: "Clasificación oficial de VGC Máster ↗",
  },
};

export default function WorldsChampionOdds({ competitors, entryCount = 0, sampleReady = false, locale = "en" }) {
  const copy = COPY[locale] || COPY.en;
  const odds = buildWorldsChampionOdds(competitors, sampleReady ? entryCount : 0);
  const leaders = odds.slice(0, WORLDS_2026_ODDS_LEADERS);
  const percentage = new Intl.NumberFormat(locale === "it" ? "it-IT" : locale === "es" ? "es-ES" : "en-US", {
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
            <div className="worlds-odds-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, competitor.probability / 0.05 * 100).toFixed(4)}%` }} /></div>
          </div>
          <b className="worlds-odds-value">{percentage.format(competitor.probability)}</b>
        </li>)}
      </ol>
    </div>
  </section>;
}
