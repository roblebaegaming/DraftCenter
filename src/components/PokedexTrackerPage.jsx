"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  filterPokedexEntries,
  groupPokedexCatalogs,
  pokedexArtworkUrl,
  pokedexHomePlacement,
  pokedexTrackerProgress,
  POKEDEX_TRACKER_PAGE_SIZE,
} from "../lib/pokedexTracker";

function ProgressRing({ progress, label, shiny = false }) {
  return <div className={`dex-tracker-ring ${shiny ? "is-shiny" : ""}`} style={{ "--dex-progress": `${progress.percentage * 3.6}deg` }}>
    <div><strong>{progress.percentage}%</strong><span>{label}</span></div>
  </div>;
}

function PokemonCard({ entry, mode, pending, onToggle, placement = null }) {
  const isShiny = mode === "shiny";
  const caught = isShiny ? entry.shiny_caught : entry.caught;
  const regularArtwork = pokedexArtworkUrl(entry.pokemon_id);
  const artwork = pokedexArtworkUrl(entry.pokemon_id, isShiny);
  function handleImageError(event) {
    if (isShiny && event.currentTarget.src !== regularArtwork) {
      event.currentTarget.src = regularArtwork;
      return;
    }
    event.currentTarget.hidden = true;
  }
  return <button
    type="button"
    className={`dex-tracker-pokemon ${caught ? "is-caught" : ""} ${isShiny ? "is-shiny" : ""}`}
    aria-pressed={caught}
    aria-label={`${caught ? "Remove" : "Mark"} ${isShiny ? "shiny " : ""}${entry.pokemon} ${caught ? "from" : "in"} this Pokédex`}
    disabled={pending}
    onClick={() => onToggle(entry)}
  >
    <span className="dex-tracker-check" aria-hidden="true">{pending ? "···" : caught ? "✓" : "+"}</span>
    <span className="dex-tracker-number">#{String(entry.dex_number).padStart(3, "0")}</span>
    <span className="dex-tracker-art">
      <img src={artwork} alt="" loading="lazy" onError={handleImageError} />
      {isShiny && <i aria-hidden="true">✦</i>}
    </span>
    <strong>{entry.pokemon}</strong>
    <small title={placement ? `Pokémon HOME page ${placement.page}, box ${placement.box}, position ${placement.position}, row ${placement.row}, slot ${placement.slot}` : undefined}>
      {placement ? `HOME P${placement.page} · B${placement.box} · Slot ${placement.position}` : entry.pokedex_key === "national" ? "National Pokédex" : String(entry.pokedex_key).replaceAll("-", " ")}
    </small>
  </button>;
}

function CreateTracker({ catalogs, busy, onCreate, onCancel }) {
  const [catalogKey, setCatalogKey] = useState(catalogs[0]?.key || "home");
  const [title, setTitle] = useState("");
  const [includeShiny, setIncludeShiny] = useState(false);
  const groups = groupPokedexCatalogs(catalogs);
  const selected = catalogs.find((catalog) => catalog.key === catalogKey);
  return <form className="dex-tracker-create" onSubmit={(event) => { event.preventDefault(); onCreate({ catalogKey, title, includeShiny }); }}>
    <header><div><span className="dex-kicker">NEW COLLECTION</span><h2>Choose your next Pokédex</h2></div>{onCancel && <button type="button" className="dex-icon-button" onClick={onCancel} aria-label="Close new tracker form">×</button>}</header>
    <label>Game or service
      <select value={catalogKey} onChange={(event) => setCatalogKey(event.target.value)} required>
        {groups.map((group) => <optgroup key={group.label} label={group.label}>{group.catalogs.map((catalog) => <option key={catalog.key} value={catalog.key}>{catalog.name} · {catalog.total}</option>)}</optgroup>)}
      </select>
    </label>
    <label>Tracker name <span>optional</span>
      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder={selected?.name || "My living dex"} />
    </label>
    <label className="dex-shiny-choice">
      <input type="checkbox" checked={includeShiny} onChange={(event) => setIncludeShiny(event.target.checked)} />
      <span><b>Add a shiny dex</b><small>Track shiny forms separately without changing your standard progress.</small></span>
      <i aria-hidden="true">✦</i>
    </label>
    <button className="dex-primary-button" disabled={busy || !catalogKey}>{busy ? "Creating…" : "Create tracker"}</button>
  </form>;
}

export default function PokedexTrackerPage() {
  const [supabase] = useState(() => createClient());
  const trackerRequestRef = useRef(0);
  const accountVersionRef = useRef(0);
  const [authState, setAuthState] = useState("loading");
  const [hub, setHub] = useState(null);
  const [active, setActive] = useState(null);
  const [activeId, setActiveId] = useState("");
  const [loadingTracker, setLoadingTracker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState("standard");
  const [homeBox, setHomeBox] = useState("all");
  const [shown, setShown] = useState(POKEDEX_TRACKER_PAGE_SIZE);
  const [pending, setPending] = useState(() => new Set());

  async function openTracker(id, accountVersion = accountVersionRef.current) {
    const requestId = ++trackerRequestRef.current;
    if (!id) {
      setActive(null);
      setActiveId("");
      setLoadingTracker(false);
      return;
    }
    setActiveId(id);
    setLoadingTracker(true);
    setMessage("");
    const { data, error } = await supabase.rpc("get_my_pokedex_tracker", { p_tracker_id: id });
    if (requestId !== trackerRequestRef.current || accountVersion !== accountVersionRef.current) return;
    setLoadingTracker(false);
    if (error || !data) {
      setActive(null);
      setMessage(error?.message || "That Pokédex tracker could not be opened.");
      return;
    }
    setActive(data);
    setSettingsTitle(data.tracker.title);
    setMode("standard");
    setQuery("");
    setStatus("all");
    setHomeBox("all");
    setShown(POKEDEX_TRACKER_PAGE_SIZE);
    setShowSettings(false);
  }

  async function loadHub(preferredId, accountVersion = accountVersionRef.current) {
    const { data, error } = await supabase.rpc("get_my_pokedex_trackers");
    if (accountVersion !== accountVersionRef.current) return;
    if (error) {
      setHub(null);
      setMessage(error.message);
      return;
    }
    setHub(data);
    const nextId = preferredId === undefined
      ? activeId || data?.trackers?.[0]?.id || ""
      : preferredId || data?.trackers?.[0]?.id || "";
    if (nextId) await openTracker(nextId, accountVersion);
    else { setActive(null); setActiveId(""); setShowCreate(true); }
  }

  useEffect(() => {
    let mounted = true;
    let currentUserId = null;

    async function updateSession(session) {
      if (!mounted) return;
      const nextUserId = session?.user?.id || "";
      if (nextUserId === currentUserId) return;
      currentUserId = nextUserId;
      const accountVersion = ++accountVersionRef.current;
      trackerRequestRef.current += 1;
      setHub(null);
      setActive(null);
      setActiveId("");
      setLoadingTracker(false);
      setBusy(false);
      setPending(new Set());
      setMessage("");
      setShowCreate(false);
      setShowSettings(false);
      if (!nextUserId) {
        setAuthState("signed-out");
        return;
      }
      setAuthState("signed-in");
      await loadHub("", accountVersion);
    }

    supabase.auth.getSession().then(({ data }) => { void updateSession(data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void updateSession(session); });
    return () => {
      mounted = false;
      accountVersionRef.current += 1;
      trackerRequestRef.current += 1;
      listener.subscription.unsubscribe();
    };
  // The browser client is stable for the life of this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setShown(POKEDEX_TRACKER_PAGE_SIZE); }, [query, status, mode, homeBox, activeId]);

  const standardProgress = useMemo(() => pokedexTrackerProgress(active?.pokemon, "standard"), [active]);
  const shinyProgress = useMemo(() => pokedexTrackerProgress(active?.pokemon, "shiny"), [active]);
  const homeBoxes = useMemo(() => active?.tracker?.catalog_key === "home"
    ? Array.from({ length: Math.ceil(standardProgress.total / 30) }, (_, index) => pokedexHomePlacement((index * 30) + 1))
    : [], [active?.tracker?.catalog_key, standardProgress.total]);
  const filtered = useMemo(() => {
    const entries = filterPokedexEntries(active?.pokemon, { query, status, mode });
    if (active?.tracker?.catalog_key !== "home" || homeBox === "all") return entries;
    return entries.filter((entry) => String(pokedexHomePlacement(entry.dex_number)?.globalBox || "") === homeBox);
  }, [active, query, status, mode, homeBox]);
  const visible = filtered.slice(0, shown);

  async function createTracker(values) {
    const accountVersion = accountVersionRef.current;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_my_pokedex_tracker", {
      p_catalog_key: values.catalogKey,
      p_title: values.title.trim() || null,
      p_include_shiny: values.includeShiny,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setShowCreate(false);
    await loadHub(data.id);
  }

  async function toggleEntry(entry) {
    const trackerId = active?.tracker?.id;
    if (!trackerId) return;
    const accountVersion = accountVersionRef.current;
    const isShiny = mode === "shiny";
    const field = isShiny ? "shiny_caught" : "caught";
    const caught = !entry[field];
    const pendingKey = `${trackerId}:${entry.pokemon_id}:${mode}`;
    if (pending.has(pendingKey)) return;
    setPending((current) => new Set(current).add(pendingKey));
    setActive((current) => current?.tracker?.id === trackerId
      ? { ...current, pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === entry.pokemon_id ? { ...pokemon, [field]: caught } : pokemon) }
      : current);
    const { data, error } = await supabase.rpc("set_my_pokedex_tracker_entry", {
      p_tracker_id: trackerId,
      p_pokemon_id: entry.pokemon_id,
      p_is_shiny: isShiny,
      p_caught: caught,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setPending((current) => { const next = new Set(current); next.delete(pendingKey); return next; });
    if (error) {
      setActive((current) => current?.tracker?.id === trackerId
        ? { ...current, pokemon: current.pokemon.map((pokemon) => pokemon.pokemon_id === entry.pokemon_id ? { ...pokemon, [field]: !caught } : pokemon) }
        : current);
      setMessage(`Progress was not saved: ${error.message}`);
      return;
    }
    setHub((current) => current ? {
      ...current,
      trackers: current.trackers.map((tracker) => tracker.id === trackerId
        ? { ...tracker, caught: data.caught, shiny_caught: data.shiny_caught, updated_at: new Date().toISOString() }
        : tracker),
    } : current);
    setMessage("");
  }

  async function saveSettings(includeShiny = active?.tracker.include_shiny) {
    if (!active) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("update_my_pokedex_tracker", {
      p_tracker_id: trackerId,
      p_title: settingsTitle.trim() || active.tracker.title,
      p_include_shiny: includeShiny,
    });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setShowSettings(false);
    await loadHub(trackerId, accountVersion);
  }

  async function deleteTracker() {
    if (!active || !window.confirm(`Delete “${active.tracker.title}” and all of its saved progress? This cannot be undone.`)) return;
    const accountVersion = accountVersionRef.current;
    const trackerId = active.tracker.id;
    setBusy(true);
    const { data, error } = await supabase.rpc("delete_my_pokedex_tracker", { p_tracker_id: trackerId });
    if (accountVersion !== accountVersionRef.current) return;
    setBusy(false);
    if (error || !data) { setMessage(error?.message || "That tracker could not be deleted."); return; }
    const nextId = hub?.trackers?.find((tracker) => tracker.id !== trackerId)?.id || "";
    setActive(null);
    setActiveId("");
    await loadHub(nextId, accountVersion);
  }

  if (authState === "loading") return <main className="dex-tracker-shell"><section className="dex-tracker-loading"><span className="dex-ball" aria-hidden="true" /><h1>Pokédex Tracker</h1><p>Checking your DraftCenter account…</p></section></main>;

  if (authState === "signed-out") return <main className="dex-tracker-shell">
    <section className="dex-tracker-signin">
      <span className="dex-kicker">ACCOUNT COLLECTIONS</span>
      <h1>Your Pokédex journey deserves one organized home.</h1>
      <p>Create a tracker for any supported game or Pokémon HOME, check off every discovery, and keep a separate shiny dex—all safely tied to your DraftCenter account.</p>
      <div><a className="dex-primary-button" href="/#member-access">Sign in to start</a><a className="dex-secondary-button" href="/pokemon">Explore the Pokédex</a></div>
    </section>
  </main>;

  return <main className={`dex-tracker-shell ${mode === "shiny" ? "shiny-mode" : ""}`}>
    <header className="dex-tracker-hero">
      <div>
        <span className="dex-kicker">LIVING COLLECTIONS</span>
        <h1>Every Pokédex</h1>
        <p>Track your catches game by game, build a complete HOME collection, and turn any list into a sparkling shiny hunt. Your progress saves automatically.</p>
      </div>
      <div className="dex-tracker-hero-card" aria-label="Tracker benefits">
        <span><b>37+</b> verified game catalogs</span>
        <span><b>HOME</b> box-by-box organization</span>
        <span><b>Private</b> account saving</span>
      </div>
    </header>

    {message && <p className="dex-tracker-message" role="status" aria-live="polite">{message}</p>}

    <section className="dex-tracker-workspace">
      <aside className="dex-tracker-sidebar">
        <div className="dex-tracker-sidebar-heading"><div><span className="dex-kicker">MY TRACKERS</span><strong>{hub?.trackers?.length || 0} collections</strong></div><button type="button" onClick={() => setShowCreate(true)} aria-label="Create a new Pokédex tracker">+</button></div>
        <div className="dex-tracker-list">
          {(hub?.trackers || []).map((tracker) => {
            const percent = tracker.total ? Math.round((tracker.caught / tracker.total) * 100) : 0;
            return <button type="button" key={tracker.id} className={tracker.id === activeId ? "is-active" : ""} onClick={() => openTracker(tracker.id)}>
              <span className={`dex-mini-icon ${tracker.catalog_key === "home" ? "is-home" : ""}`} aria-hidden="true">{tracker.catalog_key === "home" ? "⌂" : "◉"}</span>
              <span><strong>{tracker.title}</strong><small>{tracker.catalog_name}</small><i><b style={{ width: `${percent}%` }} /></i></span>
              <em>{percent}%</em>
            </button>;
          })}
        </div>
        {!showCreate && <button type="button" className="dex-new-button" onClick={() => setShowCreate(true)}>＋ New tracker</button>}
        {showCreate && <CreateTracker catalogs={hub?.catalogs || []} busy={busy} onCreate={createTracker} onCancel={hub?.trackers?.length ? () => setShowCreate(false) : null} />}
      </aside>

      <section className="dex-tracker-main">
        {loadingTracker && <div className="dex-tracker-loading is-inline"><span className="dex-ball" aria-hidden="true" /><h2>Loading this Pokédex…</h2></div>}
        {!loadingTracker && !active && <section className="dex-tracker-welcome">
          <div className="dex-welcome-orbit" aria-hidden="true"><span>001</span><span>151</span><span>1025</span><i>✓</i></div>
          <span className="dex-kicker">READY WHEN YOU ARE</span>
          <h2>Start a collection worth finishing.</h2>
          <p>Choose a game in the panel to build your first tracker. You can make separate lists for every playthrough and add shiny progress whenever the hunt begins.</p>
          <button className="dex-primary-button" type="button" onClick={() => setShowCreate(true)}>Create my first tracker</button>
        </section>}
        {!loadingTracker && active && <>
          <header className="dex-active-header">
            <div><span className="dex-kicker">{active.tracker.catalog_name}</span><h2>{active.tracker.title}</h2><p>{standardProgress.caught.toLocaleString()} of {standardProgress.total.toLocaleString()} registered{active.tracker.include_shiny ? ` · ${shinyProgress.caught.toLocaleString()} shinies found` : ""}</p></div>
            <div className="dex-active-actions"><button type="button" className="dex-secondary-button" onClick={() => setShowSettings((value) => !value)}>Manage tracker</button></div>
          </header>

          {showSettings && <form className="dex-tracker-settings" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
            <label>Tracker name<input value={settingsTitle} onChange={(event) => setSettingsTitle(event.target.value)} maxLength={80} /></label>
            {!active.tracker.include_shiny && <button type="button" className="dex-shiny-button" onClick={() => saveSettings(true)}>✦ Add shiny dex</button>}
            <button className="dex-primary-button" disabled={busy}>{busy ? "Saving…" : "Save name"}</button>
            <button type="button" className="dex-danger-button" onClick={deleteTracker} disabled={busy}>Delete tracker</button>
          </form>}

          <section className="dex-progress-panel">
            <ProgressRing progress={standardProgress} label="Standard" />
            {active.tracker.include_shiny ? <ProgressRing progress={shinyProgress} label="Shiny" shiny /> : <button className="dex-add-shiny-card" type="button" onClick={() => saveSettings(true)}><b>✦</b><span><strong>Add a shiny dex</strong><small>A second, independent checklist</small></span></button>}
            <div className="dex-progress-copy"><span>{standardProgress.total - standardProgress.caught === 0 ? "COMPLETE" : "NEXT MILESTONE"}</span><strong>{standardProgress.total - standardProgress.caught === 0 ? "Pokédex complete!" : `${Math.min(standardProgress.total, Math.ceil((standardProgress.caught + 1) / 25) * 25).toLocaleString()} registered`}</strong><small>Every change is saved to your DraftCenter account.</small></div>
          </section>

          <div className="dex-mode-tabs" role="tablist" aria-label="Pokédex progress type">
            <button type="button" role="tab" aria-selected={mode === "standard"} onClick={() => setMode("standard")}><span aria-hidden="true">◉</span> Standard dex <b>{standardProgress.caught}/{standardProgress.total}</b></button>
            {active.tracker.include_shiny && <button type="button" role="tab" aria-selected={mode === "shiny"} onClick={() => setMode("shiny")}><span aria-hidden="true">✦</span> Shiny dex <b>{shinyProgress.caught}/{shinyProgress.total}</b></button>}
          </div>

          <section className="dex-tracker-controls">
            <label className="dex-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or number…" /></label>
            {active.tracker.catalog_key === "home" && <label className="dex-home-box-filter"><span>HOME box</span><select value={homeBox} onChange={(event) => setHomeBox(event.target.value)}><option value="all">All boxes</option>{homeBoxes.map((placement) => <option key={placement.globalBox} value={placement.globalBox}>Page {placement.page} · Box {placement.box}</option>)}</select></label>}
            <div role="group" aria-label="Progress filter">
              {["all", "caught", "missing"].map((value) => <button type="button" key={value} className={status === value ? "is-active" : ""} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "caught" ? mode === "shiny" ? "Found" : "Registered" : "Missing"}</button>)}
            </div>
            <span><b>{filtered.length.toLocaleString()}</b> shown</span>
          </section>

          {visible.length ? <section className="dex-pokemon-grid" aria-label={`${mode === "shiny" ? "Shiny" : "Standard"} Pokédex entries`}>
            {visible.map((entry) => <PokemonCard key={entry.pokemon_id} entry={entry} mode={mode} placement={active.tracker.catalog_key === "home" ? pokedexHomePlacement(entry.dex_number) : null} pending={pending.has(`${active.tracker.id}:${entry.pokemon_id}:${mode}`)} onToggle={toggleEntry} />)}
          </section> : <section className="dex-no-results"><span aria-hidden="true">⌕</span><h3>No Pokémon match this view.</h3><p>Try a different name or switch the progress filter.</p></section>}
          {shown < filtered.length && <button type="button" className="dex-load-more" onClick={() => setShown((count) => count + POKEDEX_TRACKER_PAGE_SIZE)}>Show {Math.min(POKEDEX_TRACKER_PAGE_SIZE, filtered.length - shown)} more Pokémon</button>}
        </>}
      </section>
    </section>
  </main>;
}
