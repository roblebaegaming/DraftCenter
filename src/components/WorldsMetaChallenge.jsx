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
import { worldsCopy } from "../lib/worlds2026I18n";
import { trackAttributionEvent } from "../lib/signupAttribution";

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

function displayPacificDate(value, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function MetaScoring({ config, locale = "en" }) {
  const isItalian = locale !== "en" && config.discipline === "vgc";
  const copy = isItalian ? worldsCopy(locale).meta : null;
  if (config.predictionType === "deck_archetype") {
    return <details className="worlds-meta-scoring">
      <summary><span>How scoring works</span><strong>Five decks · 100 points max</strong></summary>
      <div className="worlds-meta-scoring-body">
        <p>Choose five deck archetypes and mark one as your <strong>Champion Deck</strong>. Each archetype scores only its best Masters finish.</p>
        <dl className="worlds-meta-score-grid">
          <div><dt>World Champion</dt><dd>30 pts</dd></div>
          <div><dt>Runner-up</dt><dd>20 pts</dd></div>
          <div><dt>Top 4</dt><dd>12 pts</dd></div>
          <div><dt>Top 8</dt><dd>7 pts</dd></div>
          <div><dt>Top 16</dt><dd>4 pts</dd></div>
          <div><dt>Top 32</dt><dd>2 pts</dd></div>
          <div><dt>Top 64</dt><dd>1 pt</dd></div>
        </dl>
        <ul>
          <li>Your Champion Deck scores double.</li>
          <li>The 111-point raw maximum is normalized to 100.</li>
          <li>If an unlisted rogue deck wins, nobody earns Champion Deck points for it; reviewed Top 64 archetypes still score.</li>
        </ul>
        <p className="worlds-meta-score-separation"><strong>Separate competition:</strong> Meta scores never mix with player Pick 10. The Meta Overall opens after at least two Meta disciplines have final results.</p>
        <a href={config.officialFormatUrl} target="_blank" rel="noreferrer">Official Worlds format: Standard · H regulation marks and onward ↗</a>
      </div>
    </details>;
  }
  return <details className="worlds-meta-scoring">
    <summary><span>{isItalian ? copy.scoring : "How scoring works"}</span><strong>{isItalian ? copy.scoringSummary : "Rank six · 100 points max"}</strong></summary>
    <div className="worlds-meta-scoring-body">
      <p>{isItalian ? copy.scoringBody : <>Rank six Pokémon from strongest to weakest confidence. A pick earns its position&apos;s points when it appears on the World Champion&apos;s registered team.</>}</p>
      <dl className="worlds-meta-score-grid is-roster">
        {WORLDS_META_ROSTER_POINTS.map((points, index) => <div key={points}><dt>{isItalian ? copy.pick(index + 1) : <>Pick {index + 1}</>}</dt><dd>{points} {isItalian ? "pt" : "pts"}</dd></div>)}
      </dl>
      <ul>
        <li>{isItalian ? copy.perfect : "Predict all six team members for an 8-point bonus and a perfect 100."}</li>
        <li>{isItalian ? copy.order : "The ranking is your confidence order; it does not need to match a team-sheet order."}</li>
        {config.discipline === "vgc" && <li>{isItalian ? copy.forms : "The official pool names registered species and forms. Mega Evolutions are not separate options."}</li>}
      </ul>
      <p className="worlds-meta-score-separation"><strong>{isItalian ? copy.separate : "Separate competition:"}</strong> {isItalian ? copy.separateBody : "Meta scores never mix with player Pick 10. The Meta Overall opens after at least two Meta disciplines have final results."}</p>
    </div>
  </details>;
}

export default function WorldsMetaChallenge({ discipline = "vgc", user, locale = "en" }) {
  const config = WORLDS_META_EVENTS[discipline] || WORLDS_META_EVENTS.vgc;
  const isItalian = locale !== "en" && config.discipline === "vgc";
  const copy = isItalian ? worldsCopy(locale).meta : null;
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
  const trendingCopy = isItalian ? copy.trendBody : config.discipline === "vgc"
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
    setMessage(isItalian && next.error ? copy.errors.spotsFull(event.picks_required) : next.error);
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
    if (!user) return setMessage(isItalian ? copy.errors.signIn : "Sign in from the DraftCenter home page before saving your entry.");
    if (!hub || staged) return setMessage(isItalian ? copy.errors.reviewing : "This option pool is still being reviewed. Entries are not open yet.");
    if (locked) return setMessage(isItalian ? copy.errors.locked : "Entries for this Meta Picks competition are locked.");
    if (selected.length !== event.picks_required) return setMessage(isItalian ? copy.errors.chooseExactly(event.picks_required) : `Choose exactly ${event.picks_required} ${config.optionPlural}.`);
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
      return setMessage(isItalian ? copy.errors.save : error.message || "Your Meta Picks entry could not be saved.");
    }
    trackAttributionEvent("worlds_entry_saved", { onceKey: config.eventId });
    await loadHub({ hydrateEntry: true });
    setBusy(false);
    setMessage(isItalian ? copy.saved : "Your Meta Picks entry is saved. You can revise it until the lock time.");
  }

  return <section className="worlds-meta-section" id="meta-picks" aria-labelledby="worlds-meta-heading">
    <header className="worlds-meta-header">
      <div>
        <div className="worlds-meta-kickers"><span className="eyebrow">{isItalian ? copy.eyebrow : "SEPARATE META COMPETITION"}</span><b>{isItalian ? copy.priority : META_PRIORITY[config.discipline]}</b></div>
        <h2 id="worlds-meta-heading">{isItalian ? copy.title : config.title}</h2>
        <p>{isItalian ? copy.intro : "This is separate from predicting the players. Your player Pick 10 and your Meta Picks have their own leaderboards, so either kind of Pokémon knowledge can win."}</p>
      </div>
      <div className={`worlds-meta-status is-${staged ? "review" : locked ? "locked" : "open"}`}>
        <span>{isItalian ? staged ? copy.poolReview : locked ? copy.locked : copy.open : staged ? "Pool review" : locked ? "Entries locked" : "Entries open"}</span>
        <strong>{isItalian && staged ? copy.notOpen : staged ? "Not open yet" : displayPacificDate(event.locks_at, isItalian ? worldsCopy(locale).locale : "en-US")}</strong>
      </div>
    </header>

    <MetaScoring config={config} locale={locale} />

    {staged ? <div className="worlds-meta-staged">
      <div>
        <span className="eyebrow">{isItalian ? copy.stagedEyebrow : "INFRASTRUCTURE READY · FAIL-CLOSED"}</span>
        <h3>{isItalian ? copy.reviewTitle : reviewedPoolReady && config.discipline === "tcg" ? "Activation migration pending" : config.reviewLabel}</h3>
        <p>{isItalian ? copy.waitingCopy : reviewedPoolReady && config.discipline === "tcg" ? "The official 2026 Worlds packet confirms Standard Format with H regulation marks and onward. The 49-archetype Pitch Black taxonomy is reviewed and frozen; entries stay closed until the activation migration is applied." : config.waitingCopy}</p>
        <small>{isItalian ? copy.noPlaceholders : "No placeholder Pokémon or deck guesses are being treated as reviewed event options."}</small>
      </div>
      <ol>
        <li className="is-ready"><span>1</span><div><strong>{isItalian ? copy.gameScoring : "Game and scoring"}</strong><small>{isItalian ? copy.ready : "Ready"}</small></div></li>
        <li className={reviewedPoolReady ? "is-ready" : ""}><span>2</span><div><strong>{isItalian ? copy.reviewedPool : "Reviewed option pool"}</strong><small>{reviewedPoolReady ? `${options.length} ${isItalian ? copy.ready.toLowerCase() : "ready"}` : isItalian ? copy.reviewRequired : "Review required"}</small></div></li>
        <li><span>3</span><div><strong>{isItalian ? copy.entries : reviewedPoolReady && config.discipline === "tcg" ? "Activation migration" : reviewedPoolReady ? "Official opening gate" : "Entries"}</strong><small>{isItalian ? copy.closedDefault : reviewedPoolReady && config.discipline === "tcg" ? "Pending" : "Closed by default"}</small></div></li>
      </ol>
      <a className="quiet-button" href={event.option_source_url} target="_blank" rel="noreferrer">{isItalian ? copy.reviewSource : "Review source ↗"}</a>
    </div> : <div className="worlds-meta-workspace">
      <div className="worlds-meta-builder">
        <header>
          <div><span className="eyebrow">{isItalian ? copy.picksEyebrow : "YOUR META PICKS"}</span><h3>{isItalian ? copy.selected(selected.length, event.picks_required) : `${selected.length} / ${event.picks_required} selected`}</h3></div>
          <small>{isItalian ? copy.confidence : config.predictionType === "champion_roster" ? "Order matters · strongest confidence first" : "Choose one Champion Deck after selecting five"}</small>
        </header>

        {user === undefined ? <div className="worlds-account-gate is-loading"><strong>{isItalian ? copy.checking : "Checking your DraftCenter account…"}</strong></div> : !user ? <div className="worlds-account-gate">
          <div aria-hidden="true" className="worlds-account-lock">🔒</div>
          <h3>{isItalian ? copy.signInTitle : "Sign in to build your Meta Picks."}</h3>
          <p>{isItalian ? copy.signInBody : "Your choices stay private until entries lock."}</p>
          <a className="secondary-button" href="/#member-access">{isItalian ? copy.signInAction : "Sign in or create an account"}</a>
        </div> : <>
          <div className="worlds-meta-selected">
            {Array.from({ length: event.picks_required }, (_, index) => {
              const option = optionByKey.get(selected[index]);
              return option ? <article className={featured === option.option_key ? "is-featured" : ""} key={option.option_key}>
                <span className="worlds-meta-rank">{index + 1}</span>
                <div><strong>{option.display_name}</strong>{option.group_label && <small>{option.group_label}</small>}</div>
                {config.predictionType === "champion_roster" && <div className="worlds-meta-order-controls">
                  <button type="button" disabled={locked || index === 0} onClick={() => movePick(index, -1)} aria-label={isItalian ? copy.moveUp(option.display_name) : `Move ${option.display_name} up`}>↑</button>
                  <button type="button" disabled={locked || index === selected.length - 1} onClick={() => movePick(index, 1)} aria-label={isItalian ? copy.moveDown(option.display_name) : `Move ${option.display_name} down`}>↓</button>
                </div>}
                {event.requires_featured_pick && <label><input type="radio" name={`worlds-meta-featured-${config.discipline}`} checked={featured === option.option_key} disabled={locked} onChange={() => chooseFeatured(option.option_key)} /><span>Champion Deck ×2</span></label>}
                <button className="worlds-meta-remove" type="button" disabled={locked} onClick={() => toggle(option)} aria-label={isItalian ? copy.remove(option.display_name) : `Remove ${option.display_name}`}>{isItalian ? copy.removeLabel : "Remove"}</button>
              </article> : <article className="is-empty" key={index}><span className="worlds-meta-rank">{index + 1}</span><small>{isItalian ? copy.openSpot : "Open spot"}</small></article>;
            })}
          </div>

          {trendingOptions.length > 0 && <div className="worlds-meta-option-views">
            <div role="tablist" aria-label={isItalian ? copy.browseLabel : `Browse reviewed ${config.optionPlural}`}>
              <button type="button" role="tab" aria-selected={optionView === "trending"} onClick={() => setOptionView("trending")}>{isItalian ? copy.trending : "Trending"} {trendingOptions.length}</button>
              <button type="button" role="tab" aria-selected={optionView === "all"} onClick={() => setOptionView("all")}>{isItalian ? copy.allReviewed : "All reviewed"} {options.length}</button>
            </div>
            <p><strong>{isItalian ? copy.trendLead : "Trending is a starting point, not a prediction."}</strong> {trendingCopy}</p>
          </div>}
          <label className="worlds-meta-search">{isItalian ? copy.find : <>Find {config.optionPlural}</>}<input type="search" value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} placeholder={isItalian ? copy.search(options.length) : `Search all ${options.length} reviewed ${config.gameLabel} options…`} /></label>
          <div className="worlds-meta-option-grid">
            {filteredOptions.map((option) => {
              const chosen = selected.includes(option.option_key);
              return <button type="button" key={option.option_key} aria-pressed={chosen} disabled={locked || !option.is_selectable} onClick={() => toggle(option)}>
                <strong>{option.display_name}</strong>{option.group_label && <small>{option.group_label}</small>}<span>{isItalian ? chosen ? copy.selectedLabel : copy.add : chosen ? "Selected ✓" : `Add ${config.optionLabel}`}</span>
              </button>;
            })}
          </div>
          {!filteredOptions.length && <p className="worlds-empty-state">{isItalian ? copy.noResults : "No reviewed options match that search."}</p>}
          <div className="worlds-save-row">
            <div>{hub?.my_entry ? <p>{isItalian ? copy.savedAs : "Saved as"} <strong>{hub.my_entry.display_name}</strong>. {isItalian ? copy.edits : "Edits remain open until lock."}</p> : <p>{isItalian ? copy.complete : <>Complete every spot{event.requires_featured_pick ? " and choose the Champion Deck" : " in confidence order"} to save.</>}</p>}{message && <p className="worlds-message" role="status">{message}</p>}</div>
            <button className="primary-button" type="button" disabled={busy || locked || selected.length !== event.picks_required || (event.requires_featured_pick && !featured)} onClick={saveEntry}>{isItalian ? busy ? copy.saving : hub?.my_entry ? copy.update : copy.save : busy ? "Saving…" : hub?.my_entry ? "Update Meta Picks" : "Save Meta Picks"}</button>
          </div>
        </>}
      </div>

      <aside className="worlds-meta-leaderboard">
        <span className="eyebrow">{isItalian ? copy.leaderboard : `${config.gameLabel.toUpperCase()} META LEADERBOARD`}</span>
        <h3>{isItalian ? copy.entriesCount(hub?.entry_count || 0) : `${hub?.entry_count || 0} entries`}</h3>
        {hub?.standings?.length ? <div>{hub.standings.slice(0, 10).map((entry, index) => <details className={entry.is_me ? "is-me" : ""} key={`${entry.display_name}-${index}`}>
          <summary><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></summary>
          <p>{entry.picks ? entry.picks.map((key) => `${optionByKey.get(key)?.display_name || key}${key === entry.featured_key ? " (Champion Deck ×2)" : ""}`).join(" · ") : isItalian ? copy.private : "Picks stay private until lock."}</p>
        </details>)}</div> : <p className="worlds-empty-state">{isItalian ? copy.empty : "No Meta entries yet. Saved entries will appear here."}</p>}
      </aside>
    </div>}

    <footer className="worlds-meta-safety">
      {(isItalian ? copy.safety : ["🔒 Picks private until lock", "✓ Reviewed pool required", "✓ Final results reviewed by owner", "Automation disabled"]).map((label) => <span key={label}>{label}</span>)}
    </footer>
  </section>;
}
