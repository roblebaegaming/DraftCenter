"use client";

import React, { useState } from "react";
import {
  downloadWorldsPickShareBlob,
  worldsPickShareBlob,
  worldsShareFileName,
  worldsShareText,
  worldsShareUrl,
} from "../lib/worldsPickShare";

export default function WorldsPickShare({ discipline, gameLabel, picks, championSlug, displayName, pickCount = 10 }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const ready = picks.length === pickCount && Boolean(championSlug) && picks.some(({ slug }) => slug === championSlug);
  const fileName = worldsShareFileName(discipline);

  const cardOptions = { discipline, gameLabel, picks, championSlug, displayName, pickCount };

  async function createBlob() {
    return await worldsPickShareBlob(cardOptions);
  }

  async function shareCard() {
    if (!ready || busy) return;
    setBusy("share");
    setMessage("Getting your picks ready\u2026");
    try {
      const blob = await createBlob();
      const file = typeof File === "function" ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `My ${gameLabel} Worlds picks`,
          text: `${worldsShareText(gameLabel)}\n${worldsShareUrl(discipline)}`,
          files: [file],
        });
        setMessage("Ready to share.");
      } else {
        downloadWorldsPickShareBlob(blob, fileName);
        setMessage("Your picks image was downloaded.");
      }
    } catch (error) {
      if (error?.name === "AbortError") setMessage("Sharing canceled.");
      else setMessage(error?.message || "We couldn't share your picks in this browser.");
    } finally {
      setBusy("");
    }
  }

  return <section className={`worlds-pick-share${ready ? " is-ready" : ""}`} aria-labelledby="worlds-pick-share-heading">
    <div>
      <h3 id="worlds-pick-share-heading">Share your picks</h3>
      <p>{ready ? "Create an image of your Pick 10 to share wherever you want." : `Finish all ${pickCount} spots and choose Your Champion first.`}</p>
      <small>This won&apos;t save or change your entry. If your picks are still private, sharing the image makes them public.</small>
    </div>
    <div className="worlds-pick-share-actions">
      <button type="button" className="primary-button" disabled={!ready || Boolean(busy)} onClick={shareCard}>{busy ? "Getting it ready\u2026" : "Share your picks"}</button>
    </div>
    {message && <p className="worlds-pick-share-message" role="status">{message}</p>}
  </section>;
}
