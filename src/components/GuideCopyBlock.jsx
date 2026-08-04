"use client";

import { useRef, useState } from "react";

export default function GuideCopyBlock({ title, intro, content }) {
  const fieldRef = useRef(null);
  const [message, setMessage] = useState("");

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(content);
      setMessage("Copied. Paste it into your league document and replace the bracketed fields.");
    } catch {
      fieldRef.current?.focus();
      fieldRef.current?.select();
      setMessage("The template is selected. Use your device's Copy command, then paste it into your league document.");
    }
  }

  return <section className="guide-copy-resource">
    <div className="guide-copy-heading"><div><span className="eyebrow">READY TO CUSTOMIZE</span><h2>{title}</h2></div><button type="button" className="primary-button" onClick={copyTemplate}>Copy the rules template</button></div>
    <p>{intro}</p>
    <textarea ref={fieldRef} readOnly value={content} aria-label={title} rows={28} />
    <p className="guide-copy-status" role="status" aria-live="polite">{message || "Replace every bracketed field before sharing the rules with coaches."}</p>
  </section>;
}
