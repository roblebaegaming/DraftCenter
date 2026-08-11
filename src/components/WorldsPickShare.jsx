"use client";

import React, { useState } from "react";
import {
  downloadWorldsPickShareBlob,
  worldsPickShareBlob,
  worldsShareFileName,
  worldsShareText,
  worldsShareUrl,
  worldsXShareIntent,
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

  async function downloadCard() {
    if (!ready || busy) return;
    setBusy("download");
    setMessage("Creating your social image\u2026");
    try {
      const blob = await createBlob();
      downloadWorldsPickShareBlob(blob, fileName);
      setMessage("Your 1080 \u00d7 1350 social image was downloaded.");
    } catch (error) {
      setMessage(error?.message || "This browser could not create the social image.");
    } finally {
      setBusy("");
    }
  }

  async function shareCard() {
    if (!ready || busy) return;
    setBusy("share");
    setMessage("Preparing your share image\u2026");
    try {
      const blob = await createBlob();
      const file = typeof File === "function" ? new File([blob], fileName, { type: "image/png" }) : null;
      if (file && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `My 2026 Pok\u00e9mon Worlds ${gameLabel} Pick 10`,
          text: `${worldsShareText(gameLabel)}\n${worldsShareUrl(discipline)}`,
          files: [file],
        });
        setMessage("Share menu opened with your image.");
      } else {
        downloadWorldsPickShareBlob(blob, fileName);
        setMessage("Image downloaded. Open Instagram or another social app and choose it from your device.");
      }
    } catch (error) {
      if (error?.name === "AbortError") setMessage("Sharing cancelled. Your picks are unchanged.");
      else setMessage(error?.message || "This browser could not share the social image.");
    } finally {
      setBusy("");
    }
  }

  async function shareOnX() {
    if (!ready || busy) return;
    const postWindow = window.open(worldsXShareIntent({ discipline, gameLabel }), "_blank");
    if (postWindow) postWindow.opener = null;
    setBusy("x");
    setMessage("Creating the image for your X post\u2026");
    try {
      const blob = await createBlob();
      downloadWorldsPickShareBlob(blob, fileName);
      setMessage(postWindow ? "X opened with a prepared post. Attach the downloaded image before posting." : "Image downloaded. Your browser blocked the X window, so open X and attach the image manually.");
    } catch (error) {
      setMessage(error?.message || "This browser could not prepare the X post image.");
    } finally {
      setBusy("");
    }
  }

  return <section className={`worlds-pick-share${ready ? " is-ready" : ""}`} aria-labelledby="worlds-pick-share-heading">
    <div>
      <span className="eyebrow">SHARE YOUR PICKS</span>
      <h3 id="worlds-pick-share-heading">Turn your Top 10 into a social card.</h3>
      <p>{ready ? "Download a portrait image, share it through your phone to Instagram or another app, or open a prepared X / Twitter post." : `Finish all ${pickCount} spots and choose Your Champion to unlock sharing.`}</p>
      <small>Sharing is optional and publicly reveals the choices on this card, even before entries lock. It does not save or update your DraftCenter entry.</small>
    </div>
    <div className="worlds-pick-share-actions">
      <button type="button" className="secondary-button" disabled={!ready || Boolean(busy)} onClick={downloadCard}>{busy === "download" ? "Creating image\u2026" : "Download social image"}</button>
      <button type="button" className="primary-button" disabled={!ready || Boolean(busy)} onClick={shareCard}>{busy === "share" ? "Opening share menu\u2026" : "Share to Instagram or apps"}</button>
      <button type="button" className="quiet-button" disabled={!ready || Boolean(busy)} onClick={shareOnX}>{busy === "x" ? "Preparing X post\u2026" : "Download + share on X / Twitter"}</button>
    </div>
    {message && <p className="worlds-pick-share-message" role="status">{message}</p>}
  </section>;
}
