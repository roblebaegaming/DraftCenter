"use client";

import React, { useState } from "react";
import {
  downloadWorldsPickShareBlob,
  worldsPickShareBlob,
  worldsShareFileName,
  worldsShareText,
  worldsTwitterShareUrl,
  worldsShareUrl,
} from "../lib/worldsPickShare";

function canShareImageFile() {
  if (typeof File !== "function" || typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["DraftCenter"], "draftcenter.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

export default function WorldsPickShare({ discipline, gameLabel, picks, championSlug, displayName, pickCount = 10 }) {
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
      setMessage("Image downloaded.");
    } catch (error) {
      setMessage(error?.message || "We couldn't download your picks image.");
    } finally {
      setBusy("");
    }
  }

  async function shareTo(platform) {
    if (!ready || busy) return;
    const platformName = platform === "instagram" ? "Instagram" : "Twitter";
    const nativeShare = canShareImageFile();
    let platformWindow = null;
    if (!nativeShare && typeof window !== "undefined") {
      platformWindow = window.open("about:blank", "_blank");
      if (platformWindow) platformWindow.opener = null;
    }
    setBusy(platform);
    setMessage(nativeShare ? `Choose ${platformName} in the share menu.` : "Getting your picks ready\u2026");
    try {
      const blob = await createBlob();
      if (nativeShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        await navigator.share({
          title: `My ${gameLabel} Worlds picks`,
          text: `${worldsShareText(gameLabel)}\n${worldsShareUrl(discipline)}`,
          files: [file],
        });
        setMessage("Shared.");
      } else {
        downloadWorldsPickShareBlob(blob, fileName);
        const platformUrl = platform === "instagram" ? "https://www.instagram.com/" : worldsTwitterShareUrl(discipline, gameLabel);
        if (platformWindow) platformWindow.location.replace(platformUrl);
        else window.open(platformUrl, "_blank", "noopener,noreferrer");
        setMessage(`Image downloaded. Add it to your ${platformName} post.`);
      }
    } catch (error) {
      if (platformWindow && !platformWindow.closed) platformWindow.close();
      if (error?.name === "AbortError") setMessage("Sharing canceled.");
      else setMessage(error?.message || "We couldn't share your picks in this browser.");
    } finally {
      setBusy("");
    }
  }

  return <section className={`worlds-pick-share${ready ? " is-ready" : ""}`} aria-labelledby="worlds-pick-share-heading">
    <div>
      <h3 id="worlds-pick-share-heading">Share your picks</h3>
      {!ready && <p>Choose your top {pickCount}, then choose your champion.</p>}
      <small>Sharing is public and does not save your entry.</small>
    </div>
    <div className="worlds-pick-share-actions">
      <button type="button" className="quiet-button" disabled={!ready || Boolean(busy)} onClick={downloadCard}>{busy === "download" ? "Downloading\u2026" : "Download"}</button>
      <button type="button" className="quiet-button" aria-label="Share picks to Instagram" disabled={!ready || Boolean(busy)} onClick={() => shareTo("instagram")}>{busy === "instagram" ? "Opening\u2026" : "Instagram"}</button>
      <button type="button" className="quiet-button" aria-label="Share picks to Twitter" disabled={!ready || Boolean(busy)} onClick={() => shareTo("twitter")}>{busy === "twitter" ? "Opening\u2026" : "Twitter"}</button>
    </div>
    {message && <p className="worlds-pick-share-message" role="status">{message}</p>}
  </section>;
}
