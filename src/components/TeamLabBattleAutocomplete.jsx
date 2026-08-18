"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { loadTeamLabBattleSuggestions, prioritizeTeamLabSuggestions } from "../lib/teamLabBattleSuggestions";

export default function TeamLabBattleAutocomplete({
  kind,
  pokemonName = "",
  regulationId = "",
  preferred = [],
  value,
  onChange,
  maxLength = 100,
  placeholder = "",
  autoFocus = false,
  inputRef = null,
  ariaLabel,
}) {
  const id = useId().replace(/:/g, "");
  const [loaded, setLoaded] = useState([]);
  const preferredKey = preferred.filter(Boolean).join("\u0001");
  const preferredValues = useMemo(() => preferredKey ? preferredKey.split("\u0001") : [], [preferredKey]);
  const suggestions = useMemo(() => prioritizeTeamLabSuggestions(preferredValues, loaded), [preferredValues, loaded]);
  const visibleSuggestions = useMemo(() => {
    const query = String(value || "").trim().toLowerCase();
    const matches = query ? suggestions.filter((suggestion) => suggestion.toLowerCase().includes(query)) : suggestions;
    return matches.slice(0, 40);
  }, [suggestions, value]);

  useEffect(() => {
    let cancelled = false;
    if ((kind === "move" || kind === "ability") && !pokemonName) {
      setLoaded([]);
      return undefined;
    }
    loadTeamLabBattleSuggestions(kind, pokemonName, regulationId).then((values) => {
      if (!cancelled) setLoaded(values);
    }).catch(() => {
      if (!cancelled) setLoaded([]);
    });
    return () => { cancelled = true; };
  }, [kind, pokemonName, regulationId]);

  return <>
    <input
      ref={inputRef}
      autoFocus={autoFocus}
      autoComplete="off"
      aria-label={ariaLabel}
      list={visibleSuggestions.length ? `${id}-${kind}` : undefined}
      maxLength={maxLength}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
    {visibleSuggestions.length > 0 && <datalist id={`${id}-${kind}`}>{visibleSuggestions.map((suggestion) => <option key={suggestion} value={suggestion}/>)}</datalist>}
  </>;
}
