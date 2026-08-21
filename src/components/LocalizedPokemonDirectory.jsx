"use client";

import { useEffect, useMemo, useState } from "react";

const INITIAL_RESULT_LIMIT = 60;
const DEX_NUMBER = 0;
const PROFILE_SLUG = 1;
const NAME = 2;
const ALIASES = 3;
const GENERATION = 4;
const TYPE_SLUGS = 5;
const ABILITY_SLUGS = 6;

function normalizedSearchValue(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function localizedPath(locale, profileSlug) {
  return `${locale === "en" ? "" : `/${locale}`}/pokemon/${profileSlug}`;
}

function message(pattern, key, value) {
  return String(pattern || "").replace(`{${key}}`, value);
}

export default function LocalizedPokemonDirectory({ locale, languageLocale, pokemon, typeOptions, abilityOptions, labels }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [generation, setGeneration] = useState("");
  const [ability, setAbility] = useState("");
  const [sort, setSort] = useState("number");
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_RESULT_LIMIT);

  useEffect(() => setVisibleLimit(INITIAL_RESULT_LIMIT), [query, type, generation, ability, sort]);

  const typeNames = useMemo(() => new Map(typeOptions.map((option) => [option.slug, option.name])), [typeOptions]);

  const results = useMemo(() => {
    const term = normalizedSearchValue(query).replace(/^#/, "");
    const collator = new Intl.Collator(languageLocale, { sensitivity: "base", numeric: true });
    return pokemon
      .filter((entry) => {
        const nameMatch = !term
          || String(entry[DEX_NUMBER]) === term
          || entry[ALIASES].some((name) => normalizedSearchValue(name).includes(term))
          || normalizedSearchValue(entry[PROFILE_SLUG]).includes(term);
        return nameMatch
          && (!type || entry[TYPE_SLUGS].includes(type))
          && (!generation || String(entry[GENERATION]) === generation)
          && (!ability || entry[ABILITY_SLUGS].includes(ability));
      })
      .sort((left, right) => sort === "name"
        ? collator.compare(left[NAME], right[NAME]) || left[DEX_NUMBER] - right[DEX_NUMBER]
        : left[DEX_NUMBER] - right[DEX_NUMBER]);
  }, [ability, generation, languageLocale, pokemon, query, sort, type]);

  const shown = results.slice(0, visibleLimit);
  const clear = () => {
    setQuery("");
    setType("");
    setGeneration("");
    setAbility("");
    setSort("number");
  };

  return <section className="explore-card localized-pokemon-directory" aria-labelledby="localized-pokemon-directory-title">
    <header>
      <div>
        <h2 id="localized-pokemon-directory-title">{labels.title}</h2>
        <p>{labels.body}</p>
      </div>
      <strong aria-live="polite">{results.length === 1 ? labels.matchesOne : message(labels.matches, "count", new Intl.NumberFormat(languageLocale).format(results.length))}</strong>
    </header>
    <div className="localized-pokemon-directory-filters">
      <label className="localized-pokemon-directory-search">{labels.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} /></label>
      <label>{labels.type}<select value={type} onChange={(event) => setType(event.target.value)}><option value="">{labels.allTypes}</option>{typeOptions.map((option) => <option value={option.slug} key={option.slug}>{option.name}{option.source === "english-fallback" ? ` · ${labels.englishFallback}` : ""}</option>)}</select></label>
      <label>{labels.generation}<select value={generation} onChange={(event) => setGeneration(event.target.value)}><option value="">{labels.allGenerations}</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => <option value={number} key={number}>{message(labels.generationPattern, "number", number)}</option>)}</select></label>
      <label>{labels.ability}<select value={ability} onChange={(event) => setAbility(event.target.value)}><option value="">{labels.allAbilities}</option>{abilityOptions.map((option) => <option value={option.slug} key={option.slug}>{option.name}{option.source === "english-fallback" ? ` · ${labels.englishFallback}` : ""}</option>)}</select></label>
      <label>{labels.sort}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="number">{labels.sortNumber}</option><option value="name">{labels.sortName}</option></select></label>
    </div>
    <button className="text-button localized-pokemon-clear" type="button" onClick={clear}>{labels.clear}</button>
    {shown.length ? <div className="localized-pokemon-results">{shown.map((entry) => <a href={localizedPath(locale, entry[PROFILE_SLUG])} key={entry[PROFILE_SLUG]} aria-label={message(labels.open, "name", entry[NAME])}>
      <span>#{String(entry[DEX_NUMBER]).padStart(4, "0")}</span>
      <strong>{entry[NAME]}</strong>
      <small>{entry[TYPE_SLUGS].map((slug) => typeNames.get(slug) || slug).join(" / ")} · {message(labels.generationPattern, "number", entry[GENERATION])}</small>
    </a>)}</div> : <p className="muted localized-pokemon-empty">{labels.empty}</p>}
    {shown.length < results.length && <button className="quiet-button localized-pokemon-more" type="button" onClick={() => setVisibleLimit((current) => current + INITIAL_RESULT_LIMIT)}>{labels.more}</button>}
  </section>;
}
