"use client";

import { useEffect, useRef, useState } from "react";
import { nuzlockeEncounterStatusLabel, normalizeNuzlockeTracker, summarizeNuzlockeTracker } from "../lib/nuzlockeRunTracker";
import { createTeamLabHandoff, createTeamLabMatchupHandoff, TEAM_LAB_HANDOFF_KEY, TEAM_LAB_MATCHUP_HANDOFF_KEY, TEAM_LAB_ROSTER_LIMIT } from "../lib/teamLab";
import { PRODUCT_ROUTES } from "../platform/products";
import { SHARED_POKEMON_DIRECTORY as POKEMON_DIRECTORY, SHARED_POKEMON_NAMES as POLL_POKEMON_NAMES, SHARED_REGULATION_SETS as REGULATION_SETS } from "../platform/pokemonCatalog";
import { MonAbilities, MonDefenseChart, MonSprite, MonStats, TeamDefenseSummary } from "../platform/pokemonUi";
import { createPlatformBrowserClient } from "../platform/supabase";
import TeamLabOpponentEditor, { createEmptyTeamLabMatchup, normalizeTeamLabMatchupForm } from "./TeamLabOpponentEditor";
import TeamSheetPrintStudio from "./TeamSheetPrintStudio";

const EMPTY = { team_name:"", league_name:"", format_name:"", workspace_type:"weekly", planning_entries:[], notes:"", weekly_notes:"", pokepaste_url:"", replica_code:"", spreadsheet_url:"", team_report_url:"", pokemon:[], team_sets:{version:1,pokemon:[]}, nuzlocke_run:null, archived:false, is_public:false, regulation_id:"", public_summary:"", share_pokepaste:false, share_replica_code:false, share_team_report:false };
const nullable = (value) => value?.trim() || null;
const entryLabel = (type, index) => `${type === "tournament" ? "Tournament" : type === "nuzlocke" ? "Run detail" : "Week"} ${index + 1}`;
const isNuzlockeTeam = (team) => team?.workspace_type === "nuzlocke" && Array.isArray(team?.nuzlocke_run?.team);
const workspaceLabel = (team) => isNuzlockeTeam(team) ? "Nuzlocke run" : team?.workspace_type === "tournament" ? "Tournament team" : "Weekly team";
const titleCase = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const nuzlockeDisplayName = (entry) => `${entry.pokemon_name}${entry.form_name ? ` (${entry.form_name})` : ""}`;
const cardPokemon = (team) => isNuzlockeTeam(team) ? team.nuzlocke_run.team.map(nuzlockeDisplayName) : team.pokemon || [];
const safeNuzlockeArtworkUrl = (value) => { try { const url=new URL(String(value||"")); return url.protocol==="https:"&&url.hostname==="raw.githubusercontent.com"?url.toString():""; } catch { return ""; } };
const nuzlockeTrackerFor = (team) => normalizeNuzlockeTracker(team?.nuzlocke_run?.tracker, team?.nuzlocke_run?.team);
const nuzlockeProgressFor = (team) => summarizeNuzlockeTracker(team?.nuzlocke_run?.tracker, team?.nuzlocke_run?.team);
const REGULATION_OPTIONS = Object.entries(REGULATION_SETS).map(([id, regulation]) => ({ id, name:regulation.name || id }));

export default function PersonalTeams() {
  const [supabase] = useState(() => createPlatformBrowserClient());
  const [user, setUser] = useState(undefined);
  const [teams, setTeams] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [teamLabMatchups, setTeamLabMatchups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [matchupForm, setMatchupForm] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pokemonChoice, setPokemonChoice] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedLeagueTeams, setShowArchivedLeagueTeams] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [printingTeam, setPrintingTeam] = useState(null);
  const importInputRef = useRef(null);

  async function load(owner) {
    const [personalResult, leagueResult, matchupResult] = await Promise.all([
      supabase.from("personal_teams").select("*").eq("owner_id", owner.id).order("updated_at", { ascending:false }),
      supabase.rpc("get_my_league_team_history"),
      supabase.rpc("list_my_team_lab_matchups", { p_personal_team_id:null }),
    ]);
    if (personalResult.error) setMessage(personalResult.error.message); else setTeams(personalResult.data || []);
    if (leagueResult.error) setMessage(leagueResult.error.message); else setLeagueTeams(leagueResult.data?.teams || []);
    if (matchupResult.error) setMessage(matchupResult.error.message); else setTeamLabMatchups(matchupResult.data || []);
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { const next=data.user || null; setUser(next); if(next) load(next); }); }, [supabase]);
  useEffect(() => { setMatchupForm(null); }, [viewing?.id, viewing?.league_source]);
  function start(team = null) {
    setViewing(null);
    setEditing(team?.id || "new");
    if (team) {
      const workspaceType = ["tournament", "nuzlocke"].includes(team.workspace_type) ? team.workspace_type : "weekly";
      const savedEntries = Array.isArray(team.planning_entries) ? team.planning_entries : [];
      const planningEntries = savedEntries.length
        ? savedEntries
        : team.weekly_notes?.trim()
          ? [{ id:`legacy-${team.id}`, title:entryLabel(workspaceType, 0), notes:team.weekly_notes }]
          : [];
      setForm({ ...EMPTY, ...team, workspace_type:workspaceType, planning_entries:planningEntries, pokemon:Array.isArray(team.pokemon) ? team.pokemon : [] });
    } else {
      setForm({ ...EMPTY, planning_entries:[] });
    }
    setPokemonChoice(""); setMessage("");
  }
  const pokemonByName = new Map(POKEMON_DIRECTORY.map((pokemon) => [pokemon.name, pokemon]));
  const selectedTeamRegulation = REGULATION_SETS[form.regulation_id] || null;
  const legalTeamPokemonNames = new Set(Array.isArray(selectedTeamRegulation?.legalNames) ? selectedTeamRegulation.legalNames : POLL_POKEMON_NAMES);
  const illegalTeamPokemon = form.pokemon.filter((name) => !legalTeamPokemonNames.has(name));
  const rosterFor = (team) => (team?.pokemon || []).map((name) => pokemonByName.get(name)).filter(Boolean);
  function cancel() { setEditing(null); setForm(EMPTY); setMessage(""); }
  function addPokemon() {
    const picked=POLL_POKEMON_NAMES.find((name)=>name.toLowerCase()===pokemonChoice.trim().toLowerCase());
    if(!picked)return setMessage("Choose a Pokémon from the suggestions.");
    if(!legalTeamPokemonNames.has(picked))return setMessage(`Choose a Pokémon available in ${selectedTeamRegulation?.name || "the selected regulation"}.`);
    if(form.pokemon.includes(picked))return setMessage("That Pokémon is already on this team.");
    if(form.pokemon.length>=TEAM_LAB_ROSTER_LIMIT)return setMessage("Team Lab teams can hold up to six Pokémon.");
    setForm((current)=>({...current,pokemon:[...current.pokemon,picked]})); setPokemonChoice(""); setMessage("");
  }
  function addPlanningEntry() {
    setForm((current)=>{
      const nextIndex=current.planning_entries.length;
      return {...current,planning_entries:[...current.planning_entries,{id:`entry-${Date.now()}`,title:entryLabel(current.workspace_type,nextIndex),notes:"",url:""}]};
    });
  }
  function updatePlanningEntry(index, changes) {
    setForm((current)=>({...current,planning_entries:current.planning_entries.map((entry,entryIndex)=>entryIndex===index?{...entry,...changes}:entry)}));
  }
  function removePlanningEntry(index) {
    setForm((current)=>({...current,planning_entries:current.planning_entries.filter((_,entryIndex)=>entryIndex!==index)}));
  }
  function setWorkspaceType(workspaceType) {
    setForm((current)=>({
      ...current,
      workspace_type:workspaceType,
      planning_entries:current.planning_entries.map((entry,index)=>{
        const previousDefault=entryLabel(current.workspace_type,index);
        return {...entry,title:!entry.title||entry.title===previousDefault?entryLabel(workspaceType,index):entry.title};
      }),
    }));
  }
  async function save(event) {
    event.preventDefault(); setMessage("");
    if(!isNuzlockeTeam(form)&&form.pokemon.length>TEAM_LAB_ROSTER_LIMIT)return setMessage("Trim this legacy roster to six Pokémon before saving it again.");
    if(!isNuzlockeTeam(form)&&illegalTeamPokemon.length)return setMessage(`Remove Pokémon unavailable in ${selectedTeamRegulation?.name || "the selected regulation"} before saving: ${illegalTeamPokemon.join(", ")}.`);
    if(!isNuzlockeTeam(form)&&form.is_public&&!selectedTeamRegulation)return setMessage("Choose a regulation before sharing this team publicly.");
    setBusy(true);
    const planningEntries=form.planning_entries.map((entry,index)=>({id:entry.id||`entry-${Date.now()}-${index}`,title:entry.title?.trim()||entryLabel(form.workspace_type,index),notes:entry.notes?.trim()||"",url:nullable(entry.url)}));
    const nuzlocke=isNuzlockeTeam(form);
    const payload={owner_id:user.id,team_name:form.team_name.trim(),league_name:nullable(form.league_name),format_name:nullable(form.format_name),workspace_type:form.workspace_type,planning_entries:planningEntries,notes:form.notes.trim(),weekly_notes:"",pokepaste_url:nullable(form.pokepaste_url),replica_code:form.replica_code.trim(),spreadsheet_url:nullable(form.spreadsheet_url),team_report_url:nullable(form.team_report_url),pokemon:form.pokemon,team_sets:nuzlocke?{version:1,pokemon:[]}:{version:1,pokemon:(form.team_sets?.pokemon||[]).filter((entry)=>form.pokemon.includes(entry.name))},nuzlocke_run:nuzlocke?form.nuzlocke_run:null,archived:Boolean(form.archived),is_public:nuzlocke?false:Boolean(form.is_public),regulation_id:nuzlocke?null:nullable(form.regulation_id),public_summary:nuzlocke?"":form.public_summary?.trim()||"",share_pokepaste:nuzlocke?false:Boolean(form.share_pokepaste&&form.pokepaste_url),share_replica_code:nuzlocke?false:Boolean(form.share_replica_code&&form.replica_code.trim()),share_team_report:nuzlocke?false:Boolean(form.share_team_report&&form.team_report_url)};
    const result=editing==="new"
      ? await supabase.from("personal_teams").insert(payload).select("*").single()
      : await supabase.from("personal_teams").update(payload).eq("id",editing).eq("owner_id",user.id).select("*").single();
    setBusy(false);
    if(result.error)return setMessage(result.error.message);
    const saved=result.data;
    const sharingMismatch=Boolean(saved?.is_public)!==payload.is_public
      || saved?.regulation_id!==payload.regulation_id
      || Boolean(saved?.share_pokepaste)!==payload.share_pokepaste
      || Boolean(saved?.share_team_report)!==payload.share_team_report
      || saved?.pokepaste_url!==payload.pokepaste_url
      || saved?.team_report_url!==payload.team_report_url;
    if(sharingMismatch)return setMessage("The team saved, but its public sharing choices did not. Please leave this window open and try Save again.");
    await load(user); cancel();
  }
  async function remove(team) {
    if(!window.confirm(`Delete "${team.team_name}"? This cannot be undone.`))return;
    setBusy(true); const {error}=await supabase.from("personal_teams").delete().eq("id",team.id).eq("owner_id",user.id); setBusy(false);
    if(error)return setMessage(error.message); await load(user);
  }
  async function setLeagueTeamArchived(team, archived) {
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("set_my_league_team_archived", {
      p_league_id: team.league_id,
      p_season_number: team.season_number,
      p_team_index: team.team_index,
      p_archived: archived,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setViewing(null);
    await load(user);
  }
  function openInTeamLab(team, source, event, matchupId = null) {
    event?.stopPropagation();
    const transferable = source === "league" ? { ...team, format_name:`Season ${team.season_number}` } : team;
    window.sessionStorage.setItem(TEAM_LAB_HANDOFF_KEY, createTeamLabHandoff(transferable, source));
    if (matchupId) window.sessionStorage.setItem(TEAM_LAB_MATCHUP_HANDOFF_KEY, createTeamLabMatchupHandoff(matchupId));
    window.location.assign(PRODUCT_ROUTES.teamLab);
  }
  function editMatchup(matchup = null) {
    if (!viewing?.id || viewing.league_source || isNuzlockeTeam(viewing)) return;
    setMatchupForm(matchup
      ? normalizeTeamLabMatchupForm(matchup)
      : createEmptyTeamLabMatchup({ format_id:viewing.regulation_id || "reg-mb" }));
    setMessage("");
  }
  async function saveMatchup(event) {
    event.preventDefault();
    if (!viewing?.id || !matchupForm) return;
    setBusy(true); setMessage("");
    const normalizedMatchup=normalizeTeamLabMatchupForm(matchupForm);
    const matchupRegulation=REGULATION_SETS[normalizedMatchup.format_id];
    const legalOpponentNames=new Set(Array.isArray(matchupRegulation?.legalNames)?matchupRegulation.legalNames:POLL_POKEMON_NAMES);
    const illegalOpponentNames=normalizedMatchup.pokemon.filter((name)=>!legalOpponentNames.has(name));
    if(illegalOpponentNames.length){setBusy(false);return setMessage(`Remove Pokémon unavailable in ${matchupRegulation?.name||"this format"} before saving: ${illegalOpponentNames.join(", ")}.`);}
    const { data, error } = await supabase.rpc("save_my_team_lab_matchup_details", {
      p_matchup_id:normalizedMatchup.id,
      p_personal_team_id:viewing.id,
      p_opponent_name:normalizedMatchup.opponent_name.trim(),
      p_opponent_team_name:normalizedMatchup.opponent_team_name.trim(),
      p_mode:normalizedMatchup.mode,
      p_format_id:normalizedMatchup.format_id,
      p_pokemon:normalizedMatchup.pokemon,
      p_opponent_sets:normalizedMatchup.opponent_sets,
      p_notes:normalizedMatchup.notes.trim(),
      p_week_label:normalizedMatchup.week_label || "",
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setTeamLabMatchups((current) => [data, ...current.filter((matchup) => matchup.id !== data.id)]);
    setMatchupForm(null);
    setMessage("Opponent plan saved privately. It is available here and in Team Lab.");
  }
  async function deleteMatchup(matchup) {
    if (!window.confirm(`Delete the opponent plan for ${matchup.opponent_name}?`)) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("delete_my_team_lab_matchup", { p_matchup_id:matchup.id });
    setBusy(false);
    if (error) return setMessage(error.message);
    setTeamLabMatchups((current) => current.filter((item) => item.id !== matchup.id));
    if (matchupForm?.id === matchup.id) setMatchupForm(null);
    setMessage("Opponent plan deleted.");
  }
  function downloadPrivateBackup() {
    const payload={format:"draftcenter-my-teams",version:5,exported_at:new Date().toISOString(),personal_teams:teams,team_lab_matchups:teamLabMatchups};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const link=document.createElement("a"); link.href=url; link.download=`draftcenter-my-teams-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
  async function downloadReadableExport() {
    const XLSX=await import("xlsx");
    const workbook=XLSX.utils.book_new();
    const overview=XLSX.utils.aoa_to_sheet([
      ["Team","League","Format","Use","Archived","Pokemon","General notes","Pokepaste","Spreadsheet","Team report","Replica code"],
      ...teams.map((team)=>[team.team_name,team.league_name||"",team.format_name||"",team.workspace_type||"weekly",team.archived?"Yes":"No",(team.pokemon||[]).join(", "),team.notes||"",team.pokepaste_url||"",team.spreadsheet_url||"",team.team_report_url||"",team.replica_code||""]),
    ]);
    overview["!cols"]=[24,24,20,12,10,60,80,40,50,50,24].map((wch)=>({wch}));
    XLSX.utils.book_append_sheet(workbook,overview,"My Teams");
    const plans=XLSX.utils.aoa_to_sheet([
      ["Team","Use","Section","Link","Notes"],
      ...teams.flatMap((team)=>(team.planning_entries||[]).map((entry,index)=>[team.team_name,team.workspace_type||"weekly",entry.title||entryLabel(team.workspace_type,index),entry.url||"",entry.notes||""])),
    ]);
    plans["!cols"]=[24,12,28,50,100].map((wch)=>({wch}));
    XLSX.utils.book_append_sheet(workbook,plans,"Planning");
    const matchups=XLSX.utils.aoa_to_sheet([
      ["Your team","Week or round","Team sheet","Opponent","Opponent team","Roster","Scouted sets","Observed moves","Battle notes","Matchup notes","Format"],
      ...teamLabMatchups.map((matchup)=>[
        teams.find((team)=>team.id===matchup.personal_team_id)?.team_name||"",matchup.week_label||"",matchup.sheet_mode==="open"?"Open":"Closed",matchup.opponent_name,matchup.opponent_team_name||"",(matchup.pokemon||[]).join(", "),
        (matchup.opponent_sets?.pokemon||[]).filter((pokemon)=>pokemon.ability||pokemon.moves?.length).map((pokemon)=>`${pokemon.name}${pokemon.ability?` [${pokemon.ability}]`:""}${pokemon.moves?.length?`: ${pokemon.moves.join(", ")}`:""}`).join("; "),
        (matchup.battle_report?.opponent_pokemon||[]).filter((pokemon)=>pokemon.brought||pokemon.fainted||pokemon.moves?.length).map((pokemon)=>`${pokemon.name}${pokemon.moves?.length?`: ${pokemon.moves.join(", ")}`:""}${pokemon.fainted?" (fainted)":""}`).join("; "),
        matchup.battle_report?.battle_notes||"",matchup.notes||"",matchup.format_id||"",
      ]),
    ]);
    matchups["!cols"]=[24,18,12,24,24,60,90,90,100,100,20].map((wch)=>({wch}));
    XLSX.utils.book_append_sheet(workbook,matchups,"Team Lab matchups");
    XLSX.writeFile(workbook,`draftcenter-my-teams-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  async function restorePrivateBackup(event) {
    const file=event.target.files?.[0]; if(!file)return;
    setBusy(true); setMessage("");
    try {
      const parsed=JSON.parse(await file.text());
      if(parsed?.format!=="draftcenter-my-teams"||![1,2,3,4,5].includes(parsed?.version)||!Array.isArray(parsed.personal_teams))throw new Error("Choose a DraftCenter My Teams recovery file.");
      if(!window.confirm(`Restore ${parsed.personal_teams.length} private team workspace${parsed.personal_teams.length===1?"":"s"}? Matching teams will be updated and new teams will be added.`))return;
      const rows=parsed.personal_teams.map((team)=>({
        id:team.id,owner_id:user.id,team_name:String(team.team_name||"").trim(),league_name:nullable(team.league_name),format_name:nullable(team.format_name),
        workspace_type:["tournament","nuzlocke"].includes(team.workspace_type)?team.workspace_type:"weekly",planning_entries:Array.isArray(team.planning_entries)?team.planning_entries:[],
        notes:String(team.notes||""),weekly_notes:String(team.weekly_notes||""),pokepaste_url:nullable(team.pokepaste_url),replica_code:String(team.replica_code||""),
        spreadsheet_url:nullable(team.spreadsheet_url),team_report_url:nullable(team.team_report_url),pokemon:Array.isArray(team.pokemon)?team.pokemon:[],team_sets:team.team_sets&&typeof team.team_sets==="object"?team.team_sets:{version:1,pokemon:[]},archived:Boolean(team.archived),is_public:Boolean(team.is_public),regulation_id:nullable(team.regulation_id),public_summary:String(team.public_summary||""),
        share_pokepaste:Boolean(team.share_pokepaste),share_replica_code:Boolean(team.share_replica_code),share_team_report:Boolean(team.share_team_report),nuzlocke_run:team.workspace_type==="nuzlocke"?team.nuzlocke_run:null,
      }));
      if(rows.some((team)=>!team.id||!team.team_name))throw new Error("The recovery file contains an invalid team.");
      const {error}=await supabase.rpc("restore_my_personal_teams",{p_teams:rows});
      if(error)throw error;
      if(parsed.version>=2&&Array.isArray(parsed.team_lab_matchups)&&parsed.team_lab_matchups.length){
        const {error:matchupError}=await supabase.rpc("restore_my_team_lab_matchups",{p_matchups:parsed.team_lab_matchups});
        if(matchupError)throw matchupError;
      }
      await load(user); setMessage("My Teams recovery file restored.");
    } catch(error) { setMessage(error.message||"The My Teams recovery file could not be restored."); }
    finally { setBusy(false); if(importInputRef.current)importInputRef.current.value=""; }
  }
  if(user===undefined)return <main className="personal-teams-shell"><p>Loading My Teams...</p></main>;
  if(!user)return <main className="personal-teams-shell"><section className="hub-card"><h1>My Teams is private.</h1><p className="muted">Sign in to create and manage your personal team workspaces.</p><a className="primary-button inline-link-button" href="/">Sign in</a></section></main>;
  const visible=teams.filter((team)=>Boolean(team.archived)===showArchived);
  const visibleLeagueTeams=leagueTeams.filter((team)=>Boolean(team.user_archived)===showArchivedLeagueTeams);
  const viewingNuzlockeTracker=isNuzlockeTeam(viewing)?nuzlockeTrackerFor(viewing):null;
  const viewingNuzlockeProgress=isNuzlockeTeam(viewing)?nuzlockeProgressFor(viewing):null;
  const viewingMatchups=viewing?.id&&!viewing.league_source?teamLabMatchups.filter((matchup)=>matchup.personal_team_id===viewing.id):[];
  return <main className="personal-teams-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">Dashboard</a><a className="quiet-button" href="/calendar">Calendar</a><a className="quiet-button" href="/resources">Resources</a><a className="quiet-button" href="/explore">Community</a></nav>
    <header className="personal-teams-hero"><div><span className="eyebrow">YOUR TEAM BINDER</span><h1>My Teams</h1><p>Your DraftCenter league teams and private external team workspaces, all in one place. League history remains read-only and external teams never alter a hosted league.</p></div><div className="personal-team-actions"><button className="primary-button" onClick={()=>start()}>Add external team</button><button className="secondary-button" disabled={busy} onClick={downloadReadableExport}>Download spreadsheet</button><button className="quiet-button" disabled={busy} onClick={downloadPrivateBackup}>Download recovery file</button><button className="quiet-button" disabled={busy} onClick={()=>importInputRef.current?.click()}>Restore recovery file</button><input ref={importInputRef} type="file" accept="application/json" onChange={restorePrivateBackup} hidden/></div></header>
    <section className="my-league-teams-section"><div className="section-heading"><div><span className="eyebrow">DRAFTCENTER LEAGUES</span><h2>Your league teams</h2></div><span className="muted">Archiving only cleans up your personal view</span></div>
      <div className="personal-team-tabs"><button className={!showArchivedLeagueTeams?"secondary-button":"quiet-button"} onClick={()=>setShowArchivedLeagueTeams(false)}>Active ({leagueTeams.filter((team)=>!team.user_archived).length})</button><button className={showArchivedLeagueTeams?"secondary-button":"quiet-button"} onClick={()=>setShowArchivedLeagueTeams(true)}>Archived ({leagueTeams.filter((team)=>team.user_archived).length})</button></div>
      {!leagueTeams.length&&<p className="muted">Teams you manage in DraftCenter leagues will appear here.</p>}
      {!visibleLeagueTeams.length&&leagueTeams.length>0&&<p className="muted">{showArchivedLeagueTeams?"No archived league teams.":"All of your league teams are archived."}</p>}
      <div className="personal-team-grid">{visibleLeagueTeams.map((team)=><article className="personal-team-card league-team-card" key={`${team.league_id}-${team.season_number}-${team.team_index}-${team.archived}`} onClick={()=>setViewing({...team,format_name:`Season ${team.season_number}`,league_source:true})}><span className="eyebrow">{team.league_name}</span><h2>{team.team_name}</h2><p className="personal-team-format">Season {team.season_number} · {team.archived?"Completed":"Current"}</p><div className="personal-team-pokemon">{(team.pokemon||[]).map((name)=><span key={name}>{name}</span>)}{!team.pokemon?.length&&<span className="muted">No Pokémon saved for this roster</span>}</div><div className="personal-team-actions"><button className="secondary-button">View roster</button><button className="text-button" onClick={(event)=>openInTeamLab(team,"league",event)}>Open Team Lab →</button>{!team.archived&&<a className="text-button" href={`/?league=${encodeURIComponent(team.slug||team.league_id)}`} onClick={(event)=>event.stopPropagation()}>Open league →</a>}<button className="text-button" disabled={busy} onClick={(event)=>{event.stopPropagation();setLeagueTeamArchived(team,!team.user_archived);}}>{team.user_archived?"Restore":"Archive"}</button></div></article>)}</div>
    </section>
    <section className="external-teams-section"><div className="section-heading"><div><span className="eyebrow">PRIVATE EXTERNAL TEAMS</span><h2>Your workspaces</h2></div><span className="muted">{teams.length} workspace{teams.length===1?"":"s"}</span></div>
    <div className="personal-team-tabs"><button className={!showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(false)}>Active ({teams.filter((team)=>!team.archived).length})</button><button className={showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(true)}>Archived ({teams.filter((team)=>team.archived).length})</button></div>
    {message&&!editing&&<p className="hub-message">{message}</p>}
    {!visible.length&&<section className="personal-team-empty"><h2>{showArchived?"No archived teams":"Your team binder is ready."}</h2><p>{showArchived?"Teams you archive will remain available here.":"Add a private workspace for any team, whether or not its league is hosted on DraftCenter."}</p></section>}
    <div className="personal-team-grid">{visible.map((team)=>{const pokemon=cardPokemon(team);const progress=isNuzlockeTeam(team)?nuzlockeProgressFor(team):null;return <article className="personal-team-card" key={team.id} onClick={()=>setViewing(team)}><span className="eyebrow">{team.league_name||"PERSONAL TEAM"}</span><h2>{team.team_name}</h2>{team.format_name&&<p className="personal-team-format">{team.format_name}</p>}<span className="personal-team-use-badge">{workspaceLabel(team)}</span>{progress&&<div className="personal-nuzlocke-card-progress"><strong>{progress.recorded} / {progress.total} locations recorded</strong><span>{progress.living} living · {progress.deceased} deceased</span></div>}<div className="personal-team-pokemon">{pokemon.slice(0,12).map((name,index)=><span key={`${name}-${index}`}>{name}</span>)}{pokemon.length>12&&<span>+{pokemon.length-12} more</span>}{!pokemon.length&&<span className="muted">No Pokémon added</span>}</div><div className="personal-team-links">{team.pokepaste_url&&<a href={team.pokepaste_url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>PokéPaste ↗</a>}{team.spreadsheet_url&&<a href={team.spreadsheet_url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>Spreadsheet ↗</a>}{team.team_report_url&&<a href={team.team_report_url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>{isNuzlockeTeam(team)?"Recreate build":"Team report"} ↗</a>}</div><div className="personal-team-actions"><button className="secondary-button" onClick={(event)=>{event.stopPropagation();setViewing(team);}}>{isNuzlockeTeam(team)?"View progress":"View roster"}</button>{isNuzlockeTeam(team)?<a className="text-button" href={`/nuzlocke?run=${team.id}`} onClick={(event)=>event.stopPropagation()}>Open tracker →</a>:<button className="text-button" onClick={(event)=>openInTeamLab(team,"personal",event)}>Open Team Lab →</button>}<button className="text-button danger-text" disabled={busy} onClick={(event)=>{event.stopPropagation();remove(team);}}>Delete</button></div></article>})}</div>
    </section>
    {viewing&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setViewing(null);}}><section className="tools-modal personal-team-viewer"><button className="modal-close" onClick={()=>setViewing(null)}>x</button><span className="eyebrow">{viewing.league_name||"PRIVATE TEAM WORKSPACE"}</span><div className="personal-team-viewer-heading"><div><h2>{viewing.team_name}</h2>{viewing.format_name&&<p className="personal-team-format">{viewing.format_name}</p>}</div>{viewing.league_source?<div className="personal-team-actions"><button className="primary-button" disabled={!viewing.pokemon?.length} onClick={()=>setPrintingTeam(viewing)}>Print team sheets</button><button className="secondary-button" onClick={(event)=>openInTeamLab(viewing,"league",event)}>Prepare private copy</button><a className="quiet-button inline-link-button" href={`/?league=${encodeURIComponent(viewing.slug||viewing.league_id)}`}>{viewing.archived?"Open league history":"Open league"}</a></div>:<div className="personal-team-actions">{isNuzlockeTeam(viewing)?<a className="primary-button inline-link-button" href={`/nuzlocke?run=${viewing.id}`}>Open tracker</a>:<><button className="primary-button" disabled={!viewing.pokemon?.length} onClick={()=>setPrintingTeam(viewing)}>Print team sheets</button><button className="secondary-button" onClick={(event)=>openInTeamLab(viewing,"personal",event)}>Open Team Lab</button></>}<button className="quiet-button" onClick={()=>start(viewing)}>Edit workspace</button></div>}</div>
      {isNuzlockeTeam(viewing)?<>
        <section className="personal-nuzlocke-summary">
          <strong>{viewingNuzlockeProgress.recorded} / {viewingNuzlockeProgress.total} locations recorded</strong>
          <span>{viewingNuzlockeProgress.living} living · {viewingNuzlockeProgress.deceased} deceased · {viewingNuzlockeProgress.missed} missed</span>
        </section>
        {Array.isArray(viewing.nuzlocke_run.rules)&&viewing.nuzlocke_run.rules.length>0&&<div className="personal-nuzlocke-rules">{viewing.nuzlocke_run.rules.map((rule,index)=><span key={`${rule}-${index}`}>{rule}</span>)}</div>}
        {viewingNuzlockeTracker.milestones.length>0&&<section className="personal-nuzlocke-milestones"><h3>Milestones</h3>{viewingNuzlockeTracker.milestones.map((milestone)=><div key={milestone.id}><span aria-hidden="true">{milestone.completed?"✓":"○"}</span><strong>{milestone.name}</strong>{milestone.level_cap&&<small>Level cap {milestone.level_cap}</small>}</div>)}</section>}
        <div className="personal-nuzlocke-grid">{viewing.nuzlocke_run.team.map((entry,index)=>{const artwork=safeNuzlockeArtworkUrl(entry.artwork_url);const progress=viewingNuzlockeTracker.encounters[index];return <article key={`${entry.area_key}-${entry.pokemon_id}-${index}`} className={`nuzlocke-status-${progress?.status||"not-encountered"}`}>{artwork&&<img src={artwork} alt={`${nuzlockeDisplayName(entry)} artwork`}/>}<span>{index+1}</span><div><h3>{progress?.nickname||nuzlockeDisplayName(entry)}</h3>{progress?.nickname&&<small>{nuzlockeDisplayName(entry)}</small>}<strong>{entry.area_name}</strong><span className="personal-nuzlocke-status">{nuzlockeEncounterStatusLabel(progress?.status)}</span><p>{entry.method==="starter"?"Starter Pokémon":<>{titleCase(entry.method)} · Lv. {entry.min_level??"?"}{entry.max_level!=null&&entry.max_level!==entry.min_level?`–${entry.max_level}`:""}{entry.chance!=null?` · ${entry.chance}% rate`:""}</>}</p>{progress?.notes&&<small>{progress.notes}</small>}{entry.conditions?.length>0&&<small>{entry.conditions.map(titleCase).join(", ")}</small>}</div></article>})}</div>
        {viewingNuzlockeTracker.notes&&<section className="personal-nuzlocke-run-notes"><h3>Run notes</h3><p>{viewingNuzlockeTracker.notes}</p></section>}
      </>:<><div className="personal-roster-grid">{rosterFor(viewing).map((mon,index)=><article key={`${mon.name}-${index}`} className="personal-roster-mon"><MonSprite mon={mon} size={78}/><div><h3>{mon.name}</h3><div className="personal-roster-types"><span className={`type-${mon.t1}`}>{mon.t1}</span>{mon.t2&&<span className={`type-${mon.t2}`}>{mon.t2}</span>}</div><MonStats mon={mon}/><MonAbilities mon={mon} className="personal-roster-abilities"/><div className="personal-roster-defense"><strong>Defensive matchups</strong><MonDefenseChart mon={mon}/></div></div></article>)}</div>{!rosterFor(viewing).length&&<p className="muted">No Pokémon are on this roster yet. Edit the workspace to add them.</p>}{rosterFor(viewing).length>0&&<section className="personal-team-defense-summary"><h3>Team defensive coverage</h3><TeamDefenseSummary roster={rosterFor(viewing)}/></section>}</>}
      {(viewing.notes||viewing.weekly_notes||viewing.replica_code)&&<div className="personal-team-saved-details">{viewing.notes&&<section><h3>General notes</h3><p>{viewing.notes}</p></section>}{viewing.weekly_notes&&<section><h3>Weekly notes</h3><p>{viewing.weekly_notes}</p></section>}{viewing.replica_code&&<section><h3>Pokémon Champions replica code</h3><p>{viewing.replica_code}</p></section>}</div>}
      <div className="personal-team-links">{viewing.pokepaste_url&&<a href={viewing.pokepaste_url} target="_blank" rel="noreferrer">PokéPaste ↗</a>}{viewing.spreadsheet_url&&<a href={viewing.spreadsheet_url} target="_blank" rel="noreferrer">Spreadsheet ↗</a>}{viewing.team_report_url&&<a href={viewing.team_report_url} target="_blank" rel="noreferrer">{isNuzlockeTeam(viewing)?"Recreate build":"Team report"} ↗</a>}</div>
      {Array.isArray(viewing.planning_entries)&&viewing.planning_entries.length>0&&<div className="personal-team-planning-view"><h3>{viewing.workspace_type==="tournament"?"Tournament plans":viewing.workspace_type==="nuzlocke"?"Run details":"Weekly plans"}</h3>{viewing.planning_entries.map((entry,index)=><section key={entry.id||index}><strong>{entry.title||entryLabel(viewing.workspace_type,index)}</strong>{entry.url&&<a href={entry.url} target="_blank" rel="noreferrer">Open saved link ↗</a>}{entry.notes&&<p>{entry.notes}</p>}</section>)}</div>}
      {!isNuzlockeTeam(viewing)&&<section className="personal-team-opponents">
        <div className="personal-team-opponents-heading"><div><span className="eyebrow">PRIVATE OPPONENT SCOUTING</span><h3>Teams you are preparing against</h3><p>Save opponent rosters, abilities, four moves per Pokémon, and private matchup notes. The same plans appear in Team Lab.</p></div>{viewing.league_source?<button type="button" className="secondary-button" onClick={(event)=>openInTeamLab(viewing,"league",event)}>Open planning copy</button>:<button type="button" className="secondary-button" disabled={busy} onClick={()=>editMatchup()}>Add opponent</button>}</div>
        {viewing.league_source&&<p className="team-lab-matchup-empty">This official roster is read-only. Open Team Lab to save a private planning copy, or use a scheduled league event from Calendar to prefill the opponent.</p>}
        {!viewing.league_source&&!viewingMatchups.length&&!matchupForm&&<p className="team-lab-matchup-empty">No opponent plans yet.</p>}
        {!viewing.league_source&&viewingMatchups.length>0&&<div className="personal-team-opponent-grid">{viewingMatchups.map((matchup)=>{const savedSets=(matchup.opponent_sets?.pokemon||[]).filter((pokemon)=>pokemon.ability||pokemon.moves?.length);return <article key={matchup.id}><span className="eyebrow">{matchup.week_label||"OPPONENT"}</span><h4>{matchup.opponent_name}</h4>{matchup.opponent_team_name&&<p>{matchup.opponent_team_name}</p>}<div className="team-lab-matchup-pokemon">{(matchup.pokemon||[]).map((name)=><span key={name}>{name}</span>)}</div>{savedSets.length>0&&<ul>{savedSets.map((pokemon)=><li key={pokemon.name}><strong>{pokemon.name}</strong>{pokemon.ability&&<span>{pokemon.ability}</span>}{pokemon.moves?.length>0&&<small>{pokemon.moves.join(", ")}</small>}</li>)}</ul>}{matchup.notes&&<p className="team-lab-matchup-note">{matchup.notes}</p>}<div className="personal-team-actions"><button type="button" className="primary-button" onClick={(event)=>openInTeamLab(viewing,"personal",event,matchup.id)}>Open Battle Mode</button><button type="button" className="quiet-button" onClick={()=>editMatchup(matchup)}>Edit</button><button type="button" className="text-button danger-text" disabled={busy} onClick={()=>deleteMatchup(matchup)}>Delete</button></div></article>})}</div>}
        {!viewing.league_source&&matchupForm&&<form className="team-lab-matchup-editor" onSubmit={saveMatchup}><div className="team-lab-matchup-editor-heading"><div><span className="eyebrow">{matchupForm.id?"EDIT OPPONENT":"NEW OPPONENT"}</span><h3>{matchupForm.id?matchupForm.opponent_name:"Add a team you are facing"}</h3></div><button type="button" className="quiet-button" onClick={()=>setMatchupForm(null)}>Close</button></div><label>Week or round<input maxLength={100} value={matchupForm.week_label||""} onChange={(event)=>setMatchupForm((current)=>({...current,week_label:event.target.value}))} placeholder="Week 4, finals, practice set…"/></label><TeamLabOpponentEditor form={matchupForm} onChange={setMatchupForm} onMessage={setMessage} inputId="my-teams-opponent-pokemon"/><button className="primary-button" disabled={busy||!matchupForm.opponent_name.trim()}>{busy?"Saving…":"Save opponent plan"}</button></form>}
      </section>}
    </section></div>}
    {printingTeam&&<TeamSheetPrintStudio team={printingTeam} onClose={()=>setPrintingTeam(null)}/>}
    {editing&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)cancel();}}><section className="tools-modal personal-team-editor"><button className="modal-close" onClick={cancel}>x</button><span className="eyebrow">{editing==="new"?"NEW PERSONAL TEAM":"PRIVATE TEAM WORKSPACE"}</span><h2>{editing==="new"?"Add a team":form.team_name}</h2><form className="form-stack" onSubmit={save}>
      {form.planning_entries.length>0&&<fieldset className="personal-team-entry-links"><legend>{form.workspace_type==="tournament"?"Tournament links":"Weekly links"}</legend><p className="muted">Save a bracket, registration page, matchup, replay, document, or any other useful link with each entry.</p>{form.planning_entries.map((entry,index)=><label key={entry.id||index}>{entry.title||entryLabel(form.workspace_type,index)}<input type="url" placeholder="Optional https:// link" value={entry.url||""} onChange={(event)=>updatePlanningEntry(index,{url:event.target.value})}/></label>)}</fieldset>}
      <div className="personal-team-form-grid"><label>Team name<input required maxLength={120} value={form.team_name} onChange={(e)=>setForm((current)=>({...current,team_name:e.target.value}))}/></label><label>League name<input maxLength={120} value={form.league_name||""} onChange={(e)=>setForm((current)=>({...current,league_name:e.target.value}))}/></label><label>Format<input maxLength={100} placeholder="Draft, VGC Regulation I..." value={form.format_name||""} onChange={(e)=>setForm((current)=>({...current,format_name:e.target.value}))}/></label><label>PokéPaste URL<input type="url" placeholder="https://pokepast.es/..." value={form.pokepaste_url||""} onChange={(e)=>setForm((current)=>({...current,pokepaste_url:e.target.value}))}/></label></div>
      {form.workspace_type!=="nuzlocke"&&<label>Team Lab regulation<select required={form.is_public} value={form.regulation_id||""} onChange={(e)=>setForm((current)=>({...current,regulation_id:e.target.value}))}><option value="">No regulation selected</option>{REGULATION_OPTIONS.map((option)=><option key={option.id} value={option.id}>{option.name}</option>)}</select><small className="muted">The selected regulation filters Pokémon in Team Lab and the private opponent planner.</small></label>}
      <label><a href="https://devoncorp.press/resources/the-release-of-pasrs-7-0" target="_blank" rel="noreferrer">PASRS Spreadsheet ↗</a><small className="muted">Learn about PASRS 7.0, then save your Google spreadsheet below.</small><input type="url" placeholder="https://docs.google.com/spreadsheets/..." value={form.spreadsheet_url||""} onChange={(e)=>setForm({...form,spreadsheet_url:e.target.value})}/></label>
      <div className="personal-team-form-grid"><label>Team report URL<small className="muted">Save a report, rental page, matchup write-up, or other team-analysis link.</small><input type="url" placeholder="https://..." value={form.team_report_url||""} onChange={(e)=>setForm((current)=>({...current,team_report_url:e.target.value}))}/></label><label className="replica-code-field">Pokémon Champions replica code<input maxLength={100} placeholder="Short letter and number code" value={form.replica_code} onChange={(e)=>setForm((current)=>({...current,replica_code:e.target.value}))}/></label></div><label>General notes<textarea maxLength={20000} rows={5} value={form.notes} onChange={(e)=>setForm((current)=>({...current,notes:e.target.value}))}/></label>
      {form.workspace_type!=="nuzlocke"&&<fieldset className="personal-team-planning"><legend>How will you use this team?</legend><div className="personal-team-use-options"><button type="button" className={form.workspace_type==="weekly"?"secondary-button active":"quiet-button"} onClick={()=>setWorkspaceType("weekly")}>Weekly</button><button type="button" className={form.workspace_type==="tournament"?"secondary-button active":"quiet-button"} onClick={()=>setWorkspaceType("tournament")}>Tournament</button></div><p className="muted">{form.workspace_type==="tournament"?"Keep separate preparation notes for each tournament.":"Keep separate preparation notes for each matchup week."}</p><div className="personal-team-planning-list">{form.planning_entries.map((entry,index)=><section key={entry.id||index}><div><input aria-label={`${entryLabel(form.workspace_type,index)} title`} maxLength={100} value={entry.title||""} onChange={(event)=>updatePlanningEntry(index,{title:event.target.value})}/><button type="button" className="text-button danger-text" onClick={()=>removePlanningEntry(index)}>Remove</button></div><textarea maxLength={10000} rows={4} placeholder={`${entryLabel(form.workspace_type,index)} notes`} value={entry.notes||""} onChange={(event)=>updatePlanningEntry(index,{notes:event.target.value})}/></section>)}</div><button type="button" className="secondary-button" onClick={addPlanningEntry}>Add {form.workspace_type==="tournament"?"tournament":"week"}</button></fieldset>}
      {form.workspace_type==="nuzlocke"?<section className="personal-nuzlocke-editor-note"><strong>Tracked encounter roster</strong><p className="muted">Locations and tracker progress stay attached to this private workspace. Use Open tracker to update encounters, milestones, level caps, and run notes.</p></section>:<div><strong>Six-Pokémon Team Lab roster</strong><p className="muted">Team Lab workspaces contain up to six Pokémon. Official DraftCenter league rosters remain unchanged and can still be opened as read-only planning sources.</p><div className="personal-roster-builder"><input list="personal-team-pokemon-options" value={pokemonChoice} onChange={(e)=>setPokemonChoice(e.target.value)} placeholder="Search for a Pokémon" autoComplete="off" disabled={form.pokemon.length>=TEAM_LAB_ROSTER_LIMIT}/><datalist id="personal-team-pokemon-options">{[...legalTeamPokemonNames].map((name)=><option key={name} value={name}/>)}</datalist><button type="button" className="secondary-button" onClick={addPokemon} disabled={form.pokemon.length>=TEAM_LAB_ROSTER_LIMIT}>Add to team</button></div><div className="personal-roster-selections">{form.pokemon.map((name,index)=><span key={`${name}-${index}`}><b>{index+1}</b>{name}<button type="button" aria-label={`Remove ${name}`} onClick={()=>setForm({...form,pokemon:form.pokemon.filter((_,itemIndex)=>itemIndex!==index)})}>x</button></span>)}</div><small>{form.pokemon.length} / {TEAM_LAB_ROSTER_LIMIT} Pokémon</small>{form.pokemon.length>TEAM_LAB_ROSTER_LIMIT&&<p className="team-lab-legality-warning">This legacy workspace remains readable. Remove {form.pokemon.length-TEAM_LAB_ROSTER_LIMIT} Pokémon before saving it again.</p>}{illegalTeamPokemon.length>0&&<p className="team-lab-legality-warning">Remove or replace these Pokémon before saving; they are not available in {selectedTeamRegulation?.name || "the selected regulation"}: {illegalTeamPokemon.join(", ")}.</p>}</div>}
      {form.workspace_type!=="nuzlocke"&&<fieldset className="personal-team-sharing"><legend>Community team repository</legend><label className="check-row"><input type="checkbox" checked={form.is_public} onChange={(e)=>setForm((current)=>({...current,is_public:e.target.checked}))}/> Share this roster publicly</label><p className="muted">Sharing is off by default. Your team name, regulation, roster, public summary, and public coach identity are included. Optional attachments require separate permission below.</p>{form.is_public&&<label>Public summary<textarea maxLength={500} rows={3} placeholder="What is this team designed to do?" value={form.public_summary||""} onChange={(e)=>setForm((current)=>({...current,public_summary:e.target.value}))}/></label>}</fieldset>}
      {form.is_public&&<fieldset className="personal-team-share-options"><legend>Choose public attachments</legend><p className="muted">These stay private unless you turn on the matching option.</p><label className="check-row"><input type="checkbox" disabled={!form.pokepaste_url} checked={Boolean(form.share_pokepaste&&form.pokepaste_url)} onChange={(e)=>setForm((current)=>({...current,share_pokepaste:e.target.checked}))}/> Share PokéPaste</label><label className="check-row"><input type="checkbox" disabled={!form.replica_code.trim()} checked={Boolean(form.share_replica_code&&form.replica_code.trim())} onChange={(e)=>setForm((current)=>({...current,share_replica_code:e.target.checked}))}/> Share replica code</label><label className="check-row"><input type="checkbox" disabled={!form.team_report_url} checked={Boolean(form.share_team_report&&form.team_report_url)} onChange={(e)=>setForm((current)=>({...current,share_team_report:e.target.checked}))}/> Share team report</label></fieldset>}
      <label className="check-row"><input type="checkbox" checked={form.archived} onChange={(e)=>setForm({...form,archived:e.target.checked})}/> Archive this team</label>{message&&<p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy?"Saving...":"Save private team"}</button>
    </form></section></div>}
  </main>;
}
