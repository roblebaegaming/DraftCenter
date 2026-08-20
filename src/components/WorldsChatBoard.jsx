"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { worldsLanguage } from "../lib/worlds2026I18n";
import { worldsChatCopy } from "../lib/worldsChatI18n";
import PublicCoachProfile, { CoachProfileButton } from "./PublicCoachProfile";

const PAGE_SIZE = 30;
const REFRESH_INTERVAL_MS = 20_000;

function messageTime(value, locale) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WorldsChatBoard({ eventId, locale = "en", user }) {
  const language = worldsLanguage(locale);
  const copy = worldsChatCopy(language);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeProfile, setActiveProfile] = useState(null);

  const loadMessages = useCallback(async ({ earlier = false, quiet = false } = {}) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    setNotice("");
    const first = earlier ? messages[0] : null;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_worlds_chat_messages", {
      p_event_id: eventId,
      p_language_code: language,
      p_before_created_at: first?.created_at || null,
      p_before_id: first?.id || null,
      p_limit: PAGE_SIZE,
    });
    if (error) setNotice(copy.loadError);
    else {
      const next = Array.isArray(data?.messages) ? data.messages : [];
      setMessages((current) => earlier ? [...next, ...current] : next);
      setHasMore(Boolean(data?.has_more));
    }
    if (!quiet) setLoading(false);
  }, [copy.loadError, eventId, language, messages, user]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setNotice("");
    if (!user) return;
    let active = true;
    const supabase = createClient();
    async function refresh({ quiet = false } = {}) {
      if (!quiet) setLoading(true);
      const { data, error } = await supabase.rpc("get_worlds_chat_messages", {
        p_event_id: eventId,
        p_language_code: language,
        p_before_created_at: null,
        p_before_id: null,
        p_limit: PAGE_SIZE,
      });
      if (!active) return;
      if (error) setNotice(copy.loadError);
      else {
        setMessages(Array.isArray(data?.messages) ? data.messages : []);
        setHasMore(Boolean(data?.has_more));
        setNotice("");
      }
      if (!quiet) setLoading(false);
    }
    refresh();
    const interval = setInterval(() => refresh({ quiet: true }), REFRESH_INTERVAL_MS);
    return () => { active = false; clearInterval(interval); };
  }, [copy.loadError, eventId, language, user]);

  async function postMessage(event) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 500 || busy) return;
    setBusy(true);
    setNotice("");
    const supabase = createClient();
    const { error } = await supabase.rpc("create_worlds_chat_message", {
      p_event_id: eventId,
      p_language_code: language,
      p_body: trimmed,
    });
    if (error) setNotice(/wait|attendi|espera/i.test(error.message || "") ? copy.rateLimit : copy.postError);
    else {
      setBody("");
      await loadMessages({ quiet: true });
    }
    setBusy(false);
  }

  async function removeMessage(messageId) {
    if (!window.confirm(copy.removeConfirm)) return;
    setNotice("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("remove_my_worlds_chat_message", { p_message_id: messageId });
    if (error || !data) setNotice(copy.removeError);
    else setMessages((current) => current.filter((message) => message.id !== messageId));
  }

  async function reportMessage(messageId) {
    setNotice("");
    const supabase = createClient();
    const { error } = await supabase.rpc("report_worlds_chat_message", { p_message_id: messageId });
    if (error) setNotice(copy.reportError);
    else setMessages((current) => current.map((message) => message.id === messageId ? { ...message, reported_by_me: true } : message));
  }

  return <section className="worlds-chatboard" aria-labelledby="worlds-chatboard-title">
    <header>
      <div><span className="eyebrow">{copy.eyebrow}</span><h2 id="worlds-chatboard-title">{copy.title}</h2><p>{copy.description}</p></div>
      {user && <button type="button" className="quiet-button" disabled={loading} onClick={() => loadMessages()}>{copy.refresh}</button>}
    </header>

    {user === undefined ? <div className="worlds-chat-gate is-loading" aria-live="polite">{copy.loadingAccount}</div> : !user ? <div className="worlds-chat-gate">
      <strong>{copy.signInTitle}</strong><p>{copy.signInBody}</p><a className="secondary-button" href="/#member-access">{copy.signInAction}</a>
    </div> : <>
      <div className="worlds-chat-messages" aria-live="polite" aria-busy={loading}>
        {hasMore && <button type="button" className="worlds-chat-earlier" disabled={loading} onClick={() => loadMessages({ earlier: true })}>{copy.loadEarlier}</button>}
        {loading && !messages.length ? <p className="worlds-chat-empty">{copy.loading}</p> : !messages.length ? <p className="worlds-chat-empty">{copy.empty}</p> : messages.map((message) => <article className="worlds-chat-message" key={message.id}>
          <div className="worlds-chat-author"><CoachProfileButton username={message.username} displayName={message.display_name} avatarUrl={message.avatar_url} compact locale={locale} onOpen={() => setActiveProfile(message.username || message.display_name)} /><time dateTime={message.created_at}>{messageTime(message.created_at, locale)}</time></div>
          <p>{message.body}</p>
          <footer>{message.is_mine ? <button type="button" onClick={() => removeMessage(message.id)}>{copy.remove}</button> : <button type="button" disabled={message.reported_by_me} onClick={() => reportMessage(message.id)}>{message.reported_by_me ? copy.reported : copy.report}</button>}</footer>
        </article>)}
      </div>
      <form className="worlds-chat-composer" onSubmit={postMessage}>
        <textarea value={body} maxLength={500} rows={3} onChange={(event) => setBody(event.target.value)} placeholder={copy.placeholder} aria-label={copy.placeholder} />
        <div><small>{copy.characters(body.length)}</small><button className="primary-button" type="submit" disabled={busy || !body.trim()}>{busy ? copy.posting : copy.post}</button></div>
      </form>
      <p className="worlds-chat-rules">{copy.rules}</p>
    </>}
    {notice && <p className="worlds-chat-notice" role="status">{notice}</p>}
    {activeProfile && <PublicCoachProfile identity={activeProfile} locale={locale} onClose={() => setActiveProfile(null)} />}
  </section>;
}
