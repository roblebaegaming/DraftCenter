-- Repair badge catalog text that was previously saved with mojibake.
-- chr() keeps the SQL safe even when copied through a mismatched text encoding.

update public.badge_catalog
set
  name = 'Daily Three',
  description = 'Complete the Poll, Draft Bracket, and Pok' || chr(233) || 'mon Quiz on the same local day.',
  icon = chr(127881)
where code = 'daily_trio';

update public.badge_catalog set icon = chr(128293) where code = 'daily_streak';
update public.badge_catalog set icon = chr(128197) where code = 'community_regular';
update public.badge_catalog set icon = chr(127941) where code = 'career_wins';

update public.badge_catalog
set
  name = 'Pok' || chr(233) || 'mon Loyalist',
  description = 'Draft the same Pok' || chr(233) || 'mon across your DraftCenter career.',
  icon = chr(128155)
where code = 'pokemon_loyalist';

update public.badge_catalog
set
  description = 'Draft Pok' || chr(233) || 'mon from the same generation across your career.',
  icon = chr(129517)
where code = 'generation_veteran';

update public.badge_catalog set icon = chr(127942) where code = 'league_champion';
update public.badge_catalog set icon = chr(11088) where code = 'playoff_qualifier';
update public.badge_catalog set icon = chr(128302) where code = 'prediction_champion';
update public.badge_catalog set icon = chr(127919) where code = 'draft_day_hero';
update public.badge_catalog set icon = chr(128260) where code = 'trade_master';
update public.badge_catalog set icon = chr(129497) where code = 'waiver_wizard';
update public.badge_catalog set icon = chr(128175) where code = 'perfect_season';
update public.badge_catalog set icon = chr(9876) || chr(65039) where code = 'giant_slayer';
