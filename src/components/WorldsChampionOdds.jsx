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
  fr: {
    eyebrow: "DRAFTCENTER · VGC MASTERS 2026",
    title: "Top 10 des chances de victoire aux Worlds",
    body: "Probabilités actuelles avant l’événement, sans lien avec les paris, pour l’ensemble des joueurs Masters ayant obtenu une invitation.",
    standings: "Classement officiel VGC Masters ↗",
  },
  de: {
    eyebrow: "DRAFTCENTER · VGC MASTERS 2026",
    title: "Top 10 der Worlds-Siegchancen",
    body: "Aktuelle Vorab-Wahrscheinlichkeiten ohne Wettbezug für das gesamte Masters-Feld mit Einladung.",
    standings: "Offizielle VGC-Masters-Rangliste ↗",
  },
  ja: {
    eyebrow: "DRAFTCENTER · 2026 VGCマスター",
    title: "世界王者の予想確率 Top 10",
    body: "招待権を獲得したマスター全選手を対象とする、賭けとは無関係の大会前予想です。",
    standings: "VGCマスター公式順位 ↗",
  },
  ko: {
    eyebrow: "DRAFTCENTER · 2026 VGC 마스터",
    title: "월드 챔피언 우승 확률 Top 10",
    body: "초청권을 얻은 마스터 전체 선수를 대상으로 한 비베팅 사전 예측 확률입니다.",
    standings: "VGC 마스터 공식 순위 ↗",
  },
};

const NUMBER_FORMAT_LOCALES = { en: "en-US", it: "it-IT", es: "es-ES", fr: "fr-FR", de: "de-DE", ja: "ja-JP", ko: "ko-KR" };

export default function WorldsChampionOdds({ competitors, entryCount = 0, sampleReady = false, locale = "en" }) {
  const copy = COPY[locale] || COPY.en;
  const odds = buildWorldsChampionOdds(competitors, sampleReady ? entryCount : 0);
  const leaders = odds.slice(0, WORLDS_2026_ODDS_LEADERS);
  const percentage = new Intl.NumberFormat(NUMBER_FORMAT_LOCALES[locale] || NUMBER_FORMAT_LOCALES.en, {
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
