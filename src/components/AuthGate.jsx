"use client";

import { Component, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import LeagueHub, { RotatingPokemonArtwork, WORLD_CHAMPION_POKEMON, pokemonArtworkCandidates } from "./LeagueHub";
import PokemonDraftLeague from "./PokemonDraftLeague";
import { POLL_POKEMON_NAMES, POKEMON_DIRECTORY } from "./PokemonDraftLeague";

const inputStyle = { padding: 11, borderRadius: 8, border: "1px solid #46517c", background: "#080c1c", color: "#fff", width: "100%" };
const authPanel = { width: "min(430px, calc(100vw - 32px))", padding: 28, borderRadius: 16, border: "1px solid #2a3157", background: "#11162b", boxShadow: "0 20px 70px rgba(0,0,0,.38)" };
function localDateKey(date = new Date()) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; }

class LeagueErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false, message: "" }; }
  static getDerivedStateFromError(error) { return { failed: true, message: error?.message || "Unknown league-screen error" }; }
  componentDidCatch(error) { console.error("League screen failed", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="hub-shell"><section className="hub-card"><span className="eyebrow">LEAGUE RECOVERY</span><h1>This league screen hit an unexpected problem.</h1><p className="muted">Your saved league data has not been deleted. Return to the dashboard and try opening it again.</p><details style={{ marginBottom: 16 }}><summary>Technical details</summary><code style={{ display:"block", marginTop:8, whiteSpace:"pre-wrap", color:"#ffb7b7" }}>{this.state.message}</code></details><button className="primary-button" onClick={this.props.onExit}>Return to dashboard</button></section></main>;
  }
}

function ProfileSetup({ supabase, user, onSaved }) {
  const [username, setUsername] = useState(""); const [displayName, setDisplayName] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function save(event) { event.preventDefault(); setBusy(true); setMessage(""); const { data, error } = await supabase.from("profiles").update({ username, display_name: displayName.trim() }).eq("id", user.id).select("id, display_name, username").single(); setBusy(false); if (error) return setMessage(error.message); onSaved(data); }
  return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:16, background:"radial-gradient(circle at top,#1d2857,#080b18 55%)" }}><section style={authPanel}><div className="eyebrow">DRAFTCENTER</div><h1>Choose your coach profile</h1><p className="muted">This is your site-wide identity. Your team name can be different in every league.</p><form onSubmit={save} className="form-stack"><label>Display name<input required minLength={2} value={displayName} onChange={(e)=>setDisplayName(e.target.value)} style={inputStyle} /></label><label>Username<input required minLength={3} maxLength={24} value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} style={inputStyle} /><small className="muted">3–24 lowercase letters, numbers, or underscores.</small></label>{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Continue to DraftCenter"}</button></form></section></main>;
}

function FavoritePokemonEditor({ supabase, user }) {
  const [favorites, setFavorites] = useState([]); const [choice, setChoice] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.from("profiles").select("favorite_pokemon").eq("id", user.id).maybeSingle().then(({ data }) => setFavorites(Array.isArray(data?.favorite_pokemon) ? data.favorite_pokemon : [])); }, [supabase, user.id]);
  async function save(next) { setBusy(true); const { error } = await supabase.from("profiles").update({ favorite_pokemon: next }).eq("id", user.id); setBusy(false); if (error) return setMessage(error.message); setFavorites(next); }
  function add(event) { event.preventDefault(); const picked = POLL_POKEMON_NAMES.find((name) => name.toLowerCase() === choice.trim().toLowerCase()); if (!picked) return setMessage("Choose a Pokemon from the suggestions."); if (favorites.includes(picked)) return setMessage("That Pokemon is already on your team."); if (favorites.length >= 6) return setMessage("Your favorite team is full - choose up to six Pokemon."); setChoice(""); setMessage(""); save([...favorites, picked]); }
  return <><hr/><h3>Your favorite six</h3><p className="muted">Build a fun Pokemon team for your public profile. This is separate from every league roster.</p><form className="profile-favorite-form" onSubmit={add}><input list="profile-pokemon-options" value={choice} onChange={(event) => setChoice(event.target.value)} placeholder="Search for a Pokemon" autoComplete="off" /><datalist id="profile-pokemon-options">{POLL_POKEMON_NAMES.map((name) => <option key={name} value={name} />)}</datalist><button className="secondary-button" disabled={busy}>Add</button></form><div className="favorite-team">{favorites.length ? favorites.map((name) => <span className="favorite-pokemon" key={name}>{name}<button type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={() => save(favorites.filter((item) => item !== name))}>x</button></span>) : <span className="muted">No favorites selected yet.</span>}</div>{message && <p className="hub-message">{message}</p>}</>;
}

function ProfileEditor({ supabase, user, profile, onSaved, onClose }) {
  const [file, setFile] = useState(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [dailyPollEmail, setDailyPollEmail] = useState(false);
  useEffect(() => { supabase.from("notification_preferences").select("email_daily_poll_results").eq("user_id", user.id).maybeSingle().then(({ data }) => setDailyPollEmail(Boolean(data?.email_daily_poll_results))); }, [supabase, user.id]);
  async function uploadPhoto(event) { event.preventDefault(); if (!file) return setMessage("Choose a photo first."); if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setMessage("Choose a JPG, PNG, or WebP image under 5 MB."); setBusy(true); setMessage(""); const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${user.id}/avatar-${Date.now()}.${extension}`; const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) { setBusy(false); return setMessage(uploadError.message); } const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path); const { data, error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id).select("id, display_name, username, avatar_url").single(); setBusy(false); if (error) return setMessage(error.message); onSaved(data); setMessage("Profile photo saved."); }
  async function saveDailyPollEmail(checked) { setBusy(true); const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, email_daily_poll_results: checked }, { onConflict: "user_id" }); setBusy(false); if (error) return setMessage(error.message); setDailyPollEmail(checked); setMessage(checked ? "Daily Poll of the Day results are enabled." : "Daily Poll of the Day results are disabled."); }
  return <div className="modal-backdrop"><section className="tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">YOUR PROFILE</span><h2>Profile photo</h2>{profile?.avatar_url ? <img className="profile-photo-large" src={profile.avatar_url} alt="Your profile" /> : <div className="profile-photo-placeholder">{(profile?.display_name || profile?.username || "C")[0].toUpperCase()}</div>}<p className="muted">Your photo is visible beside your name in DraftCenter discussions.</p><form className="form-stack" onSubmit={uploadPhoto}><label>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><button className="primary-button" disabled={busy}>{busy ? "Uploading..." : "Save profile photo"}</button></form><FavoritePokemonEditor supabase={supabase} user={user}/><hr/><h3>Daily Poll of the Day</h3><label className="check-row"><input type="checkbox" checked={dailyPollEmail} disabled={busy} onChange={(event) => saveDailyPollEmail(event.target.checked)} /> Email me yesterday's results each day</label>{message && <p className="hub-message">{message}</p>}</section></div>;
}

function PublicLanding({ email, password, setEmail, setPassword, busy, message, onSubmit, onMode }) {
  const [featured, setFeatured] = useState(null);
  const [poll, setPoll] = useState(null);
  const [communityPokemon, setCommunityPokemon] = useState(["Pikachu","Eevee","Charizard"]);
  useEffect(() => {
    let active = true;
    async function chooseFeatured() {
      const shuffled = [...POKEMON_DIRECTORY].sort(() => Math.random() - .5);
      for (const pokemon of shuffled.slice(0, 30)) {
        for (const apiName of pokemonArtworkCandidates(pokemon.name)) {
          try {
            const [pokemonResponse, speciesResponse] = await Promise.all([fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`), fetch(`https://pokeapi.co/api/v2/pokemon-species/${apiName}`)]);
            if (!pokemonResponse.ok || !speciesResponse.ok) continue;
            const [pokemonData, speciesData] = await Promise.all([pokemonResponse.json(), speciesResponse.json()]);
            const image = pokemonData.sprites?.other?.["official-artwork"]?.front_default || pokemonData.sprites?.front_default;
            if (!image) continue;
            const entries = (speciesData.flavor_text_entries || []).filter((entry) => entry.language.name === "en");
            const entry = entries.length ? entries[Math.floor(Math.random() * entries.length)] : null;
            if (active) setFeatured({ name: pokemon.name, image, entry: entry?.flavor_text?.replace(/[\n\f]/g, " "), game: entry?.version?.name?.replace(/-/g, " ") });
            return;
          } catch {}
        }
      }
    }
    chooseFeatured();
    Promise.all([createClient().rpc("get_public_explore"),createClient().rpc("get_local_daily_poll",{p_local_date:localDateKey()})]).then(([exploreResult,pollResult]) => {
      const data=exploreResult.data; const localPoll=pollResult.data;
      setPoll(localPoll || null);
      const pollLeaders = localPoll?.answer_type === "pokemon" ? Object.entries(localPoll.counts || {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([name]) => name) : [];
      const favorites = (data?.popularity || []).slice(0, 3).map((item) => item.pokemon);
      const highlights = [...new Set([...pollLeaders, ...favorites])].filter(Boolean);
      if (highlights.length) setCommunityPokemon(highlights);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <main className="visitor-home"><section className="visitor-hero"><div className="visitor-brand"><img src="/draftcenter-logo.png" alt="DraftCenter" /><span className="eyebrow">DRAFTCENTER</span></div><h1>More than a place to run a draft.</h1><p>Explore Pokémon, follow public leagues, and see what the DraftCenter community is enjoying—all before creating an account.</p><div className="visitor-free-grid"><a href="/pokemon" className="visitor-feature-card"><span>POKÉDEX</span><strong>Explore Pokémon</strong>{featured?.image && <img src={featured.image} alt={featured.name} />}{featured ? <div className="visitor-feature-copy"><b>Featured: {featured.name}</b>{featured.entry ? <small>“{featured.entry}” <em>{featured.game}</em></small> : <small>Open its full Pokédex entry, stats, and move pools.</small>}</div> : <small>Loading a Pokémon from the Pokédex...</small>}</a><a href="/explore" className="visitor-feature-card"><span>COMMUNITY</span><strong>Explore trends</strong><RotatingPokemonArtwork names={communityPokemon} className="visitor-card-pokemon" /><div className="visitor-poll-preview"><b>Poll of the Day</b><p>{poll?.question || "See today’s Pokémon question and community results."}</p>{poll?.total_votes != null && <small>{poll.total_votes} vote{poll.total_votes === 1 ? "" : "s"} so far</small>}</div></a><a href="/leagues" className="visitor-feature-card"><span>PUBLIC LEAGUES</span><strong>Watch a draft</strong><RotatingPokemonArtwork names={WORLD_CHAMPION_POKEMON} interval={6300} className="visitor-card-pokemon" /><div className="visitor-feature-copy"><b>Find a league</b><small>Join an open team or follow standings, schedules, replays, and predictions.</small></div></a></div></section><aside className="visitor-signin"><span className="eyebrow">MEMBERS</span><h2>Welcome back</h2><p className="muted">Sign in when you are ready to join, manage, or create a league.</p><form onSubmit={onSubmit} className="form-stack"><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={inputStyle}/></label><label>Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle}/></label>{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Please wait..." : "Sign in"}</button></form><div className="visitor-account-links"><button className="text-button" onClick={() => onMode("forgot_password")}>Forgot password?</button><button className="text-button" onClick={() => onMode("sign_up")}>New here? Create an account</button></div></aside></main>;
}

function LeagueAppearanceEditor({ league, onClose, onUpdated }) {
  const [supabase] = useState(() => createClient());
  const [description, setDescription] = useState(league.description || "");
  const [imageUrl, setImageUrl] = useState(league.image_url || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const imageResult = await supabase.rpc("update_league_image", {
      p_league_id: league.id,
      p_image_url: imageUrl.trim() || null,
    });
    if (imageResult.error) {
      setBusy(false);
      return setMessage(imageResult.error.message);
    }
    const detailsResult = await supabase.rpc("update_league_details", {
      p_league_id: league.id,
      p_name: league.name,
      p_description: description.trim(),
      p_season_label: league.season_label || "",
      p_draft_starts_at: league.draft_starts_at || null,
      p_is_public: league.visibility === "public_join",
    });
    setBusy(false);
    if (detailsResult.error) return setMessage(detailsResult.error.message);
    onUpdated({ ...league, ...detailsResult.data, image_url: imageResult.data?.image_url || null, description: description.trim() });
    setMessage("League appearance saved.");
  }

  return <div className="modal-backdrop"><section className="tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">COMMISSIONER TOOLS</span><h2>League appearance</h2><p className="muted">Change these whenever you need to. The description is shown on the public league page; the image is optional.</p><form className="form-stack" onSubmit={save}><label>League description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this league special?" /></label><label>League image URL (optional)<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/league-image.jpg" /></label>{imageUrl && <img className="league-cover" src={imageUrl} alt="League cover preview" onError={(event) => { event.currentTarget.style.display = "none"; }} />}{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save appearance"}</button></form></section></div>;
}

function LeagueTools({ league, onClose, onUpdated }) {
  const [supabase] = useState(() => createClient());
  const [name,setName]=useState(league.name||""); const [season,setSeason]=useState(league.season_label||""); const [description,setDescription]=useState(league.description||""); const [startsAt,setStartsAt]=useState(league.draft_starts_at ? new Date(league.draft_starts_at).toISOString().slice(0,16) : ""); const [visibility,setVisibility]=useState(league.league_visibility||"private");
  const [invite,setInvite]=useState(""); const [inviteEmail,setInviteEmail]=useState(""); const [coUsername,setCoUsername]=useState(""); const [coEmail,setCoEmail]=useState(""); const [removeUsername,setRemoveUsername]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  if (!['commissioner','co_commissioner'].includes(league.role)) return null;
  async function saveDetails(event) { event.preventDefault(); setBusy(true); setMessage(""); const {data,error}=await supabase.rpc('update_league_details',{p_league_id:league.id,p_name:name,p_description:description,p_season_label:season,p_draft_starts_at:startsAt ? new Date(startsAt).toISOString():null,p_is_public:visibility!=="private"}); if(error){setBusy(false);return setMessage(error.message);} const accessResult=await supabase.rpc('update_league_access',{p_league_id:league.id,p_visibility:visibility,p_is_practice:Boolean(league.is_practice),p_practice_expires_at:league.practice_expires_at||null}); if(accessResult.error){setBusy(false);return setMessage(`League details saved, but public access could not be updated: ${accessResult.error.message}`);} let note=""; if(startsAt){const {data:count,error:reminderError}=await supabase.rpc('schedule_draft_reminders',{p_league_id:league.id});note=reminderError ? ' Draft reminders will need configuration first.' : ` ${count||0} reminder jobs scheduled.`;} setBusy(false);onUpdated({...league,...data,...accessResult.data,league_visibility:visibility});setMessage(`${visibility==="watch"?"League is now listed under Open to Watch.":visibility==="open"?"League is now listed under Open to Join.":"League is now private."}${note}`); }
  async function createLink(kind, openEmail=false) { const email=inviteEmail.trim().toLowerCase(); if(openEmail&&!email)return setMessage('Enter an email address first.'); setBusy(true); const {data,error}=await supabase.rpc(kind==='spectator'?'create_spectator_invite':'create_league_invite',{p_league_id:league.id,p_email:openEmail ? email : null}); setBusy(false); if(error)return setMessage(error.message); const link=`${window.location.origin}?${kind==='spectator'?'spectate':'invite'}=${data.token}`; setInvite(link); try{await navigator.clipboard.writeText(link);}catch{} if(openEmail){const subject=encodeURIComponent(`${kind==='spectator'?'Watch':'Join'} ${league.name} on DraftCenter`);const body=encodeURIComponent(`${kind==='spectator'?'You have been invited to watch':'You have been invited to join'} ${league.name} on DraftCenter.\n\n${link}`);window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;setMessage('Your email app is opening with the link. If nothing opens, copy the link below and send it from your usual email service.');}else setMessage(kind==='spectator'?'Spectator link copied. It grants view-only access for 90 days.':'Manager invite copied. It grants team/league access for 14 days.'); }
  async function promoteCo(){const username=coUsername.trim().toLowerCase().replace(/^@/,"");if(!username)return setMessage('Enter a username first.');setBusy(true);const {error}=await supabase.rpc('set_co_commissioner',{p_league_id:league.id,p_username:username,p_enabled:true});setBusy(false);if(error)return setMessage(error.message);setCoUsername('');setMessage(`@${username} is now a co-commissioner.`);}
  async function inviteCoCommissioner(){const email=coEmail.trim().toLowerCase();if(!email)return setMessage('Enter the co-commissioner’s email address first.');setBusy(true);const {data,error}=await supabase.rpc('create_co_commissioner_invite',{p_league_id:league.id,p_email:email});setBusy(false);if(error)return setMessage(error.message);const link=`${window.location.origin}?invite=${data.token}`;setInvite(link);try{await navigator.clipboard.writeText(link);}catch{}const subject=encodeURIComponent(`Co-commissioner invitation for ${league.name}`);const body=encodeURIComponent(`You have been invited to help run ${league.name} as a co-commissioner on DraftCenter.\n\nSign in with ${email} and accept here:\n${link}`);window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;setMessage('Your email app is opening with the secure acceptance link. The link was also copied and is shown below.');}
  async function removeManager(){const username=removeUsername.trim().toLowerCase().replace(/^@/,"");if(!username)return setMessage('Enter the manager\'s username first.');if(!window.confirm(`Remove @${username} from this league? Their team will become available for a replacement.`))return;setBusy(true);const {error}=await supabase.rpc('remove_league_manager',{p_league_id:league.id,p_username:username});setBusy(false);if(error)return setMessage(error.message);setRemoveUsername('');setMessage(`Removed @${username}. Their team is available for a replacement.`);}
  return <div className="modal-backdrop">
    <section className="tools-modal">
      <button className="modal-close" onClick={onClose}>×</button>
      <span className="eyebrow">COMMISSIONER TOOLS</span>
      <h2>League details & links</h2>
      <form onSubmit={saveDetails} className="form-stack">
        <label>League name<input required value={name} onChange={(e)=>setName(e.target.value)} /></label>
        <label>Season label<input value={season} onChange={(e)=>setSeason(e.target.value)} /></label>
        <p className="muted">The league's official draft date is managed once from Setup and shared everywhere else automatically.</p>
        <label>Description<textarea rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} /></label>
        <label>Public league listing
          <select value={visibility} onChange={(e)=>setVisibility(e.target.value)}>
            <option value="private">Private — invite links only</option>
            <option value="watch">Open to Watch — public standings, schedule, replays, and predictions</option>
            <option value="open">Open to Join — public and accepting managers</option>
          </select>
        </label>
        <p className="muted">{visibility==="watch"?"This league will appear in the Open to Watch tab. Visitors can follow it without taking a team.":visibility==="open"?"This league will appear in Open to Join while unclaimed teams remain available.":"This league will not appear in either public directory tab."}</p>
        <button className="primary-button" disabled={busy}>{busy?'Saving...':'Save league details'}</button>
      </form>
      <hr/><h3>Manager invite</h3>
      <p className="muted">For a competitor. It gives them league access and assigns an open team after they accept.</p>
      <div className="form-stack"><label>Manager email (optional)<input type="email" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="coach@example.com" /></label><div className="flex gap-2 flex-wrap"><button type="button" className="secondary-button" disabled={busy} onClick={()=>createLink('manager')}>Copy manager link</button><button type="button" className="primary-button" disabled={busy} onClick={()=>createLink('manager',true)}>Email manager link</button></div></div>
      <hr/><h3>Spectator link</h3>
      <p className="muted">For someone who should only watch, scout, view results, and make no roster or league changes.</p>
      <div className="flex gap-2 flex-wrap"><button type="button" className="secondary-button" disabled={busy} onClick={()=>createLink('spectator')}>Copy spectator link</button><button type="button" className="primary-button" disabled={busy} onClick={()=>createLink('spectator',true)}>Email spectator link</button></div>
      <hr/><h3>Co-commissioner</h3>
      <p className="muted">Invite someone by email and they will become a co-commissioner after signing in and accepting. If they already joined and you know their username, you can promote them immediately instead.</p>
      <div className="form-stack"><label>Email address<input type="email" value={coEmail} onChange={(e)=>setCoEmail(e.target.value)} placeholder="co-commissioner@example.com" /></label><button type="button" className="primary-button" disabled={busy} onClick={inviteCoCommissioner}>Email co-commissioner invitation</button><span className="muted">or promote an existing league member</span><label>DraftCenter username<input value={coUsername} onChange={(e)=>setCoUsername(e.target.value.toLowerCase())} placeholder="coach_username" /></label><button type="button" className="secondary-button" disabled={busy} onClick={promoteCo}>Make co-commissioner by username</button></div>
      <hr/><h3>Remove manager</h3>
      <p className="muted">This immediately removes their league access and makes their team available to a replacement.</p>
      <div className="form-stack"><label>Manager username<input value={removeUsername} onChange={(e)=>setRemoveUsername(e.target.value.toLowerCase())} placeholder="coach_username" /></label><button type="button" className="danger-button" disabled={busy} onClick={removeManager}>Remove manager</button></div>
      {invite&&<input value={invite} readOnly onFocus={(e)=>e.target.select()} style={{marginTop:14}} />}
      {message&&<p className="hub-message">{message}</p>}
    </section>
  </div>;
}

export default function AuthGate(){
  const [supabase]=useState(()=>createClient()); const [session,setSession]=useState(undefined); const [profile,setProfile]=useState(undefined); const [mode,setMode]=useState('sign_in'); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [activeLeague,setActiveLeague]=useState(null); const [showTools,setShowTools]=useState(false); const [showProfile,setShowProfile]=useState(false); const [showAppearance,setShowAppearance]=useState(false);
  async function loadProfile(next){if(!next)return setProfile(undefined);const {data}=await supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id',next.user.id).maybeSingle();setProfile(data||null);}
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);loadProfile(data.session);});const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);loadProfile(next);if(event==='PASSWORD_RECOVERY')setMode('reset_password');});return()=>listener.subscription.unsubscribe();},[supabase]);
  function openLeague(league, replace = false) {
    const key = league?.slug || league?.id;
    if (!key) return;
    const destination = `/?league=${encodeURIComponent(key)}`;
    // Entering from the dashboard used to mount the full league application
    // while LeagueHub's snapshot/live-draft polling requests were still
    // finishing. On slower and mobile browsers that transition could crash
    // the tab before React's error boundary had a chance to render. A clean
    // navigation cancels the dashboard work first; the URL restore effect
    // below then opens the same membership in a fresh page lifecycle.
    if (!activeLeague && !replace) {
      window.location.assign(destination);
      return;
    }
    setActiveLeague(league); setShowTools(false); setShowAppearance(false);
    window.history[replace ? "replaceState" : "pushState"]({}, "", destination);
  }
  function closeLeague(replace = false) {
    setActiveLeague(null); setShowTools(false); setShowAppearance(false);
    window.history[replace ? "replaceState" : "pushState"]({}, "", "/?view=dashboard");
  }
  useEffect(()=>{
    if(!session?.user?.id || !profile?.username) return undefined;
    let alive=true;
    async function restoreFromUrl(){
      const params=new URLSearchParams(window.location.search); const key=params.get("league");
      if(!key){if(alive)setActiveLeague(null);return;}
      const {data,error}=await supabase.from("league_memberships").select("role, league:leagues(id,name,slug,description,image_url,season_label,status,draft_starts_at,league_visibility,is_practice,practice_expires_at)").eq("user_id",session.user.id);
      if(!alive)return;
      const membership=(data||[]).find((entry)=>entry.league&&(entry.league.slug===key||entry.league.id===key));
      if(error||!membership){setMessage(error?.message||"That league is unavailable or you no longer have access.");closeLeague(true);return;}
      setActiveLeague({...membership.league,role:membership.role});
    }
    restoreFromUrl(); const onPopState=()=>restoreFromUrl(); window.addEventListener("popstate",onPopState);
    return()=>{alive=false;window.removeEventListener("popstate",onPopState);};
  },[session?.user?.id,profile?.username,supabase]);
  function changeMode(next){setMode(next);setMessage('');setPassword('');setConfirmPassword('');}
  function errorText(error, fallback){const detail=typeof error?.message==='string'?error.message.trim():'';return detail&&detail!=='{}'?detail:fallback;}
  async function submit(event){event.preventDefault();const cleanEmail=email.trim().toLowerCase();setBusy(true);setMessage('');if(mode==='forgot_password'){const r=await supabase.auth.resetPasswordForEmail(cleanEmail,{redirectTo:window.location.origin});setBusy(false);return setMessage(r.error?errorText(r.error,'We could not send the reset email. Please try again shortly.'):'If that email has an account, a password-reset link is on its way. Check inbox and spam.');}if(mode==='reset_password'){if(password!==confirmPassword){setBusy(false);return setMessage('The two passwords do not match.');}const r=await supabase.auth.updateUser({password});setBusy(false);return setMessage(r.error?errorText(r.error,'We could not update the password. Please try again.'):'Password updated. You are now signed in.');}if(mode==='sign_up'&&password!==confirmPassword){setBusy(false);return setMessage('The two passwords do not match.');}const r=mode==='sign_up'?await supabase.auth.signUp({email:cleanEmail,password,options:{emailRedirectTo:window.location.origin}}):await supabase.auth.signInWithPassword({email:cleanEmail,password});setBusy(false);if(r.error)return setMessage(errorText(r.error,mode==='sign_up'?'We could not create that account. Please try again shortly.':'We could not sign you in. Check your email and password.'));if(mode==='sign_up'&&!r.data.session)setMessage(`If ${cleanEmail} is new, a DraftCenter confirmation email is on its way. If you already have an account, sign in instead or use Forgot password.`);}
  if(session===undefined||(session&&profile===undefined))return <main style={{minHeight:'100vh',display:'grid',placeItems:'center'}}>Loading DraftCenter...</main>;
if(session&&mode!=='reset_password'){if(!profile?.username)return <ProfileSetup supabase={supabase} user={session.user} onSaved={setProfile}/>;if(!activeLeague)return <><div className="site-account"><a href="/pokemon">Pokémon</a><a href="/explore">Community</a><a href="/leagues">Public Leagues</a><button onClick={()=>setShowProfile(true)}>Profile</button><span>@{profile.username}</span><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div><LeagueHub user={session.user} profile={profile} onOpenLeague={openLeague}/>{showProfile&&<ProfileEditor supabase={supabase} user={session.user} profile={profile} onSaved={setProfile} onClose={()=>setShowProfile(false)}/>}</>;return <><div className="site-account"><button onClick={()=>closeLeague()}>Dashboard</button><a href="/pokemon">Pokémon</a><a href="/explore">Community</a><a href="/leagues">Public Leagues</a><button onClick={()=>setShowProfile(true)}>Profile</button><span>@{profile.username}</span><button onClick={()=>supabase.auth.signOut()}>Sign out</button></div><LeagueErrorBoundary key={activeLeague.id} onExit={()=>closeLeague()}><PokemonDraftLeague leagueId={activeLeague.id} leagueRole={activeLeague.role} league={activeLeague} profile={profile} onOpenLeagueTools={()=>setShowTools(true)} onOpenLeagueAppearance={()=>setShowAppearance(true)}/></LeagueErrorBoundary>{showTools&&<LeagueTools league={activeLeague} onClose={()=>setShowTools(false)} onUpdated={(league)=>openLeague(league,true)}/>} {showAppearance&&<LeagueAppearanceEditor league={activeLeague} onClose={()=>setShowAppearance(false)} onUpdated={(league)=>openLeague(league,true)}/>} {showProfile&&<ProfileEditor supabase={supabase} user={session.user} profile={profile} onSaved={setProfile} onClose={()=>setShowProfile(false)}/>}</>;}
  const signUp=mode==='sign_up',forgot=mode==='forgot_password',reset=mode==='reset_password';const title=reset?'Choose a new password':forgot?'Reset your password':signUp?'Create your account':'Welcome back';
  if(mode==='sign_in')return <PublicLanding email={email} password={password} setEmail={setEmail} setPassword={setPassword} busy={busy} message={message} onSubmit={submit} onMode={changeMode}/>;
return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:16,background:'radial-gradient(circle at top,#1d2857,#080b18 55%)'}}><section style={authPanel}><div className="eyebrow">DRAFTCENTER</div><h1>{title}</h1><p className="muted">{reset?'Enter and confirm a new password.':forgot?'Enter your email and we will send a password-reset link.':signUp?'Use an email you can open now. We will ask you to confirm it before you can sign in.':'Sign in to create, join, and manage Pokémon Draft Leagues.'}</p><form onSubmit={submit} className="form-stack">{!reset&&<label>Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} style={inputStyle}/></label>}{!forgot&&<label>{reset?'New password':'Password'}<input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} style={inputStyle}/></label>}{(reset||signUp)&&<label>{reset?'Confirm new password':'Confirm password'}<input type="password" required minLength={6} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} style={inputStyle}/></label>}{message&&<p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy?'Please wait...':reset?'Update password':forgot?'Email reset link':signUp?'Create account':'Sign in'}</button></form>{forgot?<button className="text-button" onClick={()=>changeMode('sign_in')}>Back to sign in</button>:!reset&&<div className="auth-links">{!signUp&&<button className="text-button" onClick={()=>changeMode('forgot_password')}>Forgot password?</button>}<button className="text-button" onClick={()=>changeMode(signUp?'sign_in':'sign_up')}>{signUp?'Already have an account? Sign in':'New here? Create an account'}</button></div>}</section></main>;
}
