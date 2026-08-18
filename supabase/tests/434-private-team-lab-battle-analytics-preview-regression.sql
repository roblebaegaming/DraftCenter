-- Preview-only validation matrix for migration 434.
-- Run only in an isolated Supabase Preview project.

begin;

do $validation$
declare
  v_report jsonb := '{
    "version":3,
    "my_pokemon":[],
    "opponent_pokemon":[],
    "battle_notes":"",
    "turn_log":{"version":2,"current_game":1,"current_turn":1,"active_my_pokemon":"","active_opponent_pokemon":"","events":[]},
    "series":{"version":2,"best_of":1,"games":[{"game":1,"result":"win","my_lead":"","opponent_lead":"","plan":"","adjustments":"","replay_url":"https://replay.pokemonshowdown.com/gen9vgc2026regi-123","elo_before":1500,"elo_after":1524}]},
    "battle_state":{"version":1,"weather":"","terrain":"","my_side":{"hazards":{"stealth_rock":false,"spikes":0,"toxic_spikes":0,"sticky_web":false},"screens":{"reflect":false,"light_screen":false,"aurora_veil":false},"pokemon":[]},"opponent_side":{"hazards":{"stealth_rock":false,"spikes":0,"toxic_spikes":0,"sticky_web":false},"screens":{"reflect":false,"light_screen":false,"aurora_veil":false},"pokemon":[]}}
  }'::jsonb;
  v_v2_report jsonb;
  v_v1_report jsonb;
begin
  if not public.is_valid_team_lab_battle_report(v_report) then
    raise exception 'A valid v3 Battle Room report was rejected.';
  end if;

  v_v2_report := jsonb_set(
    jsonb_set(v_report, '{version}', '2'::jsonb),
    '{series}',
    jsonb_build_object(
      'version', 1,
      'best_of', 1,
      'games', jsonb_build_array(
        (v_report -> 'series' -> 'games' -> 0) - 'replay_url' - 'elo_before' - 'elo_after'
      )
    )
  );
  if not public.is_valid_team_lab_battle_report(v_v2_report) then
    raise exception 'A released v2 Battle Room report became invalid.';
  end if;

  v_v1_report := (v_v2_report - 'series' - 'battle_state')
    || jsonb_build_object(
      'version', 1,
      'turn_log', (v_v2_report -> 'turn_log') || jsonb_build_object('version', 1)
    );
  if not public.is_valid_team_lab_battle_report(v_v1_report) then
    raise exception 'A released v1 Battle Room report became invalid.';
  end if;

  if public.is_valid_team_lab_battle_report(
       jsonb_set(v_report, '{series,games,0,replay_url}', '"http://example.com/replay"'::jsonb)
     ) then
    raise exception 'A non-HTTPS replay URL was accepted.';
  end if;

  if public.is_valid_team_lab_battle_report(
       jsonb_set(v_report, '{series,games,0,elo_after}', '100001'::jsonb)
     ) then
    raise exception 'An out-of-range rating was accepted.';
  end if;

  if public.is_valid_team_lab_battle_report(
       jsonb_set(v_report, '{series,games,0,elo_before}', '1500.5'::jsonb)
     ) then
    raise exception 'A fractional rating was accepted.';
  end if;

  if public.is_valid_team_lab_battle_report(
       jsonb_set(v_report, '{series,games,0}', (v_report -> 'series' -> 'games' -> 0) - 'elo_after')
     ) then
    raise exception 'A v3 game missing a required rating key was accepted.';
  end if;

  if has_function_privilege('anon', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_series_v2(jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'Migration 434 validator grants regressed.';
  end if;
end;
$validation$;

rollback;

