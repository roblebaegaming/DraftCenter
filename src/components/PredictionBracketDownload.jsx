"use client";

import { useState } from "react";
import {
  downloadPredictionBracketShareBlob,
  predictionBracketShareBlob,
  predictionBracketShareFileName,
} from "../lib/predictionBracketShare";

export default function PredictionBracketDownload({
  bracket,
  disabled = false,
  label = "Download bracket PNG",
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    if (disabled || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const blob = await predictionBracketShareBlob({
        ...bracket,
        publicUrl: window.location.href,
      });
      downloadPredictionBracketShareBlob(blob, predictionBracketShareFileName(bracket.eventId, bracket.displayName));
      setMessage("Bracket PNG downloaded.");
    } catch (error) {
      setMessage(error?.message || "The bracket image could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="worlds-bracket-download">
    <button type="button" className="secondary-button" disabled={disabled || busy} onClick={download}>
      {busy ? "Preparing PNG…" : label}
    </button>
    {message && <small role="status">{message}</small>}
  </div>;
}
