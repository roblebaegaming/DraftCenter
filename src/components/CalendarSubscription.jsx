"use client";

import { useEffect, useState } from "react";

const GOOGLE_CALENDAR_SETTINGS = "https://calendar.google.com/calendar/u/0/r/settings/addbyurl";

export default function CalendarSubscription({ supabase }) {
  const [status, setStatus] = useState(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function authenticatedFetch(options = {}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in again to manage your calendar link.");
    const response = await fetch("/api/calendar/subscription", {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Calendar subscription is temporarily unavailable.");
    return payload;
  }

  useEffect(() => {
    let current = true;
    authenticatedFetch()
      .then((payload) => { if (current) setStatus(payload); })
      .catch((error) => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, [supabase]);

  async function createOrReplace() {
    if (status?.active && !window.confirm("Replace the private link? The old Google Calendar subscription will stop updating.")) return;
    setBusy(true);
    setMessage("");
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const payload = await authenticatedFetch({ method: "POST", body: JSON.stringify({ timezone }) });
      setStatus(payload);
      setFeedUrl(payload.feed_url);
      setMessage("Private link created. Copy it now—DraftCenter will not show this same link again.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setMessage("Private link copied. Paste it into Google Calendar's From URL field.");
    } catch {
      setMessage("Copy was blocked by your browser. Select and copy the private link below.");
    }
  }

  async function revoke() {
    if (!window.confirm("Revoke this private link? Google Calendar will no longer be able to refresh it.")) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await authenticatedFetch({ method: "DELETE" });
      setStatus(payload);
      setFeedUrl("");
      setMessage("Private calendar link revoked.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="calendar-subscription-panel" aria-labelledby="calendar-subscription-heading">
    <div className="calendar-subscription-copy">
      <span className="eyebrow">GOOGLE CALENDAR</span>
      <h2 id="calendar-subscription-heading">Keep this calendar updated automatically</h2>
      <p>Subscribe with a private, read-only link. Google receives your league dates, reminders, and maintained VGC schedule; DraftCenter never receives access to your Google account.</p>
      <small>Anyone with the private link can read these calendar details. Keep it private and revoke it immediately if it is shared accidentally.</small>
    </div>
    <div className="calendar-subscription-controls">
      {status === null && !message && <p className="muted">Checking your subscription...</p>}
      {status?.active && !feedUrl && <p className="calendar-subscription-status"><strong>Subscription active</strong><span>For security, the existing link is hidden. Replace it if you need a new copy.</span></p>}
      {feedUrl && <>
        <label>Private subscription URL<input aria-label="Private calendar subscription URL" readOnly value={feedUrl} onFocus={(event) => event.target.select()} /></label>
        <ol>
          <li>Copy the private link.</li>
          <li>Open Google Calendar, then paste it into <strong>From URL</strong>.</li>
          <li>Select <strong>Add calendar</strong>.</li>
        </ol>
      </>}
      <div className="calendar-subscription-actions">
        {feedUrl && <button className="secondary-button" type="button" onClick={copyLink}>Copy private link</button>}
        {feedUrl && <a className="primary-button inline-link-button" href={GOOGLE_CALENDAR_SETTINGS} target="_blank" rel="noreferrer">Open Google Calendar ↗</a>}
        <button className={status?.active ? "quiet-button" : "primary-button"} type="button" disabled={busy || status === null} onClick={createOrReplace}>{busy ? "Working..." : status?.active ? "Replace private link" : "Create private link"}</button>
        {status?.active && <button className="text-button danger-text" type="button" disabled={busy} onClick={revoke}>Revoke</button>}
      </div>
      {message && <p className="hub-message" aria-live="polite">{message}</p>}
      <small>Google refreshes subscribed calendars on its own schedule, so changes may not appear immediately.</small>
    </div>
  </section>;
}
