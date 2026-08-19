-- Preview-only lifecycle matrix for the six-Pokemon Regulation M-B organizer
-- demo. Run only in an isolated Supabase Preview branch; all fixtures roll back.

begin;

create temp table dc_tournament_demo_440_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_payload jsonb;
  v_tournament_id uuid;
  v_event_id uuid;
  v_league_id uuid;
  v_revision bigint;
  v_unauthorized boolean := false;
begin
  if not has_function_privilege(
       'authenticated', 'public.complete_tournament_demo_top_cut(uuid,bigint)', 'execute'
     )
     or has_function_privilege(
       'anon', 'public.complete_tournament_demo_top_cut(uuid,bigint)', 'execute'
     )
     or has_function_privilege(
       'authenticated', 'public.enforce_tournament_demo_event_defaults()', 'execute'
     )
     or has_function_privilege(
       'authenticated', 'public.configure_tournament_demo_draft_room()', 'execute'
     ) then
    raise exception 'The upgraded organizer demo grants do not match the RPC-only boundary.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'grants', 'ok', true));

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values
    (v_owner, 'Six Pokemon Demo Commissioner'),
    (v_other, 'Unauthorized Demo Viewer')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.pokemon_catalogue(
    id, display_name, primary_type, base_stat_total, is_mega, is_restricted
  )
  select
    'dc-demo-440-' || legal.ordinality,
    legal.value,
    'normal',
    500,
    legal.value like 'Mega %',
    false
  from jsonb_array_elements_text($regmb$["Venusaur","Charizard","Blastoise","Beedrill","Pidgeot","Arbok","Pikachu","Raichu","Clefable","Ninetales","Vileplume","Arcanine","Alakazam","Machamp","Victreebel","Slowbro","Gengar","Kangaskhan","Starmie","Pinsir","Tauros","Gyarados","Ditto","Vaporeon","Jolteon","Flareon","Aerodactyl","Snorlax","Dragonite","Meganium","Typhlosion","Feraligatr","Ariados","Ampharos","Azumarill","Politoed","Espeon","Umbreon","Slowking","Forretress","Steelix","Qwilfish","Scizor","Heracross","Skarmory","Houndoom","Tyranitar","Sceptile","Blaziken","Swampert","Pelipper","Gardevoir","Sableye","Mawile","Aggron","Medicham","Manectric","Sharpedo","Camerupt","Torkoal","Altaria","Milotic","Castform","Banette","Chimecho","Absol","Glalie","Metagross","Torterra","Infernape","Empoleon","Staraptor","Luxray","Roserade","Rampardos","Bastiodon","Lopunny","Spiritomb","Garchomp","Lucario","Hippowdon","Toxicroak","Abomasnow","Weavile","Rhyperior","Leafeon","Glaceon","Gliscor","Mamoswine","Gallade","Froslass","Rotom","Serperior","Emboar","Samurott","Watchog","Liepard","Simisage","Simisear","Simipour","Musharna","Excadrill","Audino","Conkeldurr","Scolipede","Whimsicott","Krookodile","Scrafty","Cofagrigus","Garbodor","Zoroark","Reuniclus","Vanilluxe","Emolga","Eelektross","Chandelure","Beartic","Stunfisk","Golurk","Hydreigon","Volcarona","Chesnaught","Delphox","Greninja","Diggersby","Talonflame","Vivillon","Pyroar","Florges","Pangoro","Furfrou","Meowstic","Aegislash","Aromatisse","Slurpuff","Malamar","Barbaracle","Dragalge","Clawitzer","Heliolisk","Tyrantrum","Aurorus","Sylveon","Hawlucha","Dedenne","Goodra","Klefki","Trevenant","Gourgeist","Avalugg","Noivern","Decidueye","Incineroar","Primarina","Toucannon","Crabominable","Toxapex","Mudsdale","Araquanid","Salazzle","Tsareena","Oranguru","Passimian","Mimikyu","Drampa","Kommo-o","Corviknight","Flapple","Appletun","Sandaconda","Polteageist","Hatterene","Grimmsnarl","Mr. Rime","Runerigus","Alcremie","Falinks","Morpeko","Dragapult","Wyrdeer","Kleavor","Basculegion","Sneasler","Overqwil","Meowscarada","Skeledirge","Quaquaval","Maushold","Garganacl","Armarouge","Ceruledge","Mega Venusaur","Mega Charizard X","Mega Charizard Y","Mega Blastoise","Mega Beedrill","Mega Pidgeot","Mega Alakazam","Mega Gengar","Mega Kangaskhan","Mega Pinsir","Mega Gyarados","Mega Aerodactyl","Mega Ampharos","Mega Steelix","Mega Scizor","Mega Heracross","Mega Houndoom","Mega Tyranitar","Mega Sceptile","Mega Blaziken","Mega Swampert","Mega Gardevoir","Mega Sableye","Mega Mawile","Mega Aggron","Mega Medicham","Mega Manectric","Mega Sharpedo","Mega Camerupt","Mega Altaria","Mega Banette","Mega Absol","Mega Glalie","Mega Metagross","Mega Lopunny","Mega Garchomp","Mega Lucario","Mega Abomasnow","Mega Gallade","Mega Audino","Mega Slowbro","Archaludon","Mega Floette","Kingambit","Sinistcha","Farigiraf","Mega Delphox","Mega Froslass","Gholdengo","Mega Raichu Y","Alolan Ninetales","Annihilape","Mega Dragonite","Mega Staraptor","Hisuian Arcanine","Mega Pyroar","Mega Scovillain","Mega Starmie","Basculegion-Female","Houndstone","Mega Glimmora","Mega Meganium","Mega Scrafty","Glimmora","Mega Clefable","Mega Excadrill","Mega Greninja","Palafin","Paldean Tauros (Water)","Rotom-Wash","Tinkaton","Mega Raichu X","Mega Skarmory","Rotom-Heat","Floette-Eternal","Hisuian Typhlosion","Mega Golurk","Mega Hawlucha","Rotom-Mow","Hisuian Zoroark","Lycanroc-Dusk","Mega Barbaracle","Mega Chandelure","Mega Chimecho","Mega Eelektross","Mega Feraligatr","Mega Meowstic","Paldean Tauros (Fire)","Mega Chesnaught","Mega Crabominable","Mega Dragalge","Mega Drampa","Mega Emboar","Espathra","Galarian Slowbro","Mega Falinks","Mega Victreebel","Orthworm","Rotom-Frost","Galarian Slowking","Hisuian Goodra","Hydrapple","Alolan Raichu","Hisuian Samurott","Mega Scolipede","Bellibolt","Hisuian Decidueye","Scovillain","Lycanroc-Midday","Mega Malamar","Paldean Tauros","Rotom-Fan","Lycanroc-Midnight","Meowstic-Female","Galarian Stunfisk","Hisuian Avalugg"]$regmb$::jsonb)
    with ordinality legal(value, ordinality)
  on conflict (id) do nothing;

  perform pg_temp.dc_auth(v_owner);
  select public.create_demo_auction_draft_first_tournament(
    'Regulation M-B Six Pokemon Organizer Demo',
    'Synthetic migration 440 lifecycle',
    'private',
    3,
    32,
    'Five Swiss rounds seed a Top 8 playoff.',
    4,
    120,
    30,
    30,
    10,
    false,
    'swiss'
  ) into v_payload;
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;

  if not exists (
    select 1
    from public.draft_tournament_events event
    where event.id = v_event_id
      and event.phase = 'check-in'
      and event.roster_size = 6
      and event.top_cut_size = 8
  ) then
    raise exception 'Organizer demo defaults did not enforce six Pokemon and a Top 8 playoff.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'six_pokemon_defaults', 'ok', true, 'roster_size', 6, 'top_cut_size', 8));

  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_auction_draft_tournament_field(v_tournament_id, v_revision);
  select draft_league_id, revision into v_league_id, v_revision
  from public.draft_tournament_events where id = v_event_id;
  if (select state #>> '{settings,regulationId}'
      from public.league_state_snapshots where league_id = v_league_id) <> 'reg-mb'
     or (select (state #>> '{settings,megaCap}')::integer
         from public.league_state_snapshots where league_id = v_league_id) <> 1 then
    raise exception 'The organizer demo draft room did not retain Regulation M-B and its Mega cap.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'regulation_room', 'ok', true, 'regulation_id', 'reg-mb', 'mega_cap', 1));

  perform public.fill_tournament_demo_auction(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if (select count(*)
      from jsonb_array_elements(
        (select state -> 'rosters' from public.league_state_snapshots where league_id = v_league_id)
      ) roster(value)
      where jsonb_array_length(roster.value) = 6) <> 32
     or (select count(distinct mon.value ->> 'id')
         from public.league_state_snapshots snapshot
         cross join lateral jsonb_array_elements(snapshot.state -> 'rosters') roster(value)
         cross join lateral jsonb_array_elements(roster.value) mon(value)
         where snapshot.league_id = v_league_id) <> 192
     or (select count(*)
         from public.league_state_snapshots snapshot
         cross join lateral jsonb_array_elements(snapshot.state -> 'rosters') roster(value)
         where snapshot.league_id = v_league_id
           and (select count(*) from jsonb_array_elements(roster.value) mon(value)
                where (mon.value ->> 'isMega')::boolean) = 1) <> 32
     or exists (
       select 1
       from public.league_state_snapshots snapshot
       cross join lateral jsonb_array_elements(snapshot.state -> 'rosters') roster(value)
       where snapshot.league_id = v_league_id
         and (select sum((mon.value ->> 'cost')::integer)
              from jsonb_array_elements(roster.value) mon(value)) > 120
     )
     or (select count(distinct (mon.value ->> 'cost')::integer)
         from public.league_state_snapshots snapshot
         cross join lateral jsonb_array_elements(snapshot.state -> 'rosters') roster(value)
         cross join lateral jsonb_array_elements(roster.value) mon(value)
         where snapshot.league_id = v_league_id) < 4 then
    raise exception 'The synthetic auction did not create 32 unique priced six-Pokemon rosters with one Mega each.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'priced_regulation_rosters', 'ok', true, 'teams', 32, 'pokemon', 192));

  perform public.lock_draft_tournament_rosters(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if (select count(*)
      from public.roster_entries entry
      join public.teams team on team.id = entry.team_id
      where team.league_id = v_league_id and entry.released_at is null) <> 192 then
    raise exception 'Roster lock did not materialize all 192 auction purchases.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'roster_lock', 'ok', true, 'entries', 192));

  perform public.complete_tournament_demo_swiss(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if not exists (
    select 1
    from public.draft_tournament_events event
    where event.id = v_event_id
      and event.phase = 'top-cut'
      and event.current_swiss_round = 5
      and event.top_cut_size = 8
  )
     or (select count(*) from public.tournament_matches match
         where match.tournament_id = v_tournament_id and match.bracket_stage = 'swiss') <> 80
     or (select count(*) from public.draft_tournament_standing_snapshots standing
         where standing.event_id = v_event_id) <> 160
     or (select count(*) from public.draft_tournament_top_cut_entries cut
         where cut.event_id = v_event_id) <> 8
     or (select count(*) from public.tournament_matches match
         where match.tournament_id = v_tournament_id and match.bracket_stage = 'top-cut') <> 7 then
    raise exception 'Swiss did not seed the final Top 8 playoff bracket.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'swiss_to_top_cut', 'ok', true, 'swiss_matches', 80, 'top_cut_entries', 8, 'playoff_matches', 7));

  perform pg_temp.dc_auth(v_other);
  begin
    perform public.complete_tournament_demo_top_cut(v_tournament_id, v_revision);
  exception when others then
    if sqlerrm not ilike '%only the owner%' then raise; end if;
    v_unauthorized := true;
  end;
  if not v_unauthorized then raise exception 'A non-owner completed the demo playoff.'; end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'authorization', 'ok', true));

  perform pg_temp.dc_auth(v_owner);
  perform public.complete_tournament_demo_top_cut(v_tournament_id, v_revision);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  if not exists (
    select 1
    from public.draft_tournament_events event
    join public.tournaments tournament on tournament.id = event.tournament_id
    where event.id = v_event_id
      and event.phase = 'complete'
      and event.completed_at is not null
      and tournament.status = 'complete'
  )
     or (select count(*) from public.tournament_matches match
         where match.tournament_id = v_tournament_id
           and match.bracket_stage = 'top-cut'
           and match.status = 'complete') <> 7 then
    raise exception 'The owner fast-forward did not complete the seven-match Top 8 playoff.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'playoff_completion', 'ok', true, 'matches', 7));

  perform public.reset_tournament_demo(v_tournament_id, v_revision);
  if not exists (
    select 1
    from public.draft_tournament_events event
    where event.id = v_event_id
      and event.phase = 'check-in'
      and event.roster_size = 6
      and event.top_cut_size = 8
      and event.draft_league_id is null
  ) then
    raise exception 'Reset did not retain the upgraded organizer demo defaults.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'reset', 'ok', true, 'roster_size', 6, 'top_cut_size', 8));

  delete from public.tournaments where id = v_tournament_id;
  delete from public.profiles where id in (v_owner, v_other);
  delete from auth.users where id in (v_owner, v_other);
  if exists (select 1 from public.tournaments where id = v_tournament_id)
     or exists (select 1 from auth.users where id in (v_owner, v_other)) then
    raise exception 'Synthetic migration 440 fixtures were not fully removed.';
  end if;
  insert into dc_tournament_demo_440_results values
    (jsonb_build_object('check', 'cleanup', 'ok', true));
end;
$validation$;

select result from dc_tournament_demo_440_results order by result ->> 'check';

rollback;
