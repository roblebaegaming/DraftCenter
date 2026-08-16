"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PUBLIC_BRACKET_CARD_STYLES,
  PUBLIC_BRACKET_FONTS,
  PUBLIC_BRACKET_SIZES,
  PUBLIC_BRACKET_THEMES,
  buildPublicBracketRounds,
  choosePublicBracketWinner,
  createPublicBracketEntrants,
  normalizePublicBracketEntrants,
  parsePublicBracketNames,
  publicBracketEntrantLabel,
  publicBracketFont,
  publicBracketRoundLabel,
  publicBracketTheme,
} from "../lib/publicBracketBuilder.js";
import { downloadPublicBracketPng } from "../lib/publicBracketImage.js";

const STORAGE_KEY = "draftcenter:public-bracket-studio:v1";
const DEFAULT_SIZE = 8;

function safelyRestoreDraft(value) {
  if (!value || typeof value !== "object") return null;
  const size = PUBLIC_BRACKET_SIZES.includes(Number(value.size)) ? Number(value.size) : DEFAULT_SIZE;
  const entrants = normalizePublicBracketEntrants(size, value.entrants);
  const bracket = buildPublicBracketRounds({ size, entrants, picks: value.picks });
  return {
    title: String(value.title || "My Tournament Bracket").slice(0, 90),
    subtitle: String(value.subtitle || "Single elimination").slice(0, 140),
    size,
    entrants,
    picks: bracket.picks,
    themeId: PUBLIC_BRACKET_THEMES.some((theme) => theme.id === value.themeId) ? value.themeId : "midnight",
    fontId: PUBLIC_BRACKET_FONTS.some((font) => font.id === value.fontId) ? value.fontId : "modern",
    cardStyleId: PUBLIC_BRACKET_CARD_STYLES.some((style) => style.id === value.cardStyleId) ? value.cardStyleId : "soft",
  };
}

export default function PublicBracketBuilder() {
  const [title, setTitle] = useState("My Tournament Bracket");
  const [subtitle, setSubtitle] = useState("Single elimination");
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [entrants, setEntrants] = useState(() => createPublicBracketEntrants(DEFAULT_SIZE));
  const [picks, setPicks] = useState({});
  const [themeId, setThemeId] = useState("midnight");
  const [fontId, setFontId] = useState("modern");
  const [cardStyleId, setCardStyleId] = useState("soft");
  const [bulkNames, setBulkNames] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const restored = safelyRestoreDraft(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"));
      if (restored) {
        setTitle(restored.title);
        setSubtitle(restored.subtitle);
        setSize(restored.size);
        setEntrants(restored.entrants);
        setPicks(restored.picks);
        setThemeId(restored.themeId);
        setFontId(restored.fontId);
        setCardStyleId(restored.cardStyleId);
        setNotice("Recovered your last bracket from this browser.");
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, subtitle, size, entrants, picks, themeId, fontId, cardStyleId }));
    } catch {
      setNotice("This browser blocked local recovery, but you can still finish and download your bracket.");
    }
  }, [cardStyleId, entrants, fontId, picks, ready, size, subtitle, themeId, title]);

  const bracket = useMemo(() => buildPublicBracketRounds({ size, entrants, picks }), [entrants, picks, size]);
  const theme = publicBracketTheme(themeId);
  const font = publicBracketFont(fontId);
  const totalMatches = size - 1;
  const completedMatches = Object.keys(bracket.picks).length;
  const boardHeight = Math.max(620, bracket.rounds[0].length * 92);
  const boardStyle = {
    "--studio-background": theme.background,
    "--studio-background-alt": theme.backgroundAlt,
    "--studio-card": theme.card,
    "--studio-card-alt": theme.cardAlt,
    "--studio-text": theme.text,
    "--studio-muted": theme.muted,
    "--studio-accent": theme.accent,
    "--studio-winner": theme.winner,
    "--studio-line": theme.line,
    "--studio-radius": `${PUBLIC_BRACKET_CARD_STYLES.find((style) => style.id === cardStyleId)?.radius || 14}px`,
    fontFamily: font.css,
  };

  function changeSize(nextSize) {
    const numericSize = Number(nextSize);
    setSize(numericSize);
    setEntrants(createPublicBracketEntrants(numericSize, entrants));
    setPicks({});
    setNotice(`Started a ${numericSize}-competitor bracket. Winner picks were cleared.`);
  }

  function changeEntrant(index, name) {
    setEntrants((current) => current.map((entrant, entrantIndex) => entrantIndex === index ? { ...entrant, name: name.slice(0, 80) } : entrant));
  }

  function chooseWinner(round, match, winnerId) {
    setPicks((current) => choosePublicBracketWinner({ size, entrants, picks: current, round, match, winnerId }));
    setNotice("");
  }

  function applyBulkNames() {
    const nextEntrants = parsePublicBracketNames(bulkNames, size);
    setEntrants(nextEntrants);
    setPicks({});
    setNotice(`Added ${nextEntrants.filter((entrant) => entrant.name).length} names. Winner picks were cleared.`);
  }

  function clearWinners() {
    setPicks({});
    setNotice("Winner picks cleared. Your names and design are unchanged.");
  }

  function downloadBracket() {
    downloadPublicBracketPng({ title, subtitle, size, entrants, picks: bracket.picks, themeId, fontId, cardStyleId });
    setNotice("Your high-resolution PNG is downloading.");
  }

  return <main className="public-bracket-studio">
    <section className="public-bracket-hero">
      <span className="eyebrow">FREE BRACKET STUDIO</span>
      <h1>Make a bracket. Download it. It’s yours.</h1>
      <p>Build a polished single-elimination bracket for any competition. Nothing is published, no account is needed, and your work stays in this browser.</p>
      <div className="public-bracket-hero-actions"><a className="primary-button inline-link-button" href="#bracket-workspace">Start building</a><a className="quiet-button" href="/predictions">Join live predictions</a><a className="quiet-button" href="/tools/mega-bracket">Play the Pokémon Mega Bracket</a></div>
      <ul aria-label="Bracket Studio features"><li>4–32 competitors</li><li>Click-to-advance winners</li><li>High-resolution PNG</li><li>Private browser recovery</li></ul>
    </section>

    <section className="public-bracket-workspace" id="bracket-workspace">
      <aside className="public-bracket-controls" aria-label="Bracket controls">
        <header><span className="eyebrow">SETUP</span><h2>Build your competition</h2><p>Edit one name at a time or paste the whole field at once.</p></header>

        <label className="studio-field"><span>Bracket title</span><input maxLength={90} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <label className="studio-field"><span>Subtitle</span><input maxLength={140} onChange={(event) => setSubtitle(event.target.value)} value={subtitle} /></label>

        <fieldset className="studio-choice-group"><legend>Competitors</legend><div className="studio-size-options">{PUBLIC_BRACKET_SIZES.map((option) => <button aria-pressed={size === option} className={size === option ? "is-selected" : ""} key={option} onClick={() => changeSize(option)} type="button">{option}</button>)}</div></fieldset>

        <details className="studio-bulk-entry"><summary>Paste a full list</summary><p>Use one competitor per line. Numbered lists work too.</p><textarea onChange={(event) => setBulkNames(event.target.value)} placeholder={`1. Competitor one\n2. Competitor two\n3. Competitor three`} rows={7} value={bulkNames} /><button className="quiet-button" disabled={!bulkNames.trim()} onClick={applyBulkNames} type="button">Use these names</button></details>

        <div className="studio-entrant-list"><h3>First-round order</h3>{entrants.map((entrant, index) => <label key={entrant.id}><span>{index + 1}</span><input aria-label={`Competitor ${index + 1}`} maxLength={80} onChange={(event) => changeEntrant(index, event.target.value)} placeholder={`Seed ${index + 1}`} value={entrant.name} /></label>)}</div>

        <section className="studio-design-controls"><span className="eyebrow">DESIGN</span><h2>Choose the look</h2>
          <fieldset className="studio-choice-group studio-theme-options"><legend>Color theme</legend><div>{PUBLIC_BRACKET_THEMES.map((option) => <button aria-pressed={themeId === option.id} className={themeId === option.id ? "is-selected" : ""} key={option.id} onClick={() => setThemeId(option.id)} style={{ "--swatch-background": option.background, "--swatch-accent": option.accent, "--swatch-winner": option.winner }} type="button"><i aria-hidden="true"><b /><b /><b /></i><span>{option.label}</span></button>)}</div></fieldset>
          <label className="studio-field"><span>Font</span><select onChange={(event) => setFontId(event.target.value)} value={fontId}>{PUBLIC_BRACKET_FONTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <fieldset className="studio-choice-group"><legend>Matchup shape</legend><div className="studio-card-options">{PUBLIC_BRACKET_CARD_STYLES.map((option) => <button aria-pressed={cardStyleId === option.id} className={cardStyleId === option.id ? "is-selected" : ""} key={option.id} onClick={() => setCardStyleId(option.id)} type="button"><i style={{ borderRadius: option.radius }} />{option.label}</button>)}</div></fieldset>
        </section>
      </aside>

      <div className="public-bracket-preview-panel">
        <header className="studio-preview-header"><div><span className="eyebrow">LIVE PREVIEW</span><h2>{completedMatches}/{totalMatches} winners chosen</h2></div><div><button className="quiet-button" disabled={!completedMatches} onClick={clearWinners} type="button">Clear winners</button><button className="primary-button" onClick={downloadBracket} type="button">Download PNG</button></div></header>
        <p className="studio-notice" aria-live="polite">{notice || (bracket.champion ? `${publicBracketEntrantLabel(bracket.champion)} is your champion.` : "Click a competitor in each matchup to advance them.")}</p>
        <div className="studio-preview-scroll">
          <div className={`studio-bracket-preview card-${cardStyleId}`} style={boardStyle}>
            <div className="studio-bracket-title"><span>TOURNAMENT BRACKET</span><h2>{title || "My Tournament Bracket"}</h2><p>{subtitle || `${size}-competitor single elimination`}</p></div>
            <div className="studio-bracket-rounds">
              {bracket.rounds.map((round, roundIndex) => <section className="studio-bracket-round" key={roundIndex} style={{ height: boardHeight }}><h3>{publicBracketRoundLabel(size, roundIndex + 1)}</h3><div>{round.map((match) => <article className="studio-matchup" key={match.key}>{[match.a, match.b].map((entrant, slotIndex) => {
                const selected = Boolean(entrant && entrant.id === match.winnerId);
                return <button aria-label={entrant ? `Advance ${publicBracketEntrantLabel(entrant)} from ${publicBracketRoundLabel(size, roundIndex + 1)}` : "Waiting for an earlier winner"} className={selected ? "is-winner" : ""} disabled={!entrant} key={entrant?.id || `${match.key}-${slotIndex}`} onClick={() => entrant && chooseWinner(match.round, match.match, entrant.id)} type="button"><span>{entrant ? publicBracketEntrantLabel(entrant) : "Winner TBD"}</span><small>{selected ? "Advances" : entrant ? "Choose" : ""}</small></button>;
              })}</article>)}</div></section>)}
              <section className="studio-bracket-round studio-champion-round" style={{ height: boardHeight }}><h3>Champion</h3><div><article><small>WINNER</small><strong>{bracket.champion ? publicBracketEntrantLabel(bracket.champion) : "Choose a champion"}</strong></article></div></section>
            </div>
            <footer><span>Made with DraftCenter Bracket Studio</span><span>Download only · Not published</span></footer>
          </div>
        </div>
        <aside className="studio-privacy-note"><strong>Private by design</strong><p>This free builder does not upload your names or create a public URL. Your draft is stored only in this browser so an accidental refresh does not erase it.</p></aside>
      </div>
    </section>

    <section className="public-bracket-future"><span className="eyebrow">BUILT TO GROW</span><h2>A fast foundation for a much bigger bracket studio.</h2><p>This release keeps the core experience genuinely free and useful. More formats, deeper design controls, participant images, reusable brand kits, and premium options can be added after the workflow earns its place—without putting a checkout screen in front of today’s builder.</p></section>
  </main>;
}
