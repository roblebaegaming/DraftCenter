"use client";

import { useRef, useState } from "react";
import {
  buildWorldsRosterSetupTemplate,
  buildWorldsUniteSetupTemplate,
  downloadJsonFile,
  validateWorldsRosterSetupDraft,
  validateWorldsUniteSetupDraft,
} from "../lib/worldsFutureSetup";

const workspaces = {
  tcg: {
    title: "TCG Masters roster",
    copy: "Prepare the complete Masters roster while entries stay closed. The blank draft includes 425 official Championship Point slots and can be resized after direct and separately managed invites are reconciled.",
    filename: "draftcenter-2026-tcg-masters-roster-draft.json",
    build: () => buildWorldsRosterSetupTemplate("tcg", 425),
    validate: (value) => validateWorldsRosterSetupDraft(value, "tcg"),
  },
  go: {
    title: "Pokémon GO Trainer roster",
    copy: "Prepare the individual Trainer roster without exposing names or opening Pick 10. The blank draft starts with the reviewed 220-slot Championship Point base.",
    filename: "draftcenter-2026-pokemon-go-roster-draft.json",
    build: () => buildWorldsRosterSetupTemplate("go", 220),
    validate: (value) => validateWorldsRosterSetupDraft(value, "go"),
  },
  unite: {
    title: "Pokémon UNITE teams and bracket",
    copy: "Prepare reviewed team identities and aliases now. Groups, advancing teams, and elimination matches remain empty until Pokémon publishes the official structure.",
    filename: "draftcenter-2026-pokemon-unite-team-draft.json",
    build: () => buildWorldsUniteSetupTemplate(15),
    validate: validateWorldsUniteSetupDraft,
  },
};

function summaryText(summary, key) {
  if (!summary) return "No draft loaded in this browser session.";
  if (key === "unite") return `${summary.completed} of ${summary.slots} team rows complete · ${summary.groups} official groups · ${summary.matches} elimination matches${summary.readyForStructureReview ? " · ready for source and structure review" : ""}.`;
  return `${summary.completed} of ${summary.slots} roster rows complete${summary.readyToReview ? " · ready for source review" : ""}.`;
}

export default function WorldsFutureOperations() {
  const tcgInput = useRef(null);
  const goInput = useRef(null);
  const uniteInput = useRef(null);
  const inputs = { tcg: tcgInput, go: goInput, unite: uniteInput };
  const [drafts, setDrafts] = useState({});
  const [summaries, setSummaries] = useState({});
  const [messages, setMessages] = useState({});

  function message(key, value) {
    setMessages((current) => ({ ...current, [key]: value }));
  }

  function downloadBlank(key) {
    const workspace = workspaces[key];
    downloadJsonFile(workspace.filename, workspace.build());
    message(key, "Blank draft downloaded. Nothing was published or saved to DraftCenter.");
  }

  async function loadDraft(key, file) {
    if (!file) return;
    if (file.size > 1024 * 1024) return message(key, "The setup file must be 1 MB or smaller.");
    try {
      const value = JSON.parse(await file.text());
      const summary = workspaces[key].validate(value);
      setDrafts((current) => ({ ...current, [key]: value }));
      setSummaries((current) => ({ ...current, [key]: summary }));
      message(key, "Draft validated locally. Nothing was published.");
    } catch (error) {
      message(key, error.message || "The setup file could not be validated.");
    } finally {
      if (inputs[key].current) inputs[key].current.value = "";
    }
  }

  function downloadLoaded(key) {
    const workspace = workspaces[key];
    const draft = drafts[key];
    if (!draft) return message(key, "Load a setup JSON before downloading its validated copy.");
    workspace.validate(draft);
    downloadJsonFile(workspace.filename, draft);
    message(key, "Validated draft downloaded. Nothing was published or saved to DraftCenter.");
  }

  return <section className="worlds-future-operations" aria-labelledby="worlds-future-operations-title">
    <header>
      <div><span className="eyebrow">OWNER-ONLY DRAFT WORKSPACE</span><h2 id="worlds-future-operations-title">TCG, GO, and UNITE event preparation</h2></div>
      <p>Download a fail-closed JSON workspace, edit it offline, and load it back for local validation. These tools cannot publish a roster, open entries, create pairings, or enable results polling.</p>
    </header>
    <div className="worlds-future-operation-grid">
      {Object.entries(workspaces).map(([key, workspace]) => <article key={key}>
        <span className="eyebrow">{key === "unite" ? "TEAM BRACKET" : "PICK 10 ROSTER"}</span>
        <h3>{workspace.title}</h3>
        <p>{workspace.copy}</p>
        <strong>{summaryText(summaries[key], key)}</strong>
        <div className="worlds-operation-actions">
          <button className="quiet-button" type="button" onClick={() => downloadBlank(key)}>Download blank JSON</button>
          <button className="quiet-button" type="button" onClick={() => inputs[key].current?.click()}>Load setup JSON</button>
          <button className="primary-button" type="button" disabled={!drafts[key]} onClick={() => downloadLoaded(key)}>Download validated copy</button>
          <input ref={inputs[key]} hidden type="file" accept="application/json,.json" onChange={(event) => loadDraft(key, event.target.files?.[0])} />
        </div>
        {messages[key] && <p className="worlds-operation-message" role="status">{messages[key]}</p>}
      </article>)}
    </div>
  </section>;
}
