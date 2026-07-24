"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

async function loadFavoriteArtwork(name) {
  const base = name.toLowerCase().replace(/[.'’:%]/g, "").replace(/\s+/g, "-");
  const special = { aegislash:"aegislash-shield", "mr-mime":"mr-mime", "mime-jr":"mime-jr", "type-null":"type-null", farfetchd:"farfetchd", sirfetchd:"sirfetchd" };
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${special[base] || base}`);
  if (!response.ok) return "";
  const data = await response.json();
  return data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default || "";
}

function FavoritePokemon({ name }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    loadFavoriteArtwork(name).then((next) => { if (active) setImage(next || ""); }).catch(() => { if (active) setImage(""); });
    return () => { active = false; };
  }, [name]);
  return <article className="public-profile-favorite">{image ? <img src={image} alt="" /> : <span className="profile-photo-placeholder">{name[0]}</span>}<strong>{name}</strong></article>;
}

export function CoachAvatar({ profile, size = 36 }) {
  const name = profile?.display_name || profile?.username || "Coach";
  return profile?.avatar_url
    ? <img className="coach-avatar" src={profile.avatar_url} alt="" style={{ width:size, height:size }} />
    : <span className="coach-avatar coach-avatar-fallback" style={{ width:size, height:size }}>{name[0].toUpperCase()}</span>;
}

export function CoachProfileButton({ username, displayName, avatarUrl, onOpen, compact = false }) {
  if (!username && !displayName) return <span>Coach</span>;
  return <button type="button" className={`coach-profile-button${compact ? " is-compact" : ""}`} onClick={() => onOpen(username || displayName)}><CoachAvatar profile={{ username, display_name:displayName, avatar_url:avatarUrl }} size={compact ? 28 : 34}/><span><strong>{displayName || username}</strong>{username && <small>@{username}</small>}</span></button>;
}

export default function PublicCoachProfile({ identity, onClose }) {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!identity) return;
    const supabase = createClient();
    supabase.rpc("get_public_coach_profile", { p_identity:identity }).then(({ data:next, error }) => {
      if (error) setMessage(error.message);
      else setData(next);
    });
  }, [identity]);
  if (!identity) return null;
  const record = data?.record || {};
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="tools-modal public-profile-modal"><button className="modal-close" onClick={onClose}>x</button>{message ? <p className="hub-message">{message}</p> : !data ? <p className="muted">Loading coach profile...</p> : <><header className="public-profile-header"><CoachAvatar profile={data} size={82}/><div><span className="eyebrow">COACH PROFILE</span><h2>{data.display_name || data.username}</h2><p>@{data.username}</p></div></header><div className="career-record-grid"><article><strong>{record.wins || 0}</strong><span>Wins</span></article><article><strong>{record.losses || 0}</strong><span>Losses</span></article><article><strong>{record.games || 0}</strong><span>Matches</span></article><article><strong>{Number(record.win_percentage || 0).toFixed(1)}%</strong><span>Win rate</span></article></div><h3>Favorite six</h3><div className="public-profile-favorites">{data.favorite_pokemon?.length ? data.favorite_pokemon.map((name) => <FavoritePokemon key={name} name={name}/>) : <p className="muted">No favorite Pokémon selected yet.</p>}</div><h3>Badges</h3><div className="profile-badge-grid">{data.badges?.length ? data.badges.map((badge) => <article key={`${badge.code}-${badge.subject}`} className="profile-badge earned"><span>{badge.icon}</span><div><strong>{badge.subject ? `${badge.subject} ${badge.name}` : badge.name}</strong><small>{badge.description}</small></div></article>) : <p className="muted">No badges earned yet.</p>}</div></>}</section></div>;
}
