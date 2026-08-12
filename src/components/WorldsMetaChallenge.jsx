"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  filterWorldsMetaOptions,
  toggleWorldsMetaPick,
  WORLDS_META_EVENTS,
  WORLDS_META_ROSTER_POINTS,
  worldsMetaEntryIsLocked,
} from "../lib/worldsMeta";

const META_PRIORITY = { vgc: "Priority 1", tcg: "Priority 2", go: "Priority 3" };

function fallbackEvent(config) {
  return {
    id: config.eventId,
    display_name: `2026 ${config.gameLabel} Worlds Meta Picks`,
    discipline: config.discipline,
    prediction_type: config.predictionType,
    status: "draft",
    picks_required: config.picksRequired,
    requires_featured_pick: config.requiresFeaturedPick,
    opens_at: "2026-08-12T07:00:00Z",
    locks_at: "2026-08-28T07:00:00Z",
    option_source_url: "https://worlds.pokemon.com/en-us/",
    source_checked_at: "2026-08-11",
    is_locked: true,
    results_status: "waiting",
  };
}

function displayPacificDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function MetaScoring({ config }) {
  if (config.predictionType === "deck_archetype") {
    return <div className="worlds-meta-scoring">
      <strong>Five deck archetypes · one Champion Deck</strong>
      <p>Each archetype scores its best Masters finish: 30 / 20 / 12 / 7 / 4 / 2 / 1 through Top 64. Your Champion Deck scores double. The final total is normalized to 100.</p>
      <small>Related variants are combined into stable archetypes. If a true rogue deck outside the frozen pool wins, nobody receives Champion Deck points, but every reviewed Top 64 placement still scores.</small>
    </div>;
  }
  return <div className="worlds-meta-scoring">
    <strong>Rank six by confidence</strong>
    <p>Your matches are worth {WORLDS_META_ROSTER_POINTS.join(" / ")} points from first to sixth. Predict all six members of the champion&apos;s registered team for an 8-point bonus and a perfect 100.</p>
    {config.discipline === "vgc" && <small>The official pool names registered species and forms. Mega Evolutions are not separate options.</small>}
  </div>;
}

export default function WorldsMetaChallenge({ discipline = "vgc", user }) {
  const config = WORLDS_META_EVENTS[discipline] || WORLDS_META_EVENTS.vgc;
  const [hub, setHub] = useState(null);
  const [selected, setSelected] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [search, setSearch] = useState("");
  const [optionView, setOptionView] = useState("trending");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const draftDirtyRef = useRef(false);
  const currentUserIdRef = useRef(undefined);

  const event = hub?.event || fallbackEvent(config);
  const options = useMemo(() => hub?.options || [], [hub]);
  const optionByKey = useMemo(() => new Map(options.map((option) => [option.option_key, option])), [options]);
  const trendingOptions = useMemo(() => options
    .filter((option) => Number.isInteger(option.metadata?.community_trend_rank))
    .toSorted((left, right) => left.metadata.community_trend_rank - right.metadata.community_trend_rank), [options]);
  const filteredOptions = useMemo(() => {
    const visibleOptions = !search.trim() && optionView === "trending" && trendingOptions.length
      ? trendingOptions
      : options;
    return filterWorldsMetaOptions(visibleOptions, search);
  }, [optionView, options, search, trendingOptions]);
  const staged = event.status === "draft" || options.length === 0;
  const locked = staged || Boolean(event.is_locked || worldsMetaEntryIsLocked(event));
  const reviewedPoolReady = options.length > 0;
  const trendingCopy = config.discipline === "vgc"
    ? "It reflects anonymous team sheets from 10 unofficial Limitless community events covering 737 teams. It never determines eligibility or official Worlds odds."
    : "It reflects 21,000 deck classifications from 292 unofficial Limitless community tournaments in the Pitch Black format. It supports browsing only and does not confirm the official Worlds format or predict the winner.";

  async function loadHub({ hydrateEntry = false } = {}) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_worlds_meta_hub", { p_event_id: config.eventId });
    if (error || !data) {
      setLoading(false);
      return;
    }
    setHub(data);
    if (hydrateEntry || !draftDirtyRef.current) {
      setSelected(data.my_entry?.picks || []);
      setFeatured(data.my_entry?.featured_key || null);
      draftDirtyRef.current = false;
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    const nextUserId = user?.id || null;
    const identityChanged = currentUserIdRef.current !== nextUserId;
    currentUserIdRef.current = nextUserId;
    loadHub({ hydrateEntry: identityChanged });
    const refresh = setInterval(() => { if (active) loadHub(); }, 120_000);
    return () => { active = false; clearInterval(refresh); };
  }, [config.eventId, user?.id]);

  function toggle(option) {
    if (!user || locked || !option.is_selectable) return;
    const wasFeatured = featured === option.option_key && selected.includes(option.option_key);
    const next = toggleWorldsMetaPick(selected, option.option_key, event.picks_required);
    if (next.picks !== selected) draftDirtyRef.current = true;
    setSelected(next.picks);
    if (wasFeatured) setFeatured(null);
    setMessage(next.error);
  }

  function movePick(index, direction) {
    const nextIndex = index + direction;
    if (locked || nextIndex < 0 || nextIndex >= selected.length) return;
    const next = [...selected];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    draftDirtyRef.current = true;
    setSelected(next);
  }

  function chooseFeatured(optionKey) {
    draftDirtyRef.current = true;
    setFeatured(optionKey);
    setMessage("");
  }

  async function saveEntry() {
    setMessage("");
    if (!user) return setMessage("Sign in from the DraftCenter home page before saving your entry.");
    if (!hub || staged) return setMessage("This option pool is still being reviewed. Entries are not open yet.");
    if (locked) return setMessage("Entries for this Meta Picks competition are locked.");
    if (selected.length !== event.picks_required) return setMessage(`Choose exactly ${event.picks_required} ${config.optionPlural}.`);
    if (event.requires_featured_pick && (!featured || !selected.includes(featured))) return setMessage("Choose your Champion Deck from the five selected archetypes.");

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("save_worlds_meta_entry", {
      p_event_id: config.eventId,
      p_pick_keys: selected,
      p_featured_key: event.requires_featured_pick ? featured : null,
    });
    if (error) {
      setBusy(false);
      return setMessage(error.message || "Your Meta Picks entry could not be saved.");
    }
    await loadHub({ hydrateEntry: true });
    setBusy(false);
    setMessage("Your Meta Picks entry is saved. You can revise it until the lock time.");
  }

  return <section className="worlds-meta-section" id="meta-picks" aria-labelledby="worlds-meta-heading">
    <header className="worlds-meta-header">
      <div>
        <div className="worlds-meta-kickers"><span className="eyebrow">SEPARATE META COMPETITION</span><b>{META_PRIORITY[config.discipline]}</b></div>
        <h2 id="worlds-meta-heading">{config.title}</h2>
        <p>This is separate from predicting the players. Your player Pick 10 and your Meta Picks have their own leaderboards, so either kind of Pokémon knowledge can win.</p>
      </div>
      <div className={`worlds-meta-status is-${staged ? "review" : locked ? "locked" : "open"}`}>
        <span>{staged ? "Pool review" : locked ? "Entries locked" : "Entries open"}</span>
        <strong>{staged ? "Not open yet" : displayPacificDate(event.locks_at)}</strong>
      </div>
    </header>

    <MetaScoring config={config} />

    {staged ? <div className="worlds-meta-staged">
      <div>
        <span className="eyebrow">INFRASTRUCTURE READY · FAIL-CLOSED</span>
        <h3>{reviewedPoolReady && config.discipline === "tcg" ? "Exact Worlds format confirmation" : config.reviewLabel}</h3>
        <p>{reviewedPoolReady && config.discipline === "tcg" ? "The 49-archetype Pitch Black taxonomy is reviewed and frozen. Entries stay closed until an official 2026 Worlds source confirms the exact TCG format." : config.waitingCopy}</p>
        <small>No placeholder Pokémon or deck guesses are being treated as reviewed event options.</small>
      </div>
      <ol>
        <li className="is-ready"><span>1</span><div><strong>Game and scoring</strong><small>Ready</small></div></li>
        <li className={reviewedPoolReady ? "is-ready" : ""}><span>2</span><div><strong>Reviewed option pool</strong><small>{reviewedPoolReady ? `${options.length} ready` : "Review required"}</small></div></li>
        <li><span>3</span><div><strong>{reviewedPoolReady ? "Official opening gate" : "Entries"}</strong><small>Closed by default</small></div></li>
      </ol>
      <a className="quiet-button" href={event.option_source_url} target="_blank" rel="noreferrer">Review source ↗</a>
    </div> : <div className="worlds-meta-workspace">
      <div className="worlds-meta-builder">
        <header>
          <div><span className="eyebrow">YOUR META PICKS</span><h3>{selected.length} / {event.picks_required} selected</h3></div>
          <small>{config.predictionType === "champion_roster" ? "Order matters · strongest confidence first" : "Choose one Champion Deck after selecting five"}</small>
        </header>

        {user === undefined ? <div className="worlds-account-gate is-loading"><strong>Checking your DraftCenter account…</strong></div> : !user ? <div className="worlds-account-gate">
          <div aria-hidden="true" className="worlds-account-lock">🔒</div>
          <h3>Sign in to build your Meta Picks.</h3>
          <p>Your choices stay private until entries lock.</p>
          <a className="secondary-button" href="/#member-access">Sign in or create an account</a>
        </div> : <>
          <div className="worlds-meta-selected">
            {Array.from({ length: event.picks_required }, (_, index) => {
              const option = optionByKey.get(selected[index]);
              return option ? <article className={featured === option.option_key ? "is-featured" : ""} key={option.option_key}>
                <span className="worlds-meta-rank">{index + 1}</span>
                <div><strong>{option.display_name}</strong>{option.group_label && <small>{option.group_label}</small>}</div>
                {config.predictionType === "champion_roster" && <div className="worlds-meta-order-controls">
                  <button type="button" disabled={locked || index === 0} onClick={() => movePick(index, -1)} aria-label={`Move ${option.display_name} up`}>↑</button>
                  <button type="button" disabled={locked || index === selected.length - 1} onClick={() => movePick(index, 1)} aria-label={`Move ${option.display_name} down`}>↓</button>
                </div>}
                {event.requires_featured_pick && <label><input type="radio" name={`worlds-meta-featured-${config.discipline}`} checked={featured === option.option_key} disabled={locked} onChange={() => chooseFeatured(option.option_key)} /><span>Champion Deck ×2</span></label>}
                <button className="worlds-meta-remove" type="button" disabled={locked} onClick={() => toggle(option)} aria-label={`Remove ${option.display_name}`}>Remove</button>
              </article> : <article className="is-empty" key={index}><span className="worlds-meta-rank">{index + 1}</span><small>Open spot</small></article>;
            })}
          </div>

          {trendingOptions.length > 0 && <div className="worlds-meta-option-views">
            <div role="tablist" aria-label={`Browse reviewed ${config.optionPlural}`}>
              <button type="button" role="tab" aria-selected={optionView === "trending"} onClick={() => setOptionView("trending")}>Trending {trendingOptions.length}</button>
              <button type="button" role="tab" aria-selected={optionView === "all"} onClick={() => setOptionView("all")}>All reviewed {options.length}</button>
            </div>
            <p><strong>Trending is a starting point, not a prediction.</strong> {trendingCopy}</p>
          </div>}
          <label className="worlds-meta-search">Find {config.optionPlural}<input type="search" value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} placeholder={`Search all ${options.length} reviewed ${config.gameLabel} options…`} /></label>
          <div className="worlds-meta-option-grid">
            {filteredOptions.map((option) => {
              const chosen = selected.includes(option.option_key);
              return <button type="button" key={option.option_key} aria-pressed={chosen} disabled={locked || !option.is_selectable} onClick={() => toggle(option)}>
                <strong>{option.display_name}</strong>{option.group_label && <small>{option.group_label}</small>}<span>{chosen ? "Selected ✓" : `Add ${config.optionLabel}`}</span>
              </button>;
            })}
          </div>
          {!filteredOptions.length && <p className="worlds-empty-state">No reviewed options match that search.</p>}
          <div className="worlds-save-row">
            <div>{hub?.my_entry ? <p>Saved as <strong>{hub.my_entry.display_name}</strong>. Edits remain open until lock.</p> : <p>Complete every spot{event.requires_featured_pick ? " and choose the Champion Deck" : " in confidence order"} to save.</p>}{message && <p className="worlds-message" role="status">{message}</p>}</div>
            <button className="primary-button" type="button" disabled={busy || locked || selected.length !== event.picks_required || (event.requires_featured_pick && !featured)} onClick={saveEntry}>{busy ? "Saving…" : hub?.my_entry ? "Update Meta Picks" : "Save Meta Picks"}</button>
          </div>
        </>}
      </div>

      <aside className="worlds-meta-leaderboard">
        <span className="eyebrow">{config.gameLabel.toUpperCase()} META LEADERBOARD</span>
        <h3>{hub?.entry_count || 0} entries</h3>
        {hub?.standings?.length ? <div>{hub.standings.slice(0, 10).map((entry, index) => <details className={entry.is_me ? "is-me" : ""} key={`${entry.display_name}-${index}`}>
          <summary><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></summary>
          <p>{entry.picks ? entry.picks.map((key) => `${optionByKey.get(key)?.display_name || key}${key === entry.featured_key ? " (Champion Deck ×2)" : ""}`).join(" · ") : "Picks stay private until lock."}</p>
        </details>)}</div> : <p className="worlds-empty-state">No Meta entries yet. Saved entries will appear here.</p>}
      </aside>
    </div>}

    <footer className="worlds-meta-safety">
      <span>🔒 Picks private until lock</span><span>✓ Reviewed pool required</span><span>✓ Final results reviewed by owner</span><span>Automation disabled</span>
    </footer>
  </section>;
}
