"use client";

import React, { useState } from "react";
import {
  downloadWorldsPickShareBlob,
  worldsPickShareBlob,
  worldsShareFileName,
} from "../lib/worldsPickShare";
import { worldsCopy } from "../lib/worlds2026I18n";

export default function WorldsPickShare({ discipline, gameLabel, picks, championSlug, displayName, pickCount = 10, locale = "en" }) {
  const isItalian = locale === "it";
  const copy = isItalian ? worldsCopy("it").share : null;
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const ready = picks.length === pickCount && Boolean(championSlug) && picks.some(({ slug }) => slug === championSlug);
  const fileName = worldsShareFileName(discipline);

  const cardOptions = { discipline, gameLabel, picks, championSlug, displayName, pickCount };

  async function createBlob() {
    return await worldsPickShareBlob(cardOptions);
  }

  async function downloadCard() {
    if (!ready || busy) return;
    setBusy("download");
    setMessage("");
    try {
      const blob = await createBlob();
      downloadWorldsPickShareBlob(blob, fileName);
      setMessage(isItalian ? copy.downloaded : "Image downloaded.");
    } catch (error) {
      setMessage(isItalian ? copy.error : error?.message || "We couldn't download your picks image.");
    } finally {
      setBusy("");
    }
  }

  return <section className={`worlds-pick-share${ready ? " is-ready" : ""}`} aria-labelledby="worlds-pick-share-heading">
    <div>
      <h3 id="worlds-pick-share-heading">{isItalian ? copy.title : "Share your picks"}</h3>
      {!ready && <p>{isItalian ? copy.incomplete(pickCount) : <>Choose your top {pickCount}, then choose your champion.</>}</p>}
      <small>{isItalian ? copy.note : "Sharing is public and does not save your entry."}</small>
    </div>
    <div className="worlds-pick-share-actions">
      <button type="button" className="quiet-button" disabled={!ready || Boolean(busy)} onClick={downloadCard}>{isItalian ? busy === "download" ? copy.downloading : copy.download : busy === "download" ? "Downloading\u2026" : "Download"}</button>
    </div>
    {message && <p className="worlds-pick-share-message" role="status">{message}</p>}
  </section>;
}
