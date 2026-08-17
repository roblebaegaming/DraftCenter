-- Restore public reference rows that a schema-only Production baseline cannot contain.
begin;

insert into public.badge_catalog
  (code, name, description, icon, category, thresholds, tier_names, created_at)
values
  ('career_wins', 'Career Winner', 'Win matches across all DraftCenter leagues.', '🏅', 'competition', array[1, 10, 100]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('community_regular', 'Community Regular', 'Complete all four Daily Games on many total days.', '📅', 'community', array[10, 25, 100]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('daily_streak', 'Daily Games Streak', 'Complete all four Daily Games on consecutive days.', '🔥', 'community', array[3, 7, 30]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('daily_trio', 'Daily Games', 'Complete Pokémon Connections, the Poll, Draft Bracket, and Pokémon Quiz on the same local day.', '🎉', 'community', array[1, 7, 30]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('draft_day_hero', 'Draft Day Hero', 'Receive the most Draft Day Hero votes.', '🎯', 'drafting', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('generation_veteran', 'Generation Veteran', 'Draft Pokémon from the same generation across your career.', '🧭', 'drafting', array[10, 25, 50]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('giant_slayer', 'Giant Slayer', 'Earn a season Giant Slayer award.', '⚔️', 'competition', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('league_champion', 'League Champion', 'Win league championships across DraftCenter.', '🏆', 'competition', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('perfect_season', 'Perfect Season', 'Complete an undefeated regular season.', '💯', 'competition', array[1, 3, 5]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('playoff_qualifier', 'Playoff Regular', 'Qualify for playoffs across DraftCenter leagues.', '⭐', 'competition', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('pokemon_loyalist', 'Pokémon Loyalist', 'Draft the same Pokémon across your DraftCenter career.', '💛', 'drafting', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('prediction_champion', 'Prediction Champion', 'Finish a season atop a prediction leaderboard.', '🔮', 'community', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('trade_master', 'Trade Master', 'Finish a season as one of its most active traders.', '🔄', 'management', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz),
  ('waiver_wizard', 'Waiver Wire Wizard', 'Lead a season in successful free-agent moves.', '🧙', 'management', array[1, 5, 10]::integer[], array['Bronze', 'Silver', 'Gold']::text[], '2026-07-24 02:09:03.677013+00'::timestamptz)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  thresholds = excluded.thresholds,
  tier_names = excluded.tier_names,
  created_at = excluded.created_at;

insert into public.pokemon_game_versions
  (game_key, display_name, release_order, mechanics_note, data_status, source_label, source_url, updated_at, generation, version_group_key, source_commit, source_row_count, pokemon_count, move_count, coverage_note)
values
  ('pokemon-champions', 'Pokemon Champions', 400, 'Competitive battle reference. Import only verified Champions move data.', 'retired', 'Official Pokemon Champions data', null, '2026-08-07 16:03:43.820526+00'::timestamptz, null, null, null, 0, 0, 0, 'Legacy alias; use champions.')
on conflict (game_key) do update set
  display_name = excluded.display_name,
  release_order = excluded.release_order,
  mechanics_note = excluded.mechanics_note,
  data_status = excluded.data_status,
  source_label = excluded.source_label,
  source_url = excluded.source_url,
  updated_at = excluded.updated_at,
  generation = excluded.generation,
  version_group_key = excluded.version_group_key,
  source_commit = excluded.source_commit,
  source_row_count = excluded.source_row_count,
  pokemon_count = excluded.pokemon_count,
  move_count = excluded.move_count,
  coverage_note = excluded.coverage_note;

do $$
begin
  if (select count(*) from public.badge_catalog) <> 17 then
    raise exception 'Badge reference catalog must contain 17 rows.';
  end if;
  if (select count(*) from public.pokemon_game_versions) <> 33 then
    raise exception 'Game-version reference catalog must contain 33 rows.';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
