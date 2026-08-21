"use client";

import { useEffect, useMemo, useState } from "react";

const INITIAL_MOVE_LIMIT = 48;

function normalizedSearchValue(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function message(pattern, count) {
  return String(pattern || "").replace("{count}", count);
}

export default function LocalizedPokemonMoveList({ moves, languageLocale, labels }) {
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_MOVE_LIMIT);
  useEffect(() => setVisibleLimit(INITIAL_MOVE_LIMIT), [query]);

  const filteredMoves = useMemo(() => {
    const term = normalizedSearchValue(query);
    return term
      ? moves.filter((move) => normalizedSearchValue(move.name).includes(term) || normalizedSearchValue(move.slug).includes(term))
      : moves;
  }, [moves, query]);
  const shown = filteredMoves.slice(0, visibleLimit);

  return <section className="explore-card localized-pokemon-moves">
    <header>
      <div><h2>{labels.title}</h2><p>{labels.body}</p></div>
      <strong aria-live="polite">{filteredMoves.length === 1 ? labels.matchesOne : message(labels.matches, new Intl.NumberFormat(languageLocale).format(filteredMoves.length))}</strong>
    </header>
    <label>{labels.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.placeholder} /></label>
    {moves.some((move) => move.source === "english-fallback") && <p className="pokemon-translation-note">{labels.fallback}</p>}
    {shown.length ? <div className="pokemon-tags localized-pokemon-move-tags">{shown.map((move) => <span key={move.slug}>{move.name}{move.source === "english-fallback" ? <small>{labels.englishFallback}</small> : null}</span>)}</div> : <p className="muted">{labels.empty}</p>}
    {shown.length < filteredMoves.length && <button className="quiet-button localized-pokemon-more" type="button" onClick={() => setVisibleLimit((current) => current + INITIAL_MOVE_LIMIT)}>{labels.more}</button>}
  </section>;
}
