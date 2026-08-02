export async function loadAllLeaguePokemon(supabase, leagueId, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("league_pokemon")
      .select("id, source_key, cost, is_drafted, is_restricted, is_mega")
      .eq("league_id", leagueId)
      .order("source_key", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
