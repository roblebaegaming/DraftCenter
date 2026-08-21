"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  filterWorldsCompetitors,
  formatWorldsAverageFinish,
  toggleWorldsPick,
  WORLDS_2026_LOCKS_AT,
  WORLDS_2026_SCORING,
  worldsEntryIsLocked,
} from "../lib/worlds2026";
import { WORLDS_PICK_DISCIPLINES } from "../lib/worldsFutureSetup";
import {
  WORLDS_LANGUAGES,
  worldsCopy,
  worldsLanguage,
  worldsQualificationLabel,
  worldsRegionLabel,
  worldsServerError,
} from "../lib/worlds2026I18n";
import WorldsDisciplineNav from "./WorldsDisciplineNav";
import WorldsChampionOdds from "./WorldsChampionOdds";
import WorldsMetaChallenge from "./WorldsMetaChallenge";
import WorldsPickShare from "./WorldsPickShare";
import WorldsChatBoard from "./WorldsChatBoard";
import PublicCoachProfile, { CoachProfileButton } from "./PublicCoachProfile";

function fallbackEvent(config, rosterSource) {
  return {
    id: config.eventId,
    display_name: `2026 ${config.gameLabel} Worlds Pick 10`,
    division: config.division,
    status: "draft",
    opens_at: "2026-08-10T07:00:00Z",
    locks_at: WORLDS_2026_LOCKS_AT,
    starts_at: WORLDS_2026_LOCKS_AT,
    ends_at: "2026-08-31T07:00:00Z",
    bracket_status: "waiting_for_official_bracket",
    roster_checked_at: rosterSource.sourceCheckedAt || rosterSource.source_checked_at || "2026-08-10",
    is_locked: true,
  };
}

function fallbackCompetitors(rosterSource, config, locale = "en") {
  if (!Array.isArray(rosterSource.competitors)) return [];
  if (config.division === "Masters" && (rosterSource.division !== "Masters" || rosterSource.competitors.some((competitor) => competitor.division && competitor.division !== "Masters"))) {
    throw new Error(locale !== "en" ? worldsCopy(locale).errors.mastersOnly : "The Worlds prediction pool must contain only Masters Division competitors.");
  }
  return rosterSource.competitors.map((competitor) => ({
    slug: competitor.slug,
    displayName: competitor.name || competitor.display_name,
    countryCode: competitor.countryCode || competitor.country_code,
    qualificationRegion: competitor.region || competitor.qualification_region,
    qualificationPath: competitor.qualification || competitor.qualification_path,
    modelQualificationPath: competitor.qualification || competitor.qualification_path,
    seasonResults: competitor.seasonResults || competitor.season_results || "",
    pickCount: 0,
    aceCount: 0,
    attendanceStatus: competitor.attendanceStatus || competitor.attendance_status || "invite_earned",
    isSelectable: competitor.isSelectable ?? competitor.is_selectable ?? true,
    scorePoints: competitor.scorePoints || competitor.score_points || 0,
    resultLabel: competitor.resultLabel || competitor.result_label || null,
  }));
}

function hubCompetitors(hub, fallbackBySlug, popularityBySlug) {
  return hub.competitors.map((competitor) => ({
    ...fallbackBySlug.get(competitor.slug),
    slug: competitor.slug,
    displayName: competitor.display_name,
    countryCode: competitor.country_code,
    qualificationRegion: competitor.qualification_region,
    qualificationPath: competitor.qualification_path,
    modelQualificationPath: competitor.qualification_path,
    seasonResults: fallbackBySlug.get(competitor.slug)?.seasonResults || "",
    pickCount: popularityBySlug.get(competitor.slug)?.pick_count || 0,
    aceCount: popularityBySlug.get(competitor.slug)?.ace_count || 0,
    attendanceStatus: competitor.attendance_status,
    isSelectable: competitor.is_selectable,
    scorePoints: competitor.score_points,
    resultLabel: competitor.result_label,
  }));
}

function displayPacificDate(value, includeTime = false, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
  }).format(new Date(value));
}

function statusLabel(status, locale = "en") {
  if (locale !== "en") return worldsCopy(locale).status[status] || status;
  return ({
    invite_earned: "Invite earned",
    confirmed: "Attendance confirmed",
    withdrawn: "Withdrawn",
    declined: "Declined",
  })[status] || status;
}

export default function WorldsPickSixteen({ rosterSource, discipline = "vgc", locale = "en", translationBeta = null }) {
  const config = WORLDS_PICK_DISCIPLINES[discipline] || WORLDS_PICK_DISCIPLINES.vgc;
  const copy = worldsCopy(locale);
  const isItalian = locale !== "en";
  const eventId = config.eventId;
  const pickCount = config.pickCount;
  const [hub, setHub] = useState(null);
  const [user, setUser] = useState(undefined);
  const [selected, setSelected] = useState([]);
  const [ace, setAce] = useState(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingHub, setLoadingHub] = useState(true);
  const [popularity, setPopularity] = useState(null);
  const [offeredLocale, setOfferedLocale] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  const draftDirtyRef = useRef(false);
  const currentUserIdRef = useRef(undefined);

  const fallback = useMemo(() => fallbackCompetitors(rosterSource, config, locale), [rosterSource, config, locale]);
  const fallbackBySlug = useMemo(() => new Map(fallback.map((competitor) => [competitor.slug, competitor])), [fallback]);
  const popularityBySlug = useMemo(() => new Map((popularity?.competitors || []).map((competitor) => [competitor.slug, competitor])), [popularity]);
  const competitors = useMemo(() => (hub?.competitors?.length ? hubCompetitors(hub, fallbackBySlug, popularityBySlug) : fallback).map((competitor) => ({
    ...competitor,
    qualificationRegion: worldsRegionLabel(competitor.qualificationRegion, locale),
    qualificationPath: worldsQualificationLabel(competitor.qualificationPath, locale),
  })), [hub, fallback, fallbackBySlug, popularityBySlug, locale]);
  const competitorBySlug = useMemo(() => new Map(competitors.map((competitor) => [competitor.slug, competitor])), [competitors]);
  const event = hub?.event || fallbackEvent(config, rosterSource);
  const staged = event.status === "draft";
  const locked = Boolean(event.status !== "open" || event.is_locked || worldsEntryIsLocked(event));
  const regions = useMemo(() => [...new Set(competitors.map((competitor) => competitor.qualificationRegion))], [competitors]);
  const filtered = useMemo(() => filterWorldsCompetitors(competitors, search, region), [competitors, search, region]);

  async function loadHub(supabase, { hydrateEntry = false } = {}) {
    const [{ data, error }, results, popularityResult] = await Promise.all([
      supabase.rpc("get_worlds_pick_hub", { p_event_id: eventId }),
      supabase.rpc("get_worlds_result_status", { p_event_id: eventId }),
      config.key === "vgc"
        ? supabase.rpc("get_worlds_pick_popularity", { p_event_id: eventId })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (error || !data) {
      setLoadingHub(false);
      return;
    }
    if (data.event?.division !== config.division) {
      setMessage(isItalian ? copy.errors.unavailableDivision : `This competition is unavailable because its roster is not in the reviewed ${config.division} division.`);
      setLoadingHub(false);
      return;
    }
    setPopularity(popularityResult.error ? null : popularityResult.data);
    setHub({ ...data, results: results.error ? { status: "waiting", is_stale: false } : results.data });
    if (hydrateEntry || !draftDirtyRef.current) {
      setSelected(data.my_entry?.picks || []);
      setAce(data.my_entry?.ace_slug || null);
      draftDirtyRef.current = false;
    }
    setLoadingHub(false);
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const nextUser = data.session?.user || null;
      currentUserIdRef.current = nextUser?.id || null;
      setUser(nextUser);
      loadHub(supabase, { hydrateEntry: true });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user || null;
      const nextUserId = nextUser?.id || null;
      const identityChanged = currentUserIdRef.current !== nextUserId;
      currentUserIdRef.current = nextUserId;
      setUser(nextUser);
      queueMicrotask(() => active && loadHub(supabase, { hydrateEntry: identityChanged }));
    });
    const refresh = setInterval(() => { if (active) loadHub(supabase); }, 120_000);
    return () => { active = false; clearInterval(refresh); listener.subscription.unsubscribe(); };
  }, [eventId, config.division]);

  useEffect(() => {
    if (isItalian || config.key !== "vgc") return;
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const preferredLanguage = languages
      .map((value) => String(value || "").toLowerCase().split("-")[0])
      .find((value) => WORLDS_LANGUAGES[value]);
    let dismissed = false;
    try { dismissed = localStorage.getItem("draftcenter-worlds-language-offer-dismissed") === "1"; } catch {}
    setOfferedLocale(preferredLanguage && preferredLanguage !== "en" && !dismissed ? preferredLanguage : null);
  }, [config.key, isItalian]);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = copy.documentLanguage;
    return () => { document.documentElement.lang = previousLanguage || "en"; };
  }, [copy.documentLanguage]);

  function dismissLanguageOffer() {
    try { localStorage.setItem("draftcenter-worlds-language-offer-dismissed", "1"); } catch {}
    setOfferedLocale(null);
  }

  function toggle(competitor) {
    if (!user || locked || !competitor.isSelectable || ["withdrawn", "declined"].includes(competitor.attendanceStatus)) return;
    const removingAce = ace === competitor.slug && selected.includes(competitor.slug);
    const next = toggleWorldsPick(selected, competitor.slug, pickCount);
    if (next.picks !== selected) draftDirtyRef.current = true;
    setSelected(next.picks);
    if (removingAce) setAce(null);
    setMessage(isItalian && next.error ? copy.errors.spotsFull(pickCount) : next.error);
  }

  function chooseChampion(slug) {
    if (slug === ace) return;
    draftDirtyRef.current = true;
    setAce(slug);
    setMessage("");
  }

  async function saveEntry() {
    setMessage("");
    if (!user) return setMessage(isItalian ? copy.errors.signIn : "Sign in from the DraftCenter home page before saving your entry.");
    if (!hub) return setMessage(isItalian ? copy.errors.notConnected : "The Pick 10 competition is not connected yet. The reviewed roster is still available below.");
    if (locked) return setMessage(isItalian ? copy.errors.locked : "Entries are locked for Worlds.");
    if (selected.length !== pickCount) return setMessage(isItalian ? copy.errors.chooseExactly(pickCount) : `Choose exactly ${pickCount} ${config.entryPlural.toLowerCase()} before saving.`);
    if (!ace || !selected.includes(ace)) return setMessage(isItalian ? copy.errors.chooseChampion(pickCount) : `Choose Your Champion from your ${pickCount} ${config.entryPlural.toLowerCase()} before saving.`);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("save_worlds_pick_entry", { p_event_id: eventId, p_pick_slugs: selected, p_ace_slug: ace });
    if (error) {
      setBusy(false);
      return setMessage(isItalian ? worldsServerError(error.message, locale, pickCount) : error.message || "Your entry could not be saved.");
    }
    await loadHub(supabase, { hydrateEntry: true });
    setBusy(false);
    setMessage(isItalian ? copy.saved : "Your Pick 10 and Your Champion are saved. You can revise them until the lock time.");
  }

  return <main className="worlds-shell" lang={copy.documentLanguage}>
    {offeredLocale && <section className="worlds-language-offer" aria-label={copy.languageOffer.label}>
      <div><strong>{copy.languageOffer.label}</strong><span>{copy.languageOffer.body(WORLDS_LANGUAGES[offeredLocale].nativeLabel)}</span></div>
      <div><a href={WORLDS_LANGUAGES[offeredLocale].href} hrefLang={offeredLocale}>{copy.languageOffer.action(WORLDS_LANGUAGES[offeredLocale].nativeLabel)}</a><button type="button" onClick={dismissLanguageOffer}>{copy.languageOffer.dismiss}</button></div>
    </section>}
    {config.key === "vgc" && <nav className="worlds-language-switch" aria-label={copy.languageSwitch.label}>{Object.entries(WORLDS_LANGUAGES).map(([language, details]) => language === worldsLanguage(locale)
      ? <strong key={language} aria-current="page" lang={details.documentLanguage}>{details.nativeLabel}</strong>
      : <a key={language} href={details.href} hrefLang={language} lang={details.documentLanguage}>{details.nativeLabel}</a>)}</nav>}
    {translationBeta && <aside className="translation-beta-note" aria-label={translationBeta.title}>
      <div><strong>{translationBeta.title}</strong><span>{translationBeta.body}</span></div>
      <a href="/support">{translationBeta.action}</a>
    </aside>}
    <WorldsDisciplineNav current={config.key} locale={locale} />
    <section className="worlds-hero">
      <div>
        <span className="eyebrow">{isItalian ? copy.hero.eyebrow : "POKÉMON WORLDS · SAN FRANCISCO"}</span>
        {isItalian ? <h1>{copy.hero.title}</h1> : config.key === "vgc" ? <h1>2026 Pokémon Worlds VGC predictions</h1> : config.key === "go" ? <h1>2026 Pokémon GO Worlds predictions</h1> : <h1>2026 Pokémon Worlds {config.gameLabel} predictions</h1>}
        <p>{isItalian ? copy.hero.body : config.key === "vgc" ? <>Pick 10 real VGC players and rank six Pokémon for the World Champion&apos;s team. Both prediction sections are below, with separate community leaderboards.</> : <>Pick the 10 {config.entryPlural} you believe in from the reviewed {config.gameLabel} roster. When Worlds finishes, the entry with the strongest collective results wins the DraftCenter community leaderboard.</>}</p>
        <div className="worlds-hero-actions">
          <a className="quiet-button" href="#meta-picks">{isItalian ? copy.hero.meta : "Predict the winning meta"}</a>
          <a className="primary-button inline-link-button" href={user === null ? "/#member-access" : "#qualified-players"}>{isItalian ? user === null ? copy.hero.signIn : staged ? copy.hero.browse : copy.hero.build : user === null ? "Sign in to predict" : staged ? "Browse reviewed roster" : "Build my 10"}</a>
          {config.key === "vgc" && <a className="quiet-button" href="/worlds/2026/vgc/bracket">{isItalian ? copy.hero.bracket : "Top Cut bracket"}</a>}
          {config.key === "vgc" && <a className="quiet-button" href="/worlds/2026/vgc/victory-road-to-san-francisco">{isItalian ? copy.hero.victoryRoad : "Victory Road bracket"}</a>}
          <a className="quiet-button" href="/worlds/2026">{isItalian ? copy.hero.all : "All Worlds competitions"}</a>
          <a className="quiet-button" href="#qualified-players">{isItalian ? copy.hero.invitees(competitors.length) : <>See all {competitors.length} {config.entryPlural.toLowerCase()}</>}</a>
        </div>
      </div>
      <aside className="worlds-event-card">
        <span>{isItalian ? copy.event.title : "2026 WORLD CHAMPIONSHIPS"}</span>
        <strong>{isItalian ? copy.event.dates : "Aug 28–30"}</strong>
        <p>{isItalian ? copy.event.location : "Moscone Center · Championship Sunday at Chase Center"}</p>
        <dl>
          <div><dt>{isItalian ? copy.event.competitionLabel : "Competition"}</dt><dd>{isItalian ? copy.event.competition : config.key === "vgc" ? "VGC Masters" : config.key === "go" ? "Pokémon GO" : `${config.gameLabel} ${config.division}`}</dd></div>
          <div><dt>{isItalian ? copy.event.lock : "Entry lock"}</dt><dd>{displayPacificDate(event.locks_at, true, copy.locale)}</dd></div>
          <div><dt>{isItalian ? copy.event.checked : "Roster checked"}</dt><dd>{displayPacificDate(`${event.roster_checked_at}T12:00:00Z`, false, copy.locale)}</dd></div>
        </dl>
      </aside>
    </section>

    {config.key === "vgc" && <section className="worlds-start-guide" aria-labelledby="worlds-start-guide-title">
      <div>
        <span className="eyebrow">{copy.guide.eyebrow}</span>
        <h2 id="worlds-start-guide-title">{copy.guide.title}</h2>
        <p>{copy.guide.body}</p>
      </div>
      <nav aria-label={copy.guide.title}>
        <a className="quiet-button" href="#meta-picks">{copy.guide.pokemon}</a>
        <a className="primary-button inline-link-button" href="#qualified-players">{copy.guide.players}</a>
      </nav>
    </section>}

    {config.key === "vgc" && <WorldsChatBoard eventId={eventId} locale={locale} user={user} />}

    <section className="worlds-trust-note">
      <div><span className="eyebrow">{isItalian ? copy.trust.eyebrow : "REVIEWED ROSTER ONLY"}</span><h2>{isItalian ? copy.trust.title(competitors.length) : <>{competitors.length} {config.entryPlural} in the prediction pool</>}</h2></div>
      <p>{isItalian ? copy.trust.body : config.division === "Masters" ? "Masters Division only — Senior and Junior Division qualifiers are excluded." : "Only published competitor identity and qualification information needed for the prediction game is used. DraftCenter does not collect or infer private age data."}</p>
      <div className="worlds-source-links">{(rosterSource.sourceUrl || rosterSource.source_url) && <a href={rosterSource.sourceUrl || rosterSource.source_url} target="_blank" rel="noreferrer">{isItalian ? copy.trust.source : "Roster source ↗"}</a>}<a href="https://worlds.pokemon.com/en-us" target="_blank" rel="noreferrer">{isItalian ? copy.trust.official : "Official Worlds site ↗"}</a></div>
    </section>

    {config.key === "vgc" && <WorldsChampionOdds
      competitors={competitors}
      entryCount={popularity?.entry_count || 0}
      sampleReady={Boolean(popularity?.sample_ready)}
      locale={locale}
    />}

    <WorldsMetaChallenge discipline={config.key} user={user} locale={locale} />

    <section className="worlds-pick-layout" id="pick-ten">
      <div className="worlds-pick-main">
        <header className="section-heading">
          <div><span className="eyebrow">{isItalian ? copy.pick.eyebrow : "SITEWIDE COMPETITION"}</span><h2>{isItalian ? copy.pick.title : "Your Pick 10"}</h2><p>{isItalian ? copy.pick.body : "Your choices stay private until entries lock. Choose Your Champion, whose placement points count twice."}</p></div>
          <div className="worlds-pick-meter"><strong>{selected.length}</strong><span>/ {pickCount}</span></div>
        </header>

        {user === undefined ? <div className="worlds-account-gate is-loading" aria-live="polite">
          <strong>{isItalian ? copy.pick.checking : "Checking your DraftCenter account…"}</strong>
        </div> : !user ? <div className="worlds-account-gate">
          <div aria-hidden="true" className="worlds-account-lock">🔒</div>
          <span className="eyebrow">{isItalian ? copy.pick.accountRequired : "DRAFTCENTER ACCOUNT REQUIRED"}</span>
          <h3>{isItalian ? copy.pick.signInTitle : "Sign in to build your Worlds prediction."}</h3>
          <p>{isItalian ? copy.pick.signInBody : <>Like DraftCenter&apos;s Daily Games, submitting a Pick 10 entry requires a free account. Your choices stay private until entries lock, and you can return to edit them before the deadline.</>}</p>
          <a className="secondary-button" href="/#member-access">{isItalian ? copy.pick.signInAction : "Sign in or create an account"}</a>
        </div> : <>
        <div className="worlds-selected-grid">
          {Array.from({ length: pickCount }, (_, index) => {
            const competitor = competitorBySlug.get(selected[index]);
            return competitor ? <div className={`worlds-selected-pick${ace === competitor.slug ? " is-ace" : ""}`} key={competitor.slug}>
              <button className="worlds-pick-remove" type="button" disabled={locked} onClick={() => toggle(competitor)}>
                <span>{index + 1}</span><strong>{competitor.displayName}</strong><small>{isItalian ? copy.pick.remove(competitor.countryCode) : <>{competitor.countryCode} · remove</>}</small>
              </button>
              <label className="worlds-ace-choice"><input type="radio" name="worlds-ace" checked={ace === competitor.slug} disabled={locked} onChange={() => chooseChampion(competitor.slug)} /><span>{isItalian ? copy.pick.champion : "Your Champion ×2"}</span></label>
            </div> : <div className="worlds-empty-pick" key={index}><span>{index + 1}</span><small>{isItalian ? copy.pick.open : "Open spot"}</small></div>;
          })}
        </div>

        <div className="worlds-save-row">
          <div>
            {loadingHub ? <p>{isItalian ? copy.save.connecting : "Connecting the community competition…"}</p> : !hub || staged ? <p>{isItalian ? copy.save.staged : "This competition is staged. Entries remain closed until the reviewed roster and opening window are published together."}</p> : locked ? <p>{isItalian ? copy.save.locked : "Entries are locked. Saved lineups are now public on the leaderboard."}</p> : !user ? <p><a href="/">{isItalian ? copy.save.signInLink : "Sign in"}</a> {isItalian ? copy.save.signInSuffix : "to save and edit your entry."}</p> : hub.my_entry ? <p>{isItalian ? copy.save.savedAsPrefix : "Saved as"} <strong>{hub.my_entry.display_name}</strong>. {isItalian ? copy.save.savedAsSuffix : "Edits remain open until the deadline."}</p> : <p>{isItalian ? copy.save.finish : "Choose all 10 and Your Champion to save your entry."}</p>}
            {message && <p className="worlds-message" role="status">{message}</p>}
          </div>
          <button className="primary-button" type="button" disabled={busy || locked || selected.length !== pickCount || !ace || !hub} onClick={saveEntry}>{isItalian ? busy ? copy.save.saving : hub?.my_entry ? copy.save.update : copy.save.create : busy ? "Saving…" : hub?.my_entry ? "Update entry" : "Save entry"}</button>
        </div>
        {!staged && <WorldsPickShare
          discipline={config.key}
          gameLabel={config.gameLabel}
          pickCount={pickCount}
          picks={selected.map((slug) => competitorBySlug.get(slug)).filter(Boolean)}
          championSlug={ace}
          displayName={hub?.my_entry?.display_name || ""}
          locale={locale}
        />}
        </>}
      </div>

      <aside className="worlds-scoring-card">
        <span className="eyebrow">{isItalian ? copy.scoring.eyebrow : "HOW SCORING WORKS"}</span>
        <p>{isItalian ? copy.scoring.body : <>Each selected {config.entrySingular.toLowerCase()} earns the points for their final placement. Your Champion earns double points, then all 10 scores are added together.</>}</p>
        <ol>{WORLDS_2026_SCORING.map(([label, points], index) => <li key={label}><span>{isItalian ? copy.scoring.placements[index] : label}</span><strong>{isItalian ? copy.scoring.points(points) : `${points} pts`}</strong></li>)}</ol>
        <div className="worlds-tiebreak-rules">
          <strong>{isItalian ? copy.scoring.tieTitle : "If total points are tied"}</strong>
          <span>{isItalian ? copy.scoring.tieOne : "1. Lower average finish among your six best-finishing picks."}</span>
          <span>{isItalian ? copy.scoring.tieTwo : "2. Lower average finish across all 10 picks."}</span>
          <small>{isItalian ? copy.scoring.tieNote : "These tiebreakers apply after results are finalized. If both averages are also equal, the entries share a rank."}</small>
        </div>
        <small>{isItalian ? copy.scoring.note : "The placement curve rewards every Top 64 pick while making the champion meaningfully valuable. Live standings remain provisional until the owner checks an official published result and finalizes scoring."}</small>
      </aside>
    </section>

    <section className="worlds-roster-section" id="qualified-players">
      <header className="section-heading"><div><span className="eyebrow">{isItalian ? copy.roster.eyebrow : <>2026 {config.gameLabel.toUpperCase()}{config.key === "go" ? "" : ` ${config.division.toUpperCase()}`}</>}</span>{isItalian ? <h2>{copy.roster.title}</h2> : config.key === "vgc" ? <h2>Pokémon Worlds VGC Masters invitee list</h2> : <h2>{config.rosterHeading}</h2>}<p>{isItalian ? copy.roster.body : <>Browse reviewed {config.entryPlural.toLowerCase()} by name, country code, region, or qualification path.</>}</p></div><strong>{isItalian ? copy.roster.shown(filtered.length) : `${filtered.length} shown`}</strong></header>
      <aside className="worlds-roster-source" aria-labelledby="worlds-roster-source-heading">
        <div>
          <span className="eyebrow">{isItalian ? copy.roster.sourceEyebrow : "ROSTER SOURCE"}</span>
          {isItalian ? <>
            <h3 id="worlds-roster-source-heading">{copy.roster.sourceTitle}</h3>
            <p>{copy.roster.sourceBody}</p>
            <small>{copy.roster.sourceNote}</small>
          </> : config.key === "vgc" ? <>
            <h3 id="worlds-roster-source-heading">Where this invite list comes from</h3>
            <p>Victory Road&apos;s 2026 World Championships invite tracker for VGC Masters brings together invite earners from official Championship Point standings and qualifying event results.</p>
            <small>This is an invite-earned list, not a confirmed attendance or registration list.</small>
          </> : config.key === "tcg" ? <>
            <h3 id="worlds-roster-source-heading">Official TCG Masters qualifiers</h3>
            <p>Pokémon&apos;s Qualified Competitors page lists the Masters competitors who earned an invitation to the 2026 World Championships.</p>
            <small>This is not a confirmed attendance or registration list.</small>
          </> : config.key === "go" ? <>
            <h3 id="worlds-roster-source-heading">Official Pokémon GO qualifiers</h3>
            <p>Pokémon&apos;s Qualified Competitors page lists the Trainers who earned an invitation to the 2026 World Championships.</p>
            <small>This is not a confirmed attendance, registration, or pool-assignment list.</small>
          </> : <>
            <h3 id="worlds-roster-source-heading">Where this roster comes from</h3>
            <p>This {displayPacificDate(`${rosterSource.sourceCheckedAt || rosterSource.source_checked_at}T12:00:00Z`)} snapshot was compiled from the reviewed 2026 {config.gameLabel} qualification and roster sources.</p>
            <small>Qualification is not treated as proof of final registration or attendance unless the source explicitly confirms it.</small>
          </>}
        </div>
        {config.key === "vgc" ? <a className="quiet-button" href={rosterSource.sourceUrl} target="_blank" rel="noreferrer">{isItalian ? copy.roster.sourceAction : "View the Victory Road tracker ↗"}</a> : (rosterSource.sourceUrl || rosterSource.source_url) && <a className="quiet-button" href={rosterSource.sourceUrl || rosterSource.source_url} target="_blank" rel="noreferrer">View the reviewed roster source ↗</a>}
      </aside>
      <div className="worlds-roster-filters">
        <label>{isItalian ? copy.roster.find : <>Find a {config.entrySingular.toLowerCase()}</>}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isItalian ? copy.roster.placeholder : config.key === "vgc" ? "Try Giovanni Cischke, Luca Ceribelli, or Wolfe Glick…" : `Search ${config.entryPlural.toLowerCase()}…`} /></label>
        <label>{isItalian ? copy.roster.region : "Qualification region"}<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">{isItalian ? copy.roster.all : "All regions"}</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <div className="worlds-player-grid">
        {filtered.map((competitor) => {
          const chosen = selected.includes(competitor.slug);
          const unavailable = !competitor.isSelectable || ["withdrawn", "declined"].includes(competitor.attendanceStatus);
          return <article className={chosen ? "is-selected" : unavailable ? "is-unavailable" : !user ? "is-account-locked" : ""} key={competitor.slug}>
            <header><span>{competitor.countryCode}</span><small>{competitor.qualificationRegion}</small></header>
            <h3>{competitor.displayName}</h3>
            <p>{competitor.qualificationPath}</p>
            <footer><small>{statusLabel(competitor.attendanceStatus, locale)}</small><button type="button" aria-pressed={chosen} disabled={!user || locked || unavailable} onClick={() => toggle(competitor)}>{isItalian ? chosen ? copy.roster.selected : unavailable ? copy.roster.unavailable : !user ? copy.roster.signIn : locked ? copy.roster.closed : copy.roster.add : chosen ? "Selected ✓" : unavailable ? "Unavailable" : !user ? "Sign in to pick" : locked ? "Entries closed" : "Add to 10"}</button></footer>
          </article>;
        })}
      </div>
      {!filtered.length && <div className="worlds-no-results"><h3>{isItalian ? copy.roster.noResults : <>No {config.entryPlural.toLowerCase()} match those filters.</>}</h3><button type="button" className="quiet-button" onClick={() => { setSearch(""); setRegion("all"); }}>{isItalian ? copy.roster.clear : "Clear filters"}</button></div>}
    </section>

    <section className="worlds-bottom-grid">
      <article className="worlds-leaderboard-card">
        <header><div><span className="eyebrow">{isItalian ? copy.leaderboard.eyebrow : `${config.gameLabel.toUpperCase()} COMMUNITY LEADERBOARD`}</span><h2>{isItalian ? copy.leaderboard.entries(hub?.entry_count || 0) : `${hub?.entry_count || 0} entries`}</h2></div>{hub?.my_entry && <strong>{isItalian ? copy.leaderboard.rank(hub.my_entry.rank) : `Your rank: ${hub.my_entry.rank}`}</strong>}</header>
        <div className={`worlds-live-result-status is-${hub?.results?.status || "waiting"}${hub?.results?.is_stale ? " is-stale" : ""}`} role="status">
          <div>
            <strong>{isItalian ? hub?.results?.status === "final" ? copy.leaderboard.final : hub?.results?.status === "provisional" ? hub.results.is_stale ? copy.leaderboard.delayed : copy.leaderboard.provisional : copy.leaderboard.waiting : hub?.results?.status === "final" ? "Final" : hub?.results?.status === "provisional" ? hub.results.is_stale ? "Live — provisional · updates delayed" : "Live — provisional" : "Waiting for live results"}</strong>
            <span>{isItalian ? hub?.results?.status === "final" ? copy.leaderboard.finalBody : hub?.results?.status === "provisional" ? copy.leaderboard.provisionalBody : copy.leaderboard.waitingBody : hub?.results?.status === "final" ? "The owner verified and locked the official result." : hub?.results?.status === "provisional" ? "Imported live standings are unofficial. The last accepted scores stay visible if an update fails." : `Saved entries will score when reviewed ${config.gameLabel} standings are available.`}</span>
          </div>
          <div>
            {hub?.results?.last_successful_update && <small>{isItalian ? copy.leaderboard.updated : "Updated"} {displayPacificDate(hub.results.last_successful_update, true, copy.locale)}</small>}
            {hub?.results?.source_url && <a href={hub.results.source_url} target="_blank" rel="noreferrer">{hub.results.source_name || (isItalian ? copy.leaderboard.resultSource : "Results source")} ↗</a>}
          </div>
        </div>
        {hub?.standings?.length ? <div className="worlds-standings">{hub.standings.map((entry, index) => <details key={`${entry.profile?.username || entry.display_name}-${index}`} className={entry.is_me ? "is-me" : ""}>
          <summary><span>#{entry.rank}</span><CoachProfileButton
            username={entry.profile?.username}
            displayName={entry.profile?.display_name || entry.display_name}
            avatarUrl={entry.profile?.avatar_url}
            compact
            locale={locale}
            stopPropagation
            onOpen={() => setActiveProfile(entry.profile || { display_name:entry.display_name, favorite_pokemon:[], badges:[] })}
          /><b>{isItalian ? copy.leaderboard.points(entry.score) : `${entry.score} pts`}</b></summary>
          {entry.top_six_average_finish != null && entry.all_ten_average_finish != null && <p className="worlds-standings-tiebreakers"><strong>{isItalian ? copy.leaderboard.tiebreakers : "Final tiebreakers:"}</strong> {isItalian ? copy.leaderboard.topSix : "Top 6 average"} {formatWorldsAverageFinish(entry.top_six_average_finish)} · {isItalian ? copy.leaderboard.allTen : "All 10 average"} {formatWorldsAverageFinish(entry.all_ten_average_finish)}</p>}
          {entry.picks ? <p>{entry.picks.map((slug) => `${competitorBySlug.get(slug)?.displayName || slug}${slug === entry.ace_slug ? ` (${isItalian ? copy.leaderboard.champion : "Your Champion ×2"})` : ""}`).join(" · ")}</p> : <p>{isItalian ? copy.leaderboard.private : "Lineup stays private until entries lock."}</p>}
        </details>)}</div> : <p className="worlds-empty-state">{isItalian ? copy.leaderboard.empty : "Be the first DraftCenter player to save a Pick 10 entry."}</p>}
      </article>

      {config.key === "vgc" && <article className="worlds-bracket-card">
        <span className="eyebrow">{isItalian ? copy.bracket.eyebrow : "PHASE TWO"}</span>
        <h2>{isItalian ? copy.bracket.title : "The Top Cut prediction room is ready."}</h2>
        <p>{isItalian ? copy.bracket.body : "DraftCenter can open a full elimination-bracket challenge as soon as the owner verifies the official Masters field, pairings, and first-match deadline. No seeds or matchups are invented in advance."}</p>
        <div aria-hidden="true" className="worlds-bracket-preview"><span /><span /><span /><span /><i /></div>
        <a className="quiet-button" href="/worlds/2026/vgc/bracket">{isItalian ? copy.bracket.action : "Open Top Cut bracket status →"}</a>
      </article>}
    </section>
    {activeProfile && <PublicCoachProfile profile={activeProfile} locale={locale} onClose={() => setActiveProfile(null)} />}
  </main>;
}
