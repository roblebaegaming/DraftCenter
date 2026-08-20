"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

const PROFILE_COPY = {
  en: {
    viewProfile: (name) => `View ${name}'s coach profile`,
    close: "Close coach profile",
    eyebrow: "COACH PROFILE",
    loading: "Loading coach profile...",
    wins: "Wins",
    losses: "Losses",
    matches: "Matches",
    winRate: "Win rate",
    favorites: "Favorite six",
    noFavorites: "No favorite Pokémon selected yet.",
    badges: "Badges",
    noBadges: "No badges earned yet.",
  },
  it: {
    viewProfile: (name) => `Visualizza il profilo allenatore di ${name}`,
    close: "Chiudi il profilo dell'allenatore",
    eyebrow: "PROFILO ALLENATORE",
    loading: "Caricamento del profilo...",
    wins: "Vittorie",
    losses: "Sconfitte",
    matches: "Partite",
    winRate: "Percentuale vittorie",
    favorites: "Sei Pokémon preferiti",
    noFavorites: "Nessun Pokémon preferito selezionato.",
    badges: "Medaglie",
    noBadges: "Nessuna medaglia ottenuta.",
  },
  es: {
    viewProfile: (name) => `Ver el perfil de entrenador de ${name}`,
    close: "Cerrar el perfil del entrenador",
    eyebrow: "PERFIL DEL ENTRENADOR",
    loading: "Cargando el perfil...",
    wins: "Victorias",
    losses: "Derrotas",
    matches: "Partidas",
    winRate: "Porcentaje de victorias",
    favorites: "Seis Pokémon favoritos",
    noFavorites: "Todavía no ha seleccionado Pokémon favoritos.",
    badges: "Insignias",
    noBadges: "Todavía no ha conseguido insignias.",
  },
  fr: {
    viewProfile: (name) => `Voir le profil de coach de ${name}`,
    close: "Fermer le profil du coach",
    eyebrow: "PROFIL DU COACH",
    loading: "Chargement du profil…",
    wins: "Victoires",
    losses: "Défaites",
    matches: "Matchs",
    winRate: "Taux de victoire",
    favorites: "Six Pokémon favoris",
    noFavorites: "Aucun Pokémon favori sélectionné.",
    badges: "Badges",
    noBadges: "Aucun badge obtenu.",
  },
  de: {
    viewProfile: (name) => `Trainerprofil von ${name} ansehen`, close: "Trainerprofil schließen", eyebrow: "TRAINERPROFIL", loading: "Trainerprofil wird geladen...", wins: "Siege", losses: "Niederlagen", matches: "Kämpfe", winRate: "Siegquote", favorites: "Sechs Lieblings-Pokémon", noFavorites: "Noch keine Lieblings-Pokémon ausgewählt.", badges: "Abzeichen", noBadges: "Noch keine Abzeichen verdient.",
  },
  ja: {
    viewProfile: (name) => `${name}のトレーナープロフィールを見る`, close: "トレーナープロフィールを閉じる", eyebrow: "トレーナープロフィール", loading: "プロフィールを読み込み中...", wins: "勝利", losses: "敗北", matches: "対戦", winRate: "勝率", favorites: "お気に入りの6匹", noFavorites: "お気に入りのポケモンはまだ選ばれていません。", badges: "バッジ", noBadges: "獲得したバッジはまだありません。",
  },
  ko: {
    viewProfile: (name) => `${name}의 트레이너 프로필 보기`, close: "트레이너 프로필 닫기", eyebrow: "트레이너 프로필", loading: "트레이너 프로필 불러오는 중...", wins: "승", losses: "패", matches: "경기", winRate: "승률", favorites: "좋아하는 포켓몬 6마리", noFavorites: "선택한 좋아하는 포켓몬이 없습니다.", badges: "배지", noBadges: "획득한 배지가 없습니다.",
  },
};

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
  return <article className="public-profile-favorite">{image ? <img src={image} alt={name} /> : <span className="profile-photo-placeholder">{name[0]}</span>}<strong>{name}</strong></article>;
}

export function CoachAvatar({ profile, size = 36 }) {
  const name = profile?.display_name || profile?.username || "Coach";
  return profile?.avatar_url
    ? <img className="coach-avatar" src={profile.avatar_url} alt={`${name} profile`} style={{ width:size, height:size }} />
    : <span className="coach-avatar coach-avatar-fallback" aria-hidden="true" style={{ width:size, height:size }}>{name[0].toUpperCase()}</span>;
}

export function CoachProfileButton({ username, displayName, avatarUrl, onOpen, compact = false, stopPropagation = false, locale = "en" }) {
  if (!username && !displayName) return <span>Coach</span>;
  const name = displayName || username;
  const copy = PROFILE_COPY[locale] || PROFILE_COPY.en;
  return <button
    type="button"
    className={`coach-profile-button${compact ? " is-compact" : ""}`}
    aria-label={copy.viewProfile(name)}
    onClick={(event) => {
      if (stopPropagation) {
        event.preventDefault();
        event.stopPropagation();
      }
      onOpen(username || displayName);
    }}
  ><CoachAvatar profile={{ username, display_name:displayName, avatar_url:avatarUrl }} size={compact ? 28 : 34}/><span><strong>{displayName || username}</strong>{username && <small>@{username}</small>}</span></button>;
}

export default function PublicCoachProfile({ identity, profile, locale = "en", onClose }) {
  const [data, setData] = useState(profile || null);
  const [message, setMessage] = useState("");
  const copy = PROFILE_COPY[locale] || PROFILE_COPY.en;

  useEffect(() => {
    if (profile) {
      setData(profile);
      setMessage("");
      return;
    }
    if (!identity) return;
    let active = true;
    setData(null);
    setMessage("");
    const supabase = createClient();
    supabase.rpc("get_public_coach_profile", { p_identity:identity }).then(({ data:next, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      else setData(next);
    });
    return () => { active = false; };
  }, [identity, profile]);

  useEffect(() => {
    if (!identity && !profile) return;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [identity, profile, onClose]);

  if (!identity && !profile) return null;
  const record = data?.record;
  const titleId = "public-coach-profile-title";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="tools-modal public-profile-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="modal-close" aria-label={copy.close} onClick={onClose}>×</button>
      {message ? <p className="hub-message">{message}</p> : !data ? <p className="muted">{copy.loading}</p> : <>
        <header className="public-profile-header"><CoachAvatar profile={data} size={82}/><div><span className="eyebrow">{copy.eyebrow}</span><h2 id={titleId}>{data.display_name || data.username}</h2>{data.username && <p>@{data.username}</p>}</div></header>
        {record && <div className="career-record-grid"><article><strong>{record.wins || 0}</strong><span>{copy.wins}</span></article><article><strong>{record.losses || 0}</strong><span>{copy.losses}</span></article><article><strong>{record.games || 0}</strong><span>{copy.matches}</span></article><article><strong>{Number(record.win_percentage || 0).toFixed(1)}%</strong><span>{copy.winRate}</span></article></div>}
        <h3>{copy.favorites}</h3>
        <div className="public-profile-favorites">{data.favorite_pokemon?.length ? data.favorite_pokemon.map((name) => <FavoritePokemon key={name} name={name}/>) : <p className="muted">{copy.noFavorites}</p>}</div>
        <h3>{copy.badges}</h3>
        <div className="profile-badge-grid">{data.badges?.length ? data.badges.map((badge) => <article key={`${badge.code}-${badge.subject}`} className="profile-badge earned"><span>{badge.icon}</span><div><strong>{badge.subject ? `${badge.subject} ${badge.name}` : badge.name}</strong><small>{badge.description}</small></div></article>) : <p className="muted">{copy.noBadges}</p>}</div>
      </>}
    </section>
  </div>;
}
