import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

export function createPublicServerClient() {
  const { url, key } = publicSupabaseConfig();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getPublicLeague(slug) {
  try {
    const client = createPublicServerClient();
    if (!client || !slug) return null;
    const { data, error } = await client.rpc("get_public_league", { p_slug: slug });
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function getPublicLeagueCards() {
  try {
    const client = createPublicServerClient();
    if (!client) return [];
    const { data, error } = await client.rpc("get_public_league_cards");
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}

export async function getPublicPokemonDraftProfile(pokemon) {
  try {
    const client = createPublicServerClient();
    if (!client || !pokemon) return null;
    const { data, error } = await client.rpc("get_public_pokemon_draft_profile", { p_pokemon: pokemon });
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function getPublicPokemonCompetitiveProfile(pokemonKey) {
  try {
    const client = createPublicServerClient();
    if (!client || !pokemonKey) return [];
    const { data, error } = await client.rpc("get_public_pokemon_competitive_profile", { p_pokemon_key: pokemonKey });
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}

export async function getPublicPokemonTournamentProfile(pokemonKey) {
  try {
    const client = createPublicServerClient();
    if (!client || !pokemonKey) return [];
    const { data, error } = await client.rpc("get_public_pokemon_tournament_profile", { p_pokemon_key: pokemonKey });
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}
