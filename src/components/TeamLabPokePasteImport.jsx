"use client";

import { useMemo, useState } from "react";
import { readTeamLabPokePasteResponse } from "../lib/teamLabPokePaste";
import { parseTeamLabShowdownRoster, TEAM_LAB_SET_IMPORT_LIMIT } from "../lib/teamLabSets";

export default function TeamLabPokePasteImport({
  supabase,
  regulation,
  catalogNames,
  disabled = false,
  onImport,
  onMessage,
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const allowedCatalogNames = useMemo(() => {
    const names = Array.from(catalogNames || []);
    if (!Array.isArray(regulation?.legalNames)) return names;
    const legal = new Set(regulation.legalNames);
    return names.filter((name) => legal.has(name));
  }, [catalogNames, regulation]);

  function applyText(source) {
    const parsed = parseTeamLabShowdownRoster(source, allowedCatalogNames);
    if (!parsed.importedCount) {
      const formatNote = regulation?.name ? ` that are legal in ${regulation.name}` : "";
      onMessage(parsed.warnings[0] || `No recognized Pokémon${formatNote} were found in that paste.`);
      return;
    }
    onImport(parsed);
    const notes = [];
    if (parsed.truncated) notes.push("Only the first six supported Pokémon were kept");
    if (parsed.warnings.length) notes.push(`${parsed.warnings.length} unrecognized, duplicate, or format-ineligible set${parsed.warnings.length === 1 ? " was" : "s were"} skipped`);
    onMessage(`Imported ${parsed.importedCount} Pokémon with their available set details.${notes.length ? ` ${notes.join("; ")}.` : " Save the team to keep it in My Teams."}`);
  }

  async function importUrl() {
    if (!url.trim()) return onMessage("Paste a complete PokéPaste URL first.");
    setBusy(true);
    onMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Sign in before importing a PokéPaste URL. File and pasted-text imports work without an account.");
      const response = await fetch("/api/team-lab/pokepaste", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const importedText = await readTeamLabPokePasteResponse(response);
      setText(importedText);
      applyText(importedText);
    } catch (error) {
      onMessage(error.message || "That PokéPaste could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="team-lab-pokepaste-import">
    <summary>Import a PokéPaste or Showdown team</summary>
    <div className="team-lab-pokepaste-body">
      <p>Importing replaces the current six-Pokémon team and fills its nickname, item, ability, moves, level, EVs, IVs, nature, Tera type, and other supported set fields. Pokémon outside the selected format are skipped.</p>
      <div className="team-lab-pokepaste-url"><label>PokéPaste URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://pokepast.es/..."/></label><button type="button" className="secondary-button" disabled={disabled || busy} onClick={importUrl}>{busy ? "Importing…" : "Import URL"}</button></div>
      <label>PokéPaste / Showdown text<textarea rows={8} maxLength={TEAM_LAB_SET_IMPORT_LIMIT} value={text} onChange={(event) => setText(event.target.value)} placeholder={'Gholdengo @ Leftovers\nAbility: Good as Gold\nEVs: 4 HP / 252 SpA / 252 Spe\nTimid Nature\n- Make It Rain\n- Shadow Ball'}/></label>
      <button type="button" className="secondary-button" disabled={disabled || !text.trim()} onClick={() => applyText(text)}>Import pasted text</button>
      <small>Set details remain private. A public analysis link contains only the six Pokémon and selected format.</small>
    </div>
  </details>;
}
