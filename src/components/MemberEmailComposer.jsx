"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function MemberEmailComposer({ scopeType, scopeId, scopeName }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const audienceLabel = scopeType === "organization" ? "organization" : "league";

  async function send(event) {
    event.preventDefault();
    if (!window.confirm(`Send this announcement to eligible ${audienceLabel} members now? Each recipient will receive a separate private copy.`)) return;
    setBusy(true);
    setStatus("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in before emailing members.");
      const response = await fetch("/api/member-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          scope_type: scopeType,
          scope_id: scopeId,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The member email could not be sent.");
      setSubject("");
      setMessage("");
      setStatus(result.recipient_count
        ? `Email submitted individually for ${result.recipient_count} eligible member${result.recipient_count === 1 ? "" : "s"}.`
        : "No eligible members currently allow commissioner announcements, so nothing was sent.");
    } catch (error) {
      setStatus(error.message || "The member email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return <details className="member-email-composer">
    <summary>Email {audienceLabel} members</summary>
    <form className="form-stack" onSubmit={send}>
      <p className="muted">DraftCenter sends one private copy to each active, confirmed member who allows commissioner announcements. Email addresses and the recipient list are never revealed.</p>
      <label>Subject<input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={`${scopeName} update`} /></label>
      <label>Message<textarea required minLength={10} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share a schedule update, reminder, or community announcement." /></label>
      <button className="primary-button" disabled={busy}>{busy ? "Submitting…" : "Review and send email"}</button>
      {status && <p className="hub-message" role="status">{status}</p>}
    </form>
  </details>;
}
