"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  filterWorldsCompetitors,
  toggleWorldsPick,
  WORLDS_2026_EVENT_ID,
  WORLDS_2026_LOCKS_AT,
  WORLDS_2026_PICK_COUNT,
  WORLDS_2026_SCORING,
  worldsEntryIsLocked,
} from "../lib/worlds2026";
import WorldsDisciplineNav from "./WorldsDisciplineNav";

const FALLBACK_EVENT = {
  id: WORLDS_2026_EVENT_ID,
  display_name: "2026 VGC Worlds Pick 16",
  division: "Masters",
  status: "open",
  opens_at: "2026-08-10T07:00:00Z",
  locks_at: WORLDS_2026_LOCKS_AT,
  starts_at: WORLDS_2026_LOCKS_AT,
  ends_at: "2026-08-31T07:00:00Z",
  bracket_status: "waiting_for_official_bracket",
  roster_checked_at: "2026-08-10",
  is_locked: false,
};

function fallbackCompetitors(rosterSource) {
  if (rosterSource.division !== "Masters" || rosterSource.competitors.some((competitor) => competitor.division !== "Masters")) {
    throw new Error("The Worlds prediction pool must contain only Masters Division competitors.");
  }
  return rosterSource.competitors.map((competitor) => ({
    slug: competitor.slug,
    displayName: competitor.name,
    countryCode: competitor.countryCode,
    qualificationRegion: competitor.region,
    qualificationPath: competitor.qualification,
    attendanceStatus: "invite_earned",
    isSelectable: true,
    scorePoints: 0,
    resultLabel: null,
  }));
}

function hubCompetitors(hub) {
  return hub.competitors.map((competitor) => ({
    slug: competitor.slug,
    displayName: competitor.display_name,
    countryCode: competitor.country_code,
    qualificationRegion: competitor.qualification_region,
    qualificationPath: competitor.qualification_path,
    attendanceStatus: competitor.attendance_status,
    isSelectable: competitor.is_selectable,
    scorePoints: competitor.score_points,
    resultLabel: competitor.result_label,
  }));
}

function displayPacificDate(value, includeTime = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
  }).format(new Date(value));
}

function statusLabel(status) {
  return ({
    invite_earned: "Invite earned",
    confirmed: "Attendance confirmed",
    withdrawn: "Withdrawn",
    declined: "Declined",
  })[status] || status;
}

export default function WorldsPickSixteen({ rosterSource }) {
  const [hub, setHub] = useState(null);
  const [user, setUser] = useState(undefined);
  const [selected, setSelected] = useState([]);
  const [ace, setAce] = useState(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHub, setLoadingHub] = useState(true);

  const fallback = useMemo(() => fallbackCompetitors(rosterSource), [rosterSource]);
  const competitors = useMemo(() => hub ? hubCompetitors(hub) : fallback, [hub, fallback]);
  const competitorBySlug = useMemo(() => new Map(competitors.map((competitor) => [competitor.slug, competitor])), [competitors]);
  const event = hub?.event || FALLBACK_EVENT;
  const locked = hub ? Boolean(event.is_locked || worldsEntryIsLocked(event)) : false;
  const regions = useMemo(() => [...new Set(competitors.map((competitor) => competitor.qualificationRegion))], [competitors]);
  const filtered = useMemo(() => filterWorldsCompetitors(competitors, search, region), [competitors, search, region]);

  async function loadHub(supabase) {
    const { data, error } = await supabase.rpc("get_worlds_pick_hub", { p_event_id: WORLDS_2026_EVENT_ID });
    if (error || !data) {
      setLoadingHub(false);
      return;
    }
    if (data.event?.division !== "Masters") {
      setMessage("This competition is unavailable because its roster is not Masters Division only.");
      setLoadingHub(false);
      return;
    }
    setHub(data);
    setSelected(data.my_entry?.picks || []);
    setAce(data.my_entry?.ace_slug || null);
    setLoadingHub(false);
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      loadHub(supabase);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      queueMicrotask(() => active && loadHub(supabase));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  function toggle(competitor) {
    if (!user || locked || !competitor.isSelectable || ["withdrawn", "declined"].includes(competitor.attendanceStatus)) return;
    const removingAce = ace === competitor.slug && selected.includes(competitor.slug);
    const next = toggleWorldsPick(selected, competitor.slug, WORLDS_2026_PICK_COUNT);
    setSelected(next.picks);
    if (removingAce) setAce(null);
    setMessage(next.error);
  }

  async function saveEntry() {
    setMessage("");
    if (!user) return setMessage("Sign in from the DraftCenter home page before saving your entry.");
    if (!hub) return setMessage("The Pick 16 competition is not connected yet. The invitee list is still available below.");
    if (locked) return setMessage("Entries are locked for Worlds.");
    if (selected.length !== WORLDS_2026_PICK_COUNT) return setMessage(`Choose exactly ${WORLDS_2026_PICK_COUNT} competitors before saving.`);
    if (!ace || !selected.includes(ace)) return setMessage("Choose one Ace Pick from your 16 competitors before saving.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("save_worlds_pick_entry", { p_event_id: WORLDS_2026_EVENT_ID, p_pick_slugs: selected, p_ace_slug: ace });
    if (error) {
      setBusy(false);
      return setMessage(error.message || "Your entry could not be saved.");
    }
    await loadHub(supabase);
    setBusy(false);
    setMessage("Your Pick 16 and Ace Pick are saved. You can revise them until the lock time.");
  }

  return <main className="worlds-shell">
    <WorldsDisciplineNav current="vgc" />
    <section className="worlds-hero">
      <div>
        <span className="eyebrow">POKÉMON WORLDS · SAN FRANCISCO</span>
        <h1>2026 Pokémon Worlds VGC predictions</h1>
        <p>Pick the 16 VGC players you believe in from every currently known Masters invitee. When Worlds finishes, the entry with the strongest collective results wins the DraftCenter community leaderboard.</p>
        <div className="worlds-hero-actions">
          <a className="primary-button inline-link-button" href={user === null ? "/#member-access" : "#pick-sixteen"}>{user === null ? "Sign in to predict" : "Build my 16"}</a>
          <a className="quiet-button" href="/worlds/2026">All Worlds competitions</a>
          <a className="quiet-button" href="#qualified-players">See all {competitors.length} invitees</a>
        </div>
      </div>
      <aside className="worlds-event-card">
        <span>2026 WORLD CHAMPIONSHIPS</span>
        <strong>Aug 28–30</strong>
        <p>Moscone Center · Championship Sunday at Chase Center</p>
        <dl>
          <div><dt>Division</dt><dd>VGC Masters</dd></div>
          <div><dt>Entry lock</dt><dd>{displayPacificDate(event.locks_at, true)}</dd></div>
          <div><dt>Roster checked</dt><dd>{displayPacificDate(`${event.roster_checked_at}T12:00:00Z`)}</dd></div>
        </dl>
      </aside>
    </section>

    <section className="worlds-trust-note">
      <div><span className="eyebrow">MASTERS DIVISION ONLY</span><h2>{competitors.length} Masters players have earned invites</h2></div>
      <p>Junior- and Senior-Division qualifiers are excluded. An invite is not the same as confirmed attendance, and the official Masters cutoff can still include people under 18. DraftCenter does not collect or infer private age data.</p>
      <div className="worlds-source-links"><a href="https://victoryroad.pro/2026-worlds-invites/" target="_blank" rel="noreferrer">Invite tracker ↗</a><a href="https://worlds.pokemon.com/en-gb" target="_blank" rel="noreferrer">Official Worlds site ↗</a></div>
    </section>

    <section className="worlds-pick-layout" id="pick-sixteen">
      <div className="worlds-pick-main">
        <header className="section-heading">
          <div><span className="eyebrow">SITEWIDE COMPETITION</span><h2>Your Pick 16</h2><p>Your choices stay private until entries lock. Choose one Ace Pick whose placement points count twice.</p></div>
          <div className="worlds-pick-meter"><strong>{selected.length}</strong><span>/ {WORLDS_2026_PICK_COUNT}</span></div>
        </header>

        {user === undefined ? <div className="worlds-account-gate is-loading" aria-live="polite">
          <strong>Checking your DraftCenter account…</strong>
        </div> : !user ? <div className="worlds-account-gate">
          <div aria-hidden="true" className="worlds-account-lock">🔒</div>
          <span className="eyebrow">DRAFTCENTER ACCOUNT REQUIRED</span>
          <h3>Sign in to build your Worlds prediction.</h3>
          <p>Like DraftCenter&apos;s Daily Games, submitting a Pick 16 entry requires a free account. Your choices stay private until entries lock, and you can return to edit them before the deadline.</p>
          <a className="secondary-button" href="/#member-access">Sign in or create an account</a>
        </div> : <>
        <div className="worlds-selected-grid">
          {Array.from({ length: WORLDS_2026_PICK_COUNT }, (_, index) => {
            const competitor = competitorBySlug.get(selected[index]);
            return competitor ? <div className={`worlds-selected-pick${ace === competitor.slug ? " is-ace" : ""}`} key={competitor.slug}>
              <button className="worlds-pick-remove" type="button" disabled={locked} onClick={() => toggle(competitor)}>
                <span>{index + 1}</span><strong>{competitor.displayName}</strong><small>{competitor.countryCode} · remove</small>
              </button>
              <label className="worlds-ace-choice"><input type="radio" name="worlds-ace" checked={ace === competitor.slug} disabled={locked} onChange={() => setAce(competitor.slug)} /><span>Ace Pick ×2</span></label>
            </div> : <div className="worlds-empty-pick" key={index}><span>{index + 1}</span><small>Open spot</small></div>;
          })}
        </div>

        <div className="worlds-save-row">
          <div>
            {loadingHub ? <p>Connecting the community competition…</p> : !hub ? <p>The full roster is ready; saving will open when the database migration is released.</p> : locked ? <p>Entries are locked. Saved lineups are now public on the leaderboard.</p> : !user ? <p><a href="/">Sign in</a> to save and edit your entry.</p> : hub.my_entry ? <p>Saved as <strong>{hub.my_entry.display_name}</strong>. Edits remain open until the deadline.</p> : <p>Finish all 16 spots, then save one entry to the sitewide field.</p>}
            {message && <p className="worlds-message" role="status">{message}</p>}
          </div>
          <button className="primary-button" type="button" disabled={busy || locked || selected.length !== WORLDS_2026_PICK_COUNT || !ace || !hub} onClick={saveEntry}>{busy ? "Saving…" : hub?.my_entry ? "Update entry" : "Save entry"}</button>
        </div>
        </>}
      </div>

      <aside className="worlds-scoring-card">
        <span className="eyebrow">HOW SCORING WORKS</span>
        <h2>Every deep run matters.</h2>
        <p>Each selected competitor earns the points for their final placement. Your chosen Ace Pick earns double points, then all 16 scores are added together.</p>
        <ol>{WORLDS_2026_SCORING.map(([label, points]) => <li key={label}><span>{label}</span><strong>{points} pts</strong></li>)}</ol>
        <small>The placement curve rewards every Top 64 pick while making the champion meaningfully valuable. Ties share the same rank, and scoring uses official published results.</small>
      </aside>
    </section>

    <section className="worlds-roster-section" id="qualified-players">
      <header className="section-heading"><div><span className="eyebrow">2026 VGC MASTERS</span><h2>Pokémon Worlds VGC Masters invitee list</h2><p>Browse qualified players by name, country code, region, or qualification path.</p></div><strong>{filtered.length} shown</strong></header>
      <aside className="worlds-roster-source" aria-labelledby="worlds-roster-source-heading">
        <div>
          <span className="eyebrow">ROSTER SOURCE</span>
          <h3 id="worlds-roster-source-heading">Where this invite list comes from</h3>
          <p>This {displayPacificDate(`${rosterSource.sourceCheckedAt}T12:00:00Z`)} snapshot was compiled from Victory Road&apos;s 2026 World Championships invite tracker for VGC Masters. The tracker brings together invite earners from official Championship Point standings and qualifying event results.</p>
          <small>This is an invite-earned list, not a confirmed attendance or registration list.</small>
        </div>
        <a className="quiet-button" href={rosterSource.sourceUrl} target="_blank" rel="noreferrer">View the Victory Road tracker ↗</a>
      </aside>
      <div className="worlds-roster-filters">
        <label>Find a competitor<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Giovanni Cischke, Luca Ceribelli, or Wolfe Glick…" /></label>
        <label>Qualification region<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">All regions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <div className="worlds-player-grid">
        {filtered.map((competitor) => {
          const chosen = selected.includes(competitor.slug);
          const unavailable = !competitor.isSelectable || ["withdrawn", "declined"].includes(competitor.attendanceStatus);
          return <article className={chosen ? "is-selected" : unavailable ? "is-unavailable" : !user ? "is-account-locked" : ""} key={competitor.slug}>
            <header><span>{competitor.countryCode}</span><small>{competitor.qualificationRegion}</small></header>
            <h3>{competitor.displayName}</h3>
            <p>{competitor.qualificationPath}</p>
            <footer><small>{statusLabel(competitor.attendanceStatus)}</small><button type="button" aria-pressed={chosen} disabled={!user || locked || unavailable} onClick={() => toggle(competitor)}>{chosen ? "Selected ✓" : unavailable ? "Unavailable" : !user ? "Sign in to pick" : "Add to 16"}</button></footer>
          </article>;
        })}
      </div>
      {!filtered.length && <div className="worlds-no-results"><h3>No invitees match those filters.</h3><button type="button" className="quiet-button" onClick={() => { setSearch(""); setRegion("all"); }}>Clear filters</button></div>}
    </section>

    <section className="worlds-bottom-grid">
      <article className="worlds-leaderboard-card">
        <header><div><span className="eyebrow">VGC COMMUNITY LEADERBOARD</span><h2>{hub?.entry_count || 0} entries</h2></div>{hub?.my_entry && <strong>Your rank: {hub.my_entry.rank}</strong>}</header>
        {hub?.standings?.length ? <div className="worlds-standings">{hub.standings.map((entry, index) => <details key={`${entry.display_name}-${index}`} className={entry.is_me ? "is-me" : ""}>
          <summary><span>#{entry.rank}</span><strong>{entry.display_name}</strong><b>{entry.score} pts</b></summary>
          {entry.picks ? <p>{entry.picks.map((slug) => `${competitorBySlug.get(slug)?.displayName || slug}${slug === entry.ace_slug ? " (Ace ×2)" : ""}`).join(" · ")}</p> : <p>Lineup stays private until entries lock.</p>}
        </details>)}</div> : <p className="worlds-empty-state">Be the first DraftCenter player to save a Pick 16 entry.</p>}
      </article>

      <article className="worlds-bracket-card">
        <span className="eyebrow">PHASE TWO</span>
        <h2>The Worlds bracket challenge comes next.</h2>
        <p>Once the official elimination bracket exists, this page can unlock a March Madness-style prediction game using the real pairings. We will not invent seeds or matchups before Pokémon publishes them.</p>
        <div aria-hidden="true" className="worlds-bracket-preview"><span /><span /><span /><span /><i /></div>
        <strong>Waiting for the official Worlds bracket</strong>
      </article>
    </section>
  </main>;
}
