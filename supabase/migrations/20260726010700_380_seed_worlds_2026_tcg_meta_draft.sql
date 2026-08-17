-- Seed the reviewed 2026 TCG Worlds Meta Picks archetype taxonomy.
-- Migration 378 must be applied first. This migration deliberately leaves the
-- event in draft until an exact official Worlds format source confirms that
-- the Pitch Black Standard pool is eligible. It does not open entries.

begin;

lock table public.worlds_meta_events in row exclusive mode;
lock table public.worlds_meta_options in share row exclusive mode;
lock table public.worlds_meta_entries in share row exclusive mode;

do $preflight$
declare
  v_event public.worlds_meta_events%rowtype;
begin
  select * into v_event
  from public.worlds_meta_events
  where id = '2026-tcg-champion-decks';

  if not found
    or v_event.discipline <> 'tcg'
    or v_event.prediction_type <> 'deck_archetype'
    or v_event.status <> 'draft'
    or v_event.picks_required <> 5
    or v_event.result_size <> 64
    or not v_event.requires_featured_pick
    or v_event.current_result_snapshot_id is not null then
    raise exception 'Migration 380 requires the untouched staged TCG Meta Picks event from migration 378.';
  end if;

  if exists (select 1 from public.worlds_meta_options where event_id = '2026-tcg-champion-decks')
     or exists (select 1 from public.worlds_meta_entries where event_id = '2026-tcg-champion-decks')
     or exists (select 1 from public.worlds_meta_result_snapshots where event_id = '2026-tcg-champion-decks') then
    raise exception 'Migration 380 only seeds a zero-option, zero-entry, zero-result TCG event.';
  end if;
end;
$preflight$;

insert into public.worlds_meta_options (
  event_id, option_key, display_name, group_label, is_selectable, source_order,
  source_url, source_checked_at, metadata
) values
  ('2026-tcg-champion-decks', 'tcg-dragapult-ex', 'Dragapult', 'Trending #1 · current community data', true, 1, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"dragapult-ex","source_rank":1,"deck_count":3769,"share_pct":17.9476,"wins":9305,"losses":8217,"ties":280,"win_rate_pct":52.2694,"source_kind":"limitless-combined-archetype","community_trend_rank":1}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-excadrill-ex', 'Mega Excadrill', 'Trending #2 · current community data', true, 2, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-excadrill-ex","source_rank":2,"deck_count":1631,"share_pct":7.7667,"wins":3854,"losses":3775,"ties":66,"win_rate_pct":50.0845,"source_kind":"limitless-combined-archetype","community_trend_rank":2}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-festival-lead', 'Festival Lead', 'Trending #3 · current community data', true, 3, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"festival-lead","source_rank":3,"deck_count":1454,"share_pct":6.9238,"wins":3488,"losses":3138,"ties":90,"win_rate_pct":51.9357,"source_kind":"limitless-combined-archetype","community_trend_rank":3}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-n-zoroark', 'N''s Zoroark', 'Trending #4 · current community data', true, 4, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"n-zoroark","source_rank":4,"deck_count":1124,"share_pct":5.3524,"wins":2437,"losses":2568,"ties":63,"win_rate_pct":48.086,"source_kind":"limitless-combined-archetype","community_trend_rank":4}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-alakazam-meg', 'Alakazam', 'Trending #5 · current community data', true, 5, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"alakazam-meg","source_rank":5,"deck_count":1094,"share_pct":5.2095,"wins":2763,"losses":2314,"ties":81,"win_rate_pct":53.5673,"source_kind":"limitless-combined-archetype","community_trend_rank":5}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-slowking-scr', 'Slowking', 'Trending #6 · current community data', true, 6, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"slowking-scr","source_rank":6,"deck_count":1067,"share_pct":5.081,"wins":2657,"losses":2296,"ties":75,"win_rate_pct":52.8441,"source_kind":"limitless-combined-archetype","community_trend_rank":6}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-marnie-grimmsnarl-ex', 'Marnie''s Grimmsnarl', 'Trending #7 · current community data', true, 7, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"marnie-grimmsnarl-ex","source_rank":7,"deck_count":1033,"share_pct":4.919,"wins":2377,"losses":2157,"ties":45,"win_rate_pct":51.9109,"source_kind":"limitless-combined-archetype","community_trend_rank":7}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-dhelmise-pbl', 'Dhelmise', 'Trending #8 · current community data', true, 8, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"dhelmise-pbl","source_rank":8,"deck_count":915,"share_pct":4.3571,"wins":1991,"losses":2141,"ties":56,"win_rate_pct":47.5406,"source_kind":"limitless-combined-archetype","community_trend_rank":8}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-toucannon-pbl', 'Toucannon', 'Trending #9 · current community data', true, 9, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"toucannon-pbl","source_rank":10,"deck_count":817,"share_pct":3.8905,"wins":1687,"losses":1822,"ties":34,"win_rate_pct":47.615,"source_kind":"limitless-combined-archetype","community_trend_rank":9}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-lucario-ex', 'Mega Lucario', 'Trending #10 · current community data', true, 10, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-lucario-ex","source_rank":11,"deck_count":645,"share_pct":3.0714,"wins":1495,"losses":1510,"ties":20,"win_rate_pct":49.4215,"source_kind":"limitless-combined-archetype","community_trend_rank":10}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-ogerpon-meganium', 'Ogerpon Meganium', 'Trending #11 · current community data', true, 11, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"ogerpon-meganium","source_rank":12,"deck_count":387,"share_pct":1.8429,"wins":945,"losses":889,"ties":22,"win_rate_pct":50.9159,"source_kind":"limitless-combined-archetype","community_trend_rank":11}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-greninja-ex', 'Mega Greninja', 'Trending #12 · current community data', true, 12, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-greninja-ex","source_rank":13,"deck_count":373,"share_pct":1.7762,"wins":631,"losses":835,"ties":14,"win_rate_pct":42.6351,"source_kind":"limitless-combined-archetype","community_trend_rank":12}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-raging-bolt-ex', 'Raging Bolt', 'Pitch Black community field', true, 13, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"raging-bolt-ex","source_rank":14,"deck_count":308,"share_pct":1.4667,"wins":792,"losses":667,"ties":18,"win_rate_pct":53.6222,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-absol-box', 'Mega Absol Box', 'Pitch Black community field', true, 14, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-absol-box","source_rank":15,"deck_count":301,"share_pct":1.4333,"wins":655,"losses":678,"ties":17,"win_rate_pct":48.5185,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-rockets-honchkrow', 'Rocket''s Honchkrow', 'Pitch Black community field', true, 15, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"rockets-honchkrow","source_rank":16,"deck_count":294,"share_pct":1.4,"wins":623,"losses":646,"ties":11,"win_rate_pct":48.6719,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-starmie-ex', 'Mega Starmie', 'Pitch Black community field', true, 16, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-starmie-ex","source_rank":17,"deck_count":294,"share_pct":1.4,"wins":625,"losses":660,"ties":10,"win_rate_pct":48.2625,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-chandelure-ex', 'Mega Chandelure', 'Pitch Black community field', true, 17, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-chandelure-ex","source_rank":18,"deck_count":286,"share_pct":1.3619,"wins":529,"losses":666,"ties":13,"win_rate_pct":43.7914,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-basic-box-m', 'Basic Box', 'Pitch Black community field', true, 18, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"basic-box-m","source_rank":19,"deck_count":284,"share_pct":1.3524,"wins":744,"losses":621,"ties":14,"win_rate_pct":53.9521,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-beedrill-ex-cri', 'Beedrill', 'Pitch Black community field', true, 19, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"beedrill-ex-cri","source_rank":20,"deck_count":274,"share_pct":1.3048,"wins":604,"losses":604,"ties":14,"win_rate_pct":49.4272,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-cynthia-garchomp-ex', 'Cynthia''s Garchomp', 'Pitch Black community field', true, 20, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"cynthia-garchomp-ex","source_rank":21,"deck_count":261,"share_pct":1.2429,"wins":629,"losses":566,"ties":19,"win_rate_pct":51.8122,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-toxtricity-pfl', 'Toxtricity', 'Pitch Black community field', true, 21, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"toxtricity-pfl","source_rank":22,"deck_count":238,"share_pct":1.1333,"wins":459,"losses":533,"ties":14,"win_rate_pct":45.6262,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-kangaskhan-bouffalant', 'Kangaskhan Bouffalant', 'Pitch Black community field', true, 22, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"kangaskhan-bouffalant","source_rank":23,"deck_count":184,"share_pct":0.8762,"wins":410,"losses":392,"ties":9,"win_rate_pct":50.5549,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-manectric-ex-meg', 'Mega Manectric', 'Pitch Black community field', true, 23, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-manectric-ex-meg","source_rank":24,"deck_count":178,"share_pct":0.8476,"wins":294,"losses":416,"ties":2,"win_rate_pct":41.2921,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-rocket-mewtwo-ex', 'Rocket''s Mewtwo', 'Pitch Black community field', true, 24, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"rocket-mewtwo-ex","source_rank":25,"deck_count":160,"share_pct":0.7619,"wins":310,"losses":373,"ties":7,"win_rate_pct":44.9275,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-crustle-dri', 'Crustle', 'Pitch Black community field', true, 25, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"crustle-dri","source_rank":26,"deck_count":155,"share_pct":0.7381,"wins":330,"losses":357,"ties":5,"win_rate_pct":47.6879,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-ethan-typhlosion', 'Ethan''s Typhlosion', 'Pitch Black community field', true, 26, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"ethan-typhlosion","source_rank":27,"deck_count":151,"share_pct":0.719,"wins":289,"losses":347,"ties":2,"win_rate_pct":45.2978,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-ceruledge-ex', 'Ceruledge', 'Pitch Black community field', true, 27, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"ceruledge-ex","source_rank":28,"deck_count":146,"share_pct":0.6952,"wins":275,"losses":301,"ties":3,"win_rate_pct":47.4957,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-venusaur-ex', 'Mega Venusaur', 'Pitch Black community field', true, 28, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-venusaur-ex","source_rank":29,"deck_count":144,"share_pct":0.6857,"wins":279,"losses":354,"ties":5,"win_rate_pct":43.7304,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-greninja-ex', 'Greninja', 'Pitch Black community field', true, 29, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"greninja-ex","source_rank":30,"deck_count":139,"share_pct":0.6619,"wins":349,"losses":308,"ties":0,"win_rate_pct":53.1202,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-hops-trevenant', 'Hop''s Trevenant', 'Pitch Black community field', true, 30, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"hops-trevenant","source_rank":31,"deck_count":132,"share_pct":0.6286,"wins":290,"losses":315,"ties":5,"win_rate_pct":47.541,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-darkrai-ex', 'Mega Darkrai', 'Pitch Black community field', true, 31, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-darkrai-ex","source_rank":32,"deck_count":124,"share_pct":0.5905,"wins":199,"losses":297,"ties":2,"win_rate_pct":39.9598,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-lopunny-ex', 'Mega Lopunny', 'Pitch Black community field', true, 32, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-lopunny-ex","source_rank":33,"deck_count":116,"share_pct":0.5524,"wins":247,"losses":242,"ties":6,"win_rate_pct":49.899,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-blaziken-ex-jtg', 'Blaziken', 'Pitch Black community field', true, 33, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"blaziken-ex-jtg","source_rank":34,"deck_count":100,"share_pct":0.4762,"wins":199,"losses":204,"ties":5,"win_rate_pct":48.7745,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-cinccino-ex', 'Cinccino', 'Pitch Black community field', true, 34, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"cinccino-ex","source_rank":35,"deck_count":90,"share_pct":0.4286,"wins":237,"losses":219,"ties":1,"win_rate_pct":51.86,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-wailord-ex-pbl', 'Wailord', 'Pitch Black community field', true, 35, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"wailord-ex-pbl","source_rank":36,"deck_count":76,"share_pct":0.3619,"wins":127,"losses":174,"ties":0,"win_rate_pct":42.1927,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-lillie-clefairy', 'Lillie''s Clefairy', 'Pitch Black community field', true, 36, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"lillie-clefairy","source_rank":37,"deck_count":76,"share_pct":0.3619,"wins":175,"losses":175,"ties":5,"win_rate_pct":49.2958,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-stevens-metagross', 'Steven''s Metagross', 'Pitch Black community field', true, 37, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"stevens-metagross","source_rank":38,"deck_count":67,"share_pct":0.319,"wins":151,"losses":146,"ties":6,"win_rate_pct":49.835,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-archaludon-ex', 'Archaludon', 'Pitch Black community field', true, 38, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"archaludon-ex","source_rank":39,"deck_count":65,"share_pct":0.3095,"wins":87,"losses":146,"ties":1,"win_rate_pct":37.1795,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-froslass-munkidori', 'Froslass Munkidori', 'Pitch Black community field', true, 39, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"froslass-munkidori","source_rank":40,"deck_count":64,"share_pct":0.3048,"wins":112,"losses":138,"ties":1,"win_rate_pct":44.6215,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-froslass-ex', 'Mega Froslass', 'Pitch Black community field', true, 40, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-froslass-ex","source_rank":41,"deck_count":60,"share_pct":0.2857,"wins":100,"losses":146,"ties":4,"win_rate_pct":40,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-abomasnow-ex', 'Mega Abomasnow', 'Pitch Black community field', true, 41, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-abomasnow-ex","source_rank":42,"deck_count":57,"share_pct":0.2714,"wins":98,"losses":145,"ties":7,"win_rate_pct":39.2,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-zygarde-ex', 'Mega Zygarde', 'Pitch Black community field', true, 42, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-zygarde-ex","source_rank":43,"deck_count":55,"share_pct":0.2619,"wins":143,"losses":149,"ties":2,"win_rate_pct":48.6395,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-okidogi-twm', 'Okidogi', 'Pitch Black community field', true, 43, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"okidogi-twm","source_rank":44,"deck_count":53,"share_pct":0.2524,"wins":100,"losses":112,"ties":4,"win_rate_pct":46.2963,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-flareon-ex', 'Flareon', 'Pitch Black community field', true, 44, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"flareon-ex","source_rank":45,"deck_count":52,"share_pct":0.2476,"wins":103,"losses":102,"ties":2,"win_rate_pct":49.7585,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-dragonite-ex', 'Mega Dragonite', 'Pitch Black community field', true, 45, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-dragonite-ex","source_rank":46,"deck_count":52,"share_pct":0.2476,"wins":117,"losses":124,"ties":0,"win_rate_pct":48.5477,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-erikas-victreebel', 'Erika''s Victreebel', 'Pitch Black community field', true, 46, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"erikas-victreebel","source_rank":47,"deck_count":49,"share_pct":0.2333,"wins":84,"losses":112,"ties":3,"win_rate_pct":42.2111,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-metagross-cri', 'Metagross', 'Pitch Black community field', true, 47, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"metagross-cri","source_rank":48,"deck_count":46,"share_pct":0.219,"wins":103,"losses":116,"ties":1,"win_rate_pct":46.8182,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-mega-charizard-x-ex', 'Mega Charizard X', 'Pitch Black community field', true, 48, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"mega-charizard-x-ex","source_rank":49,"deck_count":45,"share_pct":0.2143,"wins":56,"losses":118,"ties":4,"win_rate_pct":31.4607,"source_kind":"limitless-combined-archetype"}'::jsonb),
  ('2026-tcg-champion-decks', 'tcg-doublade-por', 'Doublade', 'Pitch Black community field', true, 49, 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1', '2026-08-11', '{"taxonomy_key":"doublade-por","source_rank":50,"deck_count":44,"share_pct":0.2095,"wins":75,"losses":100,"ties":1,"win_rate_pct":42.6136,"source_kind":"limitless-combined-archetype"}'::jsonb);

do $verify_pool$
begin
  if (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks') <> 49
     or (select count(distinct option_key) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks') <> 49
     or (select count(distinct source_order) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks') <> 49
     or (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and is_selectable) <> 49 then
    raise exception 'The reviewed TCG taxonomy must contain exactly 49 unique selectable archetypes.';
  end if;

  if exists (
    select 1 from public.worlds_meta_options
    where event_id = '2026-tcg-champion-decks'
      and (source_url <> 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1' or source_checked_at <> '2026-08-11'::date)
  ) then
    raise exception 'Every TCG Meta Picks option must retain the reviewed taxonomy source and check date.';
  end if;

  if (select count(*) from public.worlds_meta_options where event_id = '2026-tcg-champion-decks' and metadata ? 'community_trend_rank') <> 12 then
    raise exception 'The beginner TCG Trending cohort must contain exactly 12 archetypes.';
  end if;
end;
$verify_pool$;

update public.worlds_meta_events
set option_source_url = 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1',
    source_checked_at = '2026-08-11'::date,
    scoring_rules = scoring_rules || '{"taxonomy_version":"pitch-black-combined-2026-08-11","taxonomy_option_count":49,"taxonomy_source_row_count":50,"taxonomy_source_sha256":"1916a9719e6a7e6c8292aef9ef890aa770521ca6a84cf129ad02e2e793c957c8","community_trending_option_count":12,"community_tournament_count":292,"community_player_count":21000,"community_match_count":47509,"community_status":"unofficial-community-tournament-observations","opening_gate":"awaiting-exact-official-worlds-format-confirmation","official_rotation_url":"https://community.pokemon.com/en-us/discussion/23170/letter-to-the-community-march-19-2026","official_pitch_black_url":"https://www.pokemon.com/us/news/the-pokemon-tcg-mega-evolution-pitch-black-expansion-is-available-now","official_worlds_competitor_url":"https://worlds.pokemon.com/en-us/competitors/"}'::jsonb,
    updated_at = now()
where id = '2026-tcg-champion-decks';

do $verify_draft$
begin
  if not exists (
    select 1 from public.worlds_meta_events
    where id = '2026-tcg-champion-decks'
      and status = 'draft'
      and option_source_url = 'https://play.limitlesstcg.com/decks/?format=standard&rotation=2026&set=PBL&combine=1'
      and (scoring_rules ->> 'taxonomy_option_count')::integer = 49
      and scoring_rules ->> 'opening_gate' = 'awaiting-exact-official-worlds-format-confirmation'
  ) then
    raise exception 'The reviewed TCG taxonomy did not remain safely draft-locked.';
  end if;
end;
$verify_draft$;

commit;
